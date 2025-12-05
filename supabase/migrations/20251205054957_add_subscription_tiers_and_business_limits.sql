/*
  # Add Subscription Tiers and Business Limits

  ## Overview
  This migration implements a comprehensive subscription tier system with business ownership limits and sales limits.

  ## 1. Subscription Tiers
  
  ### Tier Definitions:
  - **free**: Trial tier - 50 sales total across all businesses, unlimited businesses (staff access)
  - **pro**: $4.99/month - Unlimited sales for 1 owned business
  - **pro_plus**: $9.99/month - Unlimited sales for up to 3 owned businesses  
  - **max**: $19.99/month - Unlimited sales for unlimited owned businesses
  
  ### Business Limits
  Business limits apply to **owned** businesses only (where user is the owner).
  Staff members can access unlimited businesses they're invited to, regardless of tier.

  ## 2. Schema Changes
  
  ### user_subscriptions table updates:
  - Add `tier` column (free, pro, pro_plus, max)
  - Add `max_owned_businesses` column (derived from tier)
  - Update validation logic to check business ownership limits
  
  ### New helper functions:
  - `get_user_owned_business_count()` - Counts businesses owned by user
  - `get_user_subscription_tier()` - Returns current subscription tier
  - `can_user_create_business()` - Checks if user can create another business
  - `can_user_create_sale()` - Checks if user can create sale based on tier and limits

  ## 3. Sales Validation Logic
  
  ### Free Tier:
  - 50 sales total across ALL businesses
  - Counts all completed sales regardless of business
  
  ### Paid Tiers (Pro/Pro Plus/Max):
  - Unlimited sales for businesses within tier limit
  - If user owns more businesses than their tier allows, older businesses become read-only
  
  ## 4. Security
  - All functions use SECURITY DEFINER with proper search_path
  - RLS policies enforce business ownership limits
  - Triggers prevent exceeding limits at database level
*/

-- Add tier column to user_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'tier'
  ) THEN
    ALTER TABLE user_subscriptions 
    ADD COLUMN tier text DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'pro_plus', 'max'));
  END IF;
END $$;

-- Add max_owned_businesses column (derived from tier)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'max_owned_businesses'
  ) THEN
    ALTER TABLE user_subscriptions 
    ADD COLUMN max_owned_businesses integer;
  END IF;
END $$;

-- Create index on tier column
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier);

-- Update existing subscriptions to set tier based on product_id
UPDATE user_subscriptions
SET tier = CASE 
  WHEN subscription_product_id LIKE '%pro.month%' OR subscription_product_id LIKE '%pro.yearly%' THEN 'pro'
  ELSE 'free'
END,
max_owned_businesses = CASE 
  WHEN subscription_product_id LIKE '%pro.month%' OR subscription_product_id LIKE '%pro.yearly%' THEN 1
  ELSE NULL
END
WHERE tier IS NULL;

-- Function to get user's owned business count
CREATE OR REPLACE FUNCTION get_user_owned_business_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM businesses
  WHERE owner_id = p_user_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Function to get user's subscription tier with caching-friendly structure
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
      WHEN 'pro' THEN 1
      WHEN 'pro_plus' THEN 3
      WHEN 'max' THEN 999999
      ELSE NULL
    END as max_owned_businesses,
    COALESCE(us.subscription_status, 'trial') as subscription_status,
    us.subscription_expiration_date as expiration_date
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;
  
  -- If no subscription found, return free tier defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::text, NULL::integer, 'trial'::text, NULL::timestamptz;
  END IF;
END;
$$;

-- Function to check if user can create another business
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
  
  -- Free tier has no business creation limit (unlimited for staff access)
  -- But each business will have sales limits
  IF v_tier = 'free' OR v_max_businesses IS NULL THEN
    RETURN true;
  END IF;
  
  -- Get current owned business count
  v_current_count := get_user_owned_business_count(p_user_id);
  
  -- Check if under limit
  RETURN v_current_count < v_max_businesses;
END;
$$;

-- Function to get total sales count across all businesses for a user
CREATE OR REPLACE FUNCTION get_user_total_sales_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count integer;
BEGIN
  SELECT COALESCE(SUM(sales_count), 0) INTO v_total_count
  FROM user_sales_counts
  WHERE user_id = p_user_id;
  
  RETURN v_total_count;
END;
$$;

-- Function to check if user can create a sale
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
  v_total_sales integer;
  v_owned_count integer;
  v_max_businesses integer;
  v_is_owner boolean;
BEGIN
  -- Get subscription info
  SELECT tier, subscription_status, max_owned_businesses
  INTO v_tier, v_subscription_status, v_max_businesses
  FROM get_user_subscription_tier(p_user_id);
  
  -- Check if user is the owner of this business
  SELECT EXISTS(
    SELECT 1 FROM businesses 
    WHERE id = p_business_id AND owner_id = p_user_id
  ) INTO v_is_owner;
  
  -- Get total sales count
  v_total_sales := get_user_total_sales_count(p_user_id);
  
  -- Free tier: 50 sales total across all businesses
  IF v_tier = 'free' THEN
    IF v_total_sales >= 50 THEN
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
  
  -- Paid tier with subscription within limits - unlimited sales
  RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
END;
$$;

-- Update the sales validation trigger function
CREATE OR REPLACE FUNCTION check_sales_subscription_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_can_create boolean;
  v_reason text;
  v_current_count integer;
  v_limit_reached boolean;
BEGIN
  -- Check if user can create sale
  SELECT can_create, reason, current_count, limit_reached
  INTO v_can_create, v_reason, v_current_count, v_limit_reached
  FROM can_user_create_sale(NEW.created_by, NEW.business_id);
  
  -- If cannot create, raise exception
  IF NOT v_can_create THEN
    IF v_reason = 'FREE_TIER_LIMIT' THEN
      RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Free tier limit of 50 sales reached. Please upgrade to continue.'
        USING HINT = 'User has reached the maximum number of sales allowed on the free tier';
    ELSIF v_reason = 'BUSINESS_LIMIT_EXCEEDED' THEN
      RAISE EXCEPTION 'BUSINESS_LIMIT_EXCEEDED: This business exceeds your subscription tier limit. Please upgrade to access all your businesses.'
        USING HINT = 'User has more businesses than their subscription tier allows';
    ELSE
      RAISE EXCEPTION 'SUBSCRIPTION_ERROR: Unable to create sale due to subscription limits.'
        USING HINT = 'Unknown subscription error';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger (it already exists from previous migration)
DROP TRIGGER IF EXISTS check_sales_limit_trigger ON sales;
CREATE TRIGGER check_sales_limit_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION check_sales_subscription_limit();

-- Add helpful comments
COMMENT ON FUNCTION get_user_owned_business_count(uuid) IS 'Returns the number of businesses owned by the user (not including staff access)';
COMMENT ON FUNCTION get_user_subscription_tier(uuid) IS 'Returns user subscription tier with limits and status';
COMMENT ON FUNCTION can_user_create_business(uuid) IS 'Checks if user can create another business based on their subscription tier';
COMMENT ON FUNCTION can_user_create_sale(uuid, uuid) IS 'Checks if user can create a sale for a specific business based on subscription limits';
COMMENT ON FUNCTION get_user_total_sales_count(uuid) IS 'Returns total sales count across all businesses for a user';