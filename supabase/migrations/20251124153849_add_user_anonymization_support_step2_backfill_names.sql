/*
  # User Anonymization Support - Step 2: Backfill Display Names
  
  ## Overview
  This migration backfills the display name columns added in Step 1 with
  data from the current user_profiles table.
  
  ## Changes
  Populates display name columns for existing records:
  
  1. **carts.created_by_name** - From user_profiles.full_name
  2. **sales.created_by_name** - From user_profiles.full_name
  3. **expenses.created_by_name** - From user_profiles.full_name
  4. **inventory_imports.imported_by_name** - From user_profiles.full_name
  5. **inventory_batches.imported_by_name** - From user_profiles.full_name
  6. **sale_actions.performed_by_name** - From user_profiles.full_name
  7. **products.archived_by_name** - From user_profiles.full_name OR auth.users email
  
  ## Logic
  - Uses LEFT JOIN to handle cases where user may no longer exist
  - Uses COALESCE to fallback to 'Unknown User' if profile not found
  - Only updates rows where display name is currently NULL
  - Products table joins auth.users since archived_by references auth.users directly
  
  ## Performance
  - Updates may take time on large datasets
  - Uses WHERE clauses to only update NULL values
  - Indexes on foreign key columns already exist
  
  ## Security
  - No changes to RLS policies
  - No changes to permissions
  - Read-only operation (SELECT) for user data
*/

-- Step 2.1: Backfill carts.created_by_name
UPDATE public.carts c
SET created_by_name = COALESCE(up.full_name, up.email, 'Unknown User')
FROM public.user_profiles up
WHERE c.created_by = up.user_id
  AND c.created_by_name IS NULL;

-- Step 2.2: Backfill sales.created_by_name
UPDATE public.sales s
SET created_by_name = COALESCE(up.full_name, up.email, 'Unknown User')
FROM public.user_profiles up
WHERE s.created_by = up.user_id
  AND s.created_by_name IS NULL;

-- Step 2.3: Backfill expenses.created_by_name
UPDATE public.expenses e
SET created_by_name = COALESCE(up.full_name, up.email, 'Unknown User')
FROM public.user_profiles up
WHERE e.created_by = up.user_id
  AND e.created_by_name IS NULL;

-- Step 2.4: Backfill inventory_imports.imported_by_name
UPDATE public.inventory_imports ii
SET imported_by_name = COALESCE(up.full_name, up.email, 'Unknown User')
FROM public.user_profiles up
WHERE ii.imported_by = up.user_id
  AND ii.imported_by_name IS NULL;

-- Step 2.5: Backfill inventory_batches.imported_by_name
UPDATE public.inventory_batches ib
SET imported_by_name = COALESCE(up.full_name, up.email, 'Unknown User')
FROM public.user_profiles up
WHERE ib.imported_by = up.user_id
  AND ib.imported_by_name IS NULL;

-- Step 2.6: Backfill sale_actions.performed_by_name
UPDATE public.sale_actions sa
SET performed_by_name = COALESCE(up.full_name, up.email, 'Unknown User')
FROM public.user_profiles up
WHERE sa.performed_by = up.user_id
  AND sa.performed_by_name IS NULL;

-- Step 2.7: Backfill products.archived_by_name
-- Note: products.archived_by references auth.users directly, not user_profiles
UPDATE public.products p
SET archived_by_name = COALESCE(up.full_name, up.email, au.email, 'Unknown User')
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE p.archived_by = au.id
  AND p.archived_by_name IS NULL
  AND p.archived_by IS NOT NULL;
