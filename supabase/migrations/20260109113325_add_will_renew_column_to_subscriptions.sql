/*
  # Add Will Renew Column to Subscriptions

  ## Overview
  This migration adds a `will_renew` column to track whether a subscription will auto-renew.
  This is critical for handling cancellations correctly - when a user cancels, they should
  retain their benefits until the expiration date.

  ## Changes

  1. **Add will_renew column**
     - Boolean field to track auto-renewal status
     - Defaults to true for new subscriptions
     - Set to false when user cancels (but keeps benefits until expiration)

  ## Business Logic

  ### Subscription States:
  - Active + will_renew=true → Normal active subscription
  - Active + will_renew=false → Cancelled but still active until expiration
  - Expired + will_renew=false → Fully expired after cancellation
  - Expired + will_renew=true → Natural expiration (payment failed, etc.)
*/

-- Add will_renew column to user_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'will_renew'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD COLUMN will_renew boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Create index for faster queries on will_renew status
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_will_renew
  ON user_subscriptions(will_renew)
  WHERE subscription_status = 'active';

-- Update existing subscriptions
-- Set will_renew based on current status
UPDATE user_subscriptions
SET will_renew = CASE
  WHEN subscription_status = 'cancelled' THEN false
  WHEN subscription_status = 'active' THEN true
  ELSE false
END
WHERE will_renew IS NULL;

COMMENT ON COLUMN user_subscriptions.will_renew IS 'Tracks whether subscription will auto-renew at end of period. False means user cancelled but retains benefits until expiration_date.';