/*
  Push Notification for Subscription Changes
  
  1. Purpose
    - Send push notifications when subscription status changes
    - Notify users even when app is closed
    - Keep users informed of their subscription state
  
  2. Trigger Conditions
    - Fires when subscription_status changes to 'active' or 'expired'
    - Only sends if user has registered a push token
    - Uses existing send-push-notification edge function
  
  3. Implementation
    - Uses pg_net extension for async HTTP requests
    - Calls Supabase Edge Function to send push notification
    - Non-blocking (doesn't slow down the subscription update)
*/

-- Ensure pg_net extension is enabled (should already be from previous migrations)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send push notification on subscription change
CREATE OR REPLACE FUNCTION send_subscription_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_push_token text;
  v_title text;
  v_body text;
  v_request_id bigint;
  v_supabase_url text;
  v_anon_key text;
BEGIN
  -- Only send for status changes to 'active' or 'expired'
  IF NEW.subscription_status IN ('active', 'expired') AND 
     (TG_OP = 'INSERT' OR OLD.subscription_status IS DISTINCT FROM NEW.subscription_status) THEN
    
    -- Get user's push token
    SELECT push_token INTO v_push_token
    FROM user_profiles
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    -- Only proceed if user has a push token
    IF v_push_token IS NOT NULL AND v_push_token != '' THEN
      -- Set notification text based on status
      IF NEW.subscription_status = 'active' THEN
        v_title := 'Subscription Activated';
        v_body := 'Your premium subscription is now active!';
      ELSE
        v_title := 'Subscription Expired';
        v_body := 'Your subscription has expired. Renew to continue using premium features.';
      END IF;
      
      -- Get Supabase URL and key from environment
      SELECT current_setting('app.settings.supabase_url', true) INTO v_supabase_url;
      SELECT current_setting('app.settings.supabase_anon_key', true) INTO v_anon_key;
      
      -- If settings are configured, send push notification
      IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
        -- Send push notification via edge function using pg_net
        SELECT net.http_post(
          url := v_supabase_url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'expoPushToken', v_push_token,
            'title', v_title,
            'body', v_body,
            'data', jsonb_build_object(
              'type', 'subscription_changed',
              'status', NEW.subscription_status
            )
          )
        ) INTO v_request_id;
        
        RAISE LOG 'Push notification sent for subscription change: request_id=%', v_request_id;
      ELSE
        RAISE LOG 'Supabase settings not configured, skipping push notification';
      END IF;
    ELSE
      RAISE LOG 'No push token found for user %, skipping notification', NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_subscription_push_notification ON user_subscriptions;
CREATE TRIGGER on_subscription_push_notification
  AFTER INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION send_subscription_push_notification();

-- Note: The database settings app.settings.supabase_url and app.settings.supabase_anon_key
-- need to be configured by a superuser. This can be done via the Supabase dashboard
-- or by running these commands with superuser privileges:
-- 
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';
