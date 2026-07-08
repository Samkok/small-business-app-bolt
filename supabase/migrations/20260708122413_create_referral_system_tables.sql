/*
# Create Referral System Tables

## Overview
Creates the complete database schema for the BizManage referral system, enabling users
to invite friends via unique referral codes and earn in-app credits when referred users subscribe.

## New Tables

### referral_codes
Stores unique referral codes for each user.
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, the referrer)
- `code` (text, unique 8-char alphanumeric code)
- `is_active` (boolean, whether the code can still be used)
- `total_clicks` (integer, how many times the link was clicked)
- `total_signups` (integer, how many clicked users signed up)
- `total_conversions` (integer, how many signed-up users subscribed)
- `max_uses` (integer, nullable - NULL means unlimited)
- `expires_at` (timestamptz, nullable - NULL means never expires)
- `created_at`, `updated_at` (timestamptz)

### referral_events
Tracks the full lifecycle of each referral from click through subscription and reward.
- `id` (uuid, primary key)
- `referral_code_id` (uuid, references referral_codes)
- `referrer_user_id` (uuid, the user who shared the code)
- `referee_user_id` (uuid, nullable - the user who used the code, NULL until signup)
- `referee_device_fingerprint` (text, for pre-signup attribution)
- `status` (text, lifecycle: clicked -> signed_up -> subscribed -> rewarded / expired / fraudulent)
- `clicked_at`, `signed_up_at`, `subscribed_at`, `rewarded_at` (timestamptz)
- `subscription_product_id` (text, which product the referee subscribed to)
- `subscription_tier` (text, which tier the referee subscribed to)
- `attribution_metadata` (jsonb, additional tracking data)
- `ip_address` (inet, for fraud detection)
- `user_agent` (text, for fraud detection)
- `fraud_score` (integer, 0-100 risk score)
- `expires_at` (timestamptz, attribution window - default 30 days)
- `created_at`, `updated_at` (timestamptz)

### credit_ledger
Double-entry ledger tracking all credit movements (earn, spend, expire).
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `amount` (integer, positive = credit, negative = debit)
- `balance_after` (integer, running balance after this transaction)
- `transaction_type` (text, categorizes the transaction)
- `reference_id` (uuid, links to the referral_event or other source)
- `description` (text, human-readable description)
- `expires_at` (timestamptz, nullable - when these credits expire)
- `is_expired` (boolean, whether credits have been expired)
- `metadata` (jsonb, additional data)
- `created_at` (timestamptz)

### user_credit_balances
Fast-access materialized balance for each user, updated via triggers.
- `user_id` (uuid, primary key, references auth.users)
- `total_earned` (integer, lifetime credits earned)
- `total_spent` (integer, lifetime credits spent/redeemed)
- `total_expired` (integer, lifetime credits expired)
- `current_balance` (integer, available balance now)
- `lifetime_referrals` (integer, total successful referral conversions)
- `updated_at` (timestamptz)

### referral_reward_rules
Configurable rules for how much to reward referrer and referee per tier.
- `id` (uuid, primary key)
- `rule_name` (text, unique identifier for the rule)
- `referrer_credits` (integer, credits awarded to the referrer)
- `referee_credits` (integer, credits awarded to the referee)
- `min_subscription_days` (integer, referee must stay subscribed N days)
- `applies_to_tiers` (text[], which subscription tiers trigger this rule)
- `max_rewards_per_referrer` (integer, nullable - NULL means unlimited)
- `credit_expiry_days` (integer, how many days before credits expire, NULL means never)
- `is_active` (boolean, whether this rule is currently in effect)
- `created_at`, `updated_at` (timestamptz)

### referral_fraud_flags
Records suspicious referral activity for admin review.
- `id` (uuid, primary key)
- `referral_event_id` (uuid, nullable, references referral_events)
- `user_id` (uuid, the suspected bad actor)
- `flag_type` (text, category of fraud detected)
- `severity` (text, low/medium/high/critical)
- `details` (jsonb, evidence and context)
- `is_resolved` (boolean, whether an admin has reviewed)
- `resolved_by` (uuid, nullable, admin who resolved)
- `resolved_at` (timestamptz, nullable)
- `resolution_notes` (text, nullable)
- `created_at` (timestamptz)

## Security
- RLS enabled on ALL tables.
- referral_codes: users can read/create/update their own codes.
- referral_events: referrers can see their outgoing events, referees can see their incoming events.
- credit_ledger: users can view their own transaction history.
- user_credit_balances: users can view their own balance.
- referral_reward_rules: all authenticated users can read active rules (for display).
- referral_fraud_flags: NO user-facing read access (service role only).

## Notes
1. The referral_codes table has a unique partial index ensuring only one active code per user.
2. referral_events.expires_at defaults to 30 days from creation (attribution window).
3. credit_ledger uses a double-entry bookkeeping pattern for full audit trail.
4. user_credit_balances is maintained by database functions, not direct client writes.
5. All tables use ON DELETE CASCADE for auth.users foreign keys.
*/

