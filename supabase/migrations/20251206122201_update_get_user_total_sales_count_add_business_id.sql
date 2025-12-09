/*
  # Update get_user_total_sales_count to Support Business-Specific Queries
  
  ## Overview
  This migration updates the `get_user_total_sales_count` function to optionally accept
  a business_id parameter for querying sales count for a specific business.
  
  ## Changes
  
  1. **Update get_user_total_sales_count function**
     - Add optional `p_business_id` parameter (defaults to NULL)
     - When NULL: returns total sales across all businesses (current behavior)
     - When provided: returns sales count for specific business only
     - Maintains backward compatibility with existing calls
  
  ## Backward Compatibility
  
  - All existing calls without business_id continue to work unchanged
  - New functionality is opt-in by passing the business_id parameter
  
  ## Use Cases
  
  - `get_user_total_sales_count(user_id)` → Total sales across all businesses
  - `get_user_total_sales_count(user_id, business_id)` → Sales for specific business
*/

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
