/*
  # Fix selected_business_ids column reference errors in subscription functions

  1. Problem
    - `set_all_businesses_read_only_on_expiration` and `set_read_only_businesses` 
      both try to SET `selected_business_ids = NULL` on `user_profiles`
    - That column does NOT exist on `user_profiles` -- it exists on `user_subscriptions`
    - This caused repeated PROCESSING_ERROR entries in the webhook_errors table
    - The error fires every time a subscription status changes to expired/cancelled

  2. Fix
    - Update both functions to clear `selected_business_ids` on `user_subscriptions` instead
    - Keep the `must_choose_businesses` update on `user_profiles` (that column does exist there)

  3. Tables modified
    - No schema changes, only function body corrections
*/

-- Fix set_all_businesses_read_only_on_expiration
CREATE OR REPLACE FUNCTION public.set_all_businesses_read_only_on_expiration(p_user_id uuid)
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

  -- Set must_choose_businesses flag on user_profiles
  UPDATE user_profiles
  SET must_choose_businesses = true
  WHERE user_id = p_user_id;

  -- Clear selected_business_ids on user_subscriptions (correct table)
  UPDATE user_subscriptions
  SET selected_business_ids = NULL
  WHERE user_id = p_user_id;
END;
$$;

-- Fix set_read_only_businesses
CREATE OR REPLACE FUNCTION public.set_read_only_businesses(p_user_id uuid, p_max_active_businesses integer)
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

  -- Set must_choose_businesses flag on user_profiles
  UPDATE user_profiles
  SET must_choose_businesses = true
  WHERE user_id = p_user_id;

  -- Clear selected_business_ids on user_subscriptions (correct table)
  UPDATE user_subscriptions
  SET selected_business_ids = NULL
  WHERE user_id = p_user_id;
END;
$$;
