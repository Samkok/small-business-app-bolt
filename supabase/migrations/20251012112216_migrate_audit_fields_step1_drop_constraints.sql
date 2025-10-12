/*
  # Step 1: Drop Incorrect Foreign Key Constraints
  
  ## Overview
  This is the first step in migrating audit fields from business IDs to user IDs.
  We need to drop the existing foreign key constraints before we can migrate the data.
  
  ## Changes
  
  ### 1. Drop Foreign Key Constraints
    - Drops constraints that reference businesses table for audit fields
    - This allows us to update the data in subsequent migrations
  
  ### 2. Temporarily Disable RLS
    - RLS is disabled during constraint changes to avoid conflicts
    - Will be re-enabled after migration is complete
  
  ## Security
    - This is a temporary state - constraints will be re-added in Step 3
    - RLS policies remain defined and will be re-enabled
*/

-- Temporarily disable RLS for schema changes
ALTER TABLE public.carts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_actions DISABLE ROW LEVEL SECURITY;

-- Drop incorrect foreign key constraints
ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_created_by_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_created_by_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.inventory_imports DROP CONSTRAINT IF EXISTS inventory_imports_imported_by_fkey;
ALTER TABLE public.inventory_batches DROP CONSTRAINT IF EXISTS inventory_batches_imported_by_fkey;
ALTER TABLE public.sale_actions DROP CONSTRAINT IF EXISTS sale_actions_performed_by_fkey;

-- Re-enable RLS (policies still in effect, just constraints removed)
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_actions ENABLE ROW LEVEL SECURITY;
