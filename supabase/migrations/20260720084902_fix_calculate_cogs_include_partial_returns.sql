/*
# Fix calculate_cogs to Include Partially Returned Sales (I3)

## Summary
Updates the calculate_cogs function to include sales with status 'partially_returned'
in addition to 'completed'. This fixes profit overstatement where partially-returned
sales contributed revenue but zero COGS.

## Changes
- Status filter expanded from s.status = 'completed' to
  s.status IN ('completed', 'partially_returned')

## Security Impact
- None. Function definition and grants unchanged.

## Important Notes
1. This aligns the COGS calculation with the revenue calculation in reports.ts
   which already includes both statuses.
2. The function still uses the snapshot cost_per_unit from cart_items when available.
*/

CREATE OR REPLACE FUNCTION calculate_cogs(business_id_param uuid, start_date timestamp, end_date timestamp)
RETURNS numeric AS $$
DECLARE
  total_cogs numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    ci.quantity * CASE
      WHEN ci.cost_per_unit IS NOT NULL AND ci.cost_per_unit > 0 THEN ci.cost_per_unit
      ELSE COALESCE(p.cost_per_unit, 0)
    END
  ), 0) INTO total_cogs
  FROM sales s
  JOIN carts c ON s.cart_id = c.id
  JOIN cart_items ci ON c.id = ci.cart_id
  JOIN products p ON ci.product_id = p.id
  WHERE s.business_id = business_id_param
    AND s.status IN ('completed', 'partially_returned')
    AND s.sale_date >= start_date
    AND s.sale_date <= end_date;

  RETURN total_cogs;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_catalog;

GRANT EXECUTE ON FUNCTION calculate_cogs(uuid, timestamp, timestamp) TO authenticated;
