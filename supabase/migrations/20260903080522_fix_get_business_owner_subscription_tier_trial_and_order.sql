/*
# Fix get_business_owner_subscription_tier: Trial Handling + ORDER BY

## Problem
1. This function does not consider 'trial' status as expired, while
   get_user_subscription_tier does. A trial user sees different behavior
   depending on which code path checks their status.
2. LIMIT 1 without ORDER BY makes the result non-deterministic if
   a user somehow has multiple subscription records.

## Changes
- Add 'trial' to the list of statuses treated as expired/free
- Add ORDER BY updated_at DESC before LIMIT 1
- Add grace_period_end support for consistency

## Modified Functions
- get_business_owner_subscription_tier(uuid)
*/

CREATE OR REPLACE FUNCTION get_business_owner_subscription_tier(p_business_id uuid)
RETURNS TABLE(owner_id uuid, tier text, subscription_status text, expiration_date timestamptz, max_owned_businesses integer, is_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      WHEN us.subscription_status IN ('expired', 'cancelled', 'trial') THEN true
      WHEN us.subscription_expiration_date IS NOT NULL
        AND us.subscription_expiration_date < NOW()
        AND (us.grace_period_end IS NULL OR us.grace_period_end < NOW())
        THEN true
      ELSE false
    END AS is_expired
  FROM user_subscriptions us
  WHERE us.user_id = v_owner_id
  ORDER BY us.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      v_owner_id,
      'free'::text,
      'trial'::text,
      NULL::timestamptz,
      1,
      true;
  END IF;
END;
$function$;
