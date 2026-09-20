/*
# Push notifications from the database work again

Since 2026-07-20 (commit 2d4f2a0) the edge function send-push-notification only accepts a
signed-in user's JWT plus `targetUserId`. The only caller, this trigger, still sent the public
(anon) key and an `expoPushToken`, so EVERY push was answered 401 Unauthorized: new sales,
voided sales, low stock, role changes and online orders. The in-app notification list kept
working because it reads the notifications table directly.

Fix: the trigger proves it is the database with a secret of its own.
  - vault secret `push_trigger_secret`: 32 random bytes generated here, never leaves the database
    except in the X-Push-Secret header of the request to our own edge function.
  - verify_push_trigger_secret(text): service_role only. The edge function calls it to check
    the header, so no function environment variable has to be configured.
  - The trigger sends X-Push-Secret and `targetUserId`; the function resolves the push token
    itself (it no longer trusts a token supplied by the caller).
The user-JWT path of the edge function is unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_trigger_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'push_trigger_secret',
      'Shared secret between the notifications push trigger and the send-push-notification edge function'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_push_trigger_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'pg_catalog'
AS $$
  SELECT p_secret IS NOT NULL
     AND length(p_secret) >= 32
     AND EXISTS (
       SELECT 1 FROM vault.decrypted_secrets
       WHERE name = 'push_trigger_secret' AND decrypted_secret = p_secret
     );
$$;

REVOKE ALL ON FUNCTION public.verify_push_trigger_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_push_trigger_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.send_push_notification_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
push_token    text;
unread_count  int;
request_id    bigint;
supabase_url  text;
anon_key      text;
push_secret   text;
BEGIN
SELECT decrypted_secret INTO supabase_url
FROM vault.decrypted_secrets
WHERE name = 'supabase_url';

SELECT decrypted_secret INTO anon_key
FROM vault.decrypted_secrets
WHERE name = 'supabase_anon_key';

SELECT decrypted_secret INTO push_secret
FROM vault.decrypted_secrets
WHERE name = 'push_trigger_secret';

IF supabase_url IS NULL OR anon_key IS NULL OR push_secret IS NULL THEN
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
-- the anon key only gets the request past the gateway; X-Push-Secret is what authorises it
'Authorization', 'Bearer ' || anon_key,
'X-Push-Secret', push_secret
),
body := jsonb_build_object(
'targetUserId', NEW.user_id,
'title', NEW.title,
'body', NEW.message,
'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
'notification_id', NEW.id,
'type', NEW.type
),
'badge', unread_count,
'priority', CASE
WHEN NEW.type IN ('sale_voided', 'low_stock_alert', 'web_order_received') THEN 'high'
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
$function$;
