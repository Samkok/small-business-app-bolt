-- Defects found in the 2026-11-08 UX walkthrough (docs/ux-review).
--
-- 1. check_business_selection_requirement wrote user_profiles.must_choose_businesses on every
--    call, even when the value did not change. Since 20261105090000 set REPLICA IDENTITY
--    DEFAULT on user_profiles, a realtime UPDATE no longer carries the old value, so the app's
--    listener (2.11+) saw every write as a change, called the function again, and looped:
--    about 122,000 updates on a 64-row table. The function now writes only when the value
--    differs, so an unchanged state produces no realtime event and the loop stops for every
--    installed version. Body otherwise unchanged; signature, grants and guards kept.
--
-- 2. Deleting a product cascades to its stock_adjustments, product_cost_events and
--    product_history, and the app only checked sales and imports before a permanent delete,
--    so a product with write-offs could be deleted and its write-offs vanished from past
--    profit figures. A BEFORE DELETE guard now refuses the delete from the app's API roles
--    when the product has sold lines, stock adjustments or cost events other than its
--    opening entry; the app archives instead. Deletes by the service role (business and
--    account deletion) and by definer functions are not affected.

-- 1 ----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_business_selection_requirement(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_tier_info RECORD;
v_owned_count INT;
v_max_allowed INT;
v_active_count INT;
v_read_only_count INT;
v_already_configured BOOLEAN;
v_limit_exceeded BOOLEAN;
v_must_choose BOOLEAN;
v_businesses JSON;
v_read_only_ids TEXT[];
BEGIN
  PERFORM public.require_self_or_service(p_user_id);
-- Guard: only the user themselves or service role
IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
RAISE EXCEPTION 'Cannot check another user''s business selection';
END IF;

SELECT tier, max_owned_businesses
INTO v_tier_info
FROM user_subscriptions
WHERE user_id = p_user_id
ORDER BY updated_at DESC LIMIT 1;

IF v_tier_info IS NULL THEN
-- No subscription row: free tier, one business
v_max_allowed := 1;
ELSE
v_max_allowed := v_tier_info.max_owned_businesses;
END IF;

IF v_max_allowed IS NULL OR v_max_allowed = 999999 THEN
-- Unlimited tier: activate non-disabled businesses
UPDATE businesses
SET access_state = 'active'
WHERE owner_user_id = p_user_id
AND access_state NOT IN ('active', 'owner_disabled');

-- Write only on a real change: an unchanged row must not emit a realtime UPDATE
UPDATE user_profiles
SET must_choose_businesses = false
WHERE user_id = p_user_id AND must_choose_businesses IS DISTINCT FROM false;

SELECT json_agg(json_build_object(
'id', id, 'business_name', business_name,
'access_state', access_state, 'created_at', created_at
) ORDER BY created_at ASC) INTO v_businesses
FROM businesses WHERE owner_user_id = p_user_id;

RETURN json_build_object(
'must_choose_businesses', false,
'owned_businesses', COALESCE(v_businesses, '[]'::json),
'read_only_business_ids', ARRAY[]::TEXT[],
'tier_limit', 999999,
'owned_count', (SELECT COUNT(*) FROM businesses WHERE owner_user_id = p_user_id),
'already_configured', true
);
END IF;

SELECT COUNT(*) INTO v_owned_count
FROM businesses WHERE owner_user_id = p_user_id;

v_limit_exceeded := v_owned_count > v_max_allowed;

IF NOT v_limit_exceeded THEN
-- Within limit: activate non-disabled businesses
UPDATE businesses
SET access_state = 'active'
WHERE owner_user_id = p_user_id
AND access_state NOT IN ('active', 'owner_disabled');

UPDATE user_profiles
SET must_choose_businesses = false
WHERE user_id = p_user_id AND must_choose_businesses IS DISTINCT FROM false;

SELECT json_agg(json_build_object(
'id', id, 'business_name', business_name,
'access_state', access_state, 'created_at', created_at
) ORDER BY created_at ASC) INTO v_businesses
FROM businesses WHERE owner_user_id = p_user_id;

RETURN json_build_object(
'must_choose_businesses', false,
'owned_businesses', COALESCE(v_businesses, '[]'::json),
'read_only_business_ids', ARRAY[]::TEXT[],
'tier_limit', v_max_allowed,
'owned_count', v_owned_count,
'already_configured', true
);
END IF;

-- Limit exceeded: check if already configured
SELECT COUNT(*) FILTER (WHERE access_state = 'active'),
COUNT(*) FILTER (WHERE access_state = 'read_only_sales')
INTO v_active_count, v_read_only_count
FROM businesses WHERE owner_user_id = p_user_id;

v_already_configured := (v_active_count = v_max_allowed AND v_read_only_count > 0);

IF v_already_configured THEN
UPDATE user_profiles SET must_choose_businesses = false
WHERE user_id = p_user_id AND must_choose_businesses IS DISTINCT FROM false;
v_must_choose := false;
ELSE
UPDATE user_profiles SET must_choose_businesses = true
WHERE user_id = p_user_id AND must_choose_businesses IS DISTINCT FROM true;
v_must_choose := true;
END IF;

SELECT json_agg(json_build_object(
'id', id, 'business_name', business_name,
'access_state', access_state, 'created_at', created_at
) ORDER BY created_at ASC) INTO v_businesses
FROM businesses WHERE owner_user_id = p_user_id;

SELECT array_agg(id::TEXT) INTO v_read_only_ids
FROM businesses
WHERE owner_user_id = p_user_id AND access_state = 'read_only_sales';

RETURN json_build_object(
'must_choose_businesses', v_must_choose,
'owned_businesses', COALESCE(v_businesses, '[]'::json),
'read_only_business_ids', COALESCE(v_read_only_ids, ARRAY[]::TEXT[]),
'tier_limit', v_max_allowed,
'owned_count', v_owned_count,
'already_configured', v_already_configured
);
END;
$function$;

-- 2 ----------------------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user is the API role for a PostgREST delete and the
-- owner for a definer function or the service role, which pass.
CREATE OR REPLACE FUNCTION public.guard_product_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM stock_adjustments a WHERE a.product_id = OLD.id)
     OR EXISTS (SELECT 1 FROM product_cost_events e WHERE e.product_id = OLD.id AND e.event_type <> 'opening')
     OR EXISTS (SELECT 1 FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
                 WHERE ci.product_id = OLD.id AND c.status = 'completed') THEN
    RAISE EXCEPTION 'PRODUCT_HAS_HISTORY: this product has sales, stock adjustments or cost history; archive it instead'
      USING ERRCODE = 'P0001', HINT = 'archive';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_product_delete() FROM PUBLIC, anon;

-- The trigger reads child tables under the caller's RLS; members can read all three for
-- their own business, which is the only business they can delete products in.
DROP TRIGGER IF EXISTS guard_product_delete ON public.products;
CREATE TRIGGER guard_product_delete
BEFORE DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_product_delete();
