/*
  # Fix Push Notification Trigger

  ## Problem
  The `send_push_notification_on_insert()` trigger function has two bugs:

  1. **Wrong schema reference**: The function calls `extensions.http_post()` but pg_net's
     functions actually live in the `net` schema. The `search_path` also does not include
     `net`, so every call silently fails inside the inner EXCEPTION handler and no push
     notification is ever sent from the trigger.

  2. **Missing message body**: The HTTP payload is missing the `'body'` field (the human-
     readable notification text). The edge function expects `body` as the notification
     message text but the current function only sends `title`, `data`, `badge`, and
     `priority`.

  ## Fix
  - Change `extensions.http_post()` → `net.http_post()`
  - Add `net` to `SET search_path`
  - Re-add `'body', NEW.message` to the payload
  - Remove the redundant `::text::jsonb` double-cast (body is already jsonb)
*/

CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  push_token text;
  unread_count int;
  request_id bigint;
  supabase_url text := 'https://tevtbyffttmbttekhejk.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRieWZmdHRtYnR0ZWtoZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMTY4OTcsImV4cCI6MjA2NTg5Mjg5N30.VTrXVY8-04xePQCQTKqiDylrUvWJyPplKQ4nRQwGwC4';
BEGIN
  SELECT expo_push_token INTO push_token
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  IF push_token IS NULL OR push_token = '' THEN
    RAISE LOG 'No push token for user %', NEW.user_id;
    RETURN NEW;
  END IF;

  IF NOT push_token LIKE 'ExponentPushToken[%]' THEN
    RAISE LOG 'Invalid push token format for user %: %', NEW.user_id, push_token;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO unread_count
  FROM notifications
  WHERE user_id = NEW.user_id AND is_read = false;

  BEGIN
    SELECT INTO request_id
      net.http_post(
        url := supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'expoPushToken', push_token,
          'title', NEW.title,
          'body', NEW.message,
          'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
            'notification_id', NEW.id,
            'type', NEW.type
          ),
          'badge', unread_count,
          'priority', CASE
            WHEN NEW.type IN ('sale_voided', 'low_stock_alert') THEN 'high'
            ELSE 'default'
          END
        )
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
    RAISE WARNING 'Failed in push notification trigger: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;
