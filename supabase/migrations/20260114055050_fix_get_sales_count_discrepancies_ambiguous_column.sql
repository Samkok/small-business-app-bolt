/*
  # Fix get_sales_count_discrepancies Ambiguous Column Reference

  ## Problem
  The function has an ambiguous reference to business_id in the subquery.
  Need to explicitly qualify the column name.

  ## Solution
  Use s.business_id in the subquery to make it clear we're referring to the
  sales table's business_id column.
*/

CREATE OR REPLACE FUNCTION get_sales_count_discrepancies()
RETURNS TABLE (
  user_id uuid,
  business_id uuid,
  cached_count integer,
  actual_count integer,
  discrepancy integer,
  last_reconciled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    usc.user_id,
    usc.business_id,
    usc.sales_count as cached_count,
    COALESCE(actual.count, 0)::integer as actual_count,
    (COALESCE(actual.count, 0) - usc.sales_count)::integer as discrepancy,
    usc.last_reconciled_at
  FROM user_sales_counts usc
  INNER JOIN businesses b ON usc.business_id = b.id
  LEFT JOIN (
    -- Count ALL sales per business (regardless of creator)
    SELECT s.business_id, COUNT(*)::integer as count
    FROM sales s
    GROUP BY s.business_id
  ) actual ON actual.business_id = usc.business_id
  WHERE COALESCE(actual.count, 0) != usc.sales_count
    AND b.owner_user_id = usc.user_id;
END;
$$;

COMMENT ON FUNCTION get_sales_count_discrepancies() IS
  'Returns sales count discrepancies for business owners. Counts ALL sales per business regardless of creator.';
