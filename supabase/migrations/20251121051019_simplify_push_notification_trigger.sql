/*
  # Simplify Push Notification Trigger for Reliability

  1. Problem
    - Previous trigger had complex logic for getting Supabase URL
    - May fail if environment variables aren't properly configured
    - Need a simpler, more reliable approach

  2. Solution
    - Hardcode the Supabase URL from project configuration
    - Use the anon key which is sufficient for calling edge functions
    - Simplify error handling
    - Use extensions.http_post() directly

  3. Configuration
    - Supabase URL: https://tevtbyffttmbttekhejk.supabase.co
    - Uses anon key (edge function has JWT verification enabled)
    - Async call via pg_net - doesn't block notification insert
*/

-- Update function with hardcoded Supabase project URL
CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  push_token text;
  unread_count int;
  request_id bigint;
  supabase_url text := 'https://tevtbyffttmbttekhejk.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRieWZmdHRtYnR0ZWtoZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMTY4OTcsImV4cCI6MjA2NTg5Mjg5N30.VTrXVY8-04xePQCQTKqiDylrUvWJyPplKQ4nRQwGwC4';
BEGIN
  -- Get the user's push token
  SELECT expo_push_token INTO push_token
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  -- If no push token, skip
  IF push_token IS NULL OR push_token = '' THEN
    RAISE LOG 'No push token for user %', NEW.user_id;
    RETURN NEW;
  END IF;

  -- Validate push token format
  IF NOT push_token LIKE 'ExponentPushToken[%]' THEN
    RAISE LOG 'Invalid push token format for user %: %', NEW.user_id, push_token;
    RETURN NEW;
  END IF;

  -- Get unread notification count for badge
  SELECT COUNT(*) INTO unread_count
  FROM notifications
  WHERE user_id = NEW.user_id AND is_read = false;

  -- Call Edge Function via pg_net to send push notification
  BEGIN
    SELECT INTO request_id
      extensions.http_post(
        url := supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'expoPushToken', push_token,
          'title', NEW.title,
          'body', NEW.message,
          'data', NEW.data || jsonb_build_object('notification_id', NEW.id),
          'badge', unread_count,
          'priority', CASE 
            WHEN NEW.type IN ('sale_voided', 'low_stock_alert') THEN 'high'
            ELSE 'default'
          END
        )::text::jsonb
      );

    RAISE LOG 'Push notification HTTP request initiated: request_id=%, user=%, type=%', 
      request_id, NEW.user_id, NEW.type;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to initiate push notification HTTP request: % (SQLSTATE: %)', 
        SQLERRM, SQLSTATE;
  END;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the notification insert
    RAISE WARNING 'Failed in push notification trigger: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;