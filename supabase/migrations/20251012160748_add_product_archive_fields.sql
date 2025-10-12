/*
  # Add Product Archive Fields

  1. Changes to products table
    - Add `is_archived` (boolean) column to track archived status
    - Add `archived_at` (timestamptz) column to track when product was archived
    - Add `archived_by` (uuid) column to track who archived the product
    
  2. Indexes
    - Add index on is_archived for efficient filtering
    
  3. Notes
    - Products with transaction history will be archived (soft delete)
    - Products without transaction history will be hard deleted
    - Archived products are hidden from normal queries but preserved for reporting
*/

-- Add is_archived column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE products ADD COLUMN is_archived boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add archived_at column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE products ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- Add archived_by column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE products ADD COLUMN archived_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create index on is_archived for efficient filtering
CREATE INDEX IF NOT EXISTS idx_products_is_archived ON products(is_archived);

-- Create composite index for business_id and is_archived (commonly queried together)
CREATE INDEX IF NOT EXISTS idx_products_business_archived ON products(business_id, is_archived);