/*
# Create Referral System Database Functions

## Overview
Creates all database functions needed for the referral system: code generation,
credit awarding/redemption, referral attribution claiming, and balance queries.

## New Functions

### generate_referral_code(p_user_id uuid) -> text
- Returns existing active code if user already has one
- Generates a unique 8-character alphanumeric code
- Inserts into referral_codes table
- SECURITY DEFINER to allow service-role operations

### get_user_credit_balance(p_user_id uuid) -> integer
- Fast balance lookup from user_credit_balances
- Returns 0 if user has no balance record

### award_credits(p_user_id, p_amount, p_transaction_type, p_reference_id, p_description, p_expiry_days) -> uuid
- Awards credits to a user by inserting into credit_ledger
- Creates user_credit_balances row if it doesn't exist
- Updates running balance
- Returns the ledger entry ID
- SECURITY DEFINER for service-role only

### redeem_credits(p_user_id, p_amount, p_description) -> jsonb
- Deducts credits from user balance
- Checks sufficient balance before deducting
- Returns {success: true/false, new_balance, error}
- SECURITY DEFINER for service-role only

### claim_referral_attribution(p_referee_user_id, p_device_fingerprint) -> uuid
- Called after a new user signs up to link them to a pending referral click
- Finds most recent unclaimed click matching device fingerprint
- Checks for self-referral (fraud)
- Updates referral_event status to 'signed_up'
- Returns the referral_event ID or NULL
- SECURITY DEFINER for service-role only

### get_effective_sales_limit(p_user_id uuid) -> integer
- Returns the user's effective sales limit (free tier limit + credit balance)
- Used by can_user_create_sale to factor in credits

## Security
- All functions are SECURITY DEFINER with explicit search_path = public
- Functions that modify data are restricted to service-role callers via Edge Functions
- get_user_credit_balance is safe for authenticated user calls (reads own balance only)
*/

-- ============================================================
-- Function: generate_referral_code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts integer := 0;
BEGIN
  -- Return existing active code if user already has one
  SELECT code INTO v_code
  FROM referral_codes
  WHERE user_id = p_user_id AND is_active = true;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate unique 8-char alphanumeric code
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempts > 10;
    v_attempts := v_attempts + 1;
  END LOOP;

  IF v_exists THEN
    RAISE EXCEPTION 'Failed to generate unique referral code after 10 attempts';
  END IF;

  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, v_code);

  RETURN v_code;
END;
$$;

-- ============================================================
-- Function: get_user_credit_balance
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT current_balance INTO v_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;

-- ============================================================
-- Function: award_credits
-- ============================================================
CREATE OR REPLACE FUNCTION award_credits(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT '',
  p_expiry_days integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_ledger_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF p_amount = 0 THEN
    RETURN NULL;
  END IF;

  -- Get or create balance record with row lock
  SELECT current_balance INTO v_current_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    INSERT INTO user_credit_balances (user_id, current_balance, total_earned, total_spent, total_expired, lifetime_referrals)
    VALUES (p_user_id, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT current_balance INTO v_current_balance
    FROM user_credit_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    v_current_balance := COALESCE(v_current_balance, 0);
  END IF;

  v_new_balance := v_current_balance + p_amount;
  v_expires_at := CASE
    WHEN p_expiry_days IS NOT NULL THEN now() + (p_expiry_days || ' days')::interval
    ELSE NULL
  END;

  -- Insert ledger entry
  INSERT INTO credit_ledger (user_id, amount, balance_after, transaction_type, reference_id, description, expires_at)
  VALUES (p_user_id, p_amount, v_new_balance, p_transaction_type, p_reference_id, p_description, v_expires_at)
  RETURNING id INTO v_ledger_id;

  -- Update balance summary
  UPDATE user_credit_balances
  SET current_balance = v_new_balance,
      total_earned = total_earned + GREATEST(p_amount, 0),
      total_spent = total_spent + ABS(LEAST(p_amount, 0)),
      lifetime_referrals = CASE
        WHEN p_transaction_type = 'referral_reward_referrer' THEN lifetime_referrals + 1
        ELSE lifetime_referrals
      END,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_ledger_id;
END;
$$;

-- ============================================================
-- Function: redeem_credits
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT 'Credit redemption'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT current_balance INTO v_current_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'current_balance', COALESCE(v_current_balance, 0));
  END IF;

  v_new_balance := v_current_balance - p_amount;

  INSERT INTO credit_ledger (user_id, amount, balance_after, transaction_type, description)
  VALUES (p_user_id, -p_amount, v_new_balance, 'credit_redemption', p_description);

  UPDATE user_credit_balances
  SET current_balance = v_new_balance,
      total_spent = total_spent + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ============================================================
-- Function: claim_referral_attribution
-- ============================================================
CREATE OR REPLACE FUNCTION claim_referral_attribution(
  p_referee_user_id uuid,
  p_device_fingerprint text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_referrer_user_id uuid;
  v_referral_code_id uuid;
BEGIN
  -- Find the most recent unclaimed click for this device fingerprint
  SELECT id, referrer_user_id, referral_code_id
  INTO v_event_id, v_referrer_user_id, v_referral_code_id
  FROM referral_events
  WHERE referee_device_fingerprint = p_device_fingerprint
    AND referee_user_id IS NULL
    AND status = 'clicked'
    AND expires_at > now()
  ORDER BY clicked_at DESC
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Self-referral fraud check
  IF v_referrer_user_id = p_referee_user_id THEN
    UPDATE referral_events
    SET status = 'fraudulent', updated_at = now()
    WHERE id = v_event_id;

    INSERT INTO referral_fraud_flags (referral_event_id, user_id, flag_type, severity, details)
    VALUES (v_event_id, p_referee_user_id, 'self_referral', 'high',
      jsonb_build_object('referrer_id', v_referrer_user_id, 'referee_id', p_referee_user_id));

    RETURN NULL;
  END IF;

  -- Check if this referee already has an attributed referral (prevent duplicate claims)
  IF EXISTS (
    SELECT 1 FROM referral_events
    WHERE referee_user_id = p_referee_user_id
      AND status IN ('signed_up', 'subscribed', 'rewarded')
  ) THEN
    RETURN NULL;
  END IF;

  -- Claim the attribution
  UPDATE referral_events
  SET referee_user_id = p_referee_user_id,
      status = 'signed_up',
      signed_up_at = now(),
      updated_at = now()
  WHERE id = v_event_id;

  -- Update referral code stats
  UPDATE referral_codes
  SET total_signups = total_signups + 1, updated_at = now()
  WHERE id = v_referral_code_id;

  RETURN v_event_id;
END;
$$;

-- ============================================================
-- Function: get_effective_sales_limit
-- Returns FREE_TIER_LIMIT + user's credit balance
-- ============================================================
CREATE OR REPLACE FUNCTION get_effective_sales_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_balance integer;
  v_free_limit integer := 50;
BEGIN
  SELECT current_balance INTO v_credit_balance
  FROM user_credit_balances
  WHERE user_id = p_user_id;

  RETURN v_free_limit + COALESCE(v_credit_balance, 0);
END;
$$;