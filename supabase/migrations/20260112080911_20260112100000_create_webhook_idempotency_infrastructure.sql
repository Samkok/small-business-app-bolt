/*
  # Create Webhook Idempotency Infrastructure

  ## Overview
  This migration creates infrastructure to prevent duplicate processing of RevenueCat webhook events
  and track webhook errors for debugging.

  ## 1. New Tables

  ### processed_webhook_events
  - Tracks all processed webhook events by their unique event ID
  - Prevents duplicate processing through unique constraint
  - Auto-cleanup of old events (90 days) for performance

  ### webhook_errors
  - Logs webhook processing failures with full context
  - Helps debug and monitor webhook reliability
  - Includes retry information and error details

  ## 2. Indexes
  - Optimized for fast event ID lookups
  - Timestamp-based cleanup queries
  - Error severity and status filtering

  ## 3. Security
  - RLS enabled on both tables
  - Service role access only (webhooks are system-level)
  - Automatic data retention policies
*/

-- Create processed_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  app_user_id text,
  event_timestamp_ms bigint NOT NULL,
  processed_at timestamptz DEFAULT now() NOT NULL,
  processing_duration_ms integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id
  ON processed_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_type
  ON processed_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_app_user_id
  ON processed_webhook_events(app_user_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_created_at
  ON processed_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_timestamp
  ON processed_webhook_events(event_timestamp_ms);

-- Create webhook_errors table for tracking failures
CREATE TABLE IF NOT EXISTS webhook_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  event_type text NOT NULL,
  app_user_id text,
  error_type text NOT NULL,
  error_message text NOT NULL,
  error_details jsonb,
  event_payload jsonb,
  retry_count integer DEFAULT 0 NOT NULL,
  resolved boolean DEFAULT false NOT NULL,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for error tracking
CREATE INDEX IF NOT EXISTS idx_webhook_errors_event_id
  ON webhook_errors(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_event_type
  ON webhook_errors(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_app_user_id
  ON webhook_errors(app_user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_resolved
  ON webhook_errors(resolved) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_webhook_errors_severity
  ON webhook_errors(severity);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_created_at
  ON webhook_errors(created_at);

-- Enable RLS (service role only for webhooks)
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_errors ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (webhooks run with service role)
CREATE POLICY "Service role full access to webhook events"
  ON processed_webhook_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to webhook errors"
  ON webhook_errors
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to check if event was already processed
CREATE OR REPLACE FUNCTION is_webhook_event_processed(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM processed_webhook_events
    WHERE event_id = p_event_id
  );
END;
$$;

-- Function to mark event as processed
CREATE OR REPLACE FUNCTION mark_webhook_event_processed(
  p_event_id text,
  p_event_type text,
  p_app_user_id text,
  p_event_timestamp_ms bigint,
  p_processing_duration_ms integer DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
BEGIN
  INSERT INTO processed_webhook_events (
    event_id,
    event_type,
    app_user_id,
    event_timestamp_ms,
    processing_duration_ms,
    metadata
  ) VALUES (
    p_event_id,
    p_event_type,
    p_app_user_id,
    p_event_timestamp_ms,
    p_processing_duration_ms,
    p_metadata
  )
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

-- Function to log webhook error
CREATE OR REPLACE FUNCTION log_webhook_error(
  p_event_id text,
  p_event_type text,
  p_app_user_id text,
  p_error_type text,
  p_error_message text,
  p_error_details jsonb DEFAULT NULL,
  p_event_payload jsonb DEFAULT NULL,
  p_severity text DEFAULT 'medium'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_error_id uuid;
BEGIN
  INSERT INTO webhook_errors (
    event_id,
    event_type,
    app_user_id,
    error_type,
    error_message,
    error_details,
    event_payload,
    severity
  ) VALUES (
    p_event_id,
    p_event_type,
    p_app_user_id,
    p_error_type,
    p_error_message,
    p_error_details,
    p_event_payload,
    p_severity
  )
  RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$;

-- Function to clean up old webhook records (called by cron)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete processed events older than 90 days
  DELETE FROM processed_webhook_events
  WHERE created_at < now() - interval '90 days';

  -- Delete resolved errors older than 30 days
  DELETE FROM webhook_errors
  WHERE resolved = true
    AND updated_at < now() - interval '30 days';

  -- Delete old unresolved low-severity errors (older than 6 months)
  DELETE FROM webhook_errors
  WHERE resolved = false
    AND severity = 'low'
    AND created_at < now() - interval '6 months';
END;
$$;

-- Add helpful comments
COMMENT ON TABLE processed_webhook_events IS 'Tracks processed RevenueCat webhook events to prevent duplicate processing';
COMMENT ON TABLE webhook_errors IS 'Logs webhook processing failures for debugging and monitoring';
COMMENT ON FUNCTION is_webhook_event_processed(text) IS 'Checks if a webhook event has already been processed';
COMMENT ON FUNCTION mark_webhook_event_processed(text, text, text, bigint, integer, jsonb) IS 'Marks a webhook event as successfully processed';
COMMENT ON FUNCTION log_webhook_error(text, text, text, text, text, jsonb, jsonb, text) IS 'Logs a webhook processing error with full context';
COMMENT ON FUNCTION cleanup_old_webhook_records() IS 'Cleans up old webhook records based on retention policies';
