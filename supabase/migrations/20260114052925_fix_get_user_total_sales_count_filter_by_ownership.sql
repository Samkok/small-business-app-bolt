/*
  # Fix get_user_total_sales_count to Count Only Owned Business Sales

  ## Problem
  The current function sums sales across ALL businesses in user_sales_counts,
  including businesses where the user is only a team member. For free tier users,
  the 50-sale limit should only apply to businesses they OWN, not businesses where
  they're team members.

  ## Solution
  Update the function to join with the businesses table and filter by owner_user_id
  when no specific business_id is provided.

  ## Changes
  - When business_id is NULL: Sum sales only from businesses owned by the user
  - When business_id is provided: Return sales for that specific business (unchanged)
  - Join user_sales_counts with businesses table to check ownership

  ## Impact
  - Free tier users will see accurate counts based only on their owned businesses
  - Team members' sales won't affect the owner's limit and vice versa
*/

-- Drop existing function
DROP FUNCTION IF EXISTS get_user_total_sales_count(uuid, uuid);

-- Create updated function with ownership filtering
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
  
  -- Otherwise, return total sales across OWNED businesses only
  -- Join with businesses table to filter by ownership
  SELECT COALESCE(SUM(usc.sales_count), 0) INTO v_total_count
  FROM user_sales_counts usc
  INNER JOIN businesses b ON usc.business_id = b.id
  WHERE usc.user_id = p_user_id 
    AND b.owner_user_id = p_user_id;
  
  RETURN v_total_count;
END;
$$;

COMMENT ON FUNCTION get_user_total_sales_count(uuid, uuid) IS 'Returns total sales count for a user. If business_id is provided, returns sales for that business only. Otherwise returns total across OWNED businesses only (excludes businesses where user is just a team member).';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_total_sales_count(uuid, uuid) TO authenticated;