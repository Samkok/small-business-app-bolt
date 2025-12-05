/*
  # Fix owner_id column references

  This migration fixes the column name references in subscription-related functions.
  The businesses table uses `owner_user_id` not `owner_id`.

  ## Changes
  - Updates `get_user_owned_business_count` to use `owner_user_id`
  - Updates `can_user_create_sale` to use `owner_user_id` in both places
*/

-- Function to get user's owned business count (fixed)
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
  WHERE owner_user_id = p_user_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Function to check if user can create a sale (fixed)
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
    WHERE id = p_business_id AND owner_user_id = p_user_id
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
        WHERE owner_user_id = p_user_id 
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