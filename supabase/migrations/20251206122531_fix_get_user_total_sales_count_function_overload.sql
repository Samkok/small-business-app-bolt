/*
  # Fix get_user_total_sales_count Function Overload Issue
  
  ## Problem
  The previous migration created an overloaded function, causing PostgreSQL to be unable
  to choose which function to call when only one parameter is provided.
  
  ## Solution
  1. Drop all existing versions of the function
  2. Create a single version with optional business_id parameter (DEFAULT NULL)
  
  ## Changes
  - Drop existing `get_user_total_sales_count` functions
  - Create new version with optional `p_business_id` parameter
*/

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS get_user_total_sales_count(uuid);
DROP FUNCTION IF EXISTS get_user_total_sales_count(uuid, uuid);

-- Create the new function with optional business_id parameter
CREATE OR REPLACE FUNCTION get_user_total_sales_count(
  p_user_id uuid,
  p_business_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count integer;
BEGIN
  -- If business_id is provided, return sales for that specific business
  IF p_business_id IS NOT NULL THEN
    SELECT COALESCE(sales_count, 0) INTO v_total_count
    FROM user_sales_counts
    WHERE user_id = p_user_id AND business_id = p_business_id;
    
    RETURN COALESCE(v_total_count, 0);
  END IF;
  
  -- Otherwise, return total sales across all businesses
  SELECT COALESCE(SUM(sales_count), 0) INTO v_total_count
  FROM user_sales_counts
  WHERE user_id = p_user_id;
  
  RETURN v_total_count;
END;
$$;

COMMENT ON FUNCTION get_user_total_sales_count(uuid, uuid) IS 'Returns total sales count for a user. If business_id is provided, returns sales for that business only. Otherwise returns total across all businesses.';
