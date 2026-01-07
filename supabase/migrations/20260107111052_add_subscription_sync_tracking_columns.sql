/*
  # Add Subscription Sync Tracking Columns

  1. Changes
    - Add `updated_by` column to track the source of updates (webhook, client, system)
    - Add `last_webhook_update` column to track when webhook last modified the record
    - Add `sync_version` column for optimistic locking and conflict detection
    - Add index on (user_id, updated_at) for faster queries
    
  2. Purpose
    - Prevent infinite sync loops between client and database
    - Make webhooks authoritative over client updates
    - Detect and prevent race conditions
    - Enable proper conflict resolution
*/

-- Add new columns to user_subscriptions table
DO $$ 
BEGIN
  -- Add updated_by column to track update source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE user_subscriptions 
      ADD COLUMN updated_by text DEFAULT 'system' 
      CHECK (updated_by IN ('webhook', 'client', 'system'));
  END IF;

  -- Add last_webhook_update to track when webhook last updated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'last_webhook_update'
  ) THEN
    ALTER TABLE user_subscriptions 
      ADD COLUMN last_webhook_update timestamptz;
  END IF;

  -- Add sync_version for optimistic locking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'sync_version'
  ) THEN
    ALTER TABLE user_subscriptions 
      ADD COLUMN sync_version integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_updated 
  ON user_subscriptions(user_id, updated_at DESC);

-- Create function to increment sync version automatically
CREATE OR REPLACE FUNCTION increment_subscription_sync_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sync_version = OLD.sync_version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-increment sync_version on update
DROP TRIGGER IF EXISTS trigger_increment_subscription_sync_version ON user_subscriptions;
CREATE TRIGGER trigger_increment_subscription_sync_version
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION increment_subscription_sync_version();

-- Create function to check if webhook update is recent (within 30 seconds)
CREATE OR REPLACE FUNCTION is_recent_webhook_update(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_webhook_update timestamptz;
BEGIN
  SELECT last_webhook_update INTO v_last_webhook_update
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  -- Return true if webhook updated within last 30 seconds
  RETURN v_last_webhook_update IS NOT NULL 
    AND v_last_webhook_update > (now() - interval '30 seconds');
END;
$$;
