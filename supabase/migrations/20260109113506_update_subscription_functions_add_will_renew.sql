/*
  # Update Subscription Functions to Include will_renew

  ## Overview
  Updates database functions to return and check the will_renew field.
  This ensures the client knows when a subscription is cancelled but still active.

  ## Changes

  1. **Update get_subscription_status function**
     - Add will_renew to returned data
     - This lets clients show "Subscription will end on [date]" messages

  2. **Enhance expiration checking**
     - Functions now properly check if expiration_date has passed
     - Even if status is 'active', expired subscriptions are treated as free tier
*/

-- Drop and recreate get_subscription_status with will_renew field
DROP FUNCTION IF EXISTS get_subscription_status(uuid);

CREATE FUNCTION get_subscription_status(p_user_id uuid)
RETURNS TABLE (
  is_subscribed boolean,
  subscription_status text,
  product_id text,
  expiration_date timestamptz,
  revenuecat_app_user_id text,
  will_renew boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN us.subscription_status = 'active' AND 
           (us.subscription_expiration_date IS NULL OR us.subscription_expiration_date > now())
      THEN true
      ELSE false
    END as is_subscribed,
    us.subscription_status,
    us.subscription_product_id as product_id,
    us.subscription_expiration_date as expiration_date,
    us.revenuecat_app_user_id,
    COALESCE(us.will_renew, true) as will_renew
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_subscription_status(uuid) IS 'Returns subscription status including will_renew flag to indicate if subscription will auto-renew';