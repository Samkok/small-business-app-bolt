/*
# Order status for the customer's page, now with the cart's current items

get_web_order_status(p_token) returned only the status, order number and shop contact details,
so the website showed the ordered items from a copy kept in the customer's own browser and the
list was missing on any other device. Returning the items from the database fixes that and also
shows the customer what the shop changed (removed item, different quantity).

The website already uses `items` when present; menu-get passes the JSON through untouched, so
no function redeploy and no website change is needed.

Never add cost_per_unit, stock levels, the cart's notes or any customer details here:
anyone holding the link can read this. `subtotal` is the line total after any per-item discount.
The cart-level discount and delivery_cost are deliberately left out (the shop absorbs the courier
fee, which would read as a wrong total to a customer).

Dry-run on production 2026-09-20 (rolled back): W-BE2F8 returned its one item with KHR currency;
an unknown token and an app cart's id both returned NULL; anon and authenticated cannot execute.
*/
CREATE OR REPLACE FUNCTION public.get_web_order_status(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT jsonb_build_object(
    'order_ref', c.order_ref,
    'status', CASE c.status WHEN 'active' THEN 'received'
                            WHEN 'completed' THEN 'confirmed'
                            ELSE 'cancelled' END,
    'created_at', c.created_at,
    'business_name', b.business_name,
    'business_slug', b.menu_slug,
    'business_telegram', b.menu_telegram,
    'business_phone', b.receipt_phone,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'name', p.name,
               'quantity', ci.quantity,
               'unit_price', ci.unit_price,
               'subtotal', ci.subtotal,
               'currency', CASE WHEN COALESCE(cur.id, dc.id) IS NULL THEN NULL
                                ELSE jsonb_build_object(
                                  'id', COALESCE(cur.id, dc.id),
                                  'code', COALESCE(cur.code, dc.code),
                                  'symbol', COALESCE(cur.symbol, dc.symbol)) END
             ) ORDER BY ci.created_at, p.name)
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      LEFT JOIN currencies cur ON cur.id = COALESCE(ci.currency_id, p.currency_id)
      LEFT JOIN currencies dc ON dc.business_id = c.business_id AND dc.is_default
      WHERE ci.cart_id = c.id
    ), '[]'::jsonb)
  )
  FROM carts c
  JOIN businesses b ON b.id = c.business_id
  WHERE c.web_order_token = p_token AND c.source = 'web';
$$;

-- CREATE OR REPLACE keeps the existing grants; repeated so the file is safe on a fresh database.
REVOKE ALL ON FUNCTION public.get_web_order_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_web_order_status(uuid) TO service_role;
