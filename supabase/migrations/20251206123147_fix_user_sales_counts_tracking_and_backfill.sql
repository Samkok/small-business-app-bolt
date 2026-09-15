/*
  # Fix User Sales Count Tracking and Backfill Data
  
  ## Problem
  The user_sales_counts table is completely out of sync because:
  1. No trigger exists to automatically update counts when sales are created
  2. The table was never properly backfilled with accurate data
  3. The counting logic doesn't track sales by the user who created them
  
  ## Solution
  1. Clear all existing incorrect data
  2. Backfill with accurate counts based on actual sales data
  3. Create trigger to automatically update counts on new sales
  4. Handle voided sales to decrement counts
  
  ## Changes
  - Clear and backfill `user_sales_counts` table
  - Create trigger function to update counts on sale creation
  - Create trigger function to decrement counts when sales are voided
  - Add triggers to sales table
*/

-- Clear existing incorrect data
TRUNCATE user_sales_counts;

-- Backfill with accurate data from actual sales
-- Count sales by the user who created them (created_by) for each business
INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_counted_at)
SELECT 
  s.created_by as user_id,
  s.business_id,
  COUNT(*) as sales_count,
  now() as last_counted_at
FROM sales s
WHERE s.status != 'voided'
GROUP BY s.created_by, s.business_id
ON CONFLICT (user_id, business_id) 
DO UPDATE SET 
  sales_count = EXCLUDED.sales_count,
  last_counted_at = EXCLUDED.last_counted_at,
  updated_at = now();

-- Create trigger function to update sales count when a sale is created
CREATE OR REPLACE FUNCTION update_user_sales_count_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only count non-voided sales
  IF NEW.status != 'voided' THEN
    -- Insert or increment the sales count
    INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_counted_at)
    VALUES (NEW.created_by, NEW.business_id, 1, now())
    ON CONFLICT (user_id, business_id) 
    DO UPDATE SET 
      sales_count = user_sales_counts.sales_count + 1,
      last_counted_at = now(),
      updated_at = now();

  END IF;

  
  RETURN NEW;

END;

$$;

-- Create trigger function to update sales count when a sale status changes
CREATE OR REPLACE FUNCTION update_user_sales_count_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If sale is being voided, decrement the count
  IF OLD.status != 'voided' AND NEW.status = 'voided' THEN
    UPDATE user_sales_counts
    SET 
      sales_count = GREATEST(sales_count - 1, 0),
      last_counted_at = now(),
      updated_at = now()
    WHERE user_id = NEW.created_by AND business_id = NEW.business_id;

  END IF;

  
  -- If sale is being unvoided (changed from voided to something else), increment the count
  IF OLD.status = 'voided' AND NEW.status != 'voided' THEN
    INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_counted_at)
    VALUES (NEW.created_by, NEW.business_id, 1, now())
    ON CONFLICT (user_id, business_id) 
    DO UPDATE SET 
      sales_count = user_sales_counts.sales_count + 1,
      last_counted_at = now(),
      updated_at = now();

  END IF;

  
  RETURN NEW;

END;

$$;

-- Create trigger to update count on new sales
DROP TRIGGER IF EXISTS update_sales_count_on_insert ON sales;

CREATE TRIGGER update_sales_count_on_insert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sales_count_on_insert();

-- Create trigger to update count when sale status changes (e.g., voided)
DROP TRIGGER IF EXISTS update_sales_count_on_status_change ON sales;

CREATE TRIGGER update_sales_count_on_status_change
  AFTER UPDATE OF status ON sales
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_user_sales_count_on_status_change();

COMMENT ON TRIGGER update_sales_count_on_insert ON sales IS 'Automatically updates user_sales_counts when a new sale is created';

COMMENT ON TRIGGER update_sales_count_on_status_change ON sales IS 'Automatically updates user_sales_counts when a sale status changes (e.g., voided/unvoided)';

;
