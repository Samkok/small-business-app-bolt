/*
  # Add Cost Per Unit Tracking for Products

  1. New Columns
    - `products.cost_per_unit` - Stores the weighted average cost per unit
    - Enables accurate COGS calculation based on actual sold items

  2. Updated Functions
    - Modify inventory import process to update cost_per_unit using weighted average
    - Add function to calculate COGS for sales

  3. Security
    - Maintains existing RLS policies
    - No changes to permissions or access control
*/

-- Add cost_per_unit column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_per_unit numeric(10,2) DEFAULT 0;

-- Create function to update product cost_per_unit using weighted average method
CREATE OR REPLACE FUNCTION update_product_cost_per_unit()
RETURNS TRIGGER AS $$
DECLARE
  current_stock integer;
  current_cost numeric(10,2);
  new_total_cost numeric(10,2);
  new_total_quantity integer;
BEGIN
  -- Get current product data
  SELECT p.current_stock, p.cost_per_unit INTO current_stock, current_cost
  FROM products p
  WHERE p.id = NEW.product_id;
  
  -- Calculate new weighted average cost
  new_total_quantity := current_stock + NEW.quantity;
  
  IF new_total_quantity > 0 THEN
    new_total_cost := (current_stock * current_cost) + (NEW.quantity * NEW.final_unit_cost);
    
    -- Update the product's cost_per_unit with the new weighted average
    UPDATE products
    SET 
      cost_per_unit = new_total_cost / new_total_quantity,
      updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update cost_per_unit when inventory is imported
DROP TRIGGER IF EXISTS update_product_cost_trigger ON inventory_imports;
CREATE TRIGGER update_product_cost_trigger
  AFTER INSERT ON inventory_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_product_cost_per_unit();

-- Create function to handle cost_per_unit updates when imports are updated
CREATE OR REPLACE FUNCTION handle_import_update()
RETURNS TRIGGER AS $$
DECLARE
  product_id uuid;
  old_quantity integer;
  old_cost numeric(10,2);
  current_stock integer;
  current_cost numeric(10,2);
  adjusted_stock integer;
  adjusted_total_cost numeric(10,2);
BEGIN
  -- Store the product_id and old values
  product_id := OLD.product_id;
  old_quantity := OLD.quantity;
  old_cost := OLD.final_unit_cost;
  
  -- Get current product data
  SELECT p.current_stock, p.cost_per_unit INTO current_stock, current_cost
  FROM products p
  WHERE p.id = product_id;
  
  -- First, remove the effect of the old import from the weighted average
  adjusted_stock := current_stock - old_quantity;
  
  IF adjusted_stock > 0 THEN
    -- Remove old import's contribution to the total cost
    adjusted_total_cost := (current_stock * current_cost) - (old_quantity * old_cost);
    
    -- Calculate intermediate cost per unit without the old import
    current_cost := adjusted_total_cost / adjusted_stock;
  ELSE
    -- If removing old import would result in negative or zero stock, reset cost
    current_cost := 0;
    adjusted_stock := 0;
    adjusted_total_cost := 0;
  END IF;
  
  -- Now add the effect of the new import values
  adjusted_stock := adjusted_stock + NEW.quantity;
  
  IF adjusted_stock > 0 THEN
    adjusted_total_cost := adjusted_total_cost + (NEW.quantity * NEW.final_unit_cost);
    
    -- Update the product with the new weighted average cost
    UPDATE products
    SET 
      cost_per_unit = adjusted_total_cost / adjusted_stock,
      updated_at = NOW()
    WHERE id = product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to handle cost_per_unit updates when imports are updated
DROP TRIGGER IF EXISTS handle_import_update_trigger ON inventory_imports;
CREATE TRIGGER handle_import_update_trigger
  AFTER UPDATE ON inventory_imports
  FOR EACH ROW
  EXECUTE FUNCTION handle_import_update();

-- Create function to handle cost_per_unit updates when imports are deleted
CREATE OR REPLACE FUNCTION handle_import_delete()
RETURNS TRIGGER AS $$
DECLARE
  product_id uuid;
  deleted_quantity integer;
  deleted_cost numeric(10,2);
  current_stock integer;
  current_cost numeric(10,2);
  adjusted_stock integer;
  adjusted_total_cost numeric(10,2);
BEGIN
  -- Store the product_id and deleted values
  product_id := OLD.product_id;
  deleted_quantity := OLD.quantity;
  deleted_cost := OLD.final_unit_cost;
  
  -- Get current product data
  SELECT p.current_stock, p.cost_per_unit INTO current_stock, current_cost
  FROM products p
  WHERE p.id = product_id;
  
  -- Remove the effect of the deleted import from the weighted average
  adjusted_stock := current_stock - deleted_quantity;
  
  IF adjusted_stock > 0 THEN
    -- Remove deleted import's contribution to the total cost
    adjusted_total_cost := (current_stock * current_cost) - (deleted_quantity * deleted_cost);
    
    -- Update the product with the new weighted average cost
    UPDATE products
    SET 
      cost_per_unit = adjusted_total_cost / adjusted_stock,
      updated_at = NOW()
    WHERE id = product_id;
  ELSE
    -- If removing deleted import would result in negative or zero stock, reset cost
    UPDATE products
    SET 
      cost_per_unit = 0,
      updated_at = NOW()
    WHERE id = product_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to handle cost_per_unit updates when imports are deleted
DROP TRIGGER IF EXISTS handle_import_delete_trigger ON inventory_imports;
CREATE TRIGGER handle_import_delete_trigger
  BEFORE DELETE ON inventory_imports
  FOR EACH ROW
  EXECUTE FUNCTION handle_import_delete();

-- Create function to calculate COGS for a specific time period
CREATE OR REPLACE FUNCTION calculate_cogs(business_id_param uuid, start_date timestamp, end_date timestamp)
RETURNS numeric AS $$
DECLARE
  total_cogs numeric := 0;
BEGIN
  SELECT COALESCE(SUM(ci.quantity * p.cost_per_unit), 0) INTO total_cogs
  FROM sales s
  JOIN carts c ON s.cart_id = c.id
  JOIN cart_items ci ON c.id = ci.cart_id
  JOIN products p ON ci.product_id = p.id
  WHERE s.business_id = business_id_param
    AND s.status = 'completed'
    AND s.sale_date >= start_date
    AND s.sale_date <= end_date;
  
  RETURN total_cogs;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_cogs(uuid, timestamp, timestamp) TO authenticated;

-- Update existing products to have a cost_per_unit based on their most recent import
DO $$
DECLARE
  product_record RECORD;
  latest_import RECORD;
BEGIN
  FOR product_record IN SELECT id FROM products LOOP
    -- Find the most recent import for this product
    SELECT final_unit_cost INTO latest_import
    FROM inventory_imports
    WHERE product_id = product_record.id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Update the product's cost_per_unit if an import was found
    IF FOUND THEN
      UPDATE products
      SET cost_per_unit = latest_import.final_unit_cost
      WHERE id = product_record.id;
    END IF;
  END LOOP;
END $$;