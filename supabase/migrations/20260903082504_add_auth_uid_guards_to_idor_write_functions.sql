/*
# Add auth.uid() guards to IDOR-write SECURITY DEFINER functions

## Problem
- `check_business_selection_requirement`, `activate_all_businesses_and_populate_selection`,
  and `activate_selected_businesses` accept arbitrary p_user_id and perform mutations
  (UPDATE businesses, UPDATE user_profiles) without verifying that the caller is the
  target user. Any authenticated user can manipulate another user's businesses.

## Changes
- All three functions now check `auth.uid() IS NOT NULL AND auth.uid() != p_user_id`
  and raise an exception if mismatched. Service-role callers (auth.uid() IS NULL) are
  still allowed through (webhooks, triggers).
- `check_business_selection_requirement` also fixed to exclude `owner_disabled`
  businesses from auto-activation (combines p0-2 and p0-5).

## Security
- Closes IDOR-write on 3 SECURITY DEFINER functions
- Preserves service-role access for webhook/trigger paths
*/

-- Fix activate_all_businesses_and_populate_selection
CREATE OR REPLACE FUNCTION public.activate_all_businesses_and_populate_selection(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_business_count integer;
  v_business_ids jsonb;
BEGIN
  -- Guard: only the user themselves or service role
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot modify another user''s businesses';
  END IF;

  SELECT COUNT(*) INTO v_business_count
  FROM businesses WHERE owner_user_id = p_user_id;

  SELECT jsonb_agg(id ORDER BY created_at)
  INTO v_business_ids
  FROM businesses WHERE owner_user_id = p_user_id;

  IF v_business_ids IS NULL THEN
    v_business_ids := '[]'::jsonb;
  END IF;

  UPDATE businesses
  SET access_state = 'active'
  WHERE owner_user_id = p_user_id
  AND access_state != 'owner_disabled';

  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;

  UPDATE user_subscriptions
  SET selected_business_ids = v_business_ids
  WHERE user_id = p_user_id;
END;
$function$;

-- Fix activate_selected_businesses
CREATE OR REPLACE FUNCTION public.activate_selected_businesses(p_user_id uuid, p_selected_business_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_allowed integer;
  v_selected_count integer;
  v_owned_count integer;
  v_valid_count integer;
BEGIN
  -- Guard: only the user themselves or service role
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot modify another user''s businesses';
  END IF;

  v_selected_count := array_length(p_selected_business_ids, 1);
  IF v_selected_count IS NULL OR v_selected_count = 0 THEN
    RAISE EXCEPTION 'Must select at least one business';
  END IF;

  SELECT COUNT(*) INTO v_valid_count
  FROM businesses
  WHERE id = ANY(p_selected_business_ids) AND owner_user_id = p_user_id;

  IF v_valid_count != v_selected_count THEN
    RAISE EXCEPTION 'Some selected businesses do not belong to this user';
  END IF;

  SELECT COALESCE(max_owned_businesses, 1) INTO v_max_allowed
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC LIMIT 1;

  IF v_max_allowed IS NULL THEN v_max_allowed := 1; END IF;

  IF v_selected_count > v_max_allowed THEN
    RAISE EXCEPTION 'Cannot activate % businesses. Maximum allowed: %', v_selected_count, v_max_allowed;
  END IF;

  UPDATE businesses
  SET access_state = CASE
    WHEN id = ANY(p_selected_business_ids) THEN 'active'
    WHEN access_state = 'owner_disabled' THEN 'owner_disabled'
    ELSE 'read_only_sales'
  END
  WHERE owner_user_id = p_user_id;

  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;

  UPDATE user_subscriptions
  SET selected_business_ids = to_jsonb(p_selected_business_ids)
  WHERE user_id = p_user_id;
END;
$function$;

-- Fix check_business_selection_requirement (auth guard + owner_disabled preservation)
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
    v_tier_info := ROW('free', 1);
  END IF;

  v_max_allowed := v_tier_info.max_owned_businesses;

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
    )) INTO v_businesses
    FROM businesses WHERE owner_user_id = p_user_id ORDER BY created_at ASC;

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
    )) INTO v_businesses
    FROM businesses WHERE owner_user_id = p_user_id ORDER BY created_at ASC;

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
  )) INTO v_businesses
  FROM businesses WHERE owner_user_id = p_user_id ORDER BY created_at ASC;

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
