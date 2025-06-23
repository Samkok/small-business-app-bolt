-- Create function to get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products(business_id_param uuid)
RETURNS TABLE (
  id uuid,
  name text,
  price numeric(10,2),
  description text,
  image_url text,
  barcode text,
  current_stock integer,
  min_stock_level integer,
  business_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.name,
    p.price,
    p.description,
    p.image_url,
    p.barcode,
    p.current_stock,
    p.min_stock_level,
    p.business_id,
    p.created_at,
    p.updated_at
  FROM products p
  WHERE p.business_id = business_id_param
    AND p.current_stock <= p.min_stock_level
  ORDER BY p.current_stock ASC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_low_stock_products(uuid) TO authenticated;