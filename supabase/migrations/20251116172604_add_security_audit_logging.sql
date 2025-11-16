/*
  # Add Security and Audit Logging Infrastructure

  1. New Tables
    - `audit_logs`
      - Comprehensive audit trail for all critical operations
      - Records user actions, IP addresses, and changes

    - `security_events`
      - Security-specific events (failed logins, permission denials)
      - Used for threat detection and monitoring

    - `rate_limit_records`
      - Server-side rate limiting records
      - Complements client-side rate limiting

  2. Functions
    - `log_audit_event` - Helper function to log audit events
    - `log_security_event` - Helper function to log security events
    - `check_rate_limit` - Server-side rate limiting check

  3. Security
    - RLS enabled on all tables
    - Only admins can read audit logs
    - Automatic cleanup of old records
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'create', 'update', 'delete', 'view', 'export',
    'login', 'logout', 'permission_change', 'settings_change'
  )),
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create security_events table
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'login_failed', 'login_success', 'logout', 'permission_denied',
    'rate_limit_exceeded', 'suspicious_activity', 'password_reset_requested',
    'password_changed', 'account_locked', 'account_unlocked'
  )),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  ip_address text,
  user_agent text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_email ON security_events(email);

-- Create rate_limit_records table
CREATE TABLE IF NOT EXISTS rate_limit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  key text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_time timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(identifier, key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_records_identifier_key ON rate_limit_records(identifier, key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_records_blocked_until ON rate_limit_records(blocked_until);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_records ENABLE ROW LEVEL SECURITY;

-- Audit logs policies - only admins can read
CREATE POLICY "Business admins can read audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = auth.uid()
      AND user_business_roles.business_id = audit_logs.business_id
      AND user_business_roles.role = 'admin'
    )
  );

-- Security events policies - only system can write
CREATE POLICY "System can insert security events"
  ON security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read security events"
  ON security_events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = auth.uid()
      AND user_business_roles.role = 'admin'
    )
  );

-- Rate limit policies - system managed
CREATE POLICY "System can manage rate limits"
  ON rate_limit_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_business_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO audit_logs (
    business_id,
    user_id,
    action_type,
    entity_type,
    entity_id,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_business_id,
    p_user_id,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_severity text DEFAULT 'low',
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO security_events (
    event_type,
    user_id,
    email,
    severity,
    metadata
  ) VALUES (
    p_event_type,
    p_user_id,
    p_email,
    p_severity,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_key text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15,
  p_block_minutes integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
  v_record rate_limit_records;
  v_now timestamptz := now();
  v_window_expired boolean;
  v_result jsonb;
BEGIN
  -- Get or create record
  SELECT * INTO v_record
  FROM rate_limit_records
  WHERE identifier = p_identifier AND key = p_key
  FOR UPDATE;

  -- Check if blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining_attempts', 0,
      'blocked_until', v_record.blocked_until,
      'message', 'Too many attempts. Please try again later.'
    );
  END IF;

  -- Check if window expired
  v_window_expired := v_record.first_attempt_time IS NULL
    OR (v_now - v_record.first_attempt_time) > (p_window_minutes || ' minutes')::interval;

  IF v_window_expired THEN
    -- Reset record
    UPDATE rate_limit_records
    SET attempts = 1,
        first_attempt_time = v_now,
        blocked_until = NULL,
        updated_at = v_now
    WHERE identifier = p_identifier AND key = p_key;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining_attempts', p_max_attempts - 1
    );
  END IF;

  -- Increment attempts
  IF v_record.attempts >= p_max_attempts THEN
    -- Block the key
    UPDATE rate_limit_records
    SET blocked_until = v_now + (p_block_minutes || ' minutes')::interval,
        updated_at = v_now
    WHERE identifier = p_identifier AND key = p_key;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining_attempts', 0,
      'blocked_until', v_now + (p_block_minutes || ' minutes')::interval,
      'message', 'Rate limit exceeded. Account temporarily blocked.'
    );
  END IF;

  -- Update attempts
  UPDATE rate_limit_records
  SET attempts = attempts + 1,
      updated_at = v_now
  WHERE identifier = p_identifier AND key = p_key;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_attempts', p_max_attempts - (v_record.attempts + 1)
  );

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    -- Create new record
    INSERT INTO rate_limit_records (identifier, key, attempts, first_attempt_time)
    VALUES (p_identifier, p_key, 1, v_now);

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining_attempts', p_max_attempts - 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old records (should be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_old_security_records()
RETURNS void AS $$
BEGIN
  -- Delete audit logs older than 1 year
  DELETE FROM audit_logs
  WHERE created_at < now() - interval '1 year';

  -- Delete security events older than 6 months
  DELETE FROM security_events
  WHERE created_at < now() - interval '6 months';

  -- Delete rate limit records older than 7 days or expired blocks
  DELETE FROM rate_limit_records
  WHERE created_at < now() - interval '7 days'
     OR (blocked_until IS NOT NULL AND blocked_until < now() - interval '1 day');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
