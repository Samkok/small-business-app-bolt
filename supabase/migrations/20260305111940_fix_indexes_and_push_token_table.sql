/*
  # Fix Indexes and push_token Table

  ## Changes

  ### 1. Add Missing Foreign Key Index
  - user_sales_count_history.business_id: had no covering index, causing sequential
    scans on every FK lookup and join.

  ### 2. Drop Duplicate Index
  - user_business_roles: idx_user_business_roles_user and idx_user_business_roles_user_id
    are identical. Dropping the older idx_user_business_roles_user.

  ### 3. Drop Unused Indexes
  Removes indexes that have never been used (per pg_stat_user_indexes). Unused indexes
  waste storage, slow down writes, and add overhead to query planning without benefit.

  ### 4. Fix push_token Table
  - Deduplicated rows before adding primary key
  - Added primary key on expo_push_token
  - Enabled RLS (table was publicly accessible without row-level security)
  - No permissive policies needed: access is managed via user_profiles.expo_push_token
*/

-- ============================================================
-- Add missing FK index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_sales_count_history_business_id
  ON user_sales_count_history (business_id);

-- ============================================================
-- Drop duplicate index on user_business_roles
-- ============================================================
DROP INDEX IF EXISTS idx_user_business_roles_user;

-- ============================================================
-- Drop unused indexes
-- ============================================================
DROP INDEX IF EXISTS idx_sales_created_by_business_status;
DROP INDEX IF EXISTS idx_user_sales_counts_last_reconciled;
DROP INDEX IF EXISTS idx_user_sales_counts_never_reconciled;
DROP INDEX IF EXISTS idx_user_subscriptions_tier;
DROP INDEX IF EXISTS idx_businesses_access_state;
DROP INDEX IF EXISTS idx_businesses_archived_at;
DROP INDEX IF EXISTS idx_user_profiles_expo_push_token;
DROP INDEX IF EXISTS idx_carts_created_by_name;
DROP INDEX IF EXISTS idx_sales_created_by_name;
DROP INDEX IF EXISTS idx_expenses_created_by_name;
DROP INDEX IF EXISTS idx_user_subscriptions_status;
DROP INDEX IF EXISTS idx_processed_webhook_events_event_type;
DROP INDEX IF EXISTS idx_processed_webhook_events_app_user_id;
DROP INDEX IF EXISTS idx_processed_webhook_events_created_at;
DROP INDEX IF EXISTS idx_processed_webhook_events_event_timestamp;
DROP INDEX IF EXISTS idx_webhook_errors_event_id;
DROP INDEX IF EXISTS idx_webhook_errors_event_type;
DROP INDEX IF EXISTS idx_product_history_changed_by_user_id;
DROP INDEX IF EXISTS idx_product_history_product_id;
DROP INDEX IF EXISTS idx_user_subscriptions_will_renew;
DROP INDEX IF EXISTS idx_webhook_errors_app_user_id;
DROP INDEX IF EXISTS idx_webhook_errors_resolved;
DROP INDEX IF EXISTS idx_webhook_errors_severity;
DROP INDEX IF EXISTS idx_webhook_errors_created_at;
DROP INDEX IF EXISTS idx_user_subscriptions_grace_period;
DROP INDEX IF EXISTS idx_user_subscriptions_cancel_reason;
DROP INDEX IF EXISTS idx_user_subscriptions_expiration_reason;

-- ============================================================
-- Fix push_token table: deduplicate, add PK, enable RLS
-- ============================================================

-- Remove duplicate rows keeping only one of each token
DELETE FROM push_token pt1
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM push_token
  GROUP BY expo_push_token
);

-- Add primary key (safe now that duplicates are removed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'push_token'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE push_token ADD PRIMARY KEY (expo_push_token);
  END IF;
END $$;

ALTER TABLE push_token ENABLE ROW LEVEL SECURITY;
