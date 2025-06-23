/*
  # Enhance Discount Tracking

  1. Schema Updates
    - Add discount tracking columns to cart_items table
    - Add discount tracking columns to sales table for overall sale discounts
    - Update existing functions to handle discount calculations
    - Maintain backward compatibility with existing data

  2. New Columns
    - cart_items: item_discount_type, item_discount_value, item_discount_amount
    - sales: sale_discount_type, sale_discount_value, sale_discount_amount
    - Enhanced subtotal and total calculations

  3. Security
    - Maintain existing RLS policies
    - Add proper constraints for discount values
*/

-- Add discount tracking columns to cart_items
DO $$
BEGIN
  -- Add item-level discount columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'item_discount_type'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN item_discount_type text CHECK (item_discount_type IN ('percentage', 'fixed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'item_discount_value'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN item_discount_value numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'item_discount_amount'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN item_discount_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'original_subtotal'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN original_subtotal numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add sale-level discount tracking columns to sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'sale_discount_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN sale_discount_type text CHECK (sale_discount_type IN ('percentage', 'fixed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'sale_discount_value'
  ) THEN
    ALTER TABLE sales ADD COLUMN sale_discount_value numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'sale_discount_amount'
  ) THEN
    ALTER TABLE sales ADD COLUMN sale_discount_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'subtotal_before_discount'
  ) THEN
    ALTER TABLE sales ADD COLUMN subtotal_before_discount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Create function to calculate item discount amount
CREATE OR REPLACE FUNCTION calculate_item_discount(
  quantity integer,
  unit_price numeric,
  discount_type text,
  discount_value numeric
) RETURNS numeric AS $$
DECLARE
  original_subtotal numeric;
  discount_amount numeric;
BEGIN
  original_subtotal := quantity * unit_price;
  
  IF discount_type IS NULL OR discount_value IS NULL OR discount_value = 0 THEN
    RETURN 0;
  END IF;
  
  IF discount_type = 'percentage' THEN
    discount_amount := original_subtotal * (discount_value / 100);
  ELSIF discount_type = 'fixed' THEN
    discount_amount := LEAST(discount_value, original_subtotal);
  ELSE
    discount_amount := 0;
  END IF;
  
  RETURN GREATEST(0, discount_amount);
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate sale discount amount
CREATE OR REPLACE FUNCTION calculate_sale_discount(
  subtotal_amount numeric,
  discount_type text,
  discount_value numeric
) RETURNS numeric AS $$
DECLARE
  discount_amount numeric;
BEGIN
  IF discount_type IS NULL OR discount_value IS NULL OR discount_value = 0 THEN
    RETURN 0;
  END IF;
  
  IF discount_type = 'percentage' THEN
    discount_amount := subtotal_amount * (discount_value / 100);
  ELSIF discount_type = 'fixed' THEN
    discount_amount := LEAST(discount_value, subtotal_amount);
  ELSE
    discount_amount := 0;
  END IF;
  
  RETURN GREATEST(0, discount_amount);
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically calculate discount amounts for cart items
CREATE OR REPLACE FUNCTION update_cart_item_discount_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate original subtotal
  NEW.original_subtotal := NEW.quantity * NEW.unit_price;
  
  -- Calculate discount amount
  NEW.item_discount_amount := calculate_item_discount(
    NEW.quantity,
    NEW.unit_price,
    NEW.item_discount_type,
    NEW.item_discount_value
  );
  
  -- Calculate final subtotal after discount
  NEW.subtotal := NEW.original_subtotal - NEW.item_discount_amount;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cart_items
DROP TRIGGER IF EXISTS cart_items_discount_trigger ON cart_items;
CREATE TRIGGER cart_items_discount_trigger
  BEFORE INSERT OR UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_item_discount_amounts();

-- Update existing cart_items to populate new columns
UPDATE cart_items 
SET 
  original_subtotal = quantity * unit_price,
  item_discount_amount = 0
WHERE original_subtotal IS NULL;

-- Create view for detailed cart information with discount breakdown
CREATE OR REPLACE VIEW cart_details_with_discounts AS
SELECT 
  c.id as cart_id,
  c.customer_id,
  c.status,
  c.discount_type as cart_discount_type,
  c.discount_value as cart_discount_value,
  c.delivery_cost,
  c.notes,
  c.business_id,
  c.created_by,
  c.created_at,
  c.updated_at,
  
  -- Cart totals
  COALESCE(SUM(ci.original_subtotal), 0) as items_original_total,
  COALESCE(SUM(ci.item_discount_amount), 0) as items_total_discount,
  COALESCE(SUM(ci.subtotal), 0) as items_subtotal_after_discount,
  
  -- Cart-level discount calculation
  calculate_sale_discount(
    COALESCE(SUM(ci.subtotal), 0),
    c.discount_type,
    c.discount_value
  ) as cart_discount_amount,
  
  -- Final total
  GREATEST(0, 
    COALESCE(SUM(ci.subtotal), 0) - 
    calculate_sale_discount(COALESCE(SUM(ci.subtotal), 0), c.discount_type, c.discount_value) +
    COALESCE(c.delivery_cost, 0)
  ) as final_total

FROM carts c
LEFT JOIN cart_items ci ON c.id = ci.cart_id
GROUP BY c.id, c.customer_id, c.status, c.discount_type, c.discount_value, 
         c.delivery_cost, c.notes, c.business_id, c.created_by, c.created_at, c.updated_at;

-- Create view for sales with discount breakdown
CREATE OR REPLACE VIEW sales_with_discount_details AS
SELECT 
  s.*,
  c.discount_type as cart_discount_type,
  c.discount_value as cart_discount_value,
  c.delivery_cost,
  
  -- Calculate totals from cart items
  COALESCE(SUM(ci.original_subtotal), 0) as items_original_total,
  COALESCE(SUM(ci.item_discount_amount), 0) as items_total_discount,
  COALESCE(SUM(ci.subtotal), 0) as items_subtotal_after_discount,
  
  -- Cart-level discount
  calculate_sale_discount(
    COALESCE(SUM(ci.subtotal), 0),
    c.discount_type,
    c.discount_value
  ) as cart_discount_amount

FROM sales s
JOIN carts c ON s.cart_id = c.id
LEFT JOIN cart_items ci ON c.id = ci.cart_id
GROUP BY s.id, s.cart_id, s.customer_id, s.total_amount, s.payment_method, 
         s.status, s.sale_date, s.notes, s.business_id, s.created_by, s.created_at,
         s.sale_discount_type, s.sale_discount_value, s.sale_discount_amount, s.subtotal_before_discount,
         c.discount_type, c.discount_value, c.delivery_cost;

-- Add constraints to ensure discount values are reasonable
ALTER TABLE cart_items 
ADD CONSTRAINT cart_items_discount_value_check 
CHECK (item_discount_value IS NULL OR item_discount_value >= 0);

ALTER TABLE cart_items 
ADD CONSTRAINT cart_items_discount_amount_check 
CHECK (item_discount_amount >= 0);

ALTER TABLE sales 
ADD CONSTRAINT sales_discount_value_check 
CHECK (sale_discount_value IS NULL OR sale_discount_value >= 0);

ALTER TABLE sales 
ADD CONSTRAINT sales_discount_amount_check 
CHECK (sale_discount_amount >= 0);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cart_items_discount_type ON cart_items(item_discount_type);
CREATE INDEX IF NOT EXISTS idx_sales_discount_type ON sales(sale_discount_type);