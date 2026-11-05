-- Security audit phase 1 (docs/security-fix-plan.md section 3).
-- Server-side only. Every installed build (<= 2.11) keeps working: nothing here refuses a
-- write the app actually makes; direct stock writes are recorded, not refused, until 2.12
-- moves void/return onto an RPC.
--
-- "Direct API write" below means a statement running as the PostgREST roles `authenticated`
-- or `anon`. Inside a SECURITY DEFINER function current_user is the function owner, so the
-- app's RPCs and the service role pass these guards unchanged.

-- 1. complete_sale_atomic: the cart and its products must belong to p_business_id ---------
CREATE OR REPLACE FUNCTION public.complete_sale_atomic(p_cart_id uuid, p_customer_id uuid, p_business_id uuid, p_total_amount numeric, p_payment_method text, p_sale_date timestamp with time zone DEFAULT now(), p_notes text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid, p_sale_discount_type text DEFAULT NULL::text, p_sale_discount_value numeric DEFAULT NULL::numeric, p_sale_discount_amount numeric DEFAULT NULL::numeric, p_subtotal_before_discount numeric DEFAULT NULL::numeric, p_delivery_cost numeric DEFAULT NULL::numeric, p_currency_id uuid DEFAULT NULL::uuid, p_exchange_rate_at_sale numeric DEFAULT 1, p_payment_status text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_sale_id uuid;
v_cart_status text;
v_item record;
v_conversion_factor integer;
v_base_quantity integer;
v_rows_updated integer;
v_created_by_name text;
v_caller uuid;
BEGIN
v_caller := auth.uid();

IF v_caller IS NULL AND COALESCE(auth.role(), '') = 'anon' THEN
RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
END IF;

IF v_caller IS NOT NULL THEN
IF p_created_by IS NOT NULL AND p_created_by != v_caller THEN
RAISE EXCEPTION 'Cannot create a sale on behalf of another user';
END IF;

IF NOT EXISTS (
SELECT 1 FROM businesses WHERE id = p_business_id AND owner_user_id = v_caller
UNION ALL
SELECT 1 FROM user_business_roles WHERE business_id = p_business_id AND user_id = v_caller
) THEN
RAISE EXCEPTION 'You are not a member of this business';
END IF;
END IF;

IF p_payment_status IS NOT NULL AND p_payment_status NOT IN ('paid', 'cod') THEN
RAISE EXCEPTION 'Unknown payment status: %', p_payment_status;
END IF;

-- The cart must belong to the business the caller was checked against
SELECT status INTO v_cart_status
FROM carts
WHERE id = p_cart_id AND business_id = p_business_id
FOR UPDATE;

IF v_cart_status IS NULL THEN
RAISE EXCEPTION 'Cart not found: %', p_cart_id;
END IF;

IF v_cart_status = 'completed' THEN
SELECT id INTO v_sale_id FROM sales WHERE cart_id = p_cart_id LIMIT 1;
RETURN v_sale_id;
END IF;

SELECT full_name INTO v_created_by_name
FROM user_profiles WHERE user_id = p_created_by;

INSERT INTO sales (
id, cart_id, customer_id, business_id, total_amount,
payment_method, status, sale_date, notes, created_by, created_by_name,
created_by_business_id, sale_discount_type, sale_discount_value,
sale_discount_amount, subtotal_before_discount, delivery_cost,
currency_id, exchange_rate_at_sale, payment_status
) VALUES (
gen_random_uuid(), p_cart_id, p_customer_id, p_business_id,
p_total_amount, p_payment_method, 'completed',
COALESCE(p_sale_date, now()), p_notes, p_created_by, v_created_by_name,
p_business_id, p_sale_discount_type, p_sale_discount_value,
p_sale_discount_amount, p_subtotal_before_discount, p_delivery_cost,
p_currency_id, p_exchange_rate_at_sale, p_payment_status
)
RETURNING id INTO v_sale_id;

FOR v_item IN
SELECT ci.product_id, ci.quantity, ci.unit_id
FROM cart_items ci WHERE ci.cart_id = p_cart_id
LOOP
IF v_item.unit_id IS NOT NULL THEN
SELECT COALESCE(conversion_factor_to_base, 1) INTO v_conversion_factor
FROM units WHERE id = v_item.unit_id;
v_base_quantity := v_item.quantity * COALESCE(v_conversion_factor, 1);
ELSE
v_base_quantity := v_item.quantity;
END IF;

-- Same business as the cart: a cart line can never move stock of another tenant
UPDATE products
SET current_stock = current_stock - v_base_quantity, updated_at = now()
WHERE id = v_item.product_id AND business_id = p_business_id AND current_stock >= v_base_quantity;

GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
IF v_rows_updated = 0 THEN
RAISE EXCEPTION 'Insufficient stock for product %', v_item.product_id;
END IF;
END LOOP;

UPDATE carts SET status = 'completed', updated_at = now() WHERE id = p_cart_id;
RETURN v_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_sale_atomic(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, text, numeric, numeric, numeric, numeric, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_sale_atomic(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, text, numeric, numeric, numeric, numeric, uuid, numeric, text) TO authenticated, service_role;

-- 2. businesses: ownership and plan state are never written directly through the API --------
CREATE OR REPLACE FUNCTION public.guard_business_state_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.access_state  IS DISTINCT FROM OLD.access_state
    OR NEW.archived_at   IS DISTINCT FROM OLD.archived_at) THEN
    RAISE EXCEPTION 'owner_user_id, access_state and archived_at cannot be changed directly'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_business_state_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_business_state_columns ON public.businesses;
CREATE TRIGGER trg_guard_business_state_columns
  BEFORE UPDATE OF owner_user_id, access_state, archived_at ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_state_columns();

-- 3. user_business_roles: membership changes only through the RPCs; the owner row is fixed ---
DROP POLICY IF EXISTS "Business admins can update user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can delete user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business owners and admins can insert user roles" ON public.user_business_roles;

CREATE OR REPLACE FUNCTION public.guard_owner_role_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.businesses WHERE id = OLD.business_id;
  -- Business already gone (cascade from a business delete): nothing to protect
  IF v_owner IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF OLD.user_id = v_owner AND (
       TG_OP = 'DELETE'
    OR NEW.role <> 'admin'
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.business_id IS DISTINCT FROM OLD.business_id) THEN
    RAISE EXCEPTION 'The business owner''s membership cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.guard_owner_role_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_owner_role_row ON public.user_business_roles;
CREATE TRIGGER trg_guard_owner_role_row
  BEFORE UPDATE OR DELETE ON public.user_business_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_role_row();

CREATE OR REPLACE FUNCTION public.invite_user_to_business(business_id_param uuid, user_email_param text, role_param text DEFAULT 'staff'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    inviter_is_admin boolean;
    invited_user_id uuid;
BEGIN
    IF role_param NOT IN ('admin', 'staff') THEN
        RAISE EXCEPTION 'Unknown role: %', role_param;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE user_id = auth.uid()
        AND business_id = business_id_param
        AND role = 'admin'
    ) INTO inviter_is_admin;

    IF NOT inviter_is_admin THEN
        RAISE EXCEPTION 'Only business admins can invite users';
    END IF;

    SELECT id INTO invited_user_id
    FROM auth.users
    WHERE lower(email) = lower(trim(user_email_param));

    IF invited_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email_param;
    END IF;

    -- An existing membership is never rewritten here: roles change through change_user_business_role
    IF EXISTS (SELECT 1 FROM public.user_business_roles
               WHERE user_id = invited_user_id AND business_id = business_id_param) THEN
        RAISE EXCEPTION 'User is already a member of this business';
    END IF;

    INSERT INTO public.user_business_roles (user_id, business_id, role, created_at, updated_at)
    VALUES (invited_user_id, business_id_param, role_param, now(), now());

    RETURN true;
END;
$function$;

-- 4. Sales limit trigger follows the owner's effective plan (expiry and grace), like the app --
CREATE OR REPLACE FUNCTION public.check_sales_subscription_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_owner_user_id uuid;
v_access_state text;
v_business_sales_count integer;
v_effective_limit integer;
v_tier text;
BEGIN
SELECT owner_user_id, access_state INTO v_owner_user_id, v_access_state
FROM businesses
WHERE id = NEW.business_id;

IF v_owner_user_id IS NULL THEN
RAISE EXCEPTION 'Business with id % not found', NEW.business_id;
END IF;

IF v_access_state = 'read_only_sales' THEN
RAISE EXCEPTION 'BUSINESS_READ_ONLY: This business is read-only under the owner''s current plan. Choose it as an active business or upgrade to continue.'
USING HINT = 'businesses.access_state is read_only_sales';
END IF;

IF v_access_state = 'owner_disabled' THEN
RAISE EXCEPTION 'BUSINESS_OWNER_DISABLED: The owner has disabled this business.'
USING HINT = 'businesses.access_state is owner_disabled';
END IF;

-- The same rule as can_user_create_sale: an expired plan past its grace period is free
SELECT ep.tier INTO v_tier FROM public.effective_plan(v_owner_user_id) ep;

IF COALESCE(v_tier, 'free') = 'free' THEN
SELECT sales_count INTO v_business_sales_count
FROM user_sales_counts
WHERE user_id = v_owner_user_id AND business_id = NEW.business_id;

v_effective_limit := get_effective_sales_limit(v_owner_user_id);

IF COALESCE(v_business_sales_count, 0) >= v_effective_limit THEN
RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: This business has reached the free plan limit of % sales. Please upgrade to continue.', v_effective_limit
USING HINT = 'Business has reached the maximum number of sales allowed on the free tier';
END IF;
END IF;

RETURN NEW;
END;
$function$;

-- 5. reconciliation_log is operator data: no API role reads it, no realtime broadcast --------
DROP POLICY IF EXISTS "System admins can view reconciliation logs" ON public.reconciliation_log;
REVOKE ALL ON TABLE public.reconciliation_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.recent_reconciliation_history FROM PUBLIC, anon, authenticated;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reconciliation_log;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_sales_count_history;

-- 6. business-images bucket: same limits as the other two buckets, uploads under businesses/ --
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']
 WHERE id = 'business-images';

DROP POLICY IF EXISTS "Authenticated users can upload business images" ON storage.objects;
CREATE POLICY "Authenticated users can upload business images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-images' AND (storage.foldername(name))[1] = 'businesses');

-- 7. Realtime DELETE/UPDATE payloads carry keys, not whole rows ------------------------------
-- user_business_roles' primary key is (user_id, business_id), so the app's removed-from-
-- business handler (reads old.business_id) keeps working under DEFAULT.
ALTER TABLE public.businesses          REPLICA IDENTITY DEFAULT;
ALTER TABLE public.user_profiles       REPLICA IDENTITY DEFAULT;
ALTER TABLE public.user_subscriptions  REPLICA IDENTITY DEFAULT;
ALTER TABLE public.user_sales_counts   REPLICA IDENTITY DEFAULT;
ALTER TABLE public.user_business_roles REPLICA IDENTITY DEFAULT;

-- 8. Business creation limit: one owner at a time, counted with full visibility -------------
CREATE OR REPLACE FUNCTION public.enforce_business_creation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
v_owner_id uuid;
v_current_count integer;
v_max_allowed integer;
BEGIN
v_owner_id := NEW.owner_user_id;
IF v_owner_id IS NULL THEN
v_owner_id := auth.uid();
END IF;

IF v_owner_id IS NULL THEN
RETURN NEW;
END IF;

-- Serialise concurrent creations by the same owner
PERFORM pg_advisory_xact_lock(hashtext('business_creation:' || v_owner_id::text));

SELECT COUNT(*) INTO v_current_count
FROM businesses
WHERE owner_user_id = v_owner_id;

SELECT COALESCE(max_owned_businesses, 1) INTO v_max_allowed
FROM user_subscriptions
WHERE user_id = v_owner_id
ORDER BY updated_at DESC
LIMIT 1;

IF v_max_allowed IS NULL THEN
v_max_allowed := 1;
END IF;

IF v_current_count >= v_max_allowed THEN
RAISE EXCEPTION 'Business creation limit reached. Current: %, Max: %', v_current_count, v_max_allowed;
END IF;

RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_business_creation_limit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_business(business_name_param text, owner_user_id_param uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
new_business_id uuid;
v_can_create boolean;
v_tier text;
v_max_businesses integer;
v_current_count integer;
BEGIN
  PERFORM public.require_self_or_service(owner_user_id_param);
  PERFORM pg_advisory_xact_lock(hashtext('business_creation:' || owner_user_id_param::text));
v_can_create := can_user_create_business(owner_user_id_param);

IF NOT v_can_create THEN
SELECT tier, max_owned_businesses
INTO v_tier, v_max_businesses
FROM get_user_subscription_tier(owner_user_id_param);

v_current_count := get_user_owned_business_count(owner_user_id_param);

RAISE EXCEPTION 'BUSINESS_LIMIT_REACHED: You have reached the maximum number of businesses (%) allowed for your % subscription. Please upgrade to create more businesses.',
v_max_businesses, v_tier
USING HINT = 'Current business count: ' || v_current_count;
END IF;

INSERT INTO businesses (
owner_user_id,
business_name,
created_at,
updated_at
) VALUES (
owner_user_id_param,
business_name_param,
now(),
now()
)
RETURNING id INTO new_business_id;

INSERT INTO user_business_roles (
user_id,
business_id,
role,
created_at,
updated_at
) VALUES (
owner_user_id_param,
new_business_id,
'admin',
now(),
now()
);

INSERT INTO customers (
name,
business_id,
is_system_customer,
phone,
created_at,
updated_at
) VALUES (
'Guest Customer',
new_business_id,
true,
NULL,
now(),
now()
);

RETURN new_business_id;
END;
$function$;

-- 9. set_read_only_businesses: service only, also inside the body ---------------------------
CREATE OR REPLACE FUNCTION public.set_read_only_businesses(p_user_id uuid, p_max_active_businesses integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_total_count integer;
v_active_count integer;
v_non_disabled_count integer;
BEGIN
PERFORM public.require_service_caller();

SELECT COUNT(*)
INTO v_total_count
FROM businesses
WHERE owner_user_id = p_user_id;

SELECT COUNT(*)
INTO v_non_disabled_count
FROM businesses
WHERE owner_user_id = p_user_id
AND access_state != 'owner_disabled';

SELECT COUNT(*)
INTO v_active_count
FROM businesses
WHERE owner_user_id = p_user_id
AND access_state = 'active';

IF v_non_disabled_count <= p_max_active_businesses THEN
UPDATE businesses
SET access_state = 'active'
WHERE owner_user_id = p_user_id
AND access_state = 'read_only_sales';

UPDATE user_profiles
SET must_choose_businesses = false
WHERE user_id = p_user_id;
ELSE
UPDATE businesses
SET access_state = 'read_only_sales'
WHERE owner_user_id = p_user_id
AND access_state != 'owner_disabled';

UPDATE businesses
SET access_state = 'active'
WHERE id IN (
SELECT id
FROM businesses
WHERE owner_user_id = p_user_id
AND access_state != 'owner_disabled'
ORDER BY created_at ASC
LIMIT p_max_active_businesses
);

UPDATE user_profiles
SET must_choose_businesses = true
WHERE user_id = p_user_id;
END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_read_only_businesses(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_read_only_businesses(uuid, integer) TO service_role;

-- 10. Email lookup: only business admins, 30 per hour each ----------------------------------
CREATE TABLE IF NOT EXISTS public.email_lookup_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_lookup_log_user_time ON public.email_lookup_log (user_id, created_at DESC);
ALTER TABLE public.email_lookup_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_lookup_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
v_profile RECORD;
v_caller uuid := auth.uid();
BEGIN
  PERFORM public.require_not_anon();

  -- Only someone who can actually invite (an admin somewhere) may look up accounts
  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_business_roles WHERE user_id = v_caller AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only business admins can look up accounts' USING ERRCODE = '42501';
  END IF;

  IF v_caller IS NOT NULL THEN
    DELETE FROM public.email_lookup_log WHERE created_at < now() - interval '1 day';
    IF (SELECT count(*) FROM public.email_lookup_log
         WHERE user_id = v_caller AND created_at > now() - interval '1 hour') >= 30 THEN
      RAISE EXCEPTION 'Too many lookups, try again later' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.email_lookup_log (user_id) VALUES (v_caller);
  END IF;

SELECT user_id, full_name, email
INTO v_profile
FROM user_profiles
WHERE lower(email) = lower(trim(p_email))
LIMIT 1;

IF NOT FOUND THEN
RETURN jsonb_build_object('exists', false);
END IF;

RETURN jsonb_build_object(
'exists', true,
'user_id', v_profile.user_id,
'full_name', v_profile.full_name
);
END;
$function$;

-- 11. create_web_order: abuse limits before the stock comparison, per-address daily caps -----
CREATE OR REPLACE FUNCTION public.create_web_order(p_slug text, p_customer_name text, p_customer_phone text, p_items jsonb, p_address text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_ip_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_business RECORD;
  v_name text := NULLIF(trim(regexp_replace(COALESCE(p_customer_name, ''), '\s+', ' ', 'g')), '');
  v_phone text := menu_normalize_phone(p_customer_phone);
  v_address text := NULLIF(trim(COALESCE(p_address, '')), '');
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_ip_key text := COALESCE(p_ip_hash, 'unknown');
  v_lines jsonb;
  v_line RECORD;
  v_line_count int;
  v_matched_count int;
  v_customer_id uuid;
  v_cart_id uuid;
  v_order_ref text;
  v_token uuid := gen_random_uuid();
  v_total numeric;
  v_item_count int;
  v_cart_notes text;
  v_recipient RECORD;
  v_preference RECORD;
BEGIN
  -- ---- business -----------------------------------------------------------
  SELECT b.id, b.business_name, b.owner_user_id
  INTO v_business
  FROM businesses b
  WHERE b.menu_slug = lower(trim(p_slug))
    AND b.menu_enabled
    AND b.archived_at IS NULL
    AND COALESCE(b.access_state, 'active') = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WEB_ORDER:menu_not_found';
  END IF;

  -- ---- input --------------------------------------------------------------
  IF v_name IS NULL OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_name';
  END IF;
  IF length(v_phone) < 8 OR length(v_phone) > 15 THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_phone';
  END IF;
  IF char_length(COALESCE(v_address, '')) > 300 OR char_length(COALESCE(v_note, '')) > 500 THEN
    RAISE EXCEPTION 'WEB_ORDER:text_too_long';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_items';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('product_id', s.product_id, 'quantity', s.quantity))
  INTO v_lines
  FROM (
    SELECT (i->>'product_id')::uuid AS product_id,
           SUM((i->>'quantity')::int)::int AS quantity
    FROM jsonb_array_elements(p_items) i
    GROUP BY 1
  ) s;

  v_line_count := COALESCE(jsonb_array_length(v_lines), 0);
  IF v_line_count < 1 OR v_line_count > 50 THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_items';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int) WHERE quantity IS NULL OR quantity < 1 OR quantity > 999) THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_quantity';
  END IF;

  -- ---- abuse limits (before anything that reads tenant state) --------------
  IF EXISTS (SELECT 1 FROM web_order_blocked_phones bp
             WHERE bp.business_id = v_business.id AND bp.phone = v_phone) THEN
    RAISE EXCEPTION 'WEB_ORDER:blocked';
  END IF;

  IF (SELECT count(*) FROM web_order_log
      WHERE business_id = v_business.id AND phone = v_phone
        AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;

  -- Per address: 6 an hour and 20 a day anywhere, 10 a day in one shop. Requests without a
  -- client address share the key 'unknown'.
  IF (SELECT count(*) FROM web_order_log
      WHERE COALESCE(ip_hash, 'unknown') = v_ip_key AND created_at > now() - interval '1 hour') >= 6 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;
  IF (SELECT count(*) FROM web_order_log
      WHERE COALESCE(ip_hash, 'unknown') = v_ip_key AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;
  IF (SELECT count(*) FROM web_order_log
      WHERE business_id = v_business.id AND COALESCE(ip_hash, 'unknown') = v_ip_key
        AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;

  IF (SELECT count(*) FROM web_order_log
      WHERE business_id = v_business.id
        AND created_at > now() - interval '1 day') >= 300 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;

  -- ---- products -----------------------------------------------------------
  SELECT count(*) INTO v_matched_count
  FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int)
  JOIN products p ON p.id = l.product_id
  WHERE p.business_id = v_business.id AND NOT p.is_archived;

  IF v_matched_count <> v_line_count THEN
    RAISE EXCEPTION 'WEB_ORDER:product_unavailable';
  END IF;

  -- Checkout (complete_sale_atomic) refuses to oversell, so refuse here too.
  SELECT l.product_id, p.name, COALESCE(p.current_stock, 0) AS stock
  INTO v_line
  FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int)
  JOIN products p ON p.id = l.product_id
  WHERE l.quantity > COALESCE(p.current_stock, 0)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'WEB_ORDER:insufficient_stock:%:%', v_line.product_id, v_line.stock;
  END IF;

  -- ---- customer: match on normalized phone inside this business -----------
  SELECT c.id INTO v_customer_id
  FROM customers c
  WHERE c.business_id = v_business.id
    AND NOT c.is_system_customer
    AND menu_normalize_phone(c.phone) = v_phone
  ORDER BY c.created_at
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (name, phone, address, platform, notes, business_id)
    VALUES (v_name, v_phone, v_address, 'other', 'Added from online menu', v_business.id)
    RETURNING id INTO v_customer_id;
  ELSIF v_address IS NOT NULL THEN
    UPDATE customers SET address = v_address, updated_at = now()
    WHERE id = v_customer_id AND NULLIF(trim(COALESCE(address, '')), '') IS NULL;
  END IF;

  -- ---- cart ---------------------------------------------------------------
  LOOP
    v_order_ref := 'W-' || upper(substr(md5(gen_random_uuid()::text), 1, 5));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM carts WHERE business_id = v_business.id AND order_ref = v_order_ref);
  END LOOP;

  v_cart_notes := concat_ws(E'\n',
    'Online order ' || v_order_ref || ' - ' || v_name,
    CASE WHEN v_address IS NOT NULL THEN 'Address: ' || v_address END,
    CASE WHEN v_note IS NOT NULL THEN 'Note: ' || v_note END);

  INSERT INTO carts (customer_id, status, business_id, created_by, created_by_business_id,
                     notes, source, order_ref, web_order_token)
  VALUES (v_customer_id, 'active', v_business.id, v_business.owner_user_id, v_business.id,
          v_cart_notes, 'web', v_order_ref, v_token)
  RETURNING id INTO v_cart_id;

  INSERT INTO cart_items (cart_id, product_id, quantity, unit_price, cost_per_unit, currency_id)
  SELECT v_cart_id, p.id, l.quantity, p.price, COALESCE(p.cost_per_unit, 0), p.currency_id
  FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int)
  JOIN products p ON p.id = l.product_id;

  SELECT d.final_total INTO v_total FROM cart_details_with_discounts d WHERE d.cart_id = v_cart_id;
  SELECT COALESCE(sum(l.quantity), 0) INTO v_item_count FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int);

  UPDATE carts SET total_amount = COALESCE(v_total, 0) WHERE id = v_cart_id;

  INSERT INTO web_order_log (business_id, cart_id, ip_hash, phone)
  VALUES (v_business.id, v_cart_id, p_ip_hash, v_phone);

  -- ---- notify owner + admins (push is sent by on_notification_insert_send_push) ----
  FOR v_recipient IN
    SELECT v_business.owner_user_id AS user_id
    UNION
    SELECT ubr.user_id FROM user_business_roles ubr
    WHERE ubr.business_id = v_business.id AND ubr.role = 'admin'
  LOOP
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = v_recipient.user_id;

    IF v_preference IS NULL OR COALESCE(v_preference.web_orders_enabled, true) THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        v_recipient.user_id,
        v_business.id,
        'web_order_received',
        'New online order',
        'In ' || v_business.business_name || ', ' || v_name || ' ordered ' || v_item_count ||
          CASE WHEN v_item_count = 1 THEN ' item' ELSE ' items' END || ' from your menu (' || v_order_ref || ')',
        jsonb_build_object(
          'cart_id', v_cart_id,
          'order_ref', v_order_ref,
          'customer_name', v_name,
          'customer_phone', v_phone,
          'total_amount', COALESCE(v_total, 0),
          'business_id', v_business.id,
          'business_name', v_business.business_name
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_ref', v_order_ref,
    'token', v_token,
    'total', COALESCE(v_total, 0),
    'item_count', v_item_count
  );
END;
$function$;

-- 12. Direct stock writes: recorded, not refused (yet) ---------------------------------------
-- Builds <= 2.11 write products.current_stock from the client when a sale is voided or items
-- are returned. 2.12 moves that onto an RPC; when this table has had no rows for 14 days the
-- trigger switches to refusing writes from callers who are not owner or admin.
-- The trigger is SECURITY INVOKER on purpose: inside a SECURITY DEFINER RPC current_user is
-- the function owner, so only writes arriving straight through the API are recorded.
CREATE TABLE IF NOT EXISTS public.direct_stock_writes (
  id bigserial PRIMARY KEY,
  business_id uuid,
  product_id uuid NOT NULL,
  user_id uuid,
  can_adjust boolean,
  stock_before integer,
  stock_after integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.direct_stock_writes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.direct_stock_writes FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.direct_stock_writes TO authenticated, anon;
GRANT USAGE ON SEQUENCE public.direct_stock_writes_id_seq TO authenticated, anon;
DROP POLICY IF EXISTS "API roles may record a direct stock write" ON public.direct_stock_writes;
CREATE POLICY "API roles may record a direct stock write" ON public.direct_stock_writes
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.guard_product_stock_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.current_stock IS DISTINCT FROM OLD.current_stock THEN
    INSERT INTO public.direct_stock_writes (business_id, product_id, user_id, can_adjust, stock_before, stock_after)
    VALUES (NEW.business_id, NEW.id, v_caller,
            CASE WHEN v_caller IS NULL THEN NULL ELSE EXISTS (
              SELECT 1 FROM public.businesses b WHERE b.id = NEW.business_id AND b.owner_user_id = v_caller
              UNION ALL
              SELECT 1 FROM public.user_business_roles r WHERE r.business_id = NEW.business_id AND r.user_id = v_caller AND r.role = 'admin') END,
            OLD.current_stock, NEW.current_stock);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_product_stock_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_product_stock_write ON public.products;
CREATE TRIGGER trg_guard_product_stock_write
  BEFORE UPDATE OF current_stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_stock_write();
