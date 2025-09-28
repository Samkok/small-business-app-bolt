/*
  # Update sales table for partial returns

  1. New Columns
    - `returned_amount` (numeric) - Total amount of returned items
    - `current_total_amount` (numeric) - Current total after returns (computed column)

  2. Functions
    - Function to calculate current total amount after returns
    - Trigger to update returned_amount when sale actions are added

  3. Views
    - Update existing views to use current_total_amount instead of total_amount
*/

-- Add returned_amount column to sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'returned_amount'
  ) THEN
    ALTER TABLE sales ADD COLUMN returned_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add current_total_amount computed column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'current_total_amount'
  ) THEN
    ALTER TABLE sales ADD COLUMN current_total_amount numeric(10,2) GENERATED ALWAYS AS (total_amount - COALESCE(returned_amount, 0)) STORED;
  END IF;
END $$;

-- Function to update returned amount when sale actions are performed
CREATE OR REPLACE FUNCTION update_sale_returned_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process return actions
  IF NEW.action_type = 'return' THEN
    -- Update the returned_amount in the sales table
    UPDATE sales 
    SET returned_amount = COALESCE(returned_amount, 0) + COALESCE(NEW.amount, 0)
    WHERE id = NEW.sale_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sale actions
DROP TRIGGER IF EXISTS update_returned_amount_trigger ON sale_actions;
CREATE TRIGGER update_returned_amount_trigger
  AFTER INSERT ON sale_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_returned_amount();

-- Update existing sales to calculate returned amounts
UPDATE sales 
SET returned_amount = COALESCE((
  SELECT SUM(amount) 
  FROM sale_actions 
  WHERE sale_id = sales.id AND action_type = 'return'
), 0)
WHERE returned_amount IS NULL OR returned_amount = 0;