/*
# Fix get_full_subscription_state and get_user_subscription_tier: Expiration + Grace Period

## Problem
1. get_full_subscription_state reads tier directly without checking expiration.
   An expired 'pro' user sees tier='pro' and isSubscribed=true, but
   can_user_create_sale correctly downgrades to 'free' and blocks sales.
2. grace_period_end column exists but is never checked.

## Changes
- get_full_subscription_state: apply expiration+grace period logic to determine effective tier
- get_user_subscription_tier: add grace period support (drop+recreate due to return type)
- Both functions now treat expired/cancelled/trial as 'free'
- Grace period: if expiration is past but grace_period_end is future, keep paid tier

## Modified Functions
- get_full_subscription_state(uuid, uuid)
- get_user_subscription_tier(uuid)
*/

-- Fix get_full_subscription_state
CREATE OR REPLACE FUNCTION get_full_subscription_state(p_user_id uuid, p_business_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription_status text;
  v_subscription_expiration timestamptz;
  v_subscription_product_id text;
  v_tier text;
  v_effective_tier text;
  v_max_owned_businesses integer;
  v_grace_period_end timestamptz;
  v_owned_business_count integer;
  v_active_business_count integer;
  v_sales_count integer;
  v_total_owned_business_sales integer;
  v_remaining_sales integer;
  v_is_at_limit boolean;
  v_can_access_feature boolean;
  v_has_business_access boolean;
  v_effective_limit integer;
  v_result jsonb;
BEGIN
  SELECT
    subscription_status, subscription_expiration_date, subscription_product_id,
    tier, max_owned_businesses, grace_period_end
  INTO
    v_subscription_status, v_subscription_expiration, v_subscription_product_id,
    v_tier, v_max_owned_businesses, v_grace_period_end
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_subscription_status IS NULL THEN
    v_subscription_status := 'trial';
    v_tier := 'free';
    v_max_owned_businesses := 1;
    v_subscription_expiration := NULL;
    v_subscription_product_id := NULL;
    v_grace_period_end := NULL;
  END IF;

  -- Apply expiration logic to determine effective tier
  v_effective_tier := v_tier;
  IF v_subscription_status IN ('expired', 'cancelled', 'trial') THEN
    v_effective_tier := 'free';
    v_max_owned_businesses := 1;
  ELSIF v_subscription_expiration IS NOT NULL AND v_subscription_expiration < now() THEN
    IF v_grace_period_end IS NOT NULL AND v_grace_period_end > now() THEN
      NULL; -- Grace period active: keep paid tier
    ELSE
      v_effective_tier := 'free';
      v_max_owned_businesses := 1;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO v_owned_business_count
  FROM businesses WHERE owner_user_id = p_user_id;

  SELECT COUNT(*)::integer INTO v_active_business_count
  FROM businesses WHERE owner_user_id = p_user_id AND access_state = 'active';

  SELECT COALESCE(SUM(usc.sales_count), 0)::integer INTO v_total_owned_business_sales
  FROM user_sales_counts usc
  INNER JOIN businesses b ON usc.business_id = b.id
  WHERE usc.user_id = p_user_id AND b.owner_user_id = p_user_id;

  IF p_business_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM businesses WHERE id = p_business_id AND owner_user_id = p_user_id
      UNION
      SELECT 1 FROM user_business_roles WHERE business_id = p_business_id AND user_id = p_user_id
    ) INTO v_has_business_access;

    IF NOT v_has_business_access THEN
      RAISE EXCEPTION 'User does not have access to this business';
    END IF;

    SELECT COALESCE(sales_count, 0)::integer INTO v_sales_count
    FROM user_sales_counts
    WHERE user_id = p_user_id AND business_id = p_business_id;

    IF v_sales_count IS NULL THEN v_sales_count := 0; END IF;

    IF v_effective_tier = 'free' THEN
      v_effective_limit := get_effective_sales_limit(p_user_id);
      v_remaining_sales := GREATEST(0, v_effective_limit - v_sales_count);
      v_is_at_limit := v_sales_count >= v_effective_limit;
    ELSE
      v_remaining_sales := NULL;
      v_is_at_limit := false;
    END IF;

    v_can_access_feature := NOT COALESCE(v_is_at_limit, false);
  ELSE
    v_sales_count := NULL;
    v_remaining_sales := NULL;
    v_is_at_limit := NULL;
    v_can_access_feature := NULL;
  END IF;

  v_result := jsonb_build_object(
    'subscriptionStatus', jsonb_build_object(
      'isSubscribed', v_effective_tier != 'free',
      'subscriptionStatus', v_subscription_status,
      'subscriptionExpirationDate', v_subscription_expiration,
      'subscriptionProductId', v_subscription_product_id
    ),
    'tierInfo', jsonb_build_object(
      'tier', v_effective_tier,
      'maxOwnedBusinesses', v_max_owned_businesses,
      'subscriptionStatus', v_subscription_status,
      'expirationDate', v_subscription_expiration,
      'gracePeriodEnd', v_grace_period_end
    ),
    'ownedBusinessCount', v_owned_business_count,
    'activeBusinessCount', v_active_business_count,
    'salesCountData', CASE
      WHEN p_business_id IS NOT NULL THEN
        jsonb_build_object(
          'salesCount', v_sales_count,
          'remainingSales', v_remaining_sales,
          'isAtLimit', v_is_at_limit,
          'totalSalesAllBusinesses', v_total_owned_business_sales
        )
      ELSE NULL
    END,
    'canAccessFeature', v_can_access_feature
  );

  RETURN v_result;
END;
$function$;

-- Fix get_user_subscription_tier with grace period support
-- Must DROP first because return type columns differ
DROP FUNCTION IF EXISTS get_user_subscription_tier(uuid);

CREATE FUNCTION get_user_subscription_tier(p_user_id uuid)
RETURNS TABLE(tier text, max_owned_businesses integer, subscription_status text, expiration_date timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
  v_status text;
  v_max_businesses integer;
  v_expiration timestamptz;
  v_grace_period_end timestamptz;
BEGIN
  SELECT
    us.tier, us.subscription_status, us.max_owned_businesses,
    us.subscription_expiration_date, us.grace_period_end
  INTO v_tier, v_status, v_max_businesses, v_expiration, v_grace_period_end
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::text, 1, 'trial'::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_status IN ('expired', 'cancelled', 'trial') THEN
    RETURN QUERY SELECT 'free'::text, 1, v_status, v_expiration;
    RETURN;
  END IF;

  IF v_expiration IS NOT NULL AND v_expiration < now() THEN
    IF v_grace_period_end IS NOT NULL AND v_grace_period_end > now() THEN
      RETURN QUERY SELECT v_tier, v_max_businesses, v_status, v_expiration;
      RETURN;
    ELSE
      RETURN QUERY SELECT 'free'::text, 1, 'expired'::text, v_expiration;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT v_tier, v_max_businesses, v_status, v_expiration;
END;
$function$;
