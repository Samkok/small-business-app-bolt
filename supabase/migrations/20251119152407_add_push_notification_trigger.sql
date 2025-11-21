/*
  # Add Push Notification Trigger

  1. Changes
    - Create function to send push notifications via Edge Function when notification is inserted
    - Create trigger to automatically call this function on notification insert

  2. Behavior
    - When a notification is inserted, fetch the recipient's push token
    - Call the Edge Function to send push notification to their device
    - Handles errors gracefully without blocking notification creation
*/

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  push_token text;
  supabase_url text;
  service_role_key text;
  unread_count int;
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

  -- Get Supabase URL and service role key from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  -- If environment variables are not set, use default (local development)
  IF supabase_url IS NULL THEN
    supabase_url := 'http://localhost:54321';
  END IF;

  -- Call Edge Function to send push notification (async, don't wait for response)
  PERFORM
    net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
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
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the notification insert
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on notifications insert
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;
CREATE TRIGGER on_notification_insert_send_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_on_insert();
