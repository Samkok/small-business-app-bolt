/*
  # Add unique constraint to user_subscriptions

  1. Changes
    - Add unique constraint on user_id column in user_subscriptions table
    - This ensures each user can only have one subscription record
    - Required for upsert operations in RevenueCat webhook
*/

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);
