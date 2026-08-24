/*
# Fix activate_selected_businesses: read max_owned_businesses from correct table

## Problem
The function reads `max_owned_businesses` from `user_profiles`, but that column
exists on `user_subscriptions`. This causes "column does not exist" errors.

## Fix
Changed the SELECT to read from `user_subscriptions` instead of `user_profiles`.
*/

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
  -- Get user's business count
  SELECT COUNT(*)
  INTO v_business_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  -- Get tier limit from user_subscriptions (correct table)
  SELECT max_owned_businesses
  INTO v_max_businesses
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

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
