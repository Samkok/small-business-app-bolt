-- Update calculate_cogs to prefer the stored cost_per_unit snapshot from cart_items
-- Falls back to products.cost_per_unit for any records where snapshot is 0/NULL
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
    AND s.status = 'completed'
    AND s.sale_date >= start_date
    AND s.sale_date <= end_date;
  
  RETURN total_cogs;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_catalog;

GRANT EXECUTE ON FUNCTION calculate_cogs(uuid, timestamp, timestamp) TO authenticated;
