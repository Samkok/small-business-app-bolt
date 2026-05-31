/*
  # Fix stack depth limit exceeded error (infinite recursion)

  ## Problem
  The `handle_subscription_status_change` trigger on `user_subscriptions` calls
  `set_all_businesses_read_only_on_expiration()`, which does an UPDATE on
  `user_subscriptions` (to clear `selected_business_ids`). This re-fires all
  UPDATE triggers on `user_subscriptions`, including `handle_subscription_status_change`
  itself, causing infinite recursion.

  ## Fix
  1. Remove the `UPDATE user_subscriptions` statement from
     `set_all_businesses_read_only_on_expiration()` so it no longer causes recursion.
  2. Move the `selected_business_ids = NULL` logic into
     `handle_subscription_status_change()` where it directly sets `NEW.selected_business_ids`
     without causing another UPDATE (since it's a BEFORE trigger modifying NEW).

  ## Modified Functions
  - `set_all_businesses_read_only_on_expiration` - removed user_subscriptions UPDATE
  - `handle_subscription_status_change` - now clears selected_business_ids via NEW
*/

-- Fix set_all_businesses_read_only_on_expiration to NOT update user_subscriptions
CREATE OR REPLACE FUNCTION set_all_businesses_read_only_on_expiration(p_user_id uuid)
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

  -- NOTE: selected_business_ids is now cleared by the calling trigger function
  -- directly via NEW.selected_business_ids = NULL to avoid recursive trigger firing
END;
$$;

-- Fix handle_subscription_status_change to clear selected_business_ids directly on NEW
CREATE OR REPLACE FUNCTION handle_subscription_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if subscription changed to expired, cancelled, or trial
  IF NEW.subscription_status IN ('expired', 'cancelled', 'trial')
  AND (OLD.subscription_status IS NULL OR OLD.subscription_status NOT IN ('expired', 'cancelled', 'trial')) THEN

    -- Set all businesses to read-only
    PERFORM set_all_businesses_read_only_on_expiration(NEW.user_id);

    -- Clear selected_business_ids directly (avoids recursive UPDATE on this table)
    NEW.selected_business_ids = NULL;

    RAISE NOTICE 'Automatically set businesses to read-only for user % (status: %)', NEW.user_id, NEW.subscription_status;
  END IF;

  -- Check if subscription expiration date has passed
  IF NEW.subscription_expiration_date IS NOT NULL
  AND NEW.subscription_expiration_date < now()
  AND NEW.subscription_status = 'active' THEN

    -- Update status to expired
    NEW.subscription_status = 'expired';

    -- Set all businesses to read-only
    PERFORM set_all_businesses_read_only_on_expiration(NEW.user_id);

    -- Clear selected_business_ids directly (avoids recursive UPDATE on this table)
    NEW.selected_business_ids = NULL;

    RAISE NOTICE 'Subscription expired for user %, setting businesses to read-only', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;
