/*
  # Close anonymous access to user, business, referral and webhook functions

  ## Problem
  Supabase grants EXECUTE on every new `public` function to `anon`, and these
  SECURITY DEFINER functions either guard with
  `IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id` (skipped when auth.uid() is
  NULL, i.e. by an anonymous caller holding only the app's public key), compare
  `p_user_id != auth.uid()` (NULL, so also skipped), or have no caller check at all.
  `check_user_exists_by_email` returned any user's id for an email to anonymous
  callers, which made the rest practically reachable: bypassing the paid business
  limit, pushing another user's businesses to read-only, inflating a free user's sales
  count until they are locked out, creating businesses in someone else's account,
  inflating referral counters, and reading another user's business names and email.

  ## Callers verified on 2026-09-19 (app, edge functions, triggers, policies, views, cron)
  The app always calls with a signed-in user. All five edge functions that use these
  (revenuecat-webhook, choose-businesses, validate-subscription, subscription-status,
  referral-status) use the SERVICE ROLE key. None of the functions appears in an RLS
  policy, a view or a cron job. `create_business` is only called from two screens
  behind the login, with the signed-in user's own id; no business was ever created
  before its owner had a session.

  ## Fix, two layers per function
  1. One guard line is inserted after the function's first BEGIN, calling one of three
     helpers. The rest of each body is left exactly as it is on the live database (the
     source is read with pg_get_functiondef, not taken from this repo, which has
     drifted). Signatures do not change, so CREATE OR REPLACE replaces in place.
       self    : the signed-in user acting on their OWN id, or the service role
       signed  : any signed-in user, or the service role
       service : the service role (or direct SQL) only
  2. EXECUTE is revoked from PUBLIC and anon (and from authenticated for the
     service-only functions). Layer 1 exists because a future DROP + CREATE silently
     re-grants anon; any migration that recreates one of these must repeat the REVOKE.

  | function                                              | mode    |
  | check_user_exists_by_email(text)                      | signed  |
  | create_business(text, uuid)                           | self    |
  | activate_selected_businesses(uuid, uuid[])            | self    |
  | check_business_selection_requirement(uuid)            | self    |
  | increment_sales_count(uuid, uuid)                     | self    |
  | get_or_create_sales_count(uuid, uuid)                 | self    |
  | get_full_subscription_state(uuid, uuid)               | self    |
  | generate_referral_code(uuid) and (uuid, text)         | self    |
  | get_user_sales_summary(uuid)                          | self    |
  | get_user_credit_balance(uuid)                         | self    |
  | activate_all_businesses_and_populate_selection(uuid)  | service | (only the RevenueCat webhook calls it; a signed-in user calling it for themselves bypassed the paid limit)
  | increment_referral_conversions(text) and (uuid)       | service |
  | log_webhook_error(...)                                | service |
  | mark_webhook_event_processed(...)                     | service |
  | get_user_display_name(uuid)                           | LANGUAGE sql, cannot RAISE: returns NULL to anonymous callers, and anon EXECUTE is revoked |
*/

