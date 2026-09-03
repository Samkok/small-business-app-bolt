/*
# Fix will_renew column default and get_subscription_status COALESCE

1. Changes
   - Change will_renew column default from TRUE to FALSE.
     Users without active subscriptions should not show as "will renew".
   - Update get_subscription_status function to COALESCE(will_renew, false)
     so any NULL value returns false instead of true.

2. Why
   - The old DEFAULT true caused debug/client-created rows to incorrectly
     appear as auto-renewing.
   - No row = free user, so "will renew" should default to the safe value (false).

3. Impact
   - Only the active pro_plus subscriber has a row; their will_renew is
     explicitly set to true by the webhook, so this change does not affect them.
*/

-- Fix the column default
ALTER TABLE user_subscriptions ALTER COLUMN will_renew SET DEFAULT false;

-- Recreate get_subscription_status with COALESCE(will_renew, false)
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_user_id uuid)
  RETURNS TABLE(
    is_subscribed boolean,
    subscription_status text,
    product_id text,
    expiration_date timestamptz,
    revenuecat_app_user_id text,
    will_renew boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Guard: only the user themselves or service role
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot view another user''s subscription status';
  END IF;

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
    COALESCE(us.will_renew, false) as will_renew
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC
  LIMIT 1;
END;
$function$;
