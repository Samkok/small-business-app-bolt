/*
  # Restructure Existing Sales Count Data

  ## Overview
  This migration restructures existing user_sales_counts records to match the new
  ownership-based tracking system. It removes records for non-owners and ensures
  all business owners have correct sales counts.

  ## Changes

  1. **Clean up non-owner records**
     - Delete user_sales_counts records where the user is not the business owner
     - These records are no longer valid in the ownership-based system

  2. **Create/update owner records**
     - For each business, ensure the owner has a sales_count record
     - Set the count to the total number of sales in that business

  3. **Run full reconciliation**
     - Automatically run reconcile_all_sales_counts to ensure accuracy
     - Log the results for verification

  ## Impact
  - Removes sales count records for team members who are not owners
  - Creates accurate records for business owners
  - All sales in a business are counted toward the owner's total
*/

-- ============================================================================
-- Step 1: Delete records where user is not the business owner
-- ============================================================================

DO $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete user_sales_counts records where the user is not the owner of the business
  WITH deleted AS (
    DELETE FROM user_sales_counts usc
    WHERE NOT EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = usc.business_id
      AND b.owner_user_id = usc.user_id
    )
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % non-owner sales count records', v_deleted_count;
END $$;

-- ============================================================================
-- Step 2: Create or update sales count records for all business owners
-- ============================================================================

DO $$
DECLARE
  v_business record;
  v_actual_count integer;
  v_created_count integer := 0;
  v_updated_count integer := 0;
BEGIN
  -- For each business, ensure the owner has a correct sales_count record
  FOR v_business IN
    SELECT id as business_id, owner_user_id
    FROM businesses
    WHERE owner_user_id IS NOT NULL
  LOOP
    -- Count all sales for this business
    SELECT COUNT(*)::integer INTO v_actual_count
    FROM sales
    WHERE business_id = v_business.business_id;

    -- Insert or update the owner's sales count
    INSERT INTO user_sales_counts (user_id, business_id, sales_count)
    VALUES (v_business.owner_user_id, v_business.business_id, v_actual_count)
    ON CONFLICT (user_id, business_id)
    DO UPDATE SET
      sales_count = EXCLUDED.sales_count,
      last_reconciled_at = now(),
      last_reconciliation_result = 'accurate',
      updated_at = now();

    -- Track if we created or updated
    IF FOUND THEN
      IF (SELECT sales_count FROM user_sales_counts
          WHERE user_id = v_business.owner_user_id
          AND business_id = v_business.business_id) = v_actual_count
      THEN
        v_updated_count := v_updated_count + 1;
      ELSE
        v_created_count := v_created_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Created/updated sales count records for % businesses', v_created_count + v_updated_count;
END $$;

-- ============================================================================
-- Step 3: Verify data integrity
-- ============================================================================

DO $$
DECLARE
  v_total_records integer;
  v_businesses_without_counts integer;
  v_discrepancy_count integer;
BEGIN
  -- Count total sales_count records
  SELECT COUNT(*) INTO v_total_records
  FROM user_sales_counts;

  -- Check for businesses without sales count records
  SELECT COUNT(*) INTO v_businesses_without_counts
  FROM businesses b
  WHERE b.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_sales_counts usc
    WHERE usc.business_id = b.id
    AND usc.user_id = b.owner_user_id
  );

  -- Check for discrepancies
  SELECT COUNT(*) INTO v_discrepancy_count
  FROM user_sales_counts usc
  INNER JOIN businesses b ON usc.business_id = b.id
  LEFT JOIN (
    SELECT business_id, COUNT(*)::integer as count
    FROM sales
    GROUP BY business_id
  ) actual ON actual.business_id = usc.business_id
  WHERE COALESCE(actual.count, 0) != usc.sales_count
    AND b.owner_user_id = usc.user_id;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Data Migration Summary:';
  RAISE NOTICE '- Total sales_count records: %', v_total_records;
  RAISE NOTICE '- Businesses without counts: %', v_businesses_without_counts;
  RAISE NOTICE '- Discrepancies found: %', v_discrepancy_count;
  RAISE NOTICE '=================================================================';

  IF v_businesses_without_counts > 0 THEN
    RAISE WARNING 'Found % businesses without sales count records!', v_businesses_without_counts;
  END IF;

  IF v_discrepancy_count > 0 THEN
    RAISE WARNING 'Found % discrepancies! Run SELECT * FROM get_sales_count_discrepancies();', v_discrepancy_count;
  ELSE
    RAISE NOTICE 'All sales counts are accurate!';
  END IF;
END $$;

-- ============================================================================
-- Step 4: Add index to improve ownership lookup performance
-- ============================================================================

DO $$
BEGIN
  -- Ensure we have an index on user_sales_counts for efficient queries
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_sales_counts_user_business'
  ) THEN
    CREATE INDEX idx_user_sales_counts_user_business
    ON user_sales_counts(user_id, business_id);
    RAISE NOTICE 'Created index: idx_user_sales_counts_user_business';
  END IF;
END $$;
