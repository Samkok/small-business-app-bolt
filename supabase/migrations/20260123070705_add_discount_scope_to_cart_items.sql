/*
  # Add discount scope field to cart items

  1. Changes
    - Add `item_discount_scope` column to `cart_items` table
      - Type: text with check constraint ('per_unit' or 'total')
      - Default: 'total' for backward compatibility
      - Nullable to support items without discounts
    
  2. Purpose
    - Allow users to specify whether item discounts apply per unit or to the total
    - Example 1 (per_unit): $10 product, qty 10, $1 discount per unit = $9 × 10 = $90
    - Example 2 (total): $10 product, qty 10, $9 discount total = $100 - $9 = $91
    
  3. Backward Compatibility
    - Default value 'total' maintains current behavior
    - Existing records without scope will use 'total' calculation
*/

-- Add discount scope column to cart_items table
ALTER TABLE cart_items 
ADD COLUMN IF NOT EXISTS item_discount_scope text DEFAULT 'total' 
CHECK (item_discount_scope IN ('per_unit', 'total'));

-- Add comment to document the field
COMMENT ON COLUMN cart_items.item_discount_scope IS 
'Defines how item discount is applied: per_unit (discount per unit × quantity) or total (discount on line total)';
