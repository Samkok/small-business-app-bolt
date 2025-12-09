/*
  # Fix get_user_subscription_tier Expiration Logic
  
  ## Overview
  This migration restores the expiration check logic that was removed in a previous migration.
  Expired subscriptions should be treated as 'free' tier to enforce proper limits.
  
  ## Changes
  
  1. **Update get_user_subscription_tier function**
     - Restore expiration status checking
     - Check if subscription_status is 'expired', 'cancelled', or 'trial'
     - Check if expiration_date has passed
     - Return 'free' tier for expired/cancelled/trial subscriptions
     - Keep updated business limits: free=1, pro=1, pro_plus=3, max=unlimited
  
  ## Business Rules After This Migration
  
  - Expired Pro subscription → Free tier (1 business, 50 sales total)
  - Expired Pro Plus subscription → Free tier (1 business, 50 sales total)
  - Expired Max subscription → Free tier (1 business, 50 sales total)
  - Active Pro → 1 business, unlimited sales
  - Active Pro Plus → 3 businesses, unlimited sales
  - Active Max → unlimited businesses and sales
*/

CREATE OR REPLACE FUNCTION get_user_subscription_tier(p_user_id uuid)
RETURNS TABLE (
  tier text,
  max_owned_businesses integer,
  subscription_status text,
  expiration_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_expiration timestamptz;
  v_is_expired boolean;
BEGIN
  -- Get the latest subscription
  SELECT 
    us.tier,
    us.subscription_status,
    us.subscription_expiration_date
  INTO v_tier, v_status, v_expiration
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;
  
  -- If no subscription found, return free tier defaults with 1 business limit
  IF v_tier IS NULL THEN
    RETURN QUERY SELECT 'free'::text, 1::integer, 'trial'::text, NULL::timestamptz;
    RETURN;
  END IF;
  
  -- Check if subscription is expired
  v_is_expired := (
    v_status IN ('expired', 'cancelled', 'trial') OR
    (v_expiration IS NOT NULL AND v_expiration < now())
  );
  
  -- If expired, return free tier with 1 business limit
  IF v_is_expired THEN
    RETURN QUERY SELECT 'free'::text, 1::integer, COALESCE(v_status, 'trial')::text, v_expiration;
    RETURN;
  END IF;
  
  -- Return actual tier with limits
  RETURN QUERY 
  SELECT 
    COALESCE(v_tier, 'free')::text,
    CASE COALESCE(v_tier, 'free')
      WHEN 'free' THEN 1
      WHEN 'pro' THEN 1
      WHEN 'pro_plus' THEN 3
      WHEN 'max' THEN 999999
      ELSE 1
    END as max_owned_businesses,
    COALESCE(v_status, 'trial')::text,
    v_expiration;
END;
$$;

COMMENT ON FUNCTION get_user_subscription_tier(uuid) IS 'Returns user subscription tier with limits and status, automatically returning free tier (1 business) for expired/cancelled subscriptions. Free tier: 1 business, 50 sales. Pro: 1 business, unlimited sales. Pro Plus: 3 businesses, unlimited sales. Max: unlimited businesses and sales.';
