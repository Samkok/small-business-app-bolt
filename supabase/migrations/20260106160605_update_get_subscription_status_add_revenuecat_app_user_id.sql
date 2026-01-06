/*
  # Update get_subscription_status to Include RevenueCat App User ID

  1. Changes
    - Drop and recreate `get_subscription_status` function to return `revenuecat_app_user_id`
    - This enables the subscription service and debug screens to display the RevenueCat app user ID
    - Useful for debugging and support purposes

  2. Notes
    - This is a non-breaking change in functionality, only adds a new column to the return type
    - Existing callers will continue to work, but will now have access to the RevenueCat app user ID
*/

-- Drop existing function
DROP FUNCTION IF EXISTS get_subscription_status(uuid);

-- Recreate function with revenuecat_app_user_id field
CREATE OR REPLACE FUNCTION get_subscription_status(p_user_id uuid)
RETURNS TABLE (
  is_subscribed boolean,
  subscription_status text,
  product_id text,
  expiration_date timestamptz,
  revenuecat_app_user_id text
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
    us.revenuecat_app_user_id
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;
END;
$$;
