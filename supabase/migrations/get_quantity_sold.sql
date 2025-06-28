CREATE OR REPLACE FUNCTION get_quantity_sold(
  business_id_param uuid,
  start_date timestamptz,
  end_date timestamptz
)
RETURNS numeric AS $$
  SELECT COALESCE(SUM(ct.quantity), 0)::numeric
  FROM cart_items ct
  JOIN carts c ON ct.cart_id = c.id
  WHERE ct.created_at >= start_date
    AND ct.created_at < end_date
    AND c.status = 'completed'
    AND c.business_id = business_id_param;
$$ LANGUAGE sql SECURITY INVOKER;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_business_cart_totals(uuid, timestamptz, timestamptz) TO authenticated;