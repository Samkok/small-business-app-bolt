/*
# Add owner_disabled access state and relax business activation rules

## Summary
Introduces a new business access_state value 'owner_disabled' that represents
a business voluntarily disabled by its owner (as opposed to 'read_only_sales'
which is forced by subscription limits). Updates all related functions to:
- Allow owners to disable businesses freely (minimum 1 must remain active)
- Count only 'active' businesses toward creation limits
- Block sales on owner_disabled businesses with a distinct reason code
- Preserve owner_disabled state when subscription changes occur

## Changes

### Modified Functions

1. `activate_selected_businesses(uuid, uuid[])`
   - Removes strict "must select all" rule when count <= limit
   - Allows any selection between 1 and max_businesses (inclusive)
   - Unselected businesses get 'owner_disabled' instead of 'read_only_sales'
   - Keeps validation that at least 1 business must be active

2. `can_user_create_sale(uuid, uuid)`
   - Now checks for 'owner_disabled' in addition to 'read_only_sales'
   - Returns distinct reason 'BUSINESS_OWNER_DISABLED' for owner-disabled businesses

3. `can_user_create_business(uuid)`
   - Now counts only businesses with access_state = 'active' toward the limit
   - Owner-disabled businesses do not count against creation limit

4. `set_read_only_businesses(uuid, integer)`
   - Preserves 'owner_disabled' state: does not auto-activate owner-disabled businesses
   - When count <= limit and some are owner_disabled, only activates non-owner-disabled ones
   - When count > limit, only overrides non-owner-disabled businesses

5. `validate_business_activation(uuid)`
   - Updated to reflect new relaxed rules: valid as long as at least 1 and at most max are active

## Security
- All functions remain SECURITY DEFINER with search_path = public
- No new privileges granted
*/

-- 1. Update activate_selected_businesses to allow partial selection
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
  v_business_count integer;
  v_max_businesses integer;
  v_selected_count integer;
  v_latest_subscription_id uuid;
