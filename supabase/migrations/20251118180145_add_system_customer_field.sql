/*
  # Add System Customer Support

  1. Schema Changes
    - Add `is_system_customer` boolean field to customers table
    - This field identifies system-generated customers like "Guest Customer"
    - Defaults to false for regular customers
    - Enables filtering and special handling of guest customers

  2. Purpose
    - Supports instant checkout flow with guest customer option
    - Allows each business to have a dedicated guest customer
    - Maintains data integrity for sales without specific customer selection
*/

-- Add is_system_customer field to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'is_system_customer'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_system_customer boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Create index for faster guest customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_system_customer ON customers(business_id, is_system_customer) WHERE is_system_customer = true;