/*
  # Fix Expired Subscription Read-Only Handling

  ## Overview
  Automatically sets ALL businesses to read-only when subscription expires, is refunded,
  reaches limit, or becomes inactive. No business selection prompt for expired subscriptions.

  ## Changes

  1. **New Function: set_all_businesses_read_only_on_expiration**
     - Sets all user's businesses to read_only_sales state
     - Clears selected_business_ids in user_subscriptions
     - Clears must_choose_businesses flag (no selection needed when expired)
     - Called automatically when subscription becomes inactive

  2. **New Function: get_business_owner_subscription_tier**
     - Returns the subscription tier of a business owner
     - Used by assigned users to check if business is read-only due to owner's expired subscription
     - Returns tier, status, and access information

  3. **Updated Function: set_read_only_businesses**
     - Now clears selected_business_ids when setting businesses to read-only
     - Ensures consistency between business state and subscription selection

  4. **Trigger: auto_set_read_only_on_subscription_change**
     - Automatically detects when subscription expires/cancels
     - Calls set_all_businesses_read_only_on_expiration
     - Prevents need for user intervention on expiration

  ## Security
  - All functions use SECURITY DEFINER with proper search_path
  - Functions are only callable by authenticated users or triggers
*/

-- Function to set all businesses to read-only when subscription expires
CREATE OR REPLACE FUNCTION set_all_businesses_read_only_on_expiration(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set all owned businesses to read_only_sales state
  UPDATE businesses
  SET access_state = 'read_only_sales'
  WHERE owner_id = p_user_id;

  -- Clear must_choose_businesses flag (no selection needed when expired)
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;

  -- Clear selected_business_ids in user_subscriptions
  UPDATE user_subscriptions
  SET selected_business_ids = '[]'::jsonb,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the action
  RAISE NOTICE 'Set all businesses to read-only for user % due to subscription expiration', p_user_id;
END;
$$;

COMMENT ON FUNCTION set_all_businesses_read_only_on_expiration(uuid) IS 'Sets all user businesses to read-only when subscription expires, is refunded, or becomes inactive. Clears business selection data.';

-- Function to get business owner's subscription tier (for assigned users)
CREATE OR REPLACE FUNCTION get_business_owner_subscription_tier(
  p_business_id uuid
)
RETURNS TABLE (
  owner_id uuid,
  tier text,
  subscription_status text,
  expiration_date timestamptz,
  max_owned_businesses integer,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Get the business owner
  SELECT businesses.owner_id INTO v_owner_id
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
    us.max_owned_businesses,
    CASE
      WHEN us.subscription_status IN ('expired', 'cancelled', 'trial') THEN true
      WHEN us.subscription_expiration_date IS NOT NULL
        AND us.subscription_expiration_date < now() THEN true
      ELSE false
    END as is_expired
  FROM user_subscriptions us
  WHERE us.user_id = v_owner_id
  ORDER BY us.updated_at DESC
  LIMIT 1;

  -- If no subscription record, return free tier
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_owner_id,
      'free'::text,
      'trial'::text,
      NULL::timestamptz,
      NULL::integer,
      false;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_business_owner_subscription_tier(uuid) IS 'Returns subscription tier information for the owner of a business. Used by assigned users to check if business is read-only due to owner subscription.';

-- Update set_read_only_businesses to clear selected_business_ids
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
  v_business_record RECORD;
  v_active_count integer := 0;
BEGIN
  -- Loop through user's owned businesses ordered by creation date
  FOR v_business_record IN (
    SELECT id FROM businesses
    WHERE owner_id = p_user_id
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

  -- Set must_choose_businesses flag if user has more businesses than allowed
  IF v_active_count > p_max_active_businesses THEN
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;
  ELSE
    -- Clear the flag if within limit
    UPDATE user_profiles
    SET must_choose_businesses = false
    WHERE user_id = p_user_id;
  END IF;

  -- Clear selected_business_ids when setting to read-only
  IF v_active_count > p_max_active_businesses THEN
    UPDATE user_subscriptions
    SET selected_business_ids = '[]'::jsonb,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Function to automatically handle subscription status changes
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

    RAISE NOTICE 'Subscription expired for user %, setting businesses to read-only', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic subscription status handling
DROP TRIGGER IF EXISTS trigger_handle_subscription_status_change ON user_subscriptions;
CREATE TRIGGER trigger_handle_subscription_status_change
  BEFORE INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_subscription_status_change();

COMMENT ON TRIGGER trigger_handle_subscription_status_change ON user_subscriptions IS 'Automatically sets all businesses to read-only when subscription expires, is cancelled, or becomes inactive.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_all_businesses_read_only_on_expiration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_owner_subscription_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_read_only_businesses(uuid, integer) TO authenticated;