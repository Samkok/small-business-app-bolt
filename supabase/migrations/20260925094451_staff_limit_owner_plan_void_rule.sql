-- 1. A team member's sales are limited by the OWNER's plan, not their own.
--    can_user_create_sale and get_full_subscription_state used the caller's plan and the
--    caller's counter (0 for staff), so a member of a free business past 50 sales was told
--    "allowed" while the insert trigger (which always used the owner) refused. Both now read
--    the owner's effective plan and the business's own counter, like the trigger.
--    A non-member is refused (NOT_A_MEMBER) instead of being judged on their own plan.
-- 2. Void rule: a voided sale does not count towards the free limit. The void trigger already
--    took one off the counter, but the nightly reconciliation counted every sale including
--    voided ones and put it back ("corrected" every night). Reconciliation now ignores voided
--    sales, so the two agree.

-- The plan a user is on right now, with grace periods, and NO caller guard: for use inside
-- other SECURITY DEFINER functions that need the plan of someone other than the caller.
CREATE OR REPLACE FUNCTION public.effective_plan(p_user_id uuid)
RETURNS TABLE(tier text, max_owned_businesses integer, subscription_status text, expiration_date timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_tier text;
  v_status text;
  v_max_businesses integer;
  v_expiration timestamptz;
  v_grace_period_ends_at timestamptz;
BEGIN
  SELECT us.tier, us.subscription_status, us.max_owned_businesses,
         us.subscription_expiration_date, us.grace_period_ends_at
    INTO v_tier, v_status, v_max_businesses, v_expiration, v_grace_period_ends_at
    FROM user_subscriptions us
   WHERE us.user_id = p_user_id
   ORDER BY us.updated_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::text, 1, 'trial'::text, NULL::timestamptz; RETURN;
  END IF;
  IF v_status IN ('expired', 'cancelled', 'trial') THEN
    RETURN QUERY SELECT 'free'::text, 1, v_status, v_expiration; RETURN;
  END IF;
  IF v_expiration IS NOT NULL AND v_expiration < now() THEN
    IF v_grace_period_ends_at IS NOT NULL AND v_grace_period_ends_at > now() THEN
      RETURN QUERY SELECT v_tier, v_max_businesses, v_status, v_expiration; RETURN;
    END IF;
    RETURN QUERY SELECT 'free'::text, 1, 'expired'::text, v_expiration; RETURN;
  END IF;
  RETURN QUERY SELECT v_tier, v_max_businesses, v_status, v_expiration;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.effective_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.can_user_create_sale(p_user_id uuid, p_business_id uuid)
RETURNS TABLE(can_create boolean, reason text, current_count integer, limit_reached boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_access_state text;
  v_tier text;
  v_max_businesses integer;
  v_business_sales integer;
  v_owned_count integer;
  v_effective_limit integer;
BEGIN
  PERFORM public.require_self_or_service(p_user_id);

  SELECT b.owner_user_id, b.access_state INTO v_owner, v_access_state
    FROM businesses b WHERE b.id = p_business_id;
  IF v_owner IS NULL THEN
    RETURN QUERY SELECT false, 'BUSINESS_NOT_FOUND'::text, 0, false; RETURN;
  END IF;

  -- Only people who belong to the business may sell in it
  IF v_owner <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM user_business_roles r WHERE r.business_id = p_business_id AND r.user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT false, 'NOT_A_MEMBER'::text, 0, false; RETURN;
  END IF;

  IF v_access_state = 'read_only_sales' THEN
    RETURN QUERY SELECT false, 'BUSINESS_READ_ONLY'::text, 0, true; RETURN;
  END IF;
  IF v_access_state = 'owner_disabled' THEN
    RETURN QUERY SELECT false, 'BUSINESS_OWNER_DISABLED'::text, 0, true; RETURN;
  END IF;

  -- The owner's plan and the business's own counter decide, whoever is selling
  -- (the same rule as the sales insert trigger check_sales_subscription_limit)
  SELECT ep.tier, ep.max_owned_businesses INTO v_tier, v_max_businesses
    FROM public.effective_plan(v_owner) ep;
  SELECT usc.sales_count INTO v_business_sales
    FROM user_sales_counts usc WHERE usc.user_id = v_owner AND usc.business_id = p_business_id;
  v_business_sales := COALESCE(v_business_sales, 0);

  IF v_tier = 'free' THEN
    v_effective_limit := get_effective_sales_limit(v_owner);
    IF v_business_sales >= v_effective_limit THEN
      RETURN QUERY SELECT false, 'FREE_TIER_LIMIT'::text, v_business_sales, true;
    ELSE
      RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
    END IF;
    RETURN;
  END IF;

  -- Paid plan with more businesses than it allows: only the active ones take sales
  SELECT count(*)::integer INTO v_owned_count FROM businesses WHERE owner_user_id = v_owner;
  IF v_max_businesses IS NOT NULL AND v_owned_count > v_max_businesses AND v_access_state <> 'active' THEN
    RETURN QUERY SELECT false, 'BUSINESS_SALES_LIMIT'::text, v_business_sales, true; RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_full_subscription_state(p_user_id uuid, p_business_id uuid DEFAULT NULL::uuid)
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
  v_grace_period_ends_at timestamptz;
  v_owned_business_count integer;
  v_active_business_count integer;
  v_sales_count integer;
  v_total_owned_business_sales integer;
  v_remaining_sales integer;
  v_is_at_limit boolean;
  v_can_access_feature boolean;
  v_has_business_access boolean;
  v_effective_limit integer;
  v_business_owner uuid;
  v_limit_tier text;
  v_result jsonb;
BEGIN
  PERFORM public.require_self_or_service(p_user_id);
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot view another user''s subscription state';
  END IF;

  -- The caller's OWN plan (what the subscription screens show)
  SELECT subscription_status, subscription_expiration_date, subscription_product_id,
         tier, max_owned_businesses, grace_period_ends_at
    INTO v_subscription_status, v_subscription_expiration, v_subscription_product_id,
         v_tier, v_max_owned_businesses, v_grace_period_ends_at
    FROM user_subscriptions
   WHERE user_id = p_user_id
   ORDER BY updated_at DESC LIMIT 1;

  IF v_subscription_status IS NULL THEN
    v_subscription_status := 'trial';
    v_tier := 'free';
    v_max_owned_businesses := 1;
    v_subscription_expiration := NULL;
    v_subscription_product_id := NULL;
    v_grace_period_ends_at := NULL;
  END IF;

  v_effective_tier := v_tier;
  IF v_subscription_status IN ('expired', 'cancelled', 'trial') THEN
    v_effective_tier := 'free';
    v_max_owned_businesses := 1;
  ELSIF v_subscription_expiration IS NOT NULL AND v_subscription_expiration < now() THEN
    IF v_grace_period_ends_at IS NOT NULL AND v_grace_period_ends_at > now() THEN
      NULL;
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
    SELECT owner_user_id INTO v_business_owner FROM businesses WHERE id = p_business_id;

    v_has_business_access := v_business_owner = p_user_id OR EXISTS (
      SELECT 1 FROM user_business_roles WHERE business_id = p_business_id AND user_id = p_user_id
    );
    IF NOT COALESCE(v_has_business_access, false) THEN
      RAISE EXCEPTION 'User does not have access to this business';
    END IF;

    -- The business's sales limit follows the OWNER's plan and the business's own counter,
    -- whoever is asking (same rule as can_user_create_sale and the insert trigger)
    SELECT ep.tier INTO v_limit_tier FROM public.effective_plan(v_business_owner) ep;

    SELECT COALESCE(sales_count, 0)::integer INTO v_sales_count
      FROM user_sales_counts
     WHERE user_id = v_business_owner AND business_id = p_business_id;
    IF v_sales_count IS NULL THEN v_sales_count := 0; END IF;

    IF v_limit_tier = 'free' THEN
      v_effective_limit := get_effective_sales_limit(v_business_owner);
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
      'gracePeriodEnd', v_grace_period_ends_at
    ),
    'ownedBusinessCount', v_owned_business_count,
    'activeBusinessCount', v_active_business_count,
    'salesCountData', CASE
      WHEN p_business_id IS NOT NULL THEN jsonb_build_object(
        'salesCount', v_sales_count,
        'remainingSales', v_remaining_sales,
        'isAtLimit', v_is_at_limit,
        'totalSalesAllBusinesses', v_total_owned_business_sales,
        'limitTier', v_limit_tier
      )
      ELSE NULL
    END,
    'canAccessFeature', v_can_access_feature
  );

  RETURN v_result;
