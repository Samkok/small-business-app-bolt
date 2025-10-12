/*
  # Step 2: Migrate Audit Field Data from Business IDs to User IDs
  
  ## Overview
  This migration converts audit trail fields from business IDs to user IDs.
  The foreign key constraints have been dropped in Step 1, allowing us to update the data.
  
  ## Changes
  
  ### 1. Create Backup Columns
    - Stores original business IDs for reference and rollback capability
  
  ### 2. Migrate Data
    - Maps business IDs to the business owner's user IDs
    - Updates all audit fields across affected tables
  
  ### 3. Validate Migration
    - Ensures all migrated user IDs exist in user_profiles table
    - Raises exception if any invalid IDs are found
  
  ## Security
    - Preserves audit trail integrity
    - All migrated IDs are validated before proceeding
*/

-- Step 1: Add backup columns to store original business IDs (for reference/rollback)
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS created_by_business_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_by_business_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by_business_id uuid;
ALTER TABLE public.inventory_imports ADD COLUMN IF NOT EXISTS imported_by_business_id uuid;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS imported_by_business_id uuid;
ALTER TABLE public.sale_actions ADD COLUMN IF NOT EXISTS performed_by_business_id uuid;

-- Step 2: Backup existing business IDs
UPDATE public.carts SET created_by_business_id = created_by WHERE created_by_business_id IS NULL;
UPDATE public.sales SET created_by_business_id = created_by WHERE created_by_business_id IS NULL;
UPDATE public.expenses SET created_by_business_id = created_by WHERE created_by_business_id IS NULL;
UPDATE public.inventory_imports SET imported_by_business_id = imported_by WHERE imported_by_business_id IS NULL;
UPDATE public.inventory_batches SET imported_by_business_id = imported_by WHERE imported_by_business_id IS NULL;
UPDATE public.sale_actions SET performed_by_business_id = performed_by WHERE performed_by_business_id IS NULL;

-- Step 3: Update audit fields to use user IDs instead of business IDs
-- For carts: map created_by from business ID to the business owner's user ID
UPDATE public.carts c
SET created_by = b.owner_user_id
FROM public.businesses b
WHERE c.created_by = b.id;

-- For sales: map created_by from business ID to the business owner's user ID
UPDATE public.sales s
SET created_by = b.owner_user_id
FROM public.businesses b
WHERE s.created_by = b.id;

-- For expenses: map created_by from business ID to the business owner's user ID
UPDATE public.expenses e
SET created_by = b.owner_user_id
FROM public.businesses b
WHERE e.created_by = b.id;

-- For inventory_imports: map imported_by from business ID to the business owner's user ID
UPDATE public.inventory_imports ii
SET imported_by = b.owner_user_id
FROM public.businesses b
WHERE ii.imported_by = b.id;

-- For inventory_batches: map imported_by from business ID to the business owner's user ID
UPDATE public.inventory_batches ib
SET imported_by = b.owner_user_id
FROM public.businesses b
WHERE ib.imported_by = b.id;

-- For sale_actions: map performed_by from business ID to the business owner's user ID
UPDATE public.sale_actions sa
SET performed_by = b.owner_user_id
FROM public.businesses b
WHERE sa.performed_by = b.id;

-- Step 4: Validate that all migrated user IDs exist in user_profiles
-- This will raise an exception if any invalid IDs are found
DO $$
DECLARE
  invalid_carts integer;
  invalid_sales integer;
  invalid_expenses integer;
  invalid_imports integer;
  invalid_batches integer;
  invalid_actions integer;
  total_invalid integer;
BEGIN
  -- Check each table
  SELECT COUNT(*) INTO invalid_carts
  FROM public.carts c
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = c.created_by);
  
  SELECT COUNT(*) INTO invalid_sales
  FROM public.sales s
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = s.created_by);
  
  SELECT COUNT(*) INTO invalid_expenses
  FROM public.expenses e
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = e.created_by);
  
  SELECT COUNT(*) INTO invalid_imports
  FROM public.inventory_imports ii
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = ii.imported_by);
  
  SELECT COUNT(*) INTO invalid_batches
  FROM public.inventory_batches ib
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = ib.imported_by);
  
  SELECT COUNT(*) INTO invalid_actions
  FROM public.sale_actions sa
  WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = sa.performed_by);
  
  total_invalid := invalid_carts + invalid_sales + invalid_expenses + invalid_imports + invalid_batches + invalid_actions;
  
  IF total_invalid > 0 THEN
    RAISE EXCEPTION 'Migration validation failed: carts=%, sales=%, expenses=%, imports=%, batches=%, actions=%',
      invalid_carts, invalid_sales, invalid_expenses, invalid_imports, invalid_batches, invalid_actions;
  END IF;
  
  RAISE NOTICE 'Data migration validation successful: All user IDs exist in user_profiles';
  RAISE NOTICE 'Migrated records: carts=%, sales=%, expenses=%, imports=%, batches=%, actions=%',
    (SELECT COUNT(*) FROM public.carts),
    (SELECT COUNT(*) FROM public.sales),
    (SELECT COUNT(*) FROM public.expenses),
    (SELECT COUNT(*) FROM public.inventory_imports),
    (SELECT COUNT(*) FROM public.inventory_batches),
    (SELECT COUNT(*) FROM public.sale_actions);
END $$;

-- Step 5: Add comments to backup columns for documentation
COMMENT ON COLUMN public.carts.created_by_business_id IS 'Backup of original business ID before multi-tenant migration (2025-01-12)';
COMMENT ON COLUMN public.sales.created_by_business_id IS 'Backup of original business ID before multi-tenant migration (2025-01-12)';
COMMENT ON COLUMN public.expenses.created_by_business_id IS 'Backup of original business ID before multi-tenant migration (2025-01-12)';
COMMENT ON COLUMN public.inventory_imports.imported_by_business_id IS 'Backup of original business ID before multi-tenant migration (2025-01-12)';
COMMENT ON COLUMN public.inventory_batches.imported_by_business_id IS 'Backup of original business ID before multi-tenant migration (2025-01-12)';
COMMENT ON COLUMN public.sale_actions.performed_by_business_id IS 'Backup of original business ID before multi-tenant migration (2025-01-12)';
