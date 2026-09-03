/*
# Remove 'trial' from subscription_status check constraint

1. Changes
   - Drop and recreate the subscription_status CHECK constraint to only
     allow: 'active', 'expired', 'cancelled'.
   - 'trial' is removed because it was never a real subscription state --
     the frontend uses it as an in-memory default for "no subscription row found".
     Storing it in the DB was a debug artifact.

2. Why
   - Prevents future code paths from accidentally inserting 'trial' rows.
   - Clarifies that the DB only tracks real subscription lifecycle states.

3. Safety
   - All 3 rows with status='trial' were already deleted in a prior step.
   - The only remaining row has status='active', so this constraint change
     is safe.
*/

ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_status_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text]));
