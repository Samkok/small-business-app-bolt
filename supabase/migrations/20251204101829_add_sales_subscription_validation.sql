/*
  # Add Sales Subscription Validation

  1. Changes
    - Creates a database function to validate subscription limits before sales creation
    - Adds a trigger to automatically check subscription limits on sale insertion
    - Ensures no user can bypass the free tier limit at the database level

  2. Security
    - Prevents sales creation if user exceeds free tier limit without active subscription
    - Database-level enforcement ensures no bypass through frontend or API
*/

-- Function to check if user can create a sale based on subscription status
CREATE OR REPLACE FUNCTION check_sales_subscription_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_sales_count INT;
  v_is_subscribed BOOLEAN;
  v_subscription_status TEXT;
BEGIN
  -- Get the current sales count for this user and business
  SELECT COALESCE(sales_count, 0)
  INTO v_sales_count
  FROM user_business_sales_count
  WHERE user_id = NEW.created_by
    AND business_id = NEW.business_id;

  -- Get subscription status
  SELECT 
    CASE 
      WHEN subscription_status = 'active' THEN true
      ELSE false
    END,
    subscription_status
  INTO v_is_subscribed, v_subscription_status
  FROM user_subscriptions
  WHERE user_id = NEW.created_by
  ORDER BY created_at DESC
  LIMIT 1;

  -- Set default values if no subscription record found
  IF v_is_subscribed IS NULL THEN
    v_is_subscribed := false;
    v_subscription_status := 'trial';
  END IF;

  -- Check if user has exceeded free tier limit and is not subscribed
  IF v_sales_count >= 50 AND v_is_subscribed = false THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Free tier limit of 50 sales reached. Please upgrade to continue.'
      USING HINT = 'User has reached the maximum number of sales allowed on the free tier';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to run before sale insertion
DROP TRIGGER IF EXISTS check_sales_limit_trigger ON sales;
CREATE TRIGGER check_sales_limit_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION check_sales_subscription_limit();

-- Add comment for documentation
COMMENT ON FUNCTION check_sales_subscription_limit() IS 'Validates that users have not exceeded their free tier sales limit before allowing sale creation. Subscribed users are exempt from this limit.';
