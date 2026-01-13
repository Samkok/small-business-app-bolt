/*
  # Fix Double Increment Sales Count Issue

  ## Overview
  Fixes the issue where sales count is being incremented twice (by 2 instead of by 1)
  when a new sale is created.

  ## Root Cause
  The auto_increment_sales_count trigger may be firing multiple times or there's
  a race condition causing double increments.

  ## Solution
  1. Add idempotency check using a temporary table to track recent increments
  2. Ensure trigger only increments once per sale insertion
  3. Add safeguards against duplicate increments for the same sale_id

  ## Changes
  - Update auto_increment_sales_count function with idempotency check
  - Add check to prevent incrementing for the same sale_id within 5 seconds
*/

-- Update auto_increment_sales_count with idempotency check
CREATE OR REPLACE FUNCTION auto_increment_sales_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_count integer;
  v_new_count integer;
  v_recent_increment boolean;
BEGIN
  -- Check if we already incremented for this sale in the last 5 seconds
  -- This prevents double-increment from duplicate triggers
  SELECT EXISTS (
    SELECT 1 FROM user_sales_count_history
    WHERE user_id = NEW.created_by
      AND business_id = NEW.business_id
      AND sale_id = NEW.id
      AND action_type = 'increment'
      AND changed_at > now() - interval '5 seconds'
  ) INTO v_recent_increment;

  IF v_recent_increment THEN
    RAISE NOTICE 'Skipping duplicate increment for sale % (already incremented)', NEW.id;
    RETURN NEW;
  END IF;

  -- Upsert the sales count (increment by 1)
  INSERT INTO user_sales_counts (user_id, business_id, sales_count)
  VALUES (NEW.created_by, NEW.business_id, 1)
  ON CONFLICT (user_id, business_id) 
  DO UPDATE SET 
    sales_count = user_sales_counts.sales_count + 1
  RETURNING sales_count - 1, sales_count INTO v_old_count, v_new_count;

  -- Log the change to audit history
  INSERT INTO user_sales_count_history (
    user_id,
    business_id,
    old_count,
    new_count,
    change_reason,
    sale_id,
    action_type,
    metadata
  ) VALUES (
    NEW.created_by,
    NEW.business_id,
    v_old_count,
    v_new_count,
    'new_sale',
    NEW.id,
    'increment',
    jsonb_build_object(
      'sale_id', NEW.id,
      'sale_status', NEW.status,
      'total_amount', NEW.total_amount
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_increment_sales_count() IS 'Auto-increments sales count when a sale is created. Includes idempotency check to prevent double increments.';

-- Also ensure the trigger is only set up once
DROP TRIGGER IF EXISTS trigger_auto_increment_sales_count ON sales;
CREATE TRIGGER trigger_auto_increment_sales_count
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_sales_count();

-- Verify there are no duplicate triggers on the sales table
DO $$
DECLARE
  trigger_count integer;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname LIKE '%sales_count%'
    AND tgrelid = 'sales'::regclass;
  
  IF trigger_count > 1 THEN
    RAISE WARNING 'Found % triggers related to sales_count on sales table. Expected only 1.', trigger_count;
  END IF;
END $$;
