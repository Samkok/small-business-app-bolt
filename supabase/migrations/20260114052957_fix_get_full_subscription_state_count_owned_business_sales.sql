/*
  # Fix get_full_subscription_state to Count All Owned Business Sales

  ## Problem
  The current function only returns sales count for the current business, but for
  free tier users, the 50-sale limit applies to ALL owned businesses combined.
  The function needs to return both the current business sales AND total sales
  across all owned businesses.

  ## Solution
  Add a new field `totalSalesAllBusinesses` that sums sales across ALL businesses
  owned by the user. This ensures the UI can display accurate limit information
  like "7/50 sales" instead of incorrectly showing "23/50" when team member sales
  are included.

  ## Changes
  - Calculate total sales across all owned businesses by joining user_sales_counts
    with businesses table and filtering by owner_user_id
  - Add `totalSalesAllBusinesses` field to salesCountData in the JSON response
  - Use this total for calculating remainingSales and isAtLimit for free tier
  - Current business sales (salesCount) remains unchanged for display purposes

  ## Impact
  - Free tier limit checks now based on owned businesses only
  - Warning banners will show accurate counts
  - Team member sales don't affect owner's limit
*/

-- Drop and recreate the function with owned business sales calculation
DROP FUNCTION IF EXISTS get_full_subscription_state(uuid, uuid);

CREATE OR REPLACE FUNCTION get_full_subscription_state(
  p_user_id uuid,
  p_business_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_status text;
  v_subscription_expiration timestamptz;
  v_subscription_product_id text;
  v_tier text;
  v_max_owned_businesses integer;
  v_owned_business_count integer;
  v_sales_count integer;
  v_total_owned_business_sales integer;
  v_remaining_sales integer;
  v_is_at_limit boolean;
  v_can_access_feature boolean;
  v_has_business_access boolean;
  v_result jsonb;
BEGIN
  -- Get subscription info
  SELECT 
    subscription_status,
    subscription_expiration_date,
    subscription_product_id,
    tier,
    max_owned_businesses
  INTO 
    v_subscription_status,
    v_subscription_expiration,
    v_subscription_product_id,
    v_tier,
    v_max_owned_businesses
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- If no subscription exists, use defaults
  IF v_subscription_status IS NULL THEN
    v_subscription_status := 'trial';
    v_tier := 'free';
    v_max_owned_businesses := 1;
    v_subscription_expiration := NULL;
    v_subscription_product_id := NULL;
  END IF;

  -- Get owned business count
  SELECT COUNT(*)::integer
  INTO v_owned_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  -- Calculate total sales across ALL owned businesses
  -- This is used for free tier limit calculations
  SELECT COALESCE(SUM(usc.sales_count), 0)::integer
  INTO v_total_owned_business_sales
  FROM user_sales_counts usc
  INNER JOIN businesses b ON usc.business_id = b.id
  WHERE usc.user_id = p_user_id 
    AND b.owner_user_id = p_user_id;

  -- If business_id is provided, get business-specific data
  IF p_business_id IS NOT NULL THEN
    -- Check if user has access to this business
    SELECT EXISTS (
      SELECT 1 FROM businesses WHERE id = p_business_id AND owner_user_id = p_user_id
      UNION
      SELECT 1 FROM user_business_roles WHERE business_id = p_business_id AND user_id = p_user_id
    ) INTO v_has_business_access;

    IF NOT v_has_business_access THEN
      RAISE EXCEPTION 'User does not have access to this business';
    END IF;

    -- Get sales count data for the current business
    SELECT 
      COALESCE(sales_count, 0)::integer
    INTO v_sales_count
    FROM user_sales_counts
    WHERE user_id = p_user_id AND business_id = p_business_id;

    IF v_sales_count IS NULL THEN
      v_sales_count := 0;
    END IF;

    -- Calculate remaining sales and limit status based on TOTAL owned business sales
    IF v_tier = 'free' THEN
      v_remaining_sales := GREATEST(0, 50 - v_total_owned_business_sales);
      v_is_at_limit := v_total_owned_business_sales >= 50;
    ELSE
      v_remaining_sales := NULL;
      v_is_at_limit := false;
    END IF;

    -- Determine feature access
    v_can_access_feature := NOT v_is_at_limit;
  ELSE
    -- No business provided, set business-specific fields to null
    v_sales_count := NULL;
    v_remaining_sales := NULL;
    v_is_at_limit := NULL;
    v_can_access_feature := NULL;
  END IF;

  -- Build result JSON
  v_result := jsonb_build_object(
    'subscriptionStatus', jsonb_build_object(
      'isSubscribed', v_tier != 'free' AND (v_subscription_expiration IS NULL OR v_subscription_expiration > now()),
      'subscriptionStatus', v_subscription_status,
      'subscriptionExpirationDate', v_subscription_expiration,
      'subscriptionProductId', v_subscription_product_id
    ),
    'tierInfo', jsonb_build_object(
      'tier', v_tier,
      'maxOwnedBusinesses', v_max_owned_businesses,
      'subscriptionStatus', v_subscription_status,
      'expirationDate', v_subscription_expiration
    ),
    'ownedBusinessCount', v_owned_business_count,
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
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_full_subscription_state(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION get_full_subscription_state(uuid, uuid) IS 'Returns complete subscription state including sales counts. For free tier, limits are based on total sales across ALL owned businesses, not individual businesses or team member businesses.';