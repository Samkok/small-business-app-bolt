/*
  # User Anonymization Support - Step 1: Add Display Name Columns
  
  ## Overview
  This is the first step in implementing GDPR/CCPA-compliant user deletion.
  Currently, users cannot delete their accounts if they've created any business records
  due to ON DELETE RESTRICT constraints. This migration series will:
  
  1. Add display name columns to preserve audit trail
  2. Backfill existing data with current user names
  3. Update constraints to allow user deletion (ON DELETE SET NULL)
  4. Create trigger to preserve names before deletion
  
  ## Problem Statement
  - Tables use ON DELETE RESTRICT on user foreign keys
  - This prevents user account deletion (GDPR/CCPA violation)
  - Users have "right to be forgotten" and must be able to delete accounts
  - Business records must be preserved for accounting/legal compliance
  
  ## Solution
  - Add denormalized display name columns
  - Change constraints to ON DELETE SET NULL
  - Preserve non-PII display names for audit trail
  - Allow user deletion while keeping business data intact
  
  ## This Migration (Step 1)
  Adds display name columns to all tables with user audit fields:
  
  ### Tables Modified (7 tables):
  1. **carts** - Add created_by_name (TEXT)
  2. **sales** - Add created_by_name (TEXT)
  3. **expenses** - Add created_by_name (TEXT)
  4. **inventory_imports** - Add imported_by_name (TEXT)
  5. **inventory_batches** - Add imported_by_name (TEXT)
  6. **sale_actions** - Add performed_by_name (TEXT)
  7. **products** - Add archived_by_name (TEXT)
  
  ## Security
  - No changes to RLS policies
  - No changes to permissions
  - Columns are nullable and optional
  - Non-breaking change (backward compatible)
  
  ## Notes
  - Display names are non-PII (just "John D." or "Jane Smith")
  - Used for audit trail after user deletion
  - Application should populate these on record creation
  - Next steps will backfill existing data and update constraints
*/

-- Step 1.1: Add created_by_name to carts table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'carts' 
    AND column_name = 'created_by_name'
  ) THEN
    ALTER TABLE public.carts ADD COLUMN created_by_name TEXT;
    COMMENT ON COLUMN public.carts.created_by_name IS 'Display name of user who created this cart (preserved after user deletion)';
  END IF;
END $$;

-- Step 1.2: Add created_by_name to sales table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'created_by_name'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN created_by_name TEXT;
    COMMENT ON COLUMN public.sales.created_by_name IS 'Display name of user who created this sale (preserved after user deletion)';
  END IF;
END $$;

-- Step 1.3: Add created_by_name to expenses table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'expenses' 
    AND column_name = 'created_by_name'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN created_by_name TEXT;
    COMMENT ON COLUMN public.expenses.created_by_name IS 'Display name of user who created this expense (preserved after user deletion)';
  END IF;
END $$;

-- Step 1.4: Add imported_by_name to inventory_imports table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory_imports' 
    AND column_name = 'imported_by_name'
  ) THEN
    ALTER TABLE public.inventory_imports ADD COLUMN imported_by_name TEXT;
    COMMENT ON COLUMN public.inventory_imports.imported_by_name IS 'Display name of user who performed this import (preserved after user deletion)';
  END IF;
END $$;

-- Step 1.5: Add imported_by_name to inventory_batches table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory_batches' 
    AND column_name = 'imported_by_name'
  ) THEN
    ALTER TABLE public.inventory_batches ADD COLUMN imported_by_name TEXT;
    COMMENT ON COLUMN public.inventory_batches.imported_by_name IS 'Display name of user who imported this batch (preserved after user deletion)';
  END IF;
END $$;

-- Step 1.6: Add performed_by_name to sale_actions table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sale_actions' 
    AND column_name = 'performed_by_name'
  ) THEN
    ALTER TABLE public.sale_actions ADD COLUMN performed_by_name TEXT;
    COMMENT ON COLUMN public.sale_actions.performed_by_name IS 'Display name of user who performed this action (preserved after user deletion)';
  END IF;
END $$;

-- Step 1.7: Add archived_by_name to products table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'archived_by_name'
  ) THEN
    ALTER TABLE public.products ADD COLUMN archived_by_name TEXT;
    COMMENT ON COLUMN public.products.archived_by_name IS 'Display name of user who archived this product (preserved after user deletion)';
  END IF;
END $$;

-- Create indexes for the new display name columns (optional, for query performance)
CREATE INDEX IF NOT EXISTS idx_carts_created_by_name ON public.carts(created_by_name) WHERE created_by_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_created_by_name ON public.sales(created_by_name) WHERE created_by_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_created_by_name ON public.expenses(created_by_name) WHERE created_by_name IS NOT NULL;
