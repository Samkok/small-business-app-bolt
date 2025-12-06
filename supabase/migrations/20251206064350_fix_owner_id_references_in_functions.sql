/*
  # Fix owner_id References in Functions

  ## Overview
  Fixes all database functions that reference the incorrect column name `owner_id`.
  The businesses table uses `owner_user_id`, not `owner_id`.

  ## Changes
  - Updates set_read_only_businesses() function
  - Updates activate_selected_businesses() function
  - Updates can_user_create_sale() function

  All references to `owner_id` are changed to `owner_user_id`.
*/

-- Function to set businesses to read-only when exceeding tier limit
CREATE OR REPLACE FUNCTION set_read_only_businesses(
  p_user_id uuid,
  p_max_active_businesses integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_record RECORD;
  v_active_count integer := 0;
BEGIN
  -- Loop through user's owned businesses ordered by creation date
  FOR v_business_record IN (
    SELECT id FROM businesses 
    WHERE owner_user_id = p_user_id
    ORDER BY created_at ASC
  ) LOOP
    v_active_count := v_active_count + 1;
    
    -- First N businesses stay active, rest become read-only
    IF v_active_count <= p_max_active_businesses THEN
      UPDATE businesses 
      SET access_state = 'active'
      WHERE id = v_business_record.id;
    ELSE
      UPDATE businesses 
      SET access_state = 'read_only_sales'
      WHERE id = v_business_record.id;
    END IF;
  END LOOP;
  
  -- Set must_choose_businesses flag if user has more businesses than allowed
  IF v_active_count > p_max_active_businesses THEN
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Function to activate selected businesses and set others to read-only
CREATE OR REPLACE FUNCTION activate_selected_businesses(
  p_user_id uuid,
  p_selected_business_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_subscription_id uuid;
BEGIN
  -- Set all owned businesses to read_only_sales first
  UPDATE businesses
  SET access_state = 'read_only_sales'
  WHERE owner_user_id = p_user_id;
  
  -- Activate only selected businesses
  UPDATE businesses
  SET access_state = 'active'
  WHERE owner_user_id = p_user_id
    AND id = ANY(p_selected_business_ids);
  
  -- Clear must_choose_businesses flag
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;
  
  -- Get latest subscription ID
  SELECT id INTO v_latest_subscription_id
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Store selection in user_subscriptions
  IF v_latest_subscription_id IS NOT NULL THEN
    UPDATE user_subscriptions
    SET selected_business_ids = to_jsonb(p_selected_business_ids),
        updated_at = now()
    WHERE id = v_latest_subscription_id;
  END IF;
END;
$$;

-- Update can_user_create_sale to use correct column name
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
  v_access_state text;
BEGIN
  -- Check business access state first
  SELECT access_state INTO v_access_state
  FROM businesses
  WHERE id = p_business_id;
  
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