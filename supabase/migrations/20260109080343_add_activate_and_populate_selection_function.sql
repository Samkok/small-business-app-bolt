/*
  # Add activate_all_businesses_and_populate_selection Function

  ## Overview
  Creates a new function that activates all user-owned businesses AND populates
  selected_business_ids with all business IDs. This is used when a user's business
  count is within their tier limits.

  ## Purpose
  When a user upgrades or subscribes and their business count is within the new tier's
  limits, we need to:
  1. Set all businesses to 'active' state
  2. Populate selected_business_ids with all business IDs (ordered by created_at)
  3. Clear the must_choose_businesses flag

  This is different from set_all_businesses_active which clears selected_business_ids.

  ## Use Cases
  - User upgrades from free to pro (1 business allowed, has 1 business)
  - User upgrades from pro to pro_plus (3 allowed, has 2-3 businesses)
  - User subscribes for first time and has businesses within tier limit

  ## Security
  - Uses SECURITY DEFINER with proper search_path for secure execution
  - Only affects businesses owned by the specified user
*/

-- Function to activate all businesses and populate selected_business_ids
CREATE OR REPLACE FUNCTION activate_all_businesses_and_populate_selection(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_count integer;
  v_business_ids jsonb;
BEGIN
  RAISE NOTICE '[activate_all_businesses_and_populate_selection] Called for user: %', p_user_id;

  -- Count businesses for this user
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  RAISE NOTICE '[activate_all_businesses_and_populate_selection] User has % businesses', v_business_count;

  -- Get all business IDs ordered by created_at
  SELECT jsonb_agg(id ORDER BY created_at)
  INTO v_business_ids
  FROM businesses
  WHERE owner_user_id = p_user_id;

  -- If no businesses, set to empty array
  IF v_business_ids IS NULL THEN
    v_business_ids := '[]'::jsonb;
  END IF;

  RAISE NOTICE '[activate_all_businesses_and_populate_selection] Business IDs to activate: %', v_business_ids;

  -- Set all user-owned businesses to active
  UPDATE businesses
  SET access_state = 'active'
  WHERE owner_user_id = p_user_id;

  RAISE NOTICE '[activate_all_businesses_and_populate_selection] Set all businesses to active state';

  -- Clear the must_choose_businesses flag
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;

  RAISE NOTICE '[activate_all_businesses_and_populate_selection] Cleared must_choose_businesses flag';

  -- Populate selected_business_ids with all business IDs
  UPDATE user_subscriptions
  SET selected_business_ids = v_business_ids
  WHERE user_id = p_user_id;

  RAISE NOTICE '[activate_all_businesses_and_populate_selection] Populated selected_business_ids with % businesses', v_business_count;
  RAISE NOTICE '[activate_all_businesses_and_populate_selection] Completed for user: %', p_user_id;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION activate_all_businesses_and_populate_selection(uuid) IS 'Activates all user-owned businesses and populates selected_business_ids with all business IDs. Used when business count is within tier limits. Includes detailed logging.';
