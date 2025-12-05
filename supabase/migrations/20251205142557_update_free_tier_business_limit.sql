/*
  # Update Free Tier Business Limit
  
  ## Changes
  - Free tier now limited to 1 owned business (changed from unlimited)
  - Free tier still limited to 50 total sales
  
  ## Updated Tier Limits:
  - **free**: 1 owned business, 50 sales total
  - **pro**: 1 owned business, unlimited sales
  - **pro_plus**: 3 owned businesses, unlimited sales
  - **max**: unlimited businesses, unlimited sales
  
  ## Security
  - Enforces limits at database level
*/

-- Update get_user_subscription_tier function to return 1 for free tier
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
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(us.tier, 'free') as tier,
    CASE COALESCE(us.tier, 'free')
      WHEN 'free' THEN 1
      WHEN 'pro' THEN 1
      WHEN 'pro_plus' THEN 3
      WHEN 'max' THEN 999999
      ELSE 1
    END as max_owned_businesses,
    COALESCE(us.subscription_status, 'trial') as subscription_status,
    us.subscription_expiration_date as expiration_date
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;
  
  -- If no subscription found, return free tier defaults with 1 business limit
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::text, 1::integer, 'trial'::text, NULL::timestamptz;
  END IF;
END;
$$;

-- Update can_user_create_business function to enforce free tier limit
CREATE OR REPLACE FUNCTION can_user_create_business(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_max_businesses integer;
  v_current_count integer;
BEGIN
  -- Get user's tier and limits
  SELECT tier, max_owned_businesses 
  INTO v_tier, v_max_businesses
  FROM get_user_subscription_tier(p_user_id);
  
  -- Get current owned business count
  v_current_count := get_user_owned_business_count(p_user_id);
  
  -- All tiers now have business limits
  IF v_max_businesses IS NULL THEN
    -- Fallback: if somehow max_businesses is NULL, default to 1
    RETURN v_current_count < 1;
  END IF;
  
  -- Check if under limit
  RETURN v_current_count < v_max_businesses;
END;
$$;

COMMENT ON FUNCTION get_user_subscription_tier(uuid) IS 'Returns user subscription tier with limits and status. Free tier: 1 business, 50 sales. Pro: 1 business, unlimited sales. Pro Plus: 3 businesses, unlimited sales. Max: unlimited businesses and sales.';
COMMENT ON FUNCTION can_user_create_business(uuid) IS 'Checks if user can create another business based on their subscription tier. All tiers have business limits.';
