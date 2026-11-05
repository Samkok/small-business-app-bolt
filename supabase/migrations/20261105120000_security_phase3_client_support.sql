-- Security audit phase 3, server side of the 2.12 client (docs/security-fix-plan.md section 5).
--
-- 1. restore_sale_stock: void/return put stock back through one guarded function instead of a
--    direct products.current_stock write from the client.
-- 2. check_invitee: the team-invite lookup answers "exists / already a member / role" without
--    handing out the account's user id.
-- 3. Push tokens live in user_push_tokens only: the triggers consult that table, the register
--    RPC stops copying tokens into user_profiles.expo_push_token (which co-admins can read),
--    and the column is emptied for every account that already has a device row.

-- 1. restore_sale_stock --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_sale_stock(p_sale_id uuid, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_sale record;
  v_line record;
  v_item record;
  v_factor integer;
  v_base integer;
  v_before integer;
  v_after integer;
  v_restored jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.require_not_anon();
  IF v_caller IS NULL AND COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'No lines to restore';
  END IF;

  SELECT s.id, s.business_id, s.cart_id, s.status INTO v_sale
  FROM sales s WHERE s.id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Any member of the sale's business may void or return in it (same rule as the sale itself)
  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM businesses WHERE id = v_sale.business_id AND owner_user_id = v_caller
    UNION ALL
    SELECT 1 FROM user_business_roles WHERE business_id = v_sale.business_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'You are not a member of this business' USING ERRCODE = '42501';
  END IF;

  FOR v_line IN
    SELECT (l->>'product_id')::uuid AS product_id, (l->>'quantity')::integer AS quantity
    FROM jsonb_array_elements(p_lines) l
  LOOP
    IF v_line.product_id IS NULL OR v_line.quantity IS NULL OR v_line.quantity < 1 THEN
      RAISE EXCEPTION 'Invalid line';
    END IF;

    -- The line must be something this sale actually sold, in the unit it was sold in
    SELECT ci.quantity, ci.unit_id INTO v_item
    FROM cart_items ci
    WHERE ci.cart_id = v_sale.cart_id AND ci.product_id = v_line.product_id
    ORDER BY ci.quantity DESC
    LIMIT 1;
    IF v_item.quantity IS NULL THEN
      RAISE EXCEPTION 'Product % was not part of this sale', v_line.product_id;
    END IF;
    IF v_line.quantity > v_item.quantity THEN
      RAISE EXCEPTION 'Cannot restore more than was sold for product %', v_line.product_id;
    END IF;

    v_factor := 1;
    IF v_item.unit_id IS NOT NULL THEN
      SELECT COALESCE(conversion_factor_to_base, 1) INTO v_factor FROM units WHERE id = v_item.unit_id;
    END IF;
    v_base := v_line.quantity * COALESCE(v_factor, 1);

    SELECT COALESCE(current_stock, 0) INTO v_before
    FROM products WHERE id = v_line.product_id AND business_id = v_sale.business_id FOR UPDATE;
    IF v_before IS NULL THEN
      RAISE EXCEPTION 'Product not found in this business';
    END IF;
    v_after := v_before + v_base;

    UPDATE products SET current_stock = v_after, updated_at = now() WHERE id = v_line.product_id;
    INSERT INTO product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
    VALUES (v_line.product_id, v_caller, v_sale.business_id, 'current_stock', v_before::text, v_after::text);

    v_restored := v_restored || jsonb_build_object('product_id', v_line.product_id, 'before', v_before, 'after', v_after);
  END LOOP;

  RETURN jsonb_build_object('sale_id', p_sale_id, 'restored', v_restored);
END;
$$;
REVOKE ALL ON FUNCTION public.restore_sale_stock(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_sale_stock(uuid, jsonb) TO authenticated, service_role;

-- 2. check_invitee --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_invitee(p_email text, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_profile record;
  v_role text;
BEGIN
  PERFORM public.require_not_anon();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'check_invitee needs a signed-in user' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_business_roles WHERE user_id = v_caller AND business_id = p_business_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only business admins can invite users' USING ERRCODE = '42501';
  END IF;

  DELETE FROM email_lookup_log WHERE created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM email_lookup_log WHERE user_id = v_caller AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Too many lookups, try again later' USING ERRCODE = '42501';
  END IF;
  INSERT INTO email_lookup_log (user_id) VALUES (v_caller);

  SELECT up.user_id, up.full_name INTO v_profile
  FROM user_profiles up WHERE lower(up.email) = lower(trim(p_email)) LIMIT 1;
  IF v_profile.user_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT r.role INTO v_role FROM user_business_roles r
  WHERE r.user_id = v_profile.user_id AND r.business_id = p_business_id;

  RETURN jsonb_build_object(
    'exists', true,
    'full_name', v_profile.full_name,
    'is_member', v_role IS NOT NULL,
    'role', v_role
  );
END;
$$;
REVOKE ALL ON FUNCTION public.check_invitee(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_invitee(text, uuid) TO authenticated, service_role;

-- 3. Push tokens: device rows are the source of truth -----------------------------------------
CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_platform text DEFAULT NULL::text, p_device_name text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  PERFORM public.require_not_anon();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'register_push_token needs a signed-in user' USING ERRCODE = '42501';
  END IF;
  IF p_token !~ '^(ExponentPushToken|ExpoPushToken|PushToken)\[[^\]]+\]$' THEN
    RAISE EXCEPTION 'Invalid push token';
  END IF;

  -- A device token belongs to one account at a time: the account that signed in last on it
  DELETE FROM public.user_push_tokens WHERE token = p_token AND user_id <> v_uid;

  INSERT INTO public.user_push_tokens (token, user_id, platform, device_name, app_version)
  VALUES (p_token, v_uid, p_platform, p_device_name, p_app_version)
  ON CONFLICT (token) DO UPDATE
    SET platform = COALESCE(EXCLUDED.platform, user_push_tokens.platform),
        device_name = COALESCE(EXCLUDED.device_name, user_push_tokens.device_name),
        app_version = COALESCE(EXCLUDED.app_version, user_push_tokens.app_version),
        updated_at = now(),
        last_seen_at = now();

  -- The profile copy is retired: once an account has a device row it carries no token there
  UPDATE public.user_profiles SET expo_push_token = NULL
  WHERE expo_push_token IS NOT NULL AND (user_id = v_uid OR expo_push_token = p_token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_push_notification_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
has_token     boolean;
unread_count  int;
request_id    bigint;
supabase_url  text;
anon_key      text;
push_secret   text;
BEGIN
SELECT decrypted_secret INTO supabase_url
FROM vault.decrypted_secrets
WHERE name = 'supabase_url';

SELECT decrypted_secret INTO anon_key
FROM vault.decrypted_secrets
WHERE name = 'supabase_anon_key';

SELECT decrypted_secret INTO push_secret
FROM vault.decrypted_secrets
WHERE name = 'push_trigger_secret';

IF supabase_url IS NULL OR anon_key IS NULL OR push_secret IS NULL THEN
RAISE WARNING 'Push notification credentials not found in vault';
RETURN NEW;
END IF;

-- Devices registered through register_push_token, or the legacy profile token of an account
-- that has not opened a build that registers per device yet
SELECT EXISTS (
  SELECT 1 FROM user_push_tokens WHERE user_id = NEW.user_id
  UNION ALL
  SELECT 1 FROM user_profiles WHERE user_id = NEW.user_id AND expo_push_token LIKE 'ExponentPushToken[%]'
) INTO has_token;

IF NOT has_token THEN
RAISE LOG 'No push token for user %', NEW.user_id;
RETURN NEW;
END IF;

SELECT COUNT(*) INTO unread_count
FROM notifications
WHERE user_id = NEW.user_id AND is_read = false;

BEGIN
SELECT INTO request_id
net.http_post(
url := supabase_url || '/functions/v1/send-push-notification',
headers := jsonb_build_object(
'Content-Type', 'application/json',
-- the anon key only gets the request past the gateway; X-Push-Secret is what authorises it
'Authorization', 'Bearer ' || anon_key,
'X-Push-Secret', push_secret
),
body := jsonb_build_object(
'targetUserId', NEW.user_id,
'title', NEW.title,
'body', NEW.message,
'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
'notification_id', NEW.id,
'type', NEW.type
),
'badge', unread_count,
'priority', CASE
WHEN NEW.type IN ('sale_voided', 'low_stock_alert', 'web_order_received') THEN 'high'
ELSE 'default'
END
)
);

RAISE LOG 'Push notification HTTP request initiated: request_id=%, user=%, type=%',
request_id, NEW.user_id, NEW.type;

EXCEPTION
WHEN OTHERS THEN
RAISE WARNING 'Failed to initiate push notification HTTP request: % (SQLSTATE: %)',
SQLERRM, SQLSTATE;
END;

RETURN NEW;

EXCEPTION
WHEN OTHERS THEN
RAISE WARNING 'Failed in push notification trigger: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
RETURN NEW;
END;
$function$;

-- The subscription push trigger still speaks the retired contract (expoPushToken in the body,
-- settings from current_setting that are never configured), so it never sends anything.
-- Drop it rather than keep a second reader of the profile token; the webhook already inserts a
-- notifications row for every status change, and that row is what sends the push.
DROP TRIGGER IF EXISTS on_subscription_push_notification ON public.user_subscriptions;
DROP FUNCTION IF EXISTS public.send_subscription_push_notification();

-- Accounts that already register per device carry no token on the profile any more
UPDATE public.user_profiles SET expo_push_token = NULL
WHERE expo_push_token IS NOT NULL
  AND user_id IN (SELECT user_id FROM public.user_push_tokens);
