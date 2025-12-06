/*
  # Add set_all_businesses_active Function

  ## Overview
  Creates the missing `set_all_businesses_active` function that is called by the IAP webhook
  when a user upgrades their subscription tier.

  ## Purpose
  When a user upgrades to a higher tier (e.g., from pro to pro_plus or max), any businesses
  that were previously marked as read-only should be reactivated to 'active' state.

  ## Function Details
  - `set_all_businesses_active(p_user_id uuid)` - Sets all user-owned businesses to active state
  - Also clears the `must_choose_businesses` flag since all businesses are now accessible

  ## Security
  - Uses SECURITY DEFINER with proper search_path for secure execution
  - Only affects businesses owned by the specified user
*/

-- Function to set all user-owned businesses to active state
CREATE OR REPLACE FUNCTION set_all_businesses_active(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set all user-owned businesses to active
  UPDATE businesses 
  SET access_state = 'active'
  WHERE owner_user_id = p_user_id;
  
  -- Clear the must_choose_businesses flag
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION set_all_businesses_active(uuid) IS 'Sets all user-owned businesses to active state and clears the business selection requirement. Called when upgrading to a higher tier.';