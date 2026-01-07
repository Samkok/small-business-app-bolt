/*
  # Enable pg_cron and Schedule Daily Reconciliation

  ## Overview
  This migration:
  1. Enables the pg_cron extension for scheduled jobs
  2. Schedules a daily reconciliation job at 2:00 AM
  3. Creates a wrapper function for the cron job to call

  ## New Extension
  - pg_cron: PostgreSQL job scheduler

  ## Scheduled Job
  - Name: daily_sales_count_reconciliation
  - Schedule: Every day at 2:00 AM (during low traffic period)
  - Action: Runs reconcile_all_sales_counts with auto_correct enabled
  - Logging: Results automatically logged to reconciliation_log table

  ## Cron Schedule Format
  - '0 2 * * *' = At 02:00 every day
  - Timezone: UTC (Supabase default)

  ## Monitoring
  - Check cron.job_run_details for execution history
  - Check reconciliation_log for reconciliation results
  - View sales_count_dashboard_metrics for overall health
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to use pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a wrapper function for the cron job
-- This makes it easier to test and modify the scheduled task
CREATE OR REPLACE FUNCTION run_scheduled_reconciliation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Run reconciliation with auto_correct enabled
  v_result := reconcile_all_sales_counts(true);
  
  -- Log the cron execution (optional, for additional monitoring)
  RAISE NOTICE 'Scheduled reconciliation completed: %', v_result;
END;
$$;

-- Schedule the daily reconciliation job at 2:00 AM
-- First, remove any existing job with the same name
SELECT cron.unschedule('daily_sales_count_reconciliation') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily_sales_count_reconciliation'
);

-- Schedule the new job
SELECT cron.schedule(
  'daily_sales_count_reconciliation',  -- Job name
  '0 2 * * *',                         -- At 2:00 AM every day (cron expression)
  'SELECT run_scheduled_reconciliation();'  -- SQL command to run
);

-- Create a function to manually trigger reconciliation (for testing)
CREATE OR REPLACE FUNCTION trigger_manual_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := reconcile_all_sales_counts(true);
  RETURN v_result;
END;
$$;

-- Create a view to monitor cron job executions
CREATE OR REPLACE VIEW cron_job_history AS
SELECT 
  jr.jobid,
  j.jobname,
  jr.runid,
  jr.job_pid,
  jr.database,
  jr.username,
  jr.command,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time,
  EXTRACT(EPOCH FROM (jr.end_time - jr.start_time)) * 1000 as duration_ms
FROM cron.job_run_details jr
LEFT JOIN cron.job j ON j.jobid = jr.jobid
WHERE j.jobname = 'daily_sales_count_reconciliation'
ORDER BY jr.start_time DESC
LIMIT 100;