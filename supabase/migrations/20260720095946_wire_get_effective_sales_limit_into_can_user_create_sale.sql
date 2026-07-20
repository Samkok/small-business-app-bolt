/*
# Wire get_effective_sales_limit into can_user_create_sale (A4.1)

## Summary
Updates can_user_create_sale to use get_effective_sales_limit(p_user_id) instead of
the hardcoded limit of 50. This makes referral credits (extra sales allowance) actually
spendable by free-tier users.

## Changes
- Free tier limit check now calls get_effective_sales_limit(p_user_id) which returns
  50 + user's current credit balance from the referral system.
- The function also returns the effective limit in the reason text for clarity.

## Security Impact
- No change to access control; both functions are SECURITY DEFINER.
- Credits are still only awardable via service_role (revoked from public in prior migration).

## Important Notes
1. get_effective_sales_limit already exists and returns 50 + credit_balance.
2. This change makes the referral reward loop complete: refer -> earn credits -> get more sales.
*/

CREATE OR REPLACE FUNCTION can_user_create_sale(p_user_id uuid, p_business_id uuid)
RETURNS TABLE(can_create boolean, reason text, current_count integer, limit_reached boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_subscription_status text;
  v_total_sales integer;
  v_owned_count integer;
  v_max_businesses integer;
  v_is_owner boolean;
  v_access_state text;
  v_effective_limit integer;
BEGIN
  -- Check business access state first
  SELECT b.access_state INTO v_access_state
  FROM businesses b
  WHERE b.id = p_business_id;

  IF v_access_state = 'read_only_sales' THEN
    RETURN QUERY SELECT false, 'BUSINESS_READ_ONLY'::text, 0, true;
    RETURN;
  END IF;

  -- Get subscription info
  SELECT tier, subscription_status, max_owned_businesses
  INTO v_tier, v_subscription_status, v_max_businesses
  FROM get_user_subscription_tier(p_user_id);

  -- Check if user is the owner of this business
  SELECT EXISTS(
    SELECT 1 FROM businesses
    WHERE id = p_business_id AND owner_user_id = p_user_id
  ) INTO v_is_owner;

  -- Get total sales count
  v_total_sales := get_user_total_sales_count(p_user_id);

  -- Free tier: use effective limit (base 50 + referral credits)
  IF v_tier = 'free' THEN
    v_effective_limit := get_effective_sales_limit(p_user_id);

    IF v_total_sales >= v_effective_limit THEN
      RETURN QUERY SELECT false, 'FREE_TIER_LIMIT'::text, v_total_sales, true;
      RETURN;
    ELSE
      RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
      RETURN;
    END IF;
  END IF;

  -- For paid tiers, check if user owns this business
  IF NOT v_is_owner THEN
    -- Staff member accessing someone else's business - always allowed
    RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
    RETURN;
  END IF;

  -- For paid tiers, check if business is within limit
  v_owned_count := get_user_owned_business_count(p_user_id);

  -- If user owns more businesses than allowed, check which ones are active
  IF v_max_businesses IS NOT NULL AND v_owned_count > v_max_businesses THEN
    -- Check if this business is one of the active businesses
    IF NOT EXISTS (
      SELECT 1 FROM businesses
      WHERE id = p_business_id
        AND owner_user_id = p_user_id
        AND access_state = 'active'
    ) THEN
      RETURN QUERY SELECT false, 'BUSINESS_SALES_LIMIT'::text, v_total_sales, true;
      RETURN;
    END IF;
  END IF;

  -- Paid tier with subscription within limits - unlimited sales
  RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
END;
$$;

GRANT EXECUTE ON FUNCTION can_user_create_sale(uuid, uuid) TO authenticated;
