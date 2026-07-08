/*
# Create referral helper RPC functions

1. New Functions
  - `increment_referral_conversions(p_code text)`: Increments the total_conversions counter on referral_codes table
  - `increment_referral_code_signups(p_code text)`: Increments the total_signups counter on referral_codes table

2. Purpose
  - Called by edge functions (referral-claim, revenuecat-webhook) to update referral code statistics
  - Uses SECURITY DEFINER to bypass RLS since edge functions call with service role

3. Security
  - SECURITY DEFINER with search_path set to prevent privilege escalation
*/

-- increment_referral_conversions: called when a referred user subscribes
CREATE OR REPLACE FUNCTION increment_referral_conversions(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_codes
  SET total_conversions = total_conversions + 1
  WHERE code = p_code;
END;
$$;

-- increment_referral_code_signups: called when a referred user signs up
CREATE OR REPLACE FUNCTION increment_referral_code_signups(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_codes
  SET total_signups = total_signups + 1
  WHERE code = p_code;
END;
$$;
