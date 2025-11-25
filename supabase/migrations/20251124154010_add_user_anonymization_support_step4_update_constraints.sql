/*
  # User Anonymization Support - Step 4: Update Foreign Key Constraints
  
  ## Overview
  This migration updates foreign key constraints from ON DELETE RESTRICT to ON DELETE SET NULL.
  This allows user deletion while preserving business records with anonymized user references.
  
  ## Problem
  Current constraints use ON DELETE RESTRICT which prevents user deletion if they have
  created any business records (sales, expenses, etc). This violates GDPR/CCPA requirements
  for user data deletion ("right to be forgotten").
  
  ## Solution
  Change all audit field foreign keys to use ON DELETE SET NULL:
  - When user is deleted, their UUID references become NULL
  - Display name columns (added in Step 1) preserve non-PII audit trail
  - Business records remain intact for accounting/legal compliance
  
  ## Changes
  Updates 7 foreign key constraints:
  
  1. **carts_created_by_fkey** - RESTRICT → SET NULL
  2. **sales_created_by_fkey** - RESTRICT → SET NULL
  3. **expenses_created_by_fkey** - RESTRICT → SET NULL
  4. **inventory_imports_imported_by_fkey** - RESTRICT → SET NULL
  5. **inventory_batches_imported_by_fkey** - RESTRICT → SET NULL
  6. **sale_actions_performed_by_fkey** - RESTRICT → SET NULL
  7. **products.archived_by** - Add explicit SET NULL constraint
  
  ## Security
  - No changes to RLS policies
  - No changes to permissions
  - Only affects cascade deletion behavior
  
  ## Impact
  - User deletion now works properly
  - Business data preserved
  - Audit trail maintained via display name columns
  - GDPR/CCPA compliant
*/

-- Step 4.1: Update carts.created_by constraint
ALTER TABLE public.carts 
  DROP CONSTRAINT IF EXISTS carts_created_by_fkey;

ALTER TABLE public.carts 
  ADD CONSTRAINT carts_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES public.user_profiles(user_id) 
  ON DELETE SET NULL;

-- Step 4.2: Update sales.created_by constraint
ALTER TABLE public.sales 
  DROP CONSTRAINT IF EXISTS sales_created_by_fkey;

ALTER TABLE public.sales 
  ADD CONSTRAINT sales_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES public.user_profiles(user_id) 
  ON DELETE SET NULL;

-- Step 4.3: Update expenses.created_by constraint
ALTER TABLE public.expenses 
  DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;

ALTER TABLE public.expenses 
  ADD CONSTRAINT expenses_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES public.user_profiles(user_id) 
  ON DELETE SET NULL;

-- Step 4.4: Update inventory_imports.imported_by constraint
ALTER TABLE public.inventory_imports 
  DROP CONSTRAINT IF EXISTS inventory_imports_imported_by_fkey;

ALTER TABLE public.inventory_imports 
  ADD CONSTRAINT inventory_imports_imported_by_fkey 
  FOREIGN KEY (imported_by) 
  REFERENCES public.user_profiles(user_id) 
  ON DELETE SET NULL;

-- Step 4.5: Update inventory_batches.imported_by constraint
ALTER TABLE public.inventory_batches 
  DROP CONSTRAINT IF EXISTS inventory_batches_imported_by_fkey;

ALTER TABLE public.inventory_batches 
  ADD CONSTRAINT inventory_batches_imported_by_fkey 
  FOREIGN KEY (imported_by) 
  REFERENCES public.user_profiles(user_id) 
  ON DELETE SET NULL;

-- Step 4.6: Update sale_actions.performed_by constraint
ALTER TABLE public.sale_actions 
  DROP CONSTRAINT IF EXISTS sale_actions_performed_by_fkey;

ALTER TABLE public.sale_actions 
  ADD CONSTRAINT sale_actions_performed_by_fkey 
  FOREIGN KEY (performed_by) 
  REFERENCES public.user_profiles(user_id) 
  ON DELETE SET NULL;

-- Step 4.7: Add explicit constraint for products.archived_by
-- Note: This column references auth.users directly, not user_profiles
ALTER TABLE public.products 
  DROP CONSTRAINT IF EXISTS products_archived_by_fkey;

ALTER TABLE public.products 
  ADD CONSTRAINT products_archived_by_fkey 
  FOREIGN KEY (archived_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;
