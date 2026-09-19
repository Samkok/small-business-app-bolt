/*
# Fix referral code generation and the business selection check

Both bugs predate the 2026-09-19 security migrations; neither changes who may call what.

## 1. generate_referral_code was ambiguous (42725)
Two overloads existed:
  - generate_referral_code(p_user_id uuid) RETURNS text            -- get-or-create, idempotent
  - generate_referral_code(p_user_id uuid, p_code text DEFAULT NULL) RETURNS TABLE(code text, id uuid)
Every caller (src/services/referralService.ts and the referral-status edge function)
passes only p_user_id, which matches both, so Postgres refused to choose and no
referral code was ever returned.

The one-argument version is what the callers expect: the app uses the result as the
code string, and the edge function wants "get or create" then reads referral_codes.
The two-argument version always INSERTs, so a second call would break the
one-active-code-per-user unique index, and nothing can reach it. It is dropped.

## 2. check_business_selection_requirement raised 42803
Three statements had the form
  SELECT json_agg(...) INTO v_businesses FROM businesses WHERE ... ORDER BY created_at ASC;
An ORDER BY outside an aggregate needs a GROUP BY. The error came after the function's
UPDATEs, so the whole call rolled back: businesses were not re-activated and
must_choose_businesses was not cleared after a subscription change.
The ORDER BY moves inside json_agg.

## 3. The same function raised 42703 for users with no subscription row
  v_tier_info := ROW('free', 1);  then  v_tier_info.max_owned_businesses
An anonymous ROW has fields f1, f2, so the named field did not exist and the call
failed before reaching step 2. That is every free user (19 of 20 on 2026-09-19).
The free default of one business (the same default get_full_subscription_state and
get_user_subscription_tier use) is now assigned to v_max_allowed directly.

Nothing else in the body changes; the signature is unchanged, so CREATE OR REPLACE
keeps the existing grants.
*/

-- 1. Remove the unreachable overload; re-assert the grants on the one that stays
DROP FUNCTION IF EXISTS public.generate_referral_code(uuid, text);

REVOKE EXECUTE ON FUNCTION public.generate_referral_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_referral_code(uuid) TO authenticated, service_role;

-- 2 and 3. Same body as live, with ORDER BY moved inside json_agg in three places
-- and the free-tier default assigned directly
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

UPDATE user_profiles
SET must_choose_businesses = false
WHERE user_id = p_user_id;

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
WHERE user_id = p_user_id;

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
UPDATE user_profiles SET must_choose_businesses = false WHERE user_id = p_user_id;
v_must_choose := false;
ELSE
UPDATE user_profiles SET must_choose_businesses = true WHERE user_id = p_user_id;
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

NOTIFY pgrst, 'reload schema';
