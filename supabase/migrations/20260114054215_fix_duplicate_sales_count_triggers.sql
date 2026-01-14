/*
  # Fix Duplicate Sales Count Increment Triggers

  ## Problem
  There are TWO AFTER INSERT triggers on the sales table, both incrementing sales_count:
  1. trigger_auto_increment_sales_count (newer, has idempotency checks and audit logging)
  2. update_sales_count_on_insert (legacy, no audit trail)
  
  This causes each new sale to increment the count by 2 instead of 1.

  ## Root Cause
  Legacy triggers from older migrations were not properly cleaned up when the new
  auto_increment_sales_count system was implemented.

  ## Solution
  - Drop the legacy trigger: update_sales_count_on_insert
  - Drop the legacy function: update_user_sales_count_on_insert()
  - Keep trigger_auto_increment_sales_count (has better logic with idempotency checks)
  - Keep update_user_sales_count_on_status_change (needed for void/unvoid operations)

  ## Impact
  - Sales count will now correctly increment by 1 per sale
  - Existing incorrect counts are NOT automatically fixed (will need manual reconciliation)
*/

-- Drop the legacy trigger that causes duplicate increments
DROP TRIGGER IF EXISTS update_sales_count_on_insert ON sales;

-- Drop the legacy function (no longer needed)
DROP FUNCTION IF EXISTS update_user_sales_count_on_insert();

-- Verify only one increment trigger remains
DO $$
DECLARE
  v_trigger_count integer;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'sales'::regclass
    AND tgname IN ('trigger_auto_increment_sales_count', 'update_sales_count_on_insert');
  
  IF v_trigger_count != 1 THEN
    RAISE WARNING 'Expected exactly 1 sales count increment trigger, found %', v_trigger_count;
  ELSE
    RAISE NOTICE 'Successfully cleaned up duplicate triggers. Only trigger_auto_increment_sales_count remains.';
  END IF;
END $$;

-- Add comment explaining the final trigger setup
COMMENT ON TRIGGER trigger_auto_increment_sales_count ON sales IS 
  'Auto-increments user_sales_counts when a sale is created. Includes idempotency checks and audit logging to user_sales_count_history.';