END;
$function$;

-- Void rule: reconciliation counts the sales that still stand, as the void trigger does
CREATE OR REPLACE FUNCTION public.reconcile_sales_count(p_user_id uuid, p_business_id uuid, p_auto_correct boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cached_count integer;
  v_actual_count integer;
  v_discrepancy integer;
  v_corrected boolean := false;
  v_is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM businesses WHERE id = p_business_id AND owner_user_id = p_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'User % is not the owner of business %', p_user_id, p_business_id;
  END IF;

  SELECT sales_count INTO v_cached_count
    FROM user_sales_counts
   WHERE user_id = p_user_id AND business_id = p_business_id;

  -- Every sale of this business that still stands, whoever made it. A voided sale does not
  -- use up a free-plan slot: the void trigger takes it off the counter and it stays off.
  SELECT COUNT(*)::integer INTO v_actual_count
    FROM sales
   WHERE business_id = p_business_id AND status <> 'voided';

  IF v_cached_count IS NULL THEN
    INSERT INTO user_sales_counts (user_id, business_id, sales_count)
    VALUES (p_user_id, p_business_id, v_actual_count);
    v_cached_count := v_actual_count;
    v_corrected := true;
  END IF;

  v_discrepancy := v_actual_count - v_cached_count;

  IF v_discrepancy != 0 AND p_auto_correct THEN
    UPDATE user_sales_counts
       SET sales_count = v_actual_count,
           last_reconciled_at = now(),
           last_reconciliation_result = 'corrected'
     WHERE user_id = p_user_id AND business_id = p_business_id;
    v_corrected := true;
  ELSIF v_discrepancy = 0 THEN
    UPDATE user_sales_counts
       SET last_reconciled_at = now(),
           last_reconciliation_result = 'accurate'
     WHERE user_id = p_user_id AND business_id = p_business_id;
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'business_id', p_business_id,
    'cached_count', v_cached_count,
    'actual_count', v_actual_count,
    'discrepancy', v_discrepancy,
    'corrected', v_corrected,
    'status', CASE
      WHEN v_discrepancy = 0 THEN 'accurate'
      WHEN v_corrected THEN 'corrected'
      ELSE 'discrepancy_found'
    END
  );
END;
$function$;
