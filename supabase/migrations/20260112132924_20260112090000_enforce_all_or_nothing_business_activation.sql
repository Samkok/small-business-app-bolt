/*
  # Enforce All-or-Nothing Business Activation Logic

  ## Overview
  Enforces that when a user has exactly their business limit, ALL businesses must be active.
  Only allows partial selection when user owns MORE than their tier limit.

  ## Changes
  1. Update `set_read_only_businesses` function
     - When businessCount <= maxBusinesses, activate ALL businesses automatically
     - Only set read-only when businessCount > maxBusinesses
     - Set must_choose_businesses flag only when exceeding limit

  2. Update `activate_selected_businesses` function
     - Validate user selects exactly maxBusinesses when they have exactly maxBusinesses
     - Only allow partial selection when owning more than limit

  3. Create `validate_business_activation` function
     - Validates that active business count matches tier requirements
     - Returns detailed validation results

  ## Security
  - Uses SECURITY DEFINER with proper search_path
  - Enforces business activation rules at database level
*/

-- Update set_read_only_businesses to enforce all-or-nothing logic
CREATE OR REPLACE FUNCTION set_read_only_businesses(
  p_user_id uuid,
  p_max_active_businesses integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_count integer;
BEGIN
  RAISE NOTICE '[set_read_only_businesses] Called for user: %, max_active: %', p_user_id, p_max_active_businesses;

  -- Count total businesses owned by user
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  RAISE NOTICE '[set_read_only_businesses] User owns % businesses', v_business_count;

  -- If user has equal or fewer businesses than allowed, activate ALL
  IF v_business_count <= p_max_active_businesses THEN
    RAISE NOTICE '[set_read_only_businesses] Business count within limit, activating all businesses';

    -- Activate all businesses
    UPDATE businesses
    SET access_state = 'active'
    WHERE owner_user_id = p_user_id;

    -- Clear must_choose_businesses flag
    UPDATE user_profiles
    SET must_choose_businesses = false
    WHERE user_id = p_user_id;

    RAISE NOTICE '[set_read_only_businesses] All businesses activated, must_choose_businesses cleared';
  ELSE
    -- User has MORE businesses than allowed, set excess to read-only
    RAISE NOTICE '[set_read_only_businesses] Business count exceeds limit, setting excess to read-only';

    -- First, set all to read_only
    UPDATE businesses
    SET access_state = 'read_only_sales'
    WHERE owner_user_id = p_user_id;

    -- Then activate the oldest N businesses (by created_at)
    UPDATE businesses
    SET access_state = 'active'
    WHERE id IN (
      SELECT id
      FROM businesses
      WHERE owner_user_id = p_user_id
      ORDER BY created_at ASC
      LIMIT p_max_active_businesses
    );

    -- Set must_choose_businesses flag to show selection modal
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;

    RAISE NOTICE '[set_read_only_businesses] Set must_choose_businesses flag to true';
  END IF;

  RAISE NOTICE '[set_read_only_businesses] Completed for user: %', p_user_id;
END;
$$;

COMMENT ON FUNCTION set_read_only_businesses(uuid, integer) IS 'Sets business access states. When count <= limit, activates ALL. When count > limit, requires user selection.';

-- Update activate_selected_businesses to validate selection count
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
BEGIN
  RAISE NOTICE '[activate_selected_businesses] Called for user: %', p_user_id;
  RAISE NOTICE '[activate_selected_businesses] Selected business IDs: %', p_selected_business_ids;

  -- Get user's business count and tier limit
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  SELECT max_owned_businesses
  INTO v_max_businesses
  FROM user_profiles
  WHERE user_id = p_user_id;

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

-- Create validation function to check business activation compliance
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
BEGIN
  -- Get business counts and limits
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  SELECT COUNT(*)
  INTO v_active_count
  FROM businesses
  WHERE owner_user_id = p_user_id
    AND access_state = 'active';

  SELECT max_owned_businesses
  INTO v_max_allowed
  FROM user_profiles
  WHERE user_id = p_user_id;

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
