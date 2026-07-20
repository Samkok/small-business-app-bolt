/*
# Revoke Public Execute on Mutating Referral/Credit Functions

## Summary
Removes PUBLIC/anon/authenticated EXECUTE permissions on all mutating referral
and credit functions. These are now callable only by service_role (edge functions).

## Changes
- REVOKE EXECUTE on: award_credits, redeem_credits, claim_referral_attribution,
  generate_referral_code, increment_referral_conversions, increment_referral_clicks,
  get_effective_sales_limit
- GRANT EXECUTE to service_role only (used by edge functions)

## Security Impact
- Closes E3: authenticated users can no longer call award_credits via
  POST /rest/v1/rpc/award_credits to mint unlimited credits.
- Closes the related attack where minting credits grants extra sales
  via get_effective_sales_limit.
- generate_referral_code is kept callable by authenticated users but enforces
  auth.uid() = p_user_id internally.

## Important Notes
1. Edge functions use service_role and are unaffected.
2. Correct function signatures are used for each REVOKE statement.
3. get_effective_sales_limit is left readable but made service_role-only to
   prevent users from learning their exact exploitable limit.
*/

-- award_credits(uuid, integer, text, uuid, text, integer)
REVOKE EXECUTE ON FUNCTION award_credits(uuid, integer, text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION award_credits(uuid, integer, text, uuid, text, integer) TO service_role;

-- redeem_credits(uuid, integer, text)
REVOKE EXECUTE ON FUNCTION redeem_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_credits(uuid, integer, text) TO service_role;

-- claim_referral_attribution(uuid, text)
REVOKE EXECUTE ON FUNCTION claim_referral_attribution(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_referral_attribution(uuid, text) TO service_role;

-- increment_referral_conversions: check if it exists, revoke
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'increment_referral_conversions') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION increment_referral_conversions FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION increment_referral_conversions TO service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'increment_referral_clicks') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION increment_referral_clicks FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION increment_referral_clicks TO service_role';
  END IF;
END $$;

-- get_effective_sales_limit(uuid) - service_role only to prevent enumeration
REVOKE EXECUTE ON FUNCTION get_effective_sales_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_effective_sales_limit(uuid) TO service_role;

-- generate_referral_code: rewrite to enforce auth.uid() = p_user_id
CREATE OR REPLACE FUNCTION generate_referral_code(
  p_user_id uuid,
  p_code text DEFAULT NULL
)
RETURNS TABLE(code text, id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_id uuid;
BEGIN
  -- Enforce that the caller can only generate codes for themselves
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot generate referral code for another user';
  END IF;

  -- Generate a random code if not provided
  IF p_code IS NULL OR p_code = '' THEN
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  ELSE
    v_code := upper(p_code);
  END IF;

  -- Check if code already exists
  IF EXISTS (SELECT 1 FROM referral_codes rc WHERE rc.code = v_code) THEN
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END IF;

  -- Insert the code
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, v_code)
  RETURNING referral_codes.id, referral_codes.code INTO v_id, v_code;

  RETURN QUERY SELECT v_code, v_id;
END;
$$;

-- Keep generate_referral_code callable by authenticated (self-enforces auth.uid())
GRANT EXECUTE ON FUNCTION generate_referral_code(uuid, text) TO authenticated;
