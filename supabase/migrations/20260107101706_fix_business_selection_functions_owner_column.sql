/*
  # Fix Business Selection Functions to Use Correct Owner Column

  ## Overview
  Fixes the `set_read_only_businesses()` and `activate_selected_businesses()` 
  functions to use the correct column name `owner_user_id` instead of `owner_id`.

  ## Changes
  1. Updates `set_read_only_businesses()` function
     - Changes `owner_id` to `owner_user_id` in WHERE clauses
  
  2. Updates `activate_selected_businesses()` function
     - Changes `owner_id` to `owner_user_id` in WHERE clauses

  ## Impact
  - Functions will now correctly query businesses by owner
  - Fixes business access state management during subscription changes
*/

-- Function to set businesses to read-only when exceeding tier limit (fixed)
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
BEGIN
  -- Loop through user's owned businesses ordered by creation date
  FOR v_business_record IN (
    SELECT id FROM businesses 
    WHERE owner_user_id = p_user_id
    ORDER BY created_at ASC
  ) LOOP
    v_active_count := v_active_count + 1;
    
    -- First N businesses stay active, rest become read-only
    IF v_active_count <= p_max_active_businesses THEN
      UPDATE businesses 
      SET access_state = 'active'
      WHERE id = v_business_record.id;
    ELSE
      UPDATE businesses 
      SET access_state = 'read_only_sales'
      WHERE id = v_business_record.id;
    END IF;
  END LOOP;
  
  -- Set must_choose_businesses flag if user has more businesses than allowed
  IF v_active_count > p_max_active_businesses THEN
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Function to activate selected businesses and set others to read-only (fixed)
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
BEGIN
  -- Set all owned businesses to read_only_sales first
  UPDATE businesses
  SET access_state = 'read_only_sales'
  WHERE owner_user_id = p_user_id;
  
  -- Activate only selected businesses
  UPDATE businesses
  SET access_state = 'active'
  WHERE owner_user_id = p_user_id
    AND id = ANY(p_selected_business_ids);
  
  -- Clear must_choose_businesses flag
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;
  
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
  END IF;
END;
$$;