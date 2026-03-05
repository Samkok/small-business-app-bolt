/*
  # Fix RLS Performance and Security Policies

  ## Changes

  ### 1. RLS Auth Initialization Performance
  Replaces bare `auth.uid()` calls with `(select auth.uid())` so Postgres evaluates
  the session user ID once per statement instead of once per row. Affected tables:
  - user_subscriptions (3 policies)
  - user_sales_counts (4 policies, including merging 2 duplicate SELECT policies)
  - user_sales_count_history (2 policies)

  ### 2. Multiple Permissive Policies Merged
  Merged duplicate/overlapping SELECT policies into a single policy per table to avoid
  double evaluation overhead and simplify the policy model:
  - user_business_roles: merged "Business admins can read all team member roles" +
    "Users can read their own business roles" into one
  - user_profiles: merged "Business admins can read user profiles for invitations" +
    "Users can read own user profile" into one
  - user_sales_count_history: merged "Admins can view business sales count history" +
    "Users can view own sales count history" into one
  - user_sales_counts: dropped duplicate "Users can read their own sales counts" that
    was identical to "Users can view own sales count"

  ### 3. Always-True RLS Policies Removed
  - notifications: Dropped "System can insert notifications" (WITH CHECK always true).
    Notification inserts come from SECURITY DEFINER triggers that bypass RLS — no
    explicit INSERT policy is needed, and the old policy let any authenticated user
    forge notifications for other users.
  - processed_webhook_events: Dropped "Service role full access to webhook events"
    (USING/WITH CHECK always true). service_role bypasses RLS by default; authenticated
    users should have no access to this internal table.
  - webhook_errors: Dropped "Service role full access to webhook errors" for the same
    reason.
*/

-- ============================================================
-- user_subscriptions: replace bare auth.uid() with subselect
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- user_sales_counts: replace bare auth.uid() + merge duplicate
-- SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own sales count" ON user_sales_counts;
DROP POLICY IF EXISTS "Users can read their own sales counts" ON user_sales_counts;
DROP POLICY IF EXISTS "Users can update own sales count" ON user_sales_counts;
DROP POLICY IF EXISTS "Users can view own sales count" ON user_sales_counts;

CREATE POLICY "Users can insert own sales count"
  ON user_sales_counts FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can read own sales count"
  ON user_sales_counts FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own sales count"
  ON user_sales_counts FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- user_sales_count_history: replace bare auth.uid() + merge
-- two SELECT policies into one
-- ============================================================
DROP POLICY IF EXISTS "Admins can view business sales count history" ON user_sales_count_history;
DROP POLICY IF EXISTS "Users can view own sales count history" ON user_sales_count_history;

CREATE POLICY "Users and admins can view sales count history"
  ON user_sales_count_history FOR SELECT TO authenticated
  USING (
    (user_id = (select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = (select auth.uid())
        AND user_business_roles.business_id = user_sales_count_history.business_id
        AND user_business_roles.role = 'admin'
    )
  );

-- ============================================================
-- user_business_roles: merge two permissive SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Business admins can read all team member roles" ON user_business_roles;
DROP POLICY IF EXISTS "Users can read their own business roles" ON user_business_roles;

CREATE POLICY "Users can read own roles and admins can read all roles"
  ON user_business_roles FOR SELECT TO authenticated
  USING (
    ((select auth.uid()) = user_id)
    OR is_business_admin_check((select auth.uid()), business_id)
  );

-- ============================================================
-- user_profiles: merge two permissive SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Business admins can read user profiles for invitations" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own user profile" ON user_profiles;

CREATE POLICY "Users can read own profile or admins can read for invitations"
  ON user_profiles FOR SELECT TO authenticated
  USING (
    ((select auth.uid()) = user_id)
    OR EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.user_id = (select auth.uid())
        AND user_business_roles.role = 'admin'
    )
  );

-- ============================================================
-- notifications: drop always-true INSERT policy
-- (triggers are SECURITY DEFINER and bypass RLS)
-- ============================================================
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- ============================================================
-- processed_webhook_events: drop always-true FOR ALL policy
-- (service_role bypasses RLS; authenticated users need no access)
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to webhook events" ON processed_webhook_events;

-- ============================================================
-- webhook_errors: drop always-true FOR ALL policy
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to webhook errors" ON webhook_errors;
