/*
# Create credit expiration function and schedule (A4.5)

## Summary
Creates expire_credits() function and schedules it daily via pg_cron.

## Changes
- New function: expire_credits() marks expired credits and adjusts balances.
- Scheduled daily at 2:00 AM UTC.

## Security Impact
- SECURITY DEFINER, service_role only.
*/

CREATE OR REPLACE FUNCTION expire_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer := 0;
  v_record record;
BEGIN
  FOR v_record IN
    SELECT id, user_id, amount
    FROM credit_ledger
    WHERE is_expired = false
      AND expires_at IS NOT NULL
      AND expires_at < now()
      AND amount > 0
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE credit_ledger
    SET is_expired = true
    WHERE id = v_record.id;

    UPDATE user_credit_balances
    SET current_balance = GREATEST(0, current_balance - v_record.amount),
        total_expired = total_expired + v_record.amount,
        updated_at = now()
    WHERE user_id = v_record.user_id;

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION expire_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_credits() TO service_role;

-- Schedule daily at 2 AM UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire_referral_credits',
      '0 2 * * *',
      'SELECT expire_credits();'
    );
  END IF;
END $$;
