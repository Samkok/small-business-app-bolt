/*
  # Update set_all_businesses_active Function

  ## Overview
  Updates the `set_all_businesses_active` function to clear `selected_business_ids` 
  when all businesses are activated, and adds detailed logging.

  ## Changes
  - Clears `selected_business_ids = '[]'` in user_subscriptions when activating all businesses
  - Adds RAISE NOTICE logging for debugging and audit trails
  - Logs before and after state for observability

  ## Purpose
  When a user upgrades to a higher tier that allows all their businesses to be active,
  the `selected_business_ids` field should be cleared since there's no need to track
  which specific businesses are active (all of them are).

  ## Security
  - Maintains SECURITY DEFINER with proper search_path
*/

-- Update function to clear selected_business_ids and add logging
CREATE OR REPLACE FUNCTION set_all_businesses_active(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_count integer;
BEGIN
  RAISE NOTICE '[set_all_businesses_active] Called for user: %', p_user_id;

  -- Count businesses for this user
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  RAISE NOTICE '[set_all_businesses_active] User has % businesses to activate', v_business_count;

  -- Set all user-owned businesses to active
  UPDATE businesses 
  SET access_state = 'active'
  WHERE owner_user_id = p_user_id;
  
  RAISE NOTICE '[set_all_businesses_active] Set all businesses to active state';

  -- Clear the must_choose_businesses flag
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;

  RAISE NOTICE '[set_all_businesses_active] Cleared must_choose_businesses flag';

  -- Clear selected_business_ids since all businesses are now active
  UPDATE user_subscriptions
  SET selected_business_ids = '[]'::jsonb
  WHERE user_id = p_user_id;

  RAISE NOTICE '[set_all_businesses_active] Cleared selected_business_ids (all businesses active)';
  RAISE NOTICE '[set_all_businesses_active] Completed for user: %', p_user_id;
END;
$$;

-- Update comment
COMMENT ON FUNCTION set_all_businesses_active(uuid) IS 'Sets all user-owned businesses to active state, clears the business selection requirement and selected_business_ids. Called when upgrading to a higher tier. Includes detailed logging.';
