/*
  # Step 3: Add Correct Foreign Key Constraints and Indexes
  
  ## Overview
  This is the final step in migrating audit fields. We add correct foreign key constraints
  that reference user_profiles instead of businesses, and create performance indexes.
  
  ## Changes
  
  ### 1. Add Foreign Key Constraints
    - All audit fields now reference `user_profiles(user_id)`
    - Constraints use ON DELETE RESTRICT to prevent data loss
  
  ### 2. Create Helper Function
    - `get_user_display_name` for displaying user names in audit trails
  
  ### 3. Add Performance Indexes
    - Indexes on audit fields for faster queries
    - Composite indexes for common query patterns
  
  ## Security
    - Maintains all existing RLS policies
    - Improves query performance for multi-tenant operations
*/

-- Add correct foreign key constraints pointing to user_profiles
ALTER TABLE public.carts 
  ADD CONSTRAINT carts_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.sales 
  ADD CONSTRAINT sales_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.expenses 
  ADD CONSTRAINT expenses_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_imports 
  ADD CONSTRAINT inventory_imports_imported_by_fkey 
  FOREIGN KEY (imported_by) REFERENCES public.user_profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_batches 
  ADD CONSTRAINT inventory_batches_imported_by_fkey 
  FOREIGN KEY (imported_by) REFERENCES public.user_profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE public.sale_actions 
  ADD CONSTRAINT sale_actions_performed_by_fkey 
  FOREIGN KEY (performed_by) REFERENCES public.user_profiles(user_id) ON DELETE RESTRICT;

-- Create helper function to get user display name for audit trails
CREATE OR REPLACE FUNCTION get_user_display_name(user_id_param uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(full_name, email, 'Unknown User')
  FROM public.user_profiles
  WHERE user_id = user_id_param;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_display_name(uuid) TO authenticated;

-- Create indexes for improved query performance on audit fields
CREATE INDEX IF NOT EXISTS idx_carts_created_by ON public.carts(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_imports_imported_by ON public.inventory_imports(imported_by);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_imported_by ON public.inventory_batches(imported_by);
CREATE INDEX IF NOT EXISTS idx_sale_actions_performed_by ON public.sale_actions(performed_by);

-- Create composite indexes for common query patterns (business_id + timestamp)
CREATE INDEX IF NOT EXISTS idx_carts_business_created ON public.carts(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON public.sales(business_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON public.expenses(business_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_business_date ON public.inventory_batches(business_id, purchase_date DESC);

-- Create index for sales by status (for filtering completed/voided sales)
CREATE INDEX IF NOT EXISTS idx_sales_business_status ON public.sales(business_id, status);

-- Create composite index for user_business_roles lookups
CREATE INDEX IF NOT EXISTS idx_user_business_roles_lookup ON public.user_business_roles(user_id, business_id);
