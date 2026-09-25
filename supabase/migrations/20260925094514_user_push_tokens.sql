-- One push token per device instead of one per user, so a user signed in on two phones is
-- notified on both. user_profiles.expo_push_token is kept in sync with the most recent device
-- for older builds. A token belongs to the device: when another account signs in on the same
-- phone the row moves to that account, so nobody receives someone else's notifications.
-- The send-push-notification function reads every token of the target user and deletes the
-- ones Expo reports as DeviceNotRegistered.
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text,
  device_name text,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_push_tokens_token_format CHECK (token ~ '^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$')
);
CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx ON public.user_push_tokens(user_id);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own push tokens" ON public.user_push_tokens;
CREATE POLICY "own push tokens" ON public.user_push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_tokens TO authenticated;
GRANT ALL ON public.user_push_tokens TO service_role;

-- Registers this device for the signed-in user (moving the token away from any other account).
CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_platform text DEFAULT NULL, p_device_name text DEFAULT NULL, p_app_version text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  PERFORM public.require_not_anon();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'register_push_token needs a signed-in user' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_push_tokens WHERE token = p_token AND user_id <> v_uid;

  INSERT INTO public.user_push_tokens (token, user_id, platform, device_name, app_version)
  VALUES (p_token, v_uid, p_platform, p_device_name, p_app_version)
  ON CONFLICT (token) DO UPDATE
    SET platform = COALESCE(EXCLUDED.platform, user_push_tokens.platform),
        device_name = COALESCE(EXCLUDED.device_name, user_push_tokens.device_name),
        app_version = COALESCE(EXCLUDED.app_version, user_push_tokens.app_version),
        updated_at = now(),
        last_seen_at = now();

  -- Older builds and the profile screen still read this column: keep it on the latest device
  UPDATE public.user_profiles SET expo_push_token = p_token WHERE user_id = v_uid;
  UPDATE public.user_profiles SET expo_push_token = NULL WHERE expo_push_token = p_token AND user_id <> v_uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_push_token(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text, text, text) TO authenticated, service_role;

-- Forgets this device (sign-out), whoever the row belongs to.
CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  PERFORM public.require_not_anon();
  IF v_uid IS NULL THEN RETURN; END IF;
  DELETE FROM public.user_push_tokens WHERE token = p_token AND user_id = v_uid;
  UPDATE public.user_profiles SET expo_push_token = NULL WHERE user_id = v_uid AND expo_push_token = p_token;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.unregister_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(text) TO authenticated, service_role;

-- Every device known today
INSERT INTO public.user_push_tokens (token, user_id)
SELECT expo_push_token, user_id FROM public.user_profiles
 WHERE expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$'
ON CONFLICT (token) DO NOTHING;

NOTIFY pgrst, 'reload schema';
