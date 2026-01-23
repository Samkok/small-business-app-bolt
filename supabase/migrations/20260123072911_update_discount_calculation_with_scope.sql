/*
  # Update Discount Calculation to Support Scope

  1. Changes
    - Update calculate_item_discount function to accept discount_scope parameter
    - Add logic to handle 'per_unit' and 'total' discount scopes
    - Update trigger function to pass discount scope to calculation
    - Recalculate existing cart items with default 'total' scope

  2. Discount Scope Logic
    - per_unit: Discount applies to each unit, then multiplies by quantity
      Example: $10 product, qty 10, $1 per unit = ($10 - $1) × 10 = $90
    - total: Discount applies to line total (quantity × unit price)
      Example: $10 product, qty 10, $9 total = ($10 × 10) - $9 = $91

  3. Security
    - Maintains existing RLS policies
    - No changes to permissions or access control
*/

-- Update the calculate_item_discount function to support discount scope
CREATE OR REPLACE FUNCTION calculate_item_discount(
  quantity integer,
  unit_price numeric,
  discount_type text,
  discount_value numeric,
  discount_scope text DEFAULT 'total'
) RETURNS numeric AS $$
DECLARE
  original_subtotal numeric;
  discount_amount numeric;
  effective_scope text;
BEGIN
  original_subtotal := quantity * unit_price;
  
  IF discount_type IS NULL OR discount_value IS NULL OR discount_value = 0 THEN
    RETURN 0;
  END IF;
  
  -- Default to 'total' if scope is not provided or invalid
  effective_scope := COALESCE(discount_scope, 'total');
  IF effective_scope NOT IN ('per_unit', 'total') THEN
    effective_scope := 'total';
  END IF;
  
  -- Calculate discount based on type and scope
  IF discount_type = 'percentage' THEN
    IF effective_scope = 'per_unit' THEN
      -- Apply percentage discount to unit price, then multiply by quantity
      discount_amount := (unit_price * (discount_value / 100)) * quantity;
    ELSE
      -- Apply percentage discount to total (quantity × unit_price)
      discount_amount := original_subtotal * (discount_value / 100);
    END IF;
  ELSIF discount_type = 'fixed' THEN
    IF effective_scope = 'per_unit' THEN
      -- Apply fixed discount to unit price (capped at unit price), then multiply by quantity
      discount_amount := LEAST(discount_value, unit_price) * quantity;
    ELSE
      -- Apply fixed discount to total (capped at total)
      discount_amount := LEAST(discount_value, original_subtotal);
    END IF;
  ELSE
    discount_amount := 0;
  END IF;
  
  RETURN GREATEST(0, discount_amount);
END;
$$ LANGUAGE plpgsql;

-- Update the trigger function to pass discount scope
CREATE OR REPLACE FUNCTION update_cart_item_discount_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate original subtotal
  NEW.original_subtotal := NEW.quantity * NEW.unit_price;
  
  -- Calculate discount amount with scope
  NEW.item_discount_amount := calculate_item_discount(
    NEW.quantity,
    NEW.unit_price,
    NEW.item_discount_type,
    NEW.item_discount_value,
    COALESCE(NEW.item_discount_scope, 'total')
  );
  
  -- Calculate final subtotal after discount
  NEW.subtotal := NEW.original_subtotal - NEW.item_discount_amount;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalculate existing cart items to ensure consistency
-- This will trigger the updated calculation for all existing items
UPDATE cart_items
SET updated_at = updated_at
WHERE item_discount_type IS NOT NULL
  AND item_discount_value IS NOT NULL
  AND item_discount_value > 0;
