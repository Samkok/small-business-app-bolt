/*
  # Create Sales Count Reconciliation Functions

  ## Overview
  This migration creates functions to reconcile sales counts:
  1. reconcile_sales_count - Reconcile for a specific user and business
  2. reconcile_all_sales_counts - Reconcile for all users and businesses
  3. Helper functions for discrepancy detection

  ## New Functions
  
  ### reconcile_sales_count(p_user_id, p_business_id, p_auto_correct)
  - Counts actual sales from sales table
  - Compares with cached count in user_sales_counts
  - If auto_correct is true, updates the count and logs correction
  - Returns: jsonb with status, expected_count, actual_count, corrected
  
  ### reconcile_all_sales_counts(p_auto_correct)
  - Processes all user/business combinations
  - Calls reconcile_sales_count for each
  - Logs execution summary to reconciliation_log
  - Returns: execution summary with statistics

  ### get_sales_count_discrepancies()
  - Returns all user/business combinations with count mismatches
  - Used for reporting and monitoring

  ## Security
  - Functions run with SECURITY DEFINER to bypass RLS
  - Can only be called by authenticated users with proper permissions
*/

-- Function to reconcile sales count for a specific user and business
CREATE OR REPLACE FUNCTION reconcile_sales_count(
  p_user_id uuid,
  p_business_id uuid,
  p_auto_correct boolean DEFAULT false
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
  v_corrected boolean := false;
BEGIN
  -- Get cached count
  SELECT sales_count INTO v_cached_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  -- Count actual sales (ALL sales regardless of status)
  SELECT COUNT(*)::integer INTO v_actual_count
  FROM sales
  WHERE created_by = p_user_id AND business_id = p_business_id;

  -- If no cached count exists, create one
  IF v_cached_count IS NULL THEN
    INSERT INTO user_sales_counts (user_id, business_id, sales_count)
    VALUES (p_user_id, p_business_id, v_actual_count);
    
    v_cached_count := v_actual_count;
    v_corrected := true;
  END IF;

  v_discrepancy := v_actual_count - v_cached_count;

  -- If there's a discrepancy and auto_correct is enabled, fix it
  IF v_discrepancy != 0 AND p_auto_correct THEN
    UPDATE user_sales_counts
    SET sales_count = v_actual_count,
        last_reconciled_at = now(),
        last_reconciliation_result = CASE 
          WHEN v_discrepancy = 0 THEN 'accurate'
          ELSE 'corrected'
        END
    WHERE user_id = p_user_id AND business_id = p_business_id;

    -- The update trigger will automatically log this to history
    v_corrected := true;
  ELSIF v_discrepancy = 0 THEN
    -- Update last reconciled time even if no correction needed
    UPDATE user_sales_counts
    SET last_reconciled_at = now(),
        last_reconciliation_result = 'accurate'
    WHERE user_id = p_user_id AND business_id = p_business_id;
  END IF;

  -- Return summary
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'business_id', p_business_id,
    'cached_count', v_cached_count,
    'actual_count', v_actual_count,
    'discrepancy', v_discrepancy,
    'corrected', v_corrected,
    'status', CASE 
      WHEN v_discrepancy = 0 THEN 'accurate'
      WHEN v_corrected THEN 'corrected'
      ELSE 'discrepancy_found'
    END
  );
END;
$$;

-- Function to reconcile all sales counts
CREATE OR REPLACE FUNCTION reconcile_all_sales_counts(
  p_auto_correct boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_duration_ms integer;
  v_users_processed integer := 0;
  v_discrepancies_found integer := 0;
  v_corrections_made integer := 0;
  v_status text := 'success';
  v_error_message text;
  v_user_business record;
  v_result jsonb;
  v_log_id uuid;
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    -- Process each user/business combination
    FOR v_user_business IN 
      SELECT DISTINCT created_by as user_id, business_id
      FROM sales
      WHERE created_by IS NOT NULL AND business_id IS NOT NULL
    LOOP
      v_users_processed := v_users_processed + 1;

      -- Reconcile this user/business
      v_result := reconcile_sales_count(
        v_user_business.user_id,
        v_user_business.business_id,
        p_auto_correct
      );

      -- Track statistics
      IF (v_result->>'discrepancy')::integer != 0 THEN
        v_discrepancies_found := v_discrepancies_found + 1;
        
        IF (v_result->>'corrected')::boolean THEN
          v_corrections_made := v_corrections_made + 1;
        END IF;
      END IF;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    v_status := 'failed';
    v_error_message := SQLERRM;
  END;

  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

  -- Log the reconciliation run
  INSERT INTO reconciliation_log (
    execution_time,
    users_processed,
    discrepancies_found,
    corrections_made,
    execution_duration_ms,
    status,
    error_message,
    metadata
  ) VALUES (
    v_start_time,
    v_users_processed,
    v_discrepancies_found,
    v_corrections_made,
    v_duration_ms,
    v_status,
    v_error_message,
    jsonb_build_object(
      'auto_correct', p_auto_correct,
      'end_time', v_end_time
    )
  ) RETURNING id INTO v_log_id;

  -- Return summary
  RETURN jsonb_build_object(
    'log_id', v_log_id,
    'status', v_status,
    'users_processed', v_users_processed,
    'discrepancies_found', v_discrepancies_found,
    'corrections_made', v_corrections_made,
    'execution_duration_ms', v_duration_ms,
    'error_message', v_error_message
  );
END;
$$;

-- Function to get all current discrepancies
CREATE OR REPLACE FUNCTION get_sales_count_discrepancies()
RETURNS TABLE (
  user_id uuid,
  business_id uuid,
  cached_count integer,
  actual_count integer,
  discrepancy integer,
  last_reconciled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    usc.user_id,
    usc.business_id,
    usc.sales_count as cached_count,
    COALESCE(actual.count, 0)::integer as actual_count,
    (COALESCE(actual.count, 0) - usc.sales_count)::integer as discrepancy,
    usc.last_reconciled_at
  FROM user_sales_counts usc
  LEFT JOIN (
    SELECT created_by, business_id, COUNT(*)::integer as count
    FROM sales
    GROUP BY created_by, business_id
  ) actual ON actual.created_by = usc.user_id AND actual.business_id = usc.business_id
  WHERE COALESCE(actual.count, 0) != usc.sales_count;
END;
$$;