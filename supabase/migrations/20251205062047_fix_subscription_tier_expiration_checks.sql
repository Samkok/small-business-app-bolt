/*
  # Fix Subscription Tier Expiration Checks
  
  ## Overview
  This migration fixes critical issues where expired subscriptions don't revert to free tier behavior.
  
  ## Changes
  
  1. **Update get_user_subscription_tier function**
     - Check if subscription is expired or cancelled
     - Check if expiration date has passed
     - Return 'free' tier for expired/cancelled/trial subscriptions
     - Ensures expired paid subscriptions enforce free tier limits
  
  2. **Update can_user_create_sale function**
     - Add explicit subscription status check before checking tier
     - Treat expired/cancelled subscriptions as free tier
     - Apply free tier limits (50 sales total) for expired subscriptions
     - Only apply paid tier benefits for active, non-expired subscriptions
  
  ## Business Rules After This Migration
  
  - Expired Pro subscription → Free tier (50 sales total across all businesses)
  - Expired Pro Plus subscription → Free tier (50 sales total across all businesses)
  - Expired Max subscription → Free tier (50 sales total across all businesses)
  - Active Pro with 3 businesses → Only oldest business can create sales (unlimited)
  - Active Pro Plus with 5 businesses → Only 3 oldest businesses can create sales (unlimited)
  - Active Max → All businesses can create unlimited sales
*/

-- Update get_user_subscription_tier to check expiration status
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
  
  -- If no subscription found, return free tier defaults
  IF v_tier IS NULL THEN
    RETURN QUERY SELECT 'free'::text, NULL::integer, 'trial'::text, NULL::timestamptz;
    RETURN;
  END IF;
  
  -- Check if subscription is expired
  v_is_expired := (
    v_status IN ('expired', 'cancelled', 'trial') OR
    (v_expiration IS NOT NULL AND v_expiration < now())
  );
  
  -- If expired, return free tier regardless of stored tier
  IF v_is_expired THEN
    RETURN QUERY SELECT 'free'::text, NULL::integer, COALESCE(v_status, 'trial')::text, v_expiration;
    RETURN;
  END IF;
  
  -- Return actual tier with limits
  RETURN QUERY 
  SELECT 
    COALESCE(v_tier, 'free')::text,
    CASE COALESCE(v_tier, 'free')
      WHEN 'pro' THEN 1
      WHEN 'pro_plus' THEN 3
      WHEN 'max' THEN 999999
      ELSE NULL
    END as max_owned_businesses,
    COALESCE(v_status, 'trial')::text,
    v_expiration;
END;
$$;

-- Update can_user_create_sale to properly handle expired subscriptions
CREATE OR REPLACE FUNCTION can_user_create_sale(
  p_user_id uuid,
  p_business_id uuid
)
RETURNS TABLE (
  can_create boolean,
  reason text,
  current_count integer,
  limit_reached boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_subscription_status text;
  v_expiration_date timestamptz;
  v_total_sales integer;
  v_owned_count integer;
  v_max_businesses integer;
  v_is_owner boolean;
  v_is_expired boolean;
BEGIN
  -- Get subscription info (now includes expiration check)
  SELECT tier, subscription_status, max_owned_businesses, expiration_date
  INTO v_tier, v_subscription_status, v_max_businesses, v_expiration_date
  FROM get_user_subscription_tier(p_user_id);
  
  -- Check if subscription is expired
  v_is_expired := (
    v_subscription_status IN ('expired', 'cancelled', 'trial') OR
    (v_expiration_date IS NOT NULL AND v_expiration_date < now())
  );
  
  -- If expired or free tier, enforce 50 sales limit across all businesses
  IF v_tier = 'free' OR v_is_expired THEN
    v_total_sales := get_user_total_sales_count(p_user_id);
    
    IF v_total_sales >= 50 THEN
      RETURN QUERY SELECT false, 'FREE_TIER_LIMIT'::text, v_total_sales, true;
      RETURN;
    ELSE
      RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
      RETURN;
    END IF;
  END IF;
  
  -- For active paid tiers, check business ownership
  SELECT EXISTS(
    SELECT 1 FROM businesses 
    WHERE id = p_business_id AND owner_id = p_user_id
  ) INTO v_is_owner;
  
  v_total_sales := get_user_total_sales_count(p_user_id);
  
  -- Staff member accessing someone else's business - always allowed for paid tiers
  IF NOT v_is_owner THEN
    RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
    RETURN;
  END IF;
  
  -- Check if this business is within the tier's business limit
  v_owned_count := get_user_owned_business_count(p_user_id);
  
  -- If user owns more businesses than allowed, check which ones are active
  IF v_max_businesses IS NOT NULL AND v_owned_count > v_max_businesses THEN
    -- Check if this business is one of the first N businesses (active ones)
    IF NOT EXISTS (
      SELECT 1 FROM (
        SELECT id FROM businesses 
        WHERE owner_id = p_user_id 
        ORDER BY created_at ASC 
        LIMIT v_max_businesses
      ) AS active_businesses
      WHERE id = p_business_id
    ) THEN
      RETURN QUERY SELECT false, 'BUSINESS_LIMIT_EXCEEDED'::text, v_total_sales, true;
      RETURN;
    END IF;
  END IF;
  
  -- Active paid tier with business within limits - unlimited sales
  RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION get_user_subscription_tier(uuid) IS 'Returns user subscription tier, automatically returning free tier for expired/cancelled subscriptions';
COMMENT ON FUNCTION can_user_create_sale(uuid, uuid) IS 'Checks if user can create a sale, enforcing free tier limits for expired subscriptions and business limits for paid tiers';