-- ============================================================
-- Table: referral_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  total_clicks integer NOT NULL DEFAULT 0,
  total_signups integer NOT NULL DEFAULT 0,
  total_conversions integer NOT NULL DEFAULT 0,
  max_uses integer DEFAULT NULL,
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_code_length CHECK (char_length(code) BETWEEN 6 AND 20)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_active_user
  ON referral_codes(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON referral_codes;
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own referral code" ON referral_codes;
CREATE POLICY "Users can create own referral code"
  ON referral_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own referral code" ON referral_codes;
CREATE POLICY "Users can update own referral code"
  ON referral_codes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Table: referral_events
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referee_device_fingerprint text,
  status text NOT NULL DEFAULT 'clicked'
    CHECK (status IN ('clicked', 'signed_up', 'subscribed', 'rewarded', 'expired', 'fraudulent')),
  clicked_at timestamptz NOT NULL DEFAULT now(),
  signed_up_at timestamptz,
  subscribed_at timestamptz,
  rewarded_at timestamptz,
  subscription_product_id text,
  subscription_tier text,
  attribution_metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  fraud_score integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referee ON referral_events(referee_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_status ON referral_events(status);
CREATE INDEX IF NOT EXISTS idx_referral_events_code_id ON referral_events(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_device
  ON referral_events(referee_device_fingerprint) WHERE referee_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_referral_events_expires
  ON referral_events(expires_at) WHERE status IN ('clicked', 'signed_up');

ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrers can view own referral events" ON referral_events;
CREATE POLICY "Referrers can view own referral events"
  ON referral_events FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);

DROP POLICY IF EXISTS "Referees can view own referral events" ON referral_events;
CREATE POLICY "Referees can view own referral events"
  ON referral_events FOR SELECT TO authenticated
  USING (auth.uid() = referee_user_id);

-- ============================================================
-- Table: credit_ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  transaction_type text NOT NULL
    CHECK (transaction_type IN (
      'referral_reward_referrer',
      'referral_reward_referee',
      'credit_redemption',
      'credit_expiry',
      'admin_adjustment',
      'bonus_grant'
    )),
  reference_id uuid,
  description text NOT NULL,
  expires_at timestamptz,
  is_expired boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_balance ON credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_type ON credit_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference ON credit_ledger(reference_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_expiry
  ON credit_ledger(expires_at) WHERE is_expired = false AND expires_at IS NOT NULL;

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit history" ON credit_ledger;
CREATE POLICY "Users can view own credit history"
  ON credit_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Table: user_credit_balances
-- ============================================================
CREATE TABLE IF NOT EXISTS user_credit_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  total_expired integer NOT NULL DEFAULT 0,
  current_balance integer NOT NULL DEFAULT 0,
  lifetime_referrals integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_credit_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own balance" ON user_credit_balances;
CREATE POLICY "Users can view own balance"
  ON user_credit_balances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Table: referral_reward_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_reward_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  referrer_credits integer NOT NULL DEFAULT 0,
  referee_credits integer NOT NULL DEFAULT 0,
  min_subscription_days integer NOT NULL DEFAULT 7,
  applies_to_tiers text[] DEFAULT ARRAY['pro', 'pro_plus', 'max'],
  max_rewards_per_referrer integer DEFAULT NULL,
  credit_expiry_days integer DEFAULT 365,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referral_reward_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read active reward rules" ON referral_reward_rules;
CREATE POLICY "Users can read active reward rules"
  ON referral_reward_rules FOR SELECT TO authenticated
  USING (is_active = true);

-- ============================================================
-- Table: referral_fraud_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_event_id uuid REFERENCES referral_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type text NOT NULL
    CHECK (flag_type IN (
      'self_referral',
      'duplicate_device',
      'rapid_signups',
      'immediate_cancel',
      'same_ip_cluster',
      'suspicious_pattern',
      'trial_abuse'
    )),
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details jsonb DEFAULT '{}'::jsonb,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON referral_fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_event ON referral_fraud_flags(referral_event_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_unresolved
  ON referral_fraud_flags(is_resolved, severity) WHERE is_resolved = false;

ALTER TABLE referral_fraud_flags ENABLE ROW LEVEL SECURITY;
-- No user-facing policies - service role only access for fraud flags

-- ============================================================
-- Seed default reward rules
-- ============================================================
INSERT INTO referral_reward_rules (rule_name, referrer_credits, referee_credits, min_subscription_days, applies_to_tiers, credit_expiry_days)
VALUES
  ('pro_referral', 25, 10, 7, ARRAY['pro'], 365),
  ('pro_plus_referral', 50, 20, 7, ARRAY['pro_plus'], 365),
  ('max_referral', 100, 30, 7, ARRAY['max'], 365)
ON CONFLICT (rule_name) DO NOTHING;