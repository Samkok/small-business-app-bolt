/*
# Lock Entitlement Tables — Service-Role-Only Writes

## Summary
Prevents authenticated users from directly modifying their subscription tier,
sales counts, or related monetization columns. Only edge functions running with
the service_role key (webhooks, validate-subscription) can write these tables.

## Changes

### 1. user_subscriptions
- DROP the existing INSERT and UPDATE policies for authenticated users.
- Keep the existing SELECT policy (users can still read their own subscription).
- No new INSERT/UPDATE policies are created — only service_role (which bypasses RLS) can write.

### 2. user_sales_counts
- DROP the existing INSERT and UPDATE policies for authenticated users.
- Keep the existing SELECT policy (users can still read their own count).
- No new INSERT/UPDATE policies — writes happen only via SECURITY DEFINER triggers
  (increment_user_sales_count, decrement_user_sales_count) that bypass RLS.

### Security Impact
- Closes E1: users can no longer self-grant any tier via direct REST write.
- Closes E2: users can no longer reset their sales_count to 0 via direct REST write.
- The client code that previously upserted user_subscriptions will now fail;
  subscription state is exclusively managed by the revenuecat-webhook and
  validate-subscription edge functions (service_role).

## Important Notes
1. The SELECT policies remain unchanged — users can still read their own data.
2. SECURITY DEFINER triggers (e.g. increment_user_sales_count) bypass RLS and
   continue to work for automated sales counting.
3. Edge functions use the service_role key which bypasses RLS entirely.
*/

-- ============================================================
-- user_subscriptions: remove INSERT and UPDATE for authenticated
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;

-- Ensure the SELECT policy still exists (idempotent recreation)
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- user_sales_counts: remove INSERT and UPDATE for authenticated
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own sales count" ON user_sales_counts;
DROP POLICY IF EXISTS "Users can update own sales count" ON user_sales_counts;

-- Ensure the SELECT policy still exists (idempotent recreation)
DROP POLICY IF EXISTS "Users can read own sales count" ON user_sales_counts;
CREATE POLICY "Users can read own sales count"
  ON user_sales_counts FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
