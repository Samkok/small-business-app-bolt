CREATE OR REPLACE FUNCTION get_quantity_sold(
  start_date timestamptz,
  end_date timestamptz  -- Added missing parameter
)
RETURNS numeric AS $$
  SELECT COALESCE(sum(ct.quantity), 0)  -- Handles NULL results
  FROM cart_items ct 
  JOIN carts c ON ct.cart_id = c.id 
  WHERE ct.created_at >= start_date 
    AND ct.created_at <= end_date
    AND c.status = 'completed';
$$ LANGUAGE sql;