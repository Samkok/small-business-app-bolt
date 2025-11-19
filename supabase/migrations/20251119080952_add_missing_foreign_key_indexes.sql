/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all unindexed foreign keys to improve query performance:
      - `import_costs.batch_id`
      - `inventory_imports.batch_id`
      - `product_history.business_id`
      - `product_history.changed_by_user_id`
      - `product_history.product_id`
      - `products.archived_by`
      - `sales.cart_id`

  2. Notes
    - These indexes will significantly improve JOIN performance
    - Each index is created only if it doesn't already exist
*/

-- Add index for import_costs.batch_id
CREATE INDEX IF NOT EXISTS idx_import_costs_batch_id 
ON import_costs(batch_id);

-- Add index for inventory_imports.batch_id
CREATE INDEX IF NOT EXISTS idx_inventory_imports_batch_id 
ON inventory_imports(batch_id);

-- Add index for product_history.business_id
CREATE INDEX IF NOT EXISTS idx_product_history_business_id 
ON product_history(business_id);

-- Add index for product_history.changed_by_user_id
CREATE INDEX IF NOT EXISTS idx_product_history_changed_by_user_id 
ON product_history(changed_by_user_id);

-- Add index for product_history.product_id
CREATE INDEX IF NOT EXISTS idx_product_history_product_id 
ON product_history(product_id);

-- Add index for products.archived_by
CREATE INDEX IF NOT EXISTS idx_products_archived_by 
ON products(archived_by);

-- Add index for sales.cart_id
CREATE INDEX IF NOT EXISTS idx_sales_cart_id 
ON sales(cart_id);