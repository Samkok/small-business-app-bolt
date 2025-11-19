/*
  # Add Remaining Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all remaining unindexed foreign keys:
      - `carts.created_by`
      - `expenses.category_id`
      - `expenses.created_by`
      - `inventory_batches.imported_by`
      - `sale_actions.performed_by`
      - `sales.created_by`

  2. Notes
    - These indexes will improve query performance for JOINs and foreign key lookups
    - Each index is created only if it doesn't already exist
    - These are critical for queries that filter or join on these foreign key columns
*/

-- Add index for carts.created_by
CREATE INDEX IF NOT EXISTS idx_carts_created_by 
ON carts(created_by);

-- Add index for expenses.category_id
CREATE INDEX IF NOT EXISTS idx_expenses_category_id 
ON expenses(category_id);

-- Add index for expenses.created_by
CREATE INDEX IF NOT EXISTS idx_expenses_created_by 
ON expenses(created_by);

-- Add index for inventory_batches.imported_by
CREATE INDEX IF NOT EXISTS idx_inventory_batches_imported_by 
ON inventory_batches(imported_by);

-- Add index for sale_actions.performed_by
CREATE INDEX IF NOT EXISTS idx_sale_actions_performed_by 
ON sale_actions(performed_by);

-- Add index for sales.created_by
CREATE INDEX IF NOT EXISTS idx_sales_created_by 
ON sales(created_by);