-- ── Helpers ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.require_not_anon()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NULL AND COALESCE(auth.role(), '') = 'anon' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_self_or_service(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    -- no signed-in user: only the service role and direct SQL may pass
    IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
      RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    RETURN;
  END IF;
  IF p_user_id IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not allowed for another user' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_service_caller()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL OR COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Service role only' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.require_not_anon() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.require_self_or_service(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.require_service_caller() FROM PUBLIC, anon;

-- ── Insert the guard into each live function, then fix its grants ───────────────
DO $patch$
DECLARE
  t record;
  v_oid oid;
  v_def text;
  v_new text;
  v_guard text;
  v_sig text;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('check_user_exists_by_email',                     'p_email text',                                      'signed',  NULL),
      ('create_business',                                'business_name_param text, owner_user_id_param uuid', 'self',    'owner_user_id_param'),
      ('activate_selected_businesses',                   'p_user_id uuid, p_selected_business_ids uuid[]',     'self',    'p_user_id'),
      ('check_business_selection_requirement',           'p_user_id uuid',                                    'self',    'p_user_id'),
      ('increment_sales_count',                          'p_user_id uuid, p_business_id uuid',                'self',    'p_user_id'),
      ('get_or_create_sales_count',                      'p_user_id uuid, p_business_id uuid',                'self',    'p_user_id'),
      ('get_full_subscription_state',                    'p_user_id uuid, p_business_id uuid',                'self',    'p_user_id'),
      ('generate_referral_code',                         'p_user_id uuid',                                    'self',    'p_user_id'),
      ('generate_referral_code',                         'p_user_id uuid, p_code text',                       'self',    'p_user_id'),
      ('get_user_sales_summary',                         'p_user_id uuid',                                    'self',    'p_user_id'),
      ('get_user_credit_balance',                        'p_user_id uuid',                                    'self',    'p_user_id'),
      ('activate_all_businesses_and_populate_selection', 'p_user_id uuid',                                    'service', NULL),
      ('increment_referral_conversions',                 'p_code text',                                       'service', NULL),
      ('increment_referral_conversions',                 'p_code_id uuid',                                    'service', NULL),
      ('log_webhook_error',                              'p_event_id text, p_event_type text, p_app_user_id text, p_error_type text, p_error_message text, p_error_details jsonb, p_event_payload jsonb, p_severity text', 'service', NULL),
      ('mark_webhook_event_processed',                   'p_event_id text, p_event_type text, p_app_user_id text, p_event_timestamp_ms bigint, p_processing_duration_ms integer, p_metadata jsonb', 'service', NULL)
    ) AS x(fn, identity_args, mode, user_param)
  LOOP
    SELECT p.oid INTO v_oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = t.fn
       AND pg_get_function_identity_arguments(p.oid) = t.identity_args;
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Function public.%(%) not found: the live schema differs from what this migration was written for', t.fn, t.identity_args;
    END IF;

    v_guard := CASE t.mode
      WHEN 'signed'  THEN 'PERFORM public.require_not_anon();'
      WHEN 'service' THEN 'PERFORM public.require_service_caller();'
      ELSE format('PERFORM public.require_self_or_service(%I);', t.user_param)
    END;

    v_def := pg_get_functiondef(v_oid);
    IF v_def !~ 'LANGUAGE plpgsql' THEN
      RAISE EXCEPTION 'public.% is not plpgsql; cannot insert a guard', t.fn;
    END IF;

    IF position(v_guard IN v_def) = 0 THEN
      -- first BEGIN of the definition is the start of the function's main block
      v_new := regexp_replace(v_def, '(\mBEGIN\M)', E'\\1\n  ' || v_guard, 'i');
      IF v_new = v_def OR (length(v_new) - length(replace(v_new, v_guard, ''))) / length(v_guard) <> 1 THEN
        RAISE EXCEPTION 'Could not insert the guard into public.% exactly once', t.fn;
      END IF;
      IF replace(v_new, E'\n  ' || v_guard, '') <> v_def THEN
        RAISE EXCEPTION 'Guard insertion changed more than one line in public.%', t.fn;
      END IF;
      EXECUTE v_new;
    END IF;

    v_sig := format('public.%I(%s)', t.fn, pg_get_function_identity_arguments(v_oid));
    IF t.mode = 'service' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_sig);
    END IF;
  END LOOP;
END
$patch$;

-- ── get_user_display_name: LANGUAGE sql, so it cannot RAISE ─────────────────────
-- Same result as before for signed-in users, the service role and direct SQL;
-- nothing for an anonymous caller (it returned the EMAIL when full_name was null).
CREATE OR REPLACE FUNCTION public.get_user_display_name(user_id_param uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
SELECT COALESCE(full_name, email, 'Unknown User')
FROM public.user_profiles
WHERE user_id = user_id_param
  AND (auth.uid() IS NOT NULL OR COALESCE(auth.role(), '') <> 'anon');
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_display_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
