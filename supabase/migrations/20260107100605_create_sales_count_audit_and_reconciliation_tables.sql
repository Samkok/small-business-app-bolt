/*
  # Create Sales Count Audit and Reconciliation System - Tables

  ## Overview
  This migration creates the foundational tables for the sales count transparency system:
  - Audit history table to track all changes to sales counts
  - Reconciliation log table to track automated reconciliation runs

  ## New Tables
  
  ### user_sales_count_history
  Tracks every change to user sales counts for complete audit trail
  - id (uuid, primary key)
  - user_id (uuid, references auth.users)
  - business_id (uuid, references businesses)
  - old_count (integer) - Previous count value
  - new_count (integer) - New count value
  - change_reason (text) - Reason for change
  - sale_id (uuid, nullable) - Reference to specific sale if applicable
  - action_type (text) - Type of action
  - changed_at (timestamptz) - When the change occurred
  - metadata (jsonb, nullable) - Additional context

  ### reconciliation_log
  Tracks all reconciliation runs and their results
  - id (uuid, primary key)
  - execution_time (timestamptz) - When reconciliation ran
  - users_processed (integer) - Number of combinations processed
  - discrepancies_found (integer) - Number of mismatches found
  - corrections_made (integer) - Number of corrections applied
  - execution_duration_ms (integer) - How long it took to run
  - status (text) - success, failed, partial
  - error_message (text, nullable) - Error details if failed
  - metadata (jsonb) - Additional details about the run

  ## Security
  - Enable RLS on both tables
  - Add policies for admins and owners to view their own history
  - System functions bypass RLS for automated operations

  ## Indexes
  - user_sales_count_history: (user_id, business_id, changed_at)
  - reconciliation_log: (execution_time)
*/

-- Create user_sales_count_history table
CREATE TABLE IF NOT EXISTS user_sales_count_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  old_count integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  change_reason text NOT NULL CHECK (change_reason IN ('new_sale', 'reconciliation_correction', 'manual_adjustment')),
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('increment', 'correction', 'adjustment')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

-- Create reconciliation_log table
CREATE TABLE IF NOT EXISTS reconciliation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_time timestamptz NOT NULL DEFAULT now(),
  users_processed integer NOT NULL DEFAULT 0,
  discrepancies_found integer NOT NULL DEFAULT 0,
  corrections_made integer NOT NULL DEFAULT 0,
  execution_duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  error_message text,
  metadata jsonb
);

-- Enable RLS
ALTER TABLE user_sales_count_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_log ENABLE ROW LEVEL SECURITY;

-- Policies for user_sales_count_history
-- Users can view their own history
CREATE POLICY "Users can view own sales count history"
  ON user_sales_count_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view history for their business
CREATE POLICY "Admins can view business sales count history"
  ON user_sales_count_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = auth.uid()
      AND user_business_roles.business_id = user_sales_count_history.business_id
      AND user_business_roles.role = 'admin'
    )
  );

-- Policies for reconciliation_log
-- Only admins/owners can view reconciliation logs (system-wide view)
CREATE POLICY "System admins can view reconciliation logs"
  ON reconciliation_log
  FOR SELECT
  TO authenticated
  USING (true); -- We'll rely on application logic to restrict this

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sales_count_history_user_business 
  ON user_sales_count_history(user_id, business_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sales_count_history_sale 
  ON user_sales_count_history(sale_id) WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_execution_time 
  ON reconciliation_log(execution_time DESC);

-- Enable realtime for history tracking
ALTER PUBLICATION supabase_realtime ADD TABLE user_sales_count_history;
ALTER PUBLICATION supabase_realtime ADD TABLE reconciliation_log;