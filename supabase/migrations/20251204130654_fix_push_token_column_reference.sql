/*
  Fix Push Token Column Reference
  
  1. Issue
    - Previous migration referenced wrong column name
    - Column is 'expo_push_token' not 'push_token'
  
  2. Fix
    - Update send_subscription_push_notification function
    - Change SELECT push_token to SELECT expo_push_token
*/

-- Update function to use correct column name
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
    
    -- Get user's push token (FIXED: using correct column name)
    SELECT expo_push_token INTO v_push_token
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