BEGIN
  -- Get user's business count and tier limit
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  SELECT max_owned_businesses
  INTO v_max_businesses
  FROM user_profiles
  WHERE user_id = p_user_id;

  v_selected_count := COALESCE(array_length(p_selected_business_ids, 1), 0);

  -- Validation: must select at least 1 business
  IF v_selected_count < 1 THEN
    RAISE EXCEPTION 'INVALID_SELECTION: You must keep at least one business active.';
  END IF;

  -- Validation: cannot select more than plan allows
  IF v_max_businesses IS NOT NULL AND v_selected_count > v_max_businesses THEN
    RAISE EXCEPTION 'INVALID_SELECTION: You can only have up to % active businesses. You selected %.',
      v_max_businesses, v_selected_count;
  END IF;

  -- Verify all selected businesses are owned by the user
  IF EXISTS (
    SELECT 1 FROM unnest(p_selected_business_ids) AS sid
    WHERE NOT EXISTS (
      SELECT 1 FROM businesses WHERE id = sid AND owner_user_id = p_user_id
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_SELECTION: Some selected businesses are not owned by you.';
  END IF;

  -- Set unselected businesses to owner_disabled
  UPDATE businesses
  SET access_state = 'owner_disabled'
  WHERE owner_user_id = p_user_id
    AND id != ALL(p_selected_business_ids);

  -- Activate selected businesses
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

COMMENT ON FUNCTION activate_selected_businesses(uuid, uuid[]) IS 'Activates selected businesses and sets unselected to owner_disabled. Requires at least 1 active, at most tier limit active.';

-- 2. Update can_user_create_sale to handle owner_disabled
CREATE OR REPLACE FUNCTION can_user_create_sale(p_user_id uuid, p_business_id uuid)
RETURNS TABLE(can_create boolean, reason text, current_count integer, limit_reached boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_subscription_status text;
  v_business_sales integer;
  v_owned_count integer;
  v_max_businesses integer;
  v_is_owner boolean;
  v_access_state text;
  v_effective_limit integer;
BEGIN
  -- Check business access state first
  SELECT b.access_state INTO v_access_state
  FROM businesses b
  WHERE b.id = p_business_id;

  IF v_access_state = 'read_only_sales' THEN
    RETURN QUERY SELECT false, 'BUSINESS_READ_ONLY'::text, 0, true;
    RETURN;
  END IF;

  IF v_access_state = 'owner_disabled' THEN
    RETURN QUERY SELECT false, 'BUSINESS_OWNER_DISABLED'::text, 0, true;
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

  -- Get per-business sales count
  v_business_sales := get_user_total_sales_count(p_user_id, p_business_id);

  -- Free tier: use effective limit (base 50 + referral credits) checked per-business
  IF v_tier = 'free' THEN
    v_effective_limit := get_effective_sales_limit(p_user_id);

    IF v_business_sales >= v_effective_limit THEN
      RETURN QUERY SELECT false, 'FREE_TIER_LIMIT'::text, v_business_sales, true;
      RETURN;
    ELSE
      RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
      RETURN;
    END IF;
  END IF;

  -- For paid tiers, check if user owns this business
  IF NOT v_is_owner THEN
    -- Staff member accessing someone else's business - always allowed
    RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
    RETURN;
  END IF;

  -- For paid tiers, check if business is within limit
  v_owned_count := get_user_owned_business_count(p_user_id);

  -- If user owns more businesses than allowed, check which ones are active
  IF v_max_businesses IS NOT NULL AND v_owned_count > v_max_businesses THEN
    IF NOT EXISTS (
      SELECT 1 FROM businesses
      WHERE id = p_business_id
        AND owner_user_id = p_user_id
        AND access_state = 'active'
    ) THEN
      RETURN QUERY SELECT false, 'BUSINESS_SALES_LIMIT'::text, v_business_sales, true;
      RETURN;
    END IF;
  END IF;

  -- Paid tier with subscription within limits - unlimited sales
  RETURN QUERY SELECT true, NULL::text, v_business_sales, false;
END;
$$;

GRANT EXECUTE ON FUNCTION can_user_create_sale(uuid, uuid) TO authenticated;

-- 3. Update can_user_create_business to count only active businesses
CREATE OR REPLACE FUNCTION can_user_create_business(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_max_businesses integer;
  v_active_count integer;
BEGIN
  -- Get user's tier and limits
  SELECT tier, max_owned_businesses
  INTO v_tier, v_max_businesses
  FROM get_user_subscription_tier(p_user_id);

  -- Count only ACTIVE businesses (owner_disabled ones don't count)
  SELECT COUNT(*)
  INTO v_active_count
  FROM businesses
  WHERE owner_user_id = p_user_id
    AND access_state = 'active';

  -- All tiers now have business limits
  IF v_max_businesses IS NULL THEN
    RETURN v_active_count < 1;
  END IF;

  -- Check if under limit
  RETURN v_active_count < v_max_businesses;
END;
$$;

-- 4. Update set_read_only_businesses to preserve owner_disabled state
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
  v_total_count integer;
  v_active_count integer;
  v_non_disabled_count integer;
BEGIN
  -- Count total businesses owned by user
  SELECT COUNT(*)
  INTO v_total_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  -- Count businesses that are NOT owner_disabled (active + read_only_sales)
  SELECT COUNT(*)
  INTO v_non_disabled_count
  FROM businesses
  WHERE owner_user_id = p_user_id
    AND access_state != 'owner_disabled';

  -- Count currently active businesses
  SELECT COUNT(*)
  INTO v_active_count
  FROM businesses
  WHERE owner_user_id = p_user_id
    AND access_state = 'active';

  -- If non-disabled businesses are within limit, activate them (preserve owner_disabled)
  IF v_non_disabled_count <= p_max_active_businesses THEN
    -- Activate all non-owner-disabled businesses
    UPDATE businesses
    SET access_state = 'active'
    WHERE owner_user_id = p_user_id
      AND access_state = 'read_only_sales';

    -- Clear must_choose_businesses flag
    UPDATE user_profiles
    SET must_choose_businesses = false
    WHERE user_id = p_user_id;
  ELSE
    -- More non-disabled businesses than allowed; need to set some to read_only
    -- First, set all non-owner-disabled to read_only
    UPDATE businesses
    SET access_state = 'read_only_sales'
    WHERE owner_user_id = p_user_id
      AND access_state != 'owner_disabled';

    -- Then activate the oldest N non-owner-disabled businesses
    UPDATE businesses
    SET access_state = 'active'
    WHERE id IN (
      SELECT id
      FROM businesses
      WHERE owner_user_id = p_user_id
        AND access_state != 'owner_disabled'
      ORDER BY created_at ASC
      LIMIT p_max_active_businesses
    );

    -- Set must_choose_businesses flag
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION set_read_only_businesses(uuid, integer) IS 'Sets business access states preserving owner_disabled. Non-disabled businesses within limit get activated; excess requires selection.';

-- 5. Update validate_business_activation with relaxed rules
CREATE OR REPLACE FUNCTION validate_business_activation(p_user_id uuid)
RETURNS TABLE(
  is_valid boolean,
  business_count integer,
  max_allowed integer,
  active_count integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_count integer;
  v_max_allowed integer;
  v_active_count integer;
  v_is_valid boolean;
  v_error_message text;
BEGIN
  -- Get business counts and limits
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  SELECT COUNT(*)
  INTO v_active_count
  FROM businesses
  WHERE owner_user_id = p_user_id
    AND access_state = 'active';

  SELECT max_owned_businesses
  INTO v_max_allowed
  FROM user_profiles
  WHERE user_id = p_user_id;

  -- Relaxed validation: at least 1 active, at most max_allowed active
  IF v_active_count < 1 THEN
    v_is_valid := false;
    v_error_message := 'At least one business must be active.';
  ELSIF v_max_allowed IS NOT NULL AND v_active_count > v_max_allowed THEN
    v_is_valid := false;
    v_error_message := format('You can have at most %s active businesses. Currently %s are active.',
      v_max_allowed, v_active_count);
  ELSE
    v_is_valid := true;
    v_error_message := NULL;
  END IF;

  RETURN QUERY SELECT
    v_is_valid,
    v_business_count,
    v_max_allowed,
    v_active_count,
    v_error_message;
END;
$$;

COMMENT ON FUNCTION validate_business_activation(uuid) IS 'Validates business activation: at least 1 must be active, at most tier limit can be active. Owner-disabled businesses are allowed.';
