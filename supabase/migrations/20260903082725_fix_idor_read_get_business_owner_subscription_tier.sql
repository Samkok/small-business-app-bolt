/*
# Fix get_business_owner_subscription_tier return type and add auth guard

## Problem
- Previous migration failed because return type differs.
- Need DROP + CREATE.

## Changes
- DROP then CREATE with auth.uid() guard
- Allows business members (not just owner) to check tier
- Includes grace period logic
*/

DROP FUNCTION IF EXISTS public.get_business_owner_subscription_tier(uuid);

CREATE FUNCTION public.get_business_owner_subscription_tier(p_business_id uuid)
RETURNS TABLE(tier text, max_businesses integer, subscription_status text, expiration_date timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_sub RECORD;
  v_effective_tier text;
  v_grace_period_end timestamptz;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();

  SELECT owner_user_id INTO v_owner_id
  FROM businesses WHERE id = p_business_id;

  IF v_owner_id IS NULL THEN
    RETURN QUERY SELECT 'free'::text, 1::integer, 'none'::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_caller IS NOT NULL AND v_caller != v_owner_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_business_roles WHERE business_id = p_business_id AND user_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Cannot view subscription tier for a business you are not a member of';
    END IF;
  END IF;

  SELECT us.tier, us.max_owned_businesses, us.subscription_status, us.expiration_date,
         us.grace_period_end
  INTO v_sub
  FROM user_subscriptions us
  WHERE us.user_id = v_owner_id
  ORDER BY us.updated_at DESC LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN QUERY SELECT 'free'::text, 1::integer, 'trial'::text, NULL::timestamptz;
    RETURN;
  END IF;

  v_effective_tier := v_sub.tier;
  IF v_sub.subscription_status IN ('expired', 'cancelled', 'billing_issue', 'trial') THEN
    v_grace_period_end := COALESCE(v_sub.grace_period_end, v_sub.expiration_date);
    IF v_grace_period_end IS NOT NULL AND v_grace_period_end > now() THEN
      v_effective_tier := v_sub.tier;
    ELSE
      v_effective_tier := 'free';
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_effective_tier::text,
    CASE WHEN v_effective_tier = 'free' THEN 1 ELSE v_sub.max_owned_businesses END::integer,
    v_sub.subscription_status::text,
    v_sub.expiration_date::timestamptz;
END;
$function$;
