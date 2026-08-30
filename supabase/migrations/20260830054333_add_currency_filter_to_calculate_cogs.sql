/*
# Add optional currency_id filter to calculate_cogs function

## Summary
Adds an optional `currency_id_param` parameter to the `calculate_cogs` function.
When provided, COGS is calculated only for sales made in that specific currency.
When NULL (default), behavior is unchanged — all sales are included.

## Modified Functions
- `calculate_cogs`: Added 4th parameter `currency_id_param uuid DEFAULT NULL`
  - Both the total COGS query and the returned COGS query now filter by
    `s.currency_id = currency_id_param` when the parameter is not NULL.

## Security Impact
- None. Same grants, same behavior. The new parameter is optional with a NULL default,
  so all existing callers continue to work unchanged.

## Important Notes
1. This is a backwards-compatible change — existing calls without the 4th arg still work.
2. The function signature changes from (uuid, timestamp, timestamp) to 
   (uuid, timestamp, timestamp, uuid), so we need to grant on the new signature.
*/

CREATE OR REPLACE FUNCTION calculate_cogs(
  business_id_param uuid,
  start_date timestamp,
  end_date timestamp,
  currency_id_param uuid DEFAULT NULL
)
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
    AND s.sale_date <= end_date
    AND (currency_id_param IS NULL OR s.currency_id = currency_id_param);

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
    AND s.sale_date <= end_date
    AND (currency_id_param IS NULL OR s.currency_id = currency_id_param);

  RETURN total_cogs - returned_cogs;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_catalog;

GRANT EXECUTE ON FUNCTION calculate_cogs(uuid, timestamp, timestamp, uuid) TO authenticated;
