/*
# Fix calculate_cogs: subtract returned items' COGS (A3.3/A3.6)

## Summary
Updates calculate_cogs to net out returned items for partially_returned sales.
Previously, COGS was calculated on ALL cart items regardless of return status,
while revenue was correctly reduced by returns — causing profit understatement.

## Changes
- Subtracts the cost of returned items (from sale_actions.items_metadata) for
  partially_returned sales.
- Uses snapshot cost_per_unit from cart_items when available, falls back to product cost.

## Security Impact
- None. Same grants, same SECURITY DEFINER behavior.

## Important Notes
1. Returns are tracked in sale_actions with action_type='return' and items_metadata JSON.
2. items_metadata contains [{productId, quantity, ...}] for each returned item.
3. This aligns COGS with the revenue calculation (both now net returns).
*/

CREATE OR REPLACE FUNCTION calculate_cogs(business_id_param uuid, start_date timestamp, end_date timestamp)
RETURNS numeric AS $$
DECLARE
  total_cogs numeric := 0;
  returned_cogs numeric := 0;
BEGIN
  -- Total COGS from all completed + partially_returned sales
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

  -- Subtract COGS for returned items in partially_returned sales
  SELECT COALESCE(SUM(
    (item->>'quantity')::integer * CASE
      WHEN ci.cost_per_unit IS NOT NULL AND ci.cost_per_unit > 0 THEN ci.cost_per_unit
      ELSE COALESCE(p.cost_per_unit, 0)
    END
  ), 0) INTO returned_cogs
  FROM sales s
  JOIN sale_actions sa ON sa.sale_id = s.id
  CROSS JOIN LATERAL jsonb_array_elements(sa.items_metadata::jsonb) AS item
  JOIN carts c ON s.cart_id = c.id
  JOIN cart_items ci ON c.id = ci.cart_id AND ci.product_id = (item->>'productId')::uuid
  JOIN products p ON ci.product_id = p.id
  WHERE s.business_id = business_id_param
    AND s.status = 'partially_returned'
    AND sa.action_type = 'return'
    AND s.sale_date >= start_date
    AND s.sale_date <= end_date;

  RETURN total_cogs - returned_cogs;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_catalog;

GRANT EXECUTE ON FUNCTION calculate_cogs(uuid, timestamp, timestamp) TO authenticated;
