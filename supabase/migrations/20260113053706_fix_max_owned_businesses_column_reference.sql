/*
  # Fix max_owned_businesses Column Reference in Database Functions

  ## Overview
  Fixes database functions that incorrectly try to read max_owned_businesses from user_profiles table.
  The column doesn't exist in user_profiles - it should be obtained via get_user_subscription_tier function.

  ## Changes
  
  1. **Update activate_selected_businesses function**
     - Replace direct SELECT from user_profiles with call to get_user_subscription_tier
     - Retrieve max_owned_businesses from the tier function result
     - Keep all validation logic intact

  2. **Update validate_business_activation function**
     - Replace direct SELECT from user_profiles with call to get_user_subscription_tier
     - Retrieve max_owned_businesses from the tier function result
     - Keep all validation logic intact

  ## Error Fixed
  - Error: column "max_owned_businesses" does not exist
  - Location: Both functions were trying to SELECT max_owned_businesses FROM user_profiles
  - Root cause: max_owned_businesses is computed by get_user_subscription_tier, not stored in user_profiles
*/

-- Update activate_selected_businesses to use get_user_subscription_tier
CREATE OR REPLACE FUNCTION activate_selected_businesses(
  p_user_id uuid,
  p_selected_business_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_subscription_id uuid;
  v_business_count integer;
  v_max_businesses integer;
  v_selected_count integer;
  v_tier_info record;
BEGIN
  RAISE NOTICE '[activate_selected_businesses] Called for user: %', p_user_id;
  RAISE NOTICE '[activate_selected_businesses] Selected business IDs: %', p_selected_business_ids;

  -- Get user's business count
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  -- Get tier limit from subscription tier function
  SELECT *
  INTO v_tier_info
  FROM get_user_subscription_tier(p_user_id)
  LIMIT 1;

  v_max_businesses := v_tier_info.max_owned_businesses;
  v_selected_count := array_length(p_selected_business_ids, 1);

  RAISE NOTICE '[activate_selected_businesses] Business count: %, Max allowed: %, Selected: %',
    v_business_count, v_max_businesses, v_selected_count;

  -- Validation: If user has exactly their limit, they must select all
  IF v_business_count = v_max_businesses AND v_selected_count < v_max_businesses THEN
    RAISE EXCEPTION 'INVALID_SELECTION: You must select all % businesses. Your plan allows % businesses and you own %. All must be active.',
      v_max_businesses, v_max_businesses, v_business_count;
  END IF;

  -- Validation: If user has more than limit, they must select exactly the limit
  IF v_business_count > v_max_businesses AND v_selected_count <> v_max_businesses THEN
    RAISE EXCEPTION 'INVALID_SELECTION: You must select exactly % businesses. You selected %.',
      v_max_businesses, v_selected_count;
  END IF;

  -- Validation: Selected count cannot exceed max allowed
  IF v_selected_count > v_max_businesses THEN
    RAISE EXCEPTION 'INVALID_SELECTION: You can only select up to % businesses. You selected %.',
      v_max_businesses, v_selected_count;
  END IF;

  -- Set all owned businesses to read_only_sales first
  UPDATE businesses
  SET access_state = 'read_only_sales'
  WHERE owner_user_id = p_user_id;

  RAISE NOTICE '[activate_selected_businesses] Set all businesses to read_only_sales';

  -- Activate only selected businesses
  UPDATE businesses
  SET access_state = 'active'
  WHERE owner_user_id = p_user_id
    AND id = ANY(p_selected_business_ids);

  RAISE NOTICE '[activate_selected_businesses] Activated selected businesses';

  -- Clear must_choose_businesses flag
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;

  RAISE NOTICE '[activate_selected_businesses] Cleared must_choose_businesses flag';

  -- Get latest subscription ID
  SELECT id INTO v_latest_subscription_id
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Store selection in user_subscriptions
  IF v_latest_subscription_id IS NOT NULL THEN
    UPDATE user_subscriptions
    SET selected_business_ids = to_jsonb(p_selected_business_ids),
        updated_at = now()
    WHERE id = v_latest_subscription_id;

    RAISE NOTICE '[activate_selected_businesses] Updated selected_business_ids in subscription';
  END IF;

  RAISE NOTICE '[activate_selected_businesses] Completed for user: %', p_user_id;
END;
$$;

COMMENT ON FUNCTION activate_selected_businesses(uuid, uuid[]) IS 'Activates selected businesses. Validates that selection count matches requirements (all when count=limit, exact limit when count>limit).';

-- Update validate_business_activation to use get_user_subscription_tier
CREATE OR REPLACE FUNCTION validate_business_activation(p_user_id uuid)
RETURNS TABLE(
  is_valid boolean,
  business_count integer,
  max_allowed integer,
  active_count integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_count integer;
  v_max_allowed integer;
  v_active_count integer;
  v_is_valid boolean;
  v_error_message text;
  v_tier_info record;
BEGIN
  -- Get business counts
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  SELECT COUNT(*)
  INTO v_active_count
  FROM businesses
  WHERE owner_user_id = p_user_id
    AND access_state = 'active';

  -- Get tier limit from subscription tier function
  SELECT *
  INTO v_tier_info
  FROM get_user_subscription_tier(p_user_id)
  LIMIT 1;

  v_max_allowed := v_tier_info.max_owned_businesses;

  -- Validation logic
  IF v_business_count <= v_max_allowed THEN
    -- All businesses must be active
    IF v_active_count = v_business_count THEN
      v_is_valid := true;
      v_error_message := NULL;
    ELSE
      v_is_valid := false;
      v_error_message := format('All %s businesses must be active. Currently only %s are active.',
        v_business_count, v_active_count);
    END IF;
  ELSE
    -- Exactly max_allowed businesses must be active
    IF v_active_count = v_max_allowed THEN
      v_is_valid := true;
      v_error_message := NULL;
    ELSE
      v_is_valid := false;
      v_error_message := format('Exactly %s businesses must be active. Currently %s are active.',
        v_max_allowed, v_active_count);
    END IF;
  END IF;

  -- Return results
  RETURN QUERY SELECT
    v_is_valid,
    v_business_count,
    v_max_allowed,
    v_active_count,
    v_error_message;
END;
$$;

COMMENT ON FUNCTION validate_business_activation(uuid) IS 'Validates that user has correct number of active businesses based on their tier limit. Returns validation results.';