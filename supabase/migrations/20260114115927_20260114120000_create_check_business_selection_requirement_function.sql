/*
  # Create Business Selection Requirement Checker Function

  1. Purpose
    - Centralizes the logic for determining if a user needs to choose which businesses to keep active
    - Moves this logic from client-side to server-side for security and consistency
    - Handles automatic activation/deactivation based on subscription tier limits

  2. Function: check_business_selection_requirement
    - Parameters:
      - p_user_id: UUID of the user
    - Returns: JSON object with:
      - must_choose_businesses: boolean flag
      - owned_businesses: array of business objects with state
      - read_only_business_ids: array of business IDs that are read-only
      - tier_limit: max allowed businesses for current tier
      - owned_count: total owned businesses count
      - already_configured: boolean if businesses are already in correct state
    
  3. Logic
    - Gets user's tier info and max allowed businesses
    - Counts owned businesses
    - If limit exceeded:
      - Checks if businesses are already properly configured
      - If not configured: sets must_choose_businesses flag
      - If already configured: clears flag
    - If within limit:
      - Auto-activates all businesses
      - Clears must_choose_businesses flag
    - Returns current state for client to display

  4. Security
    - Uses SECURITY DEFINER to ensure atomic operations
    - Only accessible through proper authentication
*/

CREATE OR REPLACE FUNCTION check_business_selection_requirement(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_info RECORD;
  v_owned_count INT;
  v_max_allowed INT;
  v_active_count INT;
  v_read_only_count INT;
  v_already_configured BOOLEAN;
  v_limit_exceeded BOOLEAN;
  v_must_choose BOOLEAN;
  v_businesses JSON;
  v_read_only_ids TEXT[];
  v_result JSON;
BEGIN
  -- Get tier info
  SELECT tier, max_owned_businesses
  INTO v_tier_info
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- If no subscription record, default to free tier
  IF v_tier_info IS NULL THEN
    v_tier_info := ROW('free', 1);
  END IF;

  v_max_allowed := v_tier_info.max_owned_businesses;

  -- Handle unlimited tier (null or 999999)
  IF v_max_allowed IS NULL OR v_max_allowed = 999999 THEN
    -- Auto-activate all businesses for unlimited tier
    UPDATE businesses
    SET access_state = 'active'
    WHERE owner_user_id = p_user_id
      AND access_state != 'active';

    -- Clear must_choose_businesses flag
    UPDATE user_profiles
    SET must_choose_businesses = false
    WHERE user_id = p_user_id;

    -- Get all businesses
    SELECT json_agg(
      json_build_object(
        'id', id,
        'business_name', business_name,
        'access_state', access_state,
        'created_at', created_at
      )
    )
    INTO v_businesses
    FROM businesses
    WHERE owner_user_id = p_user_id
    ORDER BY created_at ASC;

    -- Return result
    RETURN json_build_object(
      'must_choose_businesses', false,
      'owned_businesses', COALESCE(v_businesses, '[]'::json),
      'read_only_business_ids', ARRAY[]::TEXT[],
      'tier_limit', 999999,
      'owned_count', (SELECT COUNT(*) FROM businesses WHERE owner_user_id = p_user_id),
      'already_configured', true
    );
  END IF;

  -- Count owned businesses
  SELECT COUNT(*)
  INTO v_owned_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  -- Check if limit is exceeded
  v_limit_exceeded := v_owned_count > v_max_allowed;

  IF NOT v_limit_exceeded THEN
    -- Within limit: auto-activate all businesses
    UPDATE businesses
    SET access_state = 'active'
    WHERE owner_user_id = p_user_id
      AND access_state != 'active';

    -- Clear must_choose_businesses flag
    UPDATE user_profiles
    SET must_choose_businesses = false
    WHERE user_id = p_user_id;

    -- Get all businesses
    SELECT json_agg(
      json_build_object(
        'id', id,
        'business_name', business_name,
        'access_state', access_state,
        'created_at', created_at
      )
    )
    INTO v_businesses
    FROM businesses
    WHERE owner_user_id = p_user_id
    ORDER BY created_at ASC;

    -- Return result
    RETURN json_build_object(
      'must_choose_businesses', false,
      'owned_businesses', COALESCE(v_businesses, '[]'::json),
      'read_only_business_ids', ARRAY[]::TEXT[],
      'tier_limit', v_max_allowed,
      'owned_count', v_owned_count,
      'already_configured', true
    );
  END IF;

  -- Limit exceeded: check if already configured
  SELECT COUNT(*) FILTER (WHERE access_state = 'active'),
         COUNT(*) FILTER (WHERE access_state = 'read_only_sales')
  INTO v_active_count, v_read_only_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  v_already_configured := (v_active_count = v_max_allowed AND v_read_only_count > 0);

  IF v_already_configured THEN
    -- Already configured: clear flag
    UPDATE user_profiles
    SET must_choose_businesses = false
    WHERE user_id = p_user_id;

    v_must_choose := false;
  ELSE
    -- Not configured: set flag
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;

    v_must_choose := true;
  END IF;

  -- Get all businesses
  SELECT json_agg(
    json_build_object(
      'id', id,
      'business_name', business_name,
      'access_state', access_state,
      'created_at', created_at
    )
  )
  INTO v_businesses
  FROM businesses
  WHERE owner_user_id = p_user_id
  ORDER BY created_at ASC;

  -- Get read-only business IDs
  SELECT array_agg(id::TEXT)
  INTO v_read_only_ids
  FROM businesses
  WHERE owner_user_id = p_user_id
    AND access_state = 'read_only_sales';

  -- Return result
  RETURN json_build_object(
    'must_choose_businesses', v_must_choose,
    'owned_businesses', COALESCE(v_businesses, '[]'::json),
    'read_only_business_ids', COALESCE(v_read_only_ids, ARRAY[]::TEXT[]),
    'tier_limit', v_max_allowed,
    'owned_count', v_owned_count,
    'already_configured', v_already_configured
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_business_selection_requirement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_business_selection_requirement(UUID) TO service_role;
