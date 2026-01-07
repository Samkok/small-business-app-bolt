/*
  # Update set_read_only_businesses Function

  ## Overview
  Updates the `set_read_only_businesses` function to clear old `selected_business_ids` 
  before processing, ensuring a clean state, and adds detailed logging.

  ## Changes
  - Clears `selected_business_ids = '[]'` at the start of the function
  - Adds RAISE NOTICE logging for debugging and audit trails
  - Logs which businesses are being set to active vs read-only
  - Note: Column name is owner_user_id not owner_id (fixing previous bug)

  ## Purpose
  When a user downgrades and needs to select businesses, we first clear the old 
  selection to ensure we start from a clean state. The oldest N businesses are 
  temporarily activated, and the user can change their selection later.

  ## Security
  - Maintains SECURITY DEFINER with proper search_path
*/

-- Update function to clear old selection and add logging
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
  v_business_record RECORD;
  v_active_count integer := 0;
  v_total_count integer;
BEGIN
  RAISE NOTICE '[set_read_only_businesses] Called for user: %, max_active: %', p_user_id, p_max_active_businesses;

  -- Count total businesses
  SELECT COUNT(*)
  INTO v_total_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  RAISE NOTICE '[set_read_only_businesses] User has % total businesses', v_total_count;

  -- Clear old selected_business_ids to start fresh
  UPDATE user_subscriptions
  SET selected_business_ids = '[]'::jsonb
  WHERE user_id = p_user_id;

  RAISE NOTICE '[set_read_only_businesses] Cleared old selected_business_ids';

  -- Loop through user's owned businesses ordered by creation date (oldest first)
  FOR v_business_record IN (
    SELECT id, business_name FROM businesses 
    WHERE owner_user_id = p_user_id
    ORDER BY created_at ASC
  ) LOOP
    v_active_count := v_active_count + 1;
    
    -- First N businesses stay active, rest become read-only
    IF v_active_count <= p_max_active_businesses THEN
      UPDATE businesses 
      SET access_state = 'active'
      WHERE id = v_business_record.id;
      
      RAISE NOTICE '[set_read_only_businesses] Set business % (%) to ACTIVE (oldest #%)', v_business_record.id, v_business_record.business_name, v_active_count;
    ELSE
      UPDATE businesses 
      SET access_state = 'read_only_sales'
      WHERE id = v_business_record.id;
      
      RAISE NOTICE '[set_read_only_businesses] Set business % (%) to READ_ONLY', v_business_record.id, v_business_record.business_name;
    END IF;
  END LOOP;
  
  -- Set must_choose_businesses flag if user has more businesses than allowed
  IF v_active_count > p_max_active_businesses THEN
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;
    
    RAISE NOTICE '[set_read_only_businesses] Set must_choose_businesses = true (% businesses > % allowed)', v_active_count, p_max_active_businesses;
  ELSE
    RAISE NOTICE '[set_read_only_businesses] User has % businesses which is within limit of %', v_active_count, p_max_active_businesses;
  END IF;

  RAISE NOTICE '[set_read_only_businesses] Completed for user: %', p_user_id;
END;
$$;

-- Update comment
COMMENT ON FUNCTION set_read_only_businesses(uuid, integer) IS 'Sets businesses to read-only state when user exceeds tier limit. Clears old selected_business_ids and keeps oldest N businesses active. Includes detailed logging.';
