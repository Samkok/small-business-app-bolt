/*
  # Fix Push Notification Trigger to Use pg_net Properly

  1. Problem
    - The trigger function calls net.http_post() but pg_net is in the extensions schema
    - Need to properly reference extensions.http_post() or use pg_net.http_post()
    - Also need to configure Supabase URL and service role key

  2. Solution
    - Update function to use extensions.http_post() with proper schema reference
    - Set search_path to include extensions schema
    - Use Supabase environment variables properly

  3. Testing
    - When a notification is inserted, the trigger will call the edge function
    - The edge function will send push notification to Expo's servers
    - User will receive notification on their iPhone device
*/

-- Drop and recreate the function with proper pg_net usage
CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  push_token text;
  supabase_url text;
  service_role_key text;
  anon_key text;
  unread_count int;
  request_id bigint;
BEGIN
  -- Get the user's push token
  SELECT expo_push_token INTO push_token
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  -- If no push token, skip
  IF push_token IS NULL OR push_token = '' THEN
    RETURN NEW;
  END IF;

  -- Get unread notification count for badge
  SELECT COUNT(*) INTO unread_count
  FROM notifications
  WHERE user_id = NEW.user_id AND is_read = false;

  -- Get Supabase URL from environment or use default
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Fallback to environment variables if app settings not available
  IF supabase_url IS NULL OR supabase_url = '' THEN
    BEGIN
      supabase_url := current_setting('env.SUPABASE_URL');
    EXCEPTION
      WHEN OTHERS THEN
        -- Default for hosted Supabase (will be set by platform)
        supabase_url := 'https://' || current_setting('request.jwt.claims', true)::json->>'iss';
    END;
  END IF;

  -- Use service role key if available, otherwise use anon key
  IF service_role_key IS NULL OR service_role_key = '' THEN
    service_role_key := COALESCE(anon_key, '');
  END IF;

  -- Call Edge Function via pg_net to send push notification
  SELECT
    http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
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
      )
    ) INTO request_id;

  RAISE LOG 'Push notification request initiated with ID: %', request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the notification insert
    RAISE WARNING 'Failed to send push notification: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;