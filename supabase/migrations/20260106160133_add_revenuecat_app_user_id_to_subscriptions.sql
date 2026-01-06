/*
  # Add RevenueCat App User ID to User Subscriptions

  1. Changes
    - Add `revenuecat_app_user_id` column to `user_subscriptions` table
    - This field stores the RevenueCat app user ID for tracking and syncing purposes
    - Field is nullable as not all users may have RevenueCat subscriptions
    - Add index for faster lookups by RevenueCat app user ID

  2. Notes
    - This field enables better tracking and syncing between RevenueCat and Supabase
    - Allows for easier debugging and support queries
*/

-- Add RevenueCat app user ID column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'revenuecat_app_user_id'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN revenuecat_app_user_id text;
  END IF;
END $$;

-- Add index for faster lookups by RevenueCat app user ID
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_revenuecat_app_user_id 
  ON user_subscriptions(revenuecat_app_user_id);

-- Add comment for documentation
COMMENT ON COLUMN user_subscriptions.revenuecat_app_user_id IS 'RevenueCat app user ID for tracking and syncing subscription data';
