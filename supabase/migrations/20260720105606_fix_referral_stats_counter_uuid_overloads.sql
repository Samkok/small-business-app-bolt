/*
# Fix increment_referral_code_signups: add UUID overload (A4.7)

## Summary
The existing function accepts `p_code text` (the code string), but callers pass
`p_code_id uuid` (the referral_codes.id). Adds an overloaded version that accepts
uuid and increments by id.

Also adds an overload for increment_referral_conversions with the same fix.

## Changes
- New function: increment_referral_code_signups(p_code_id uuid)
- New function: increment_referral_conversions(p_code_id uuid) if not exists

## Security Impact
- Both functions are SECURITY DEFINER with pinned search_path.
- Granted to service_role only (consistent with the referral lockdown).
*/

CREATE OR REPLACE FUNCTION increment_referral_code_signups(p_code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_codes
  SET total_signups = total_signups + 1,
      updated_at = now()
  WHERE id = p_code_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_referral_code_signups(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_referral_code_signups(uuid) TO service_role;

-- Also fix increment_referral_conversions to accept uuid
CREATE OR REPLACE FUNCTION increment_referral_conversions(p_code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE referral_codes
  SET total_conversions = total_conversions + 1,
      updated_at = now()
  WHERE id = p_code_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_referral_conversions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_referral_conversions(uuid) TO service_role;
