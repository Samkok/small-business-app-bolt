-- NOT YET APPLIED to the live project (apply through the Supabase MCP; the live version number will differ from this file name).
-- Low stock: one rule, full rows.
--   * The inventory badge, the dashboard counter, the Low Stock screen and Product Insight
--     used two definitions of "low": the RPC compared with min_stock_level as stored (0 when
--     the form left it blank, so only out-of-stock products matched) while Insight substituted
--     the business's default_low_stock_level. Now the RPC uses the same substitution.
--   * The RPC returned a hand-picked column list without cost_per_unit, currency_id,
--     unit_group_id or is_archived, so the Low Stock screen showed "No cost set" on every
--     product and opened the edit form without currency or units. It now returns product rows.
--   * Archived products are excluded.
-- Return type changes, so DROP + CREATE; grants repeated because CREATE re-grants anon.
DROP FUNCTION IF EXISTS public.get_low_stock_products(uuid);
CREATE FUNCTION public.get_low_stock_products(business_id_param uuid)
 RETURNS SETOF public.products
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT p.*
  FROM products p
  WHERE p.business_id = business_id_param
    AND NOT COALESCE(p.is_archived, false)
    AND p.current_stock <= COALESCE(
          NULLIF(p.min_stock_level, 0),
          (SELECT s.default_low_stock_level FROM product_insight_settings s WHERE s.business_id = p.business_id LIMIT 1),
          10)
    AND public.caller_is_member_or_service(business_id_param)
  ORDER BY p.current_stock ASC;
$function$;
REVOKE ALL ON FUNCTION public.get_low_stock_products(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_low_stock_products(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
