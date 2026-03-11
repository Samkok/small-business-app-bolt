/*
  # Store Push Notification Credentials in Vault

  ## Problem
  The `send_push_notification_on_insert()` trigger function has hardcoded
  Supabase URL and anon key directly in its source code, which is visible to
  any authenticated user via `pg_proc`.

  ## Fix
  1. Store the Supabase URL and anon key in Supabase Vault (encrypted at rest)
  2. Update the trigger function to read credentials from vault at runtime
     instead of embedding them in the function body

  ## Security Changes
  - Credentials are no longer visible in `pg_proc`
  - Vault secrets are encrypted at rest using `pgsodium`
  - Only SECURITY DEFINER functions can access vault secrets
*/

SELECT vault.create_secret(
  'https://tevtbyffttmbttekhejk.supabase.co',
  'supabase_url',
  'Supabase project URL used by DB triggers for internal edge function calls'
) WHERE NOT EXISTS (
  SELECT 1 FROM vault.secrets WHERE name = 'supabase_url'
);

SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRieWZmdHRtYnR0ZWtoZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMTY4OTcsImV4cCI6MjA2NTg5Mjg5N30.VTrXVY8-04xePQCQTKqiDylrUvWJyPplKQ4nRQwGwC4',
  'supabase_anon_key',
  'Supabase anon key used by DB triggers for internal edge function calls'
) WHERE NOT EXISTS (
  SELECT 1 FROM vault.secrets WHERE name = 'supabase_anon_key'
);

CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  push_token    text;
  unread_count  int;
  request_id    bigint;
  supabase_url  text;
  anon_key      text;
BEGIN
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url';

  SELECT decrypted_secret INTO anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_anon_key';

  IF supabase_url IS NULL OR anon_key IS NULL THEN
    RAISE WARNING 'Push notification credentials not found in vault';
    RETURN NEW;
  END IF;

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
