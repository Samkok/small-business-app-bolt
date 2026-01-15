/*
  # Fix get_business_owner_subscription_tier Function
  
  Fixes the function to not reference the non-existent subscription_tiers table.
  Uses max_owned_businesses directly from user_subscriptions table.
  
  ## Changes
  
  1. **get_business_owner_subscription_tier** - Removed JOIN with subscription_tiers table
     - Uses max_owned_businesses directly from user_subscriptions
     - Returns tier information without needing separate subscription_tiers table
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
    us.subscription_expiration_date,
    COALESCE(us.max_owned_businesses, 1),
    CASE 
      WHEN us.subscription_status IN ('expired', 'cancelled') THEN true
      WHEN us.subscription_expiration_date IS NOT NULL AND us.subscription_expiration_date < NOW() THEN true
      ELSE false
    END AS is_expired
  FROM user_subscriptions us
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