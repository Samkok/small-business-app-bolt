/*
  # Run Initial Reconciliation After Restructure

  ## Overview
  This migration runs a full reconciliation to verify that the restructured
  sales count system is working correctly. It checks for discrepancies and
  ensures all counts are accurate.

  ## What This Does
  1. Run reconcile_all_sales_counts with auto_correct enabled
  2. Check for any remaining discrepancies
  3. Log the results
*/

-- ============================================================================
-- Run full reconciliation with auto-correction
-- ============================================================================

DO $$
DECLARE
  v_reconciliation_result jsonb;
  v_discrepancy_count integer;
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Running full reconciliation of sales counts...';
  RAISE NOTICE '=================================================================';

  -- Run reconciliation
  SELECT reconcile_all_sales_counts(true) INTO v_reconciliation_result;

  -- Display results
  RAISE NOTICE 'Reconciliation Results:';
  RAISE NOTICE '- Status: %', v_reconciliation_result->>'status';
  RAISE NOTICE '- Businesses processed: %', v_reconciliation_result->>'businesses_processed';
  RAISE NOTICE '- Discrepancies found: %', v_reconciliation_result->>'discrepancies_found';
  RAISE NOTICE '- Corrections made: %', v_reconciliation_result->>'corrections_made';
  RAISE NOTICE '- Duration (ms): %', v_reconciliation_result->>'execution_duration_ms';

  -- Check for remaining discrepancies
  SELECT COUNT(*) INTO v_discrepancy_count
  FROM get_sales_count_discrepancies();

  IF v_discrepancy_count > 0 THEN
    RAISE WARNING 'Still found % discrepancies after reconciliation!', v_discrepancy_count;
    RAISE NOTICE 'Run: SELECT * FROM get_sales_count_discrepancies(); to investigate';
  ELSE
    RAISE NOTICE 'Perfect! No discrepancies found. All sales counts are accurate.';
  END IF;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration complete! Sales count system is now ownership-based.';
  RAISE NOTICE '=================================================================';
END $$;
