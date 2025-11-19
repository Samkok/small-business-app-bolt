/*
  # Create Guest Customers for Existing Businesses

  1. Data Migration
    - Creates a "Guest Customer" for each existing business that doesn't have one
    - Sets is_system_customer flag to true for identification
    - Allows quick identification of guest customers per business

  2. Purpose
    - Ensures all existing businesses have a guest customer for instant checkout
    - Maintains consistency across all businesses in the system
    - Supports instant checkout flow without requiring customer selection
*/

-- Create guest customer for each business that doesn't have one
INSERT INTO customers (
  name,
  business_id,
  is_system_customer,
  phone,
  created_at,
  updated_at
)
SELECT 
  'Guest Customer',
  b.id,
  true,
  NULL,
  now(),
  now()
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 
  FROM customers c 
  WHERE c.business_id = b.id 
  AND c.is_system_customer = true
);