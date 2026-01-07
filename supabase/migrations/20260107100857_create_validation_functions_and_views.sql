/*
  # Create Validation Functions and Views

  ## Overview
  This migration creates functions and views for monitoring sales count accuracy:
  1. Validation function to check if a user's count is accurate
  2. Views for reporting accuracy and discrepancies
  3. Dashboard metrics for overall system health

  ## New Functions
  
  ### validate_user_sales_count(p_user_id, p_business_id)
  - Returns detailed validation status
  - Includes: is_accurate, cached_count, actual_count, discrepancy
  
  ### get_sales_count_with_verification(p_user_id, p_business_id)
  - Returns count with verification metadata
  - Includes: count, is_verified, last_check, verification_status

  ## New Views
  
  ### sales_count_accuracy_report
  - Shows all user/business combinations with accuracy status
  - Columns: user_id, business_id, cached_count, actual_count, is_accurate, discrepancy
  
  ### sales_count_discrepancies_view
  - Filtered view showing only discrepancies
  
  ### sales_count_dashboard_metrics
  - Overall system health metrics
  - Total counts, accuracy percentage, recent reconciliations

  ## Security
  - Views use RLS from underlying tables
  - Functions use SECURITY DEFINER for system checks
*/

-- Function to validate a specific user's sales count
CREATE OR REPLACE FUNCTION validate_user_sales_count(
  p_user_id uuid,
  p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached_count integer;
  v_actual_count integer;
  v_discrepancy integer;
  v_last_reconciled timestamptz;
  v_last_result text;
BEGIN
  -- Get cached count and reconciliation info
  SELECT sales_count, last_reconciled_at, last_reconciliation_result
  INTO v_cached_count, v_last_reconciled, v_last_result
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  -- If no record exists, return null status
  IF v_cached_count IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'user_id', p_user_id,
      'business_id', p_business_id
    );
  END IF;

  -- Count actual sales
  SELECT COUNT(*)::integer INTO v_actual_count
  FROM sales
  WHERE created_by = p_user_id AND business_id = p_business_id;

  v_discrepancy := v_actual_count - v_cached_count;

  -- Return detailed validation result
  RETURN jsonb_build_object(
    'exists', true,
    'user_id', p_user_id,
    'business_id', p_business_id,
    'cached_count', v_cached_count,
    'actual_count', v_actual_count,
    'discrepancy', v_discrepancy,
    'is_accurate', v_discrepancy = 0,
    'last_reconciled_at', v_last_reconciled,
    'last_reconciliation_result', v_last_result,
    'status', CASE 
      WHEN v_discrepancy = 0 THEN 'accurate'
      WHEN v_discrepancy > 0 THEN 'undercount'
      ELSE 'overcount'
    END
  );
END;
$$;

-- Function to get sales count with verification
CREATE OR REPLACE FUNCTION get_sales_count_with_verification(
  p_user_id uuid,
  p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_validation jsonb;
BEGIN
  v_count := get_or_create_sales_count(p_user_id, p_business_id);
  v_validation := validate_user_sales_count(p_user_id, p_business_id);

  RETURN jsonb_build_object(
    'count', v_count,
    'validation', v_validation,
    'is_verified', (v_validation->>'is_accurate')::boolean,
    'last_check', v_validation->>'last_reconciled_at'
  );
END;
$$;

-- View: Sales Count Accuracy Report
CREATE OR REPLACE VIEW sales_count_accuracy_report AS
SELECT 
  usc.user_id,
  usc.business_id,
  up.full_name as user_name,
  b.business_name as business_name,
  usc.sales_count as cached_count,
  COALESCE(actual.count, 0) as actual_count,
  (COALESCE(actual.count, 0) = usc.sales_count) as is_accurate,
  (COALESCE(actual.count, 0) - usc.sales_count) as discrepancy,
  usc.last_reconciled_at,
  usc.last_reconciliation_result,
  CASE 
    WHEN COALESCE(actual.count, 0) = usc.sales_count THEN 'accurate'
    WHEN COALESCE(actual.count, 0) > usc.sales_count THEN 'undercount'
    ELSE 'overcount'
  END as status
FROM user_sales_counts usc
LEFT JOIN (
  SELECT created_by, business_id, COUNT(*)::integer as count
  FROM sales
  GROUP BY created_by, business_id
) actual ON actual.created_by = usc.user_id AND actual.business_id = usc.business_id
LEFT JOIN user_profiles up ON up.user_id = usc.user_id
LEFT JOIN businesses b ON b.id = usc.business_id;

-- View: Sales Count Discrepancies (filtered for issues only)
CREATE OR REPLACE VIEW sales_count_discrepancies_view AS
SELECT *
FROM sales_count_accuracy_report
WHERE NOT is_accurate;

-- View: Dashboard Metrics
CREATE OR REPLACE VIEW sales_count_dashboard_metrics AS
SELECT 
  COUNT(*)::integer as total_user_business_combinations,
  COUNT(*) FILTER (WHERE is_accurate)::integer as accurate_count,
  COUNT(*) FILTER (WHERE NOT is_accurate)::integer as discrepancy_count,
  ROUND(
    (COUNT(*) FILTER (WHERE is_accurate)::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as accuracy_percentage,
  MAX(last_reconciled_at) as most_recent_reconciliation,
  COUNT(*) FILTER (WHERE last_reconciled_at IS NULL)::integer as never_reconciled_count,
  COUNT(*) FILTER (
    WHERE last_reconciled_at < now() - interval '7 days'
  )::integer as stale_reconciliation_count
FROM sales_count_accuracy_report;

-- View: Recent Reconciliation History
CREATE OR REPLACE VIEW recent_reconciliation_history AS
SELECT 
  rl.id,
  rl.execution_time,
  rl.users_processed,
  rl.discrepancies_found,
  rl.corrections_made,
  rl.execution_duration_ms,
  rl.status,
  ROUND((rl.discrepancies_found::numeric / NULLIF(rl.users_processed, 0)) * 100, 2) as discrepancy_rate,
  ROUND((rl.corrections_made::numeric / NULLIF(rl.discrepancies_found, 0)) * 100, 2) as correction_rate
FROM reconciliation_log rl
ORDER BY rl.execution_time DESC
LIMIT 100;

-- View: User Sales Count History Report
CREATE OR REPLACE VIEW user_sales_count_history_report AS
SELECT 
  usch.id,
  usch.user_id,
  up.full_name as user_name,
  usch.business_id,
  b.business_name as business_name,
  usch.old_count,
  usch.new_count,
  (usch.new_count - usch.old_count) as change_amount,
  usch.change_reason,
  usch.action_type,
  usch.sale_id,
  usch.changed_at,
  usch.metadata
FROM user_sales_count_history usch
LEFT JOIN user_profiles up ON up.user_id = usch.user_id
LEFT JOIN businesses b ON b.id = usch.business_id
ORDER BY usch.changed_at DESC;