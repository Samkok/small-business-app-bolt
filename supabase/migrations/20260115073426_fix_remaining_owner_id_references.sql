/*
  # Fix Remaining owner_id References
  
  Fixes all remaining database functions that incorrectly reference `owner_id` instead of `owner_user_id`.
  
  ## Changes
  
  1. **get_business_owner_subscription_tier** - Fixed query to use owner_user_id
  2. **set_all_businesses_read_only_on_expiration** - Fixed UPDATE to use owner_user_id
  3. **set_read_only_businesses** - Fixed WHERE clause to use owner_user_id
*/

-- Fix get_business_owner_subscription_tier function
CREATE OR REPLACE FUNCTION get_business_owner_subscription_tier(
  p_business_id uuid
)
RETURNS TABLE (
  owner_id uuid,
  tier text,
  subscription_status text,
  expiration_date timestamptz,
  max_owned_businesses integer,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Get the business owner
  SELECT businesses.owner_user_id INTO v_owner_id
  FROM businesses
  WHERE businesses.id = p_business_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  -- Return owner's subscription information
  RETURN QUERY
  SELECT
    v_owner_id,
    COALESCE(us.tier, 'free')::text,
    COALESCE(us.subscription_status, 'trial')::text,
    us.expiration_date,
    COALESCE(st.max_owned_businesses, 1),
    CASE 
      WHEN us.subscription_status IN ('expired', 'cancelled') THEN true
      WHEN us.expiration_date IS NOT NULL AND us.expiration_date < NOW() THEN true
      ELSE false
    END AS is_expired
  FROM user_subscriptions us
  LEFT JOIN subscription_tiers st ON us.tier = st.tier_name
  WHERE us.user_id = v_owner_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      v_owner_id,
      'free'::text,
      'trial'::text,
      NULL::timestamptz,
      1,
      false;
  END IF;
END;
$$;

-- Fix set_all_businesses_read_only_on_expiration function
CREATE OR REPLACE FUNCTION set_all_businesses_read_only_on_expiration(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set all owned businesses to read_only_sales state
  UPDATE businesses
  SET access_state = 'read_only_sales'
  WHERE owner_user_id = p_user_id;

  -- Clear selected_business_ids for the user
  UPDATE user_profiles
  SET 
    selected_business_ids = NULL,
    must_choose_businesses = true
  WHERE user_id = p_user_id;
END;
$$;

-- Fix set_read_only_businesses function
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

  -- Clear selected_business_ids and set must_choose_businesses
  UPDATE user_profiles
  SET 
    selected_business_ids = NULL,
    must_choose_businesses = true
  WHERE user_id = p_user_id;
END;
$$;