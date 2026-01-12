/*
  # Add Grace Period and Cancellation/Expiration Reason Tracking

  ## Overview
  Adds fields to track grace periods, cancellation reasons, and expiration reasons
  from RevenueCat webhooks for better subscription management.

  ## Changes

  ### New Columns on user_subscriptions:
  1. **grace_period_ends_at** - When the grace period expires (for BILLING_ISSUE events)
  2. **in_grace_period** - Boolean flag for quick grace period checks
  3. **cancel_reason** - Why subscription was cancelled (UNSUBSCRIBE, BILLING_ERROR, etc.)
  4. **expiration_reason** - Why subscription expired
  5. **is_trial_conversion** - Tracks if last renewal was from trial
  6. **is_family_share** - iOS family sharing status
  7. **cancel_reason_at** - When cancel_reason was set
  8. **expiration_reason_at** - When expiration_reason was set

  ## Reason Values

  ### cancel_reason:
  - UNSUBSCRIBE - User cancelled voluntarily
  - BILLING_ERROR - Payment failed
  - DEVELOPER_INITIATED - Developer cancelled
  - PRICE_INCREASE - User rejected price increase
  - CUSTOMER_SUPPORT - Refunded by support
  - UNKNOWN - Apple didn't provide reason

  ### expiration_reason:
  - Same as cancel_reason plus:
  - SUBSCRIPTION_PAUSED - Android pause-induced expiration
*/

-- Add grace period columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'grace_period_ends_at'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN grace_period_ends_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'in_grace_period'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN in_grace_period boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add cancellation and expiration reason columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'cancel_reason'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN cancel_reason text CHECK (cancel_reason IN (
        'UNSUBSCRIBE', 'BILLING_ERROR', 'DEVELOPER_INITIATED', 
        'PRICE_INCREASE', 'CUSTOMER_SUPPORT', 'UNKNOWN'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'expiration_reason'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN expiration_reason text CHECK (expiration_reason IN (
        'UNSUBSCRIBE', 'BILLING_ERROR', 'DEVELOPER_INITIATED', 
        'PRICE_INCREASE', 'CUSTOMER_SUPPORT', 'UNKNOWN', 'SUBSCRIPTION_PAUSED'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'cancel_reason_at'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN cancel_reason_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'expiration_reason_at'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN expiration_reason_at timestamptz;
  END IF;
END $$;

-- Add trial conversion tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'is_trial_conversion'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN is_trial_conversion boolean DEFAULT false;
  END IF;
END $$;

-- Add family share tracking (iOS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'is_family_share'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN is_family_share boolean DEFAULT false;
  END IF;
END $$;

-- Add updated_by and last_webhook_update if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN updated_by text DEFAULT 'system';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'last_webhook_update'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN last_webhook_update timestamptz;
  END IF;
END $$;

-- Create indexes for grace period queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_grace_period
  ON user_subscriptions(in_grace_period, grace_period_ends_at)
  WHERE in_grace_period = true;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_cancel_reason
  ON user_subscriptions(cancel_reason)
  WHERE cancel_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expiration_reason
  ON user_subscriptions(expiration_reason)
  WHERE expiration_reason IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN user_subscriptions.grace_period_ends_at IS 'When the billing grace period ends (for BILLING_ISSUE events)';
COMMENT ON COLUMN user_subscriptions.in_grace_period IS 'Whether user is currently in billing grace period';
COMMENT ON COLUMN user_subscriptions.cancel_reason IS 'Reason why subscription was cancelled (from RevenueCat)';
COMMENT ON COLUMN user_subscriptions.expiration_reason IS 'Reason why subscription expired (from RevenueCat)';
COMMENT ON COLUMN user_subscriptions.is_trial_conversion IS 'Whether the last renewal was a trial conversion';
COMMENT ON COLUMN user_subscriptions.is_family_share IS 'Whether this is an iOS Family Sharing subscription';
COMMENT ON COLUMN user_subscriptions.cancel_reason_at IS 'When the cancel_reason was recorded';
COMMENT ON COLUMN user_subscriptions.expiration_reason_at IS 'When the expiration_reason was recorded';
