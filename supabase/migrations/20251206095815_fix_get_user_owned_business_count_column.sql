/*
  # Fix get_user_owned_business_count Function
  
  ## Overview
  Fixes the get_user_owned_business_count function to use the correct column name.
  The businesses table uses `owner_user_id`, not `owner_id`.
  
  ## Changes
  - Updates get_user_owned_business_count() to use owner_user_id
  
  This fixes the edge function error when selecting businesses during subscription downgrades.
*/

-- Fix the function to use correct column name
CREATE OR REPLACE FUNCTION get_user_owned_business_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM businesses
  WHERE owner_user_id = p_user_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$;
