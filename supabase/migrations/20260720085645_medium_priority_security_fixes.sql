/*
# Medium Priority Security Fixes: Business Creation Trigger + Webhook Idempotency

## Summary
1. Business-creation limit enforcement via BEFORE INSERT trigger on businesses.
2. UNIQUE constraint on credit_ledger for webhook idempotency.
3. Pin search_path on unpinned SECURITY DEFINER functions.

## Changes

### 1. Business Creation Trigger
- BEFORE INSERT trigger on businesses enforces max_owned_businesses from subscription.

### 2. credit_ledger Idempotency
- UNIQUE index on (reference_id, transaction_type) WHERE reference_id IS NOT NULL.

### 3. Security Definer Functions
- Pins search_path on log_audit_event, log_security_event, check_rate_limit.

## Security Impact
- Prevents business creation limit bypass via direct INSERT.
- Prevents duplicate credit awards from webhook retries.
*/

-- ============================================================
-- 1. Business creation limit trigger
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_business_creation_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_current_count integer;
  v_max_allowed integer;
BEGIN
  v_owner_id := NEW.created_by;
  IF v_owner_id IS NULL THEN
    v_owner_id := auth.uid();
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM businesses b
  JOIN user_business_roles ubr ON ubr.business_id = b.id
  WHERE ubr.user_id = v_owner_id AND ubr.role = 'admin';

  SELECT COALESCE(max_owned_businesses, 1) INTO v_max_allowed
  FROM user_subscriptions
  WHERE user_id = v_owner_id;

  IF v_max_allowed IS NULL THEN
    v_max_allowed := 1;
  END IF;

  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Business creation limit reached. Current: %, Max: %', v_current_count, v_max_allowed;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_business_creation_limit ON businesses;
CREATE TRIGGER trg_enforce_business_creation_limit
  BEFORE INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION enforce_business_creation_limit();

-- ============================================================
-- 2. credit_ledger unique constraint for idempotency
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_reference_idempotency
  ON credit_ledger (reference_id, transaction_type)
  WHERE reference_id IS NOT NULL;

-- ============================================================
-- 3. Pin search_path on unpinned SECURITY DEFINER functions
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event') THEN
    EXECUTE 'ALTER FUNCTION log_audit_event SET search_path = public, pg_catalog';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_security_event') THEN
    EXECUTE 'ALTER FUNCTION log_security_event SET search_path = public, pg_catalog';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit') THEN
    EXECUTE 'ALTER FUNCTION check_rate_limit SET search_path = public, pg_catalog';
  END IF;
END $$;
