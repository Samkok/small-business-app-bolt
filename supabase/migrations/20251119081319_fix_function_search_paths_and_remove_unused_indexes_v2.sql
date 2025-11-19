/*
  # Fix Function Search Paths and Remove Unused Indexes

  1. Security Improvements
    - Set immutable search_path for all functions to prevent SQL injection
    - This ensures functions only look up objects in specified schemas

  2. Performance Improvements
    - Remove unused indexes that are consuming storage and slowing down writes:
      - idx_expenses_category_id
      - idx_cart_items_discount_type
      - idx_sales_created_by
      - idx_expenses_created_by
      - idx_inventory_batches_imported_by
      - idx_sale_actions_performed_by
      - idx_sales_discount_type
      - idx_carts_created_by
      - idx_user_business_roles_lookup

  3. Functions Updated
    - All public schema functions will have their search_path set to 'public, pg_catalog'
*/

-- ============================================================================
-- REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_expenses_category_id;
DROP INDEX IF EXISTS idx_cart_items_discount_type;
DROP INDEX IF EXISTS idx_sales_created_by;
DROP INDEX IF EXISTS idx_expenses_created_by;
DROP INDEX IF EXISTS idx_inventory_batches_imported_by;
DROP INDEX IF EXISTS idx_sale_actions_performed_by;
DROP INDEX IF EXISTS idx_sales_discount_type;
DROP INDEX IF EXISTS idx_carts_created_by;
DROP INDEX IF EXISTS idx_user_business_roles_lookup;

-- ============================================================================
-- FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Functions with no parameters
ALTER FUNCTION handle_user_email_update() SET search_path = public, pg_catalog;
ALTER FUNCTION update_sale_returned_amount() SET search_path = public, pg_catalog;
ALTER FUNCTION update_product_cost_per_unit() SET search_path = public, pg_catalog;
ALTER FUNCTION handle_import_update() SET search_path = public, pg_catalog;
ALTER FUNCTION handle_import_delete() SET search_path = public, pg_catalog;
ALTER FUNCTION update_cart_item_discount_amounts() SET search_path = public, pg_catalog;
ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_catalog;

-- Functions with parameters
ALTER FUNCTION get_user_display_name(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION is_business_admin(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION invite_user_to_business(uuid, text, text) SET search_path = public, pg_catalog;
ALTER FUNCTION change_user_business_role(uuid, uuid, text) SET search_path = public, pg_catalog;
ALTER FUNCTION remove_user_from_business(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION create_business(text, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION get_quantity_sold(uuid, timestamp with time zone, timestamp with time zone) SET search_path = public, pg_catalog;
ALTER FUNCTION get_low_stock_products(uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION calculate_cogs(uuid, timestamp without time zone, timestamp without time zone) SET search_path = public, pg_catalog;
ALTER FUNCTION get_distinct_customer_count_for_sales(uuid, timestamp with time zone, timestamp with time zone) SET search_path = public, pg_catalog;
ALTER FUNCTION calculate_item_discount(integer, numeric, text, numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION calculate_sale_discount(numeric, text, numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION user_has_business_access(uuid, uuid) SET search_path = public, pg_catalog;