/*
  # User Anonymization Support - Step 3: Make Audit Columns Nullable
  
  ## Overview
  Before we can change foreign key constraints to ON DELETE SET NULL, we must first
  make the audit columns nullable. Currently they are defined as NOT NULL which
  prevents SET NULL behavior.
  
  ## Problem
  Current schema defines audit columns as NOT NULL:
  - carts.created_by (NOT NULL)
  - sales.created_by (NOT NULL)
  - expenses.created_by (NOT NULL)
  - inventory_imports.imported_by (NOT NULL)
  - inventory_batches.imported_by (NOT NULL)
  - sale_actions.performed_by (NOT NULL)
  
  This prevents using ON DELETE SET NULL on the foreign key constraints.
  
  ## Solution
  Change these columns to allow NULL values. This is safe because:
  1. Display name columns (added in Step 1) preserve audit trail
  2. NULL indicates user was deleted (GDPR/CCPA compliance)
  3. Application code will check display_name column first, then user_id
  
  ## Changes
  Makes 6 columns nullable (products.archived_by already nullable):
  
  1. carts.created_by - Remove NOT NULL
  2. sales.created_by - Remove NOT NULL
  3. expenses.created_by - Remove NOT NULL
  4. inventory_imports.imported_by - Remove NOT NULL
  5. inventory_batches.imported_by - Remove NOT NULL
  6. sale_actions.performed_by - Remove NOT NULL
  
  ## Security
  - No changes to RLS policies
  - No changes to permissions
  - Application code must handle NULL values gracefully
  
  ## Application Impact
  - Queries must check display_name column OR user_id
  - NULL user_id means user was deleted
  - Display name preserved for audit trail
*/

-- Step 3.1: Make carts.created_by nullable
ALTER TABLE public.carts 
  ALTER COLUMN created_by DROP NOT NULL;

-- Step 3.2: Make sales.created_by nullable
ALTER TABLE public.sales 
  ALTER COLUMN created_by DROP NOT NULL;

-- Step 3.3: Make expenses.created_by nullable
ALTER TABLE public.expenses 
  ALTER COLUMN created_by DROP NOT NULL;

-- Step 3.4: Make inventory_imports.imported_by nullable
ALTER TABLE public.inventory_imports 
  ALTER COLUMN imported_by DROP NOT NULL;

-- Step 3.5: Make inventory_batches.imported_by nullable
ALTER TABLE public.inventory_batches 
  ALTER COLUMN imported_by DROP NOT NULL;

-- Step 3.6: Make sale_actions.performed_by nullable
ALTER TABLE public.sale_actions 
  ALTER COLUMN performed_by DROP NOT NULL;

-- Add comments to document why these are nullable
COMMENT ON COLUMN public.carts.created_by IS 'User who created this cart. NULL if user deleted (see created_by_name for audit trail)';
COMMENT ON COLUMN public.sales.created_by IS 'User who created this sale. NULL if user deleted (see created_by_name for audit trail)';
COMMENT ON COLUMN public.expenses.created_by IS 'User who created this expense. NULL if user deleted (see created_by_name for audit trail)';
COMMENT ON COLUMN public.inventory_imports.imported_by IS 'User who performed this import. NULL if user deleted (see imported_by_name for audit trail)';
COMMENT ON COLUMN public.inventory_batches.imported_by IS 'User who imported this batch. NULL if user deleted (see imported_by_name for audit trail)';
COMMENT ON COLUMN public.sale_actions.performed_by IS 'User who performed this action. NULL if user deleted (see performed_by_name for audit trail)';
