/*
  # Add delivery_cost column to sales table

  1. Changes
    - Add `delivery_cost` column to `sales` table
      - Type: numeric (decimal)
      - Nullable: true
      - Default: null
      - Purpose: Store delivery fee deduction for each sale
  
  2. Notes
    - This column stores the delivery fee that is deducted from the total
    - The value represents a discount/deduction, not an addition
    - Aligns with the `delivery_cost` field already present in `carts` table
    - Used by the instant checkout feature to apply delivery fee discounts
*/

-- Add delivery_cost column to sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sales'
    AND column_name = 'delivery_cost'
  ) THEN
    ALTER TABLE sales ADD COLUMN delivery_cost numeric DEFAULT NULL;
  END IF;
END $$;