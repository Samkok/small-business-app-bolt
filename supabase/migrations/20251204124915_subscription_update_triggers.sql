/*
  Subscription Update Triggers
  
  1. Purpose
    - Automatically update timestamps when subscriptions change
    - Ensure Realtime events are consistently fired
    - Log changes for debugging and auditing
  
  2. Triggers Created
    - on_subscription_change: Fires on user_subscriptions changes
    - on_sales_count_change: Fires on user_sales_counts changes
  
  3. Why BEFORE Triggers
    - Modify the row before it's written to disk
    - Guarantee updated_at is always current
    - Cannot be bypassed by any code
*/

-- Create trigger function for subscription changes
CREATE OR REPLACE FUNCTION notify_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure updated_at is set to current timestamp
  NEW.updated_at = now();
  
  -- Log the change for debugging
  RAISE LOG 'Subscription changed for user: %, status: %', 
    NEW.user_id, NEW.subscription_status;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_subscriptions
DROP TRIGGER IF EXISTS on_subscription_change ON user_subscriptions;
CREATE TRIGGER on_subscription_change
  BEFORE INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_subscription_change();

-- Create trigger function for sales count changes
CREATE OR REPLACE FUNCTION notify_sales_count_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure updated_at is set to current timestamp
  NEW.updated_at = now();
  
  -- Log the change for debugging
  RAISE LOG 'Sales count changed for user: %, business: %, count: %', 
    NEW.user_id, NEW.business_id, NEW.sales_count;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_sales_counts
DROP TRIGGER IF EXISTS on_sales_count_change ON user_sales_counts;
CREATE TRIGGER on_sales_count_change
  BEFORE INSERT OR UPDATE ON user_sales_counts
  FOR EACH ROW
  EXECUTE FUNCTION notify_sales_count_change();
