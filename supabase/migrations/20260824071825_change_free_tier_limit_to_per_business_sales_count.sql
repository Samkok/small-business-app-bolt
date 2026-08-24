/*
# Change free-tier sales limit check to per-business instead of total

## Summary
Updates can_user_create_sale so that free-tier users are limited based on the sales
count of the SPECIFIC business they are trying to create a sale for, NOT the total
across all owned businesses. This makes the business selection flow meaningful:
a user whose subscription expired can still sell on a business that hasn't reached
the 50-sale threshold, even if their other businesses have exceeded it.

## Changes
- Free tier branch now calls get_user_total_sales_count(p_user_id, p_business_id)
  to get the per-business count instead of get_user_total_sales_count(p_user_id)
  which sums all businesses.
- The effective limit (50 + referral credits) still applies, but per-business.
- The returned current_count now reflects the specific business's sales count.

## Important Notes
1. Paid tier logic is unchanged — paid users still get unlimited sales on active businesses.
2. The business access_state check (read_only_sales) still happens first and blocks
   sales on read-only businesses regardless of count.
3. Referral credits still apply on top of the base 50 limit per business.
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
  v_business_sales integer;
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

  -- Get per-business sales count (not total across all businesses)
  v_business_sales := get_user_total_sales_count(p_user_id, p_business_id);

  -- Free tier: use effective limit (base 50 + referral credits) checked per-business
  IF v_tier = 'free' THEN
    v_effective_limit := get_effective_sales_limit(p_user_id);

    IF v_business_sales >= v_effective_limit THEN
      RETURN QUERY SELECT false, 'FREE_TIER_LIMIT'::text, v_business_sales, true;
      RETURN;
    ELSE
      RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
      RETURN;
    END IF;
  END IF;

  -- For paid tiers, check if user owns this business
  IF NOT v_is_owner THEN
    -- Staff member accessing someone else's business - always allowed
    RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
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
      RETURN QUERY SELECT false, 'BUSINESS_SALES_LIMIT'::text, v_business_sales, true;
      RETURN;
    END IF;
  END IF;

  -- Paid tier with subscription within limits - unlimited sales
  RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
END;
$$;

GRANT EXECUTE ON FUNCTION can_user_create_sale(uuid, uuid) TO authenticated;
