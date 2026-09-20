/*
# Online-order pushes go out at high priority

A new web order is time-sensitive (a customer is waiting for confirmation), so its push is sent
at 'high' priority like voided sales and low-stock alerts. The app already treats the type as
high (pushNotificationService.getNotificationPriority).

Same body as the live function; only the priority CASE gains 'web_order_received'. Dry-run on
production 2026-09-20: the new definition equals the old one with that single line replaced.
Signature unchanged, so the grants (postgres, service_role) are kept.
*/
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
