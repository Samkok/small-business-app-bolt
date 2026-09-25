/*
# Close the remaining database functions the public key could call

Security assessment 2026-09-21, finding 3 (Supabase advisor lint 0028): 22 SECURITY DEFINER
functions in `public` were executable by `anon`, the key that ships inside the mobile app.
Twelve of them never checked who was calling, so with a business or user UUID anyone could,
for example, read a shop's low-stock products or a user's plan and sales count.

Why they were missed: 20260919104338 closed the 17 functions named in that task. These are
the rest, including functions added since (stock adjustments, receipts, barcodes), which got
`anon` EXECUTE automatically from the schema's default privileges. `REVOKE ... FROM PUBLIC`
does not remove that direct grant.

## Changes
1. Two non-raising helpers for functions that must answer false rather than fail
   (one of them is used inside RLS policies): caller_is_self_or_service(user),
   caller_is_member_or_service(business).
2. A caller check as the FIRST statement of the twelve unguarded functions. Nothing else in
   their bodies changes (the patch aborts if it would).
     - takes a user id, returns data  -> require_self_or_service (raises 42501 for anyone else)
     - takes a user id, returns bool  -> false for anyone else
     - takes a business id            -> caller must belong to that business
   The service role and direct SQL (no JWT) always pass, because the edge functions, the
   RevenueCat webhook and cron call several of these.
3. REVOKE EXECUTE FROM PUBLIC, anon on all 22 and the helpers. `authenticated` keeps it: the app
   calls them signed in and `is_business_admin_check` is used by RLS on user_business_roles.
4. Default privileges: functions created in `public` from now on no longer get `anon` (or PUBLIC)
   EXECUTE automatically, so this cannot silently come back. A function that really must be
   public has to GRANT it on purpose.

The app never calls any of these before sign-in, and always passes the signed-in user's own id.
*/

-- 1. helpers ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.caller_is_self_or_service(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated')
    ELSE p_user_id IS NOT NULL AND auth.uid() = p_user_id
  END;
$$;

CREATE OR REPLACE FUNCTION public.caller_is_member_or_service(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated')
    ELSE EXISTS (SELECT 1 FROM public.user_business_roles r WHERE r.business_id = p_business_id AND r.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id AND b.owner_user_id = auth.uid())
  END;
$$;

-- 2a. SQL-language functions are rewritten whole (there is no BEGIN to patch) --------------------
CREATE OR REPLACE FUNCTION public.can_adjust_stock(p_business_id uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT public.caller_is_self_or_service(p_user) AND EXISTS (
    SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_user_id = p_user
    UNION ALL
    SELECT 1 FROM public.user_business_roles WHERE business_id = p_business_id AND user_id = p_user AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_low_stock_products(business_id_param uuid)
 RETURNS TABLE(id uuid, name text, price numeric, description text, image_url text, barcode text, current_stock integer, min_stock_level integer, business_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT
    p.id,
    p.name,
    p.price,
    p.description,
    p.image_url,
    p.barcode,
    p.current_stock,
    p.min_stock_level,
    p.business_id,
    p.created_at,
    p.updated_at
  FROM products p
  WHERE p.business_id = business_id_param
    AND p.current_stock <= p.min_stock_level
    -- only people who belong to this business (or the service role) get its products
    AND public.caller_is_member_or_service(business_id_param)
  ORDER BY p.current_stock ASC;
$function$;

-- 2b. plpgsql functions: insert one guard line after the first BEGIN, change nothing else -------
DO $patch$
DECLARE
  r record;
  v_oid oid;
  v_def text;
  v_new text;
  v_guard text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('can_user_create_business',         'p_user_id uuid',                          'PERFORM public.require_self_or_service(p_user_id);'),
      ('can_user_create_sale',             'p_user_id uuid, p_business_id uuid',      'PERFORM public.require_self_or_service(p_user_id);'),
      ('get_user_owned_business_count',    'p_user_id uuid',                          'PERFORM public.require_self_or_service(p_user_id);'),
      ('get_user_subscription_tier',       'p_user_id uuid',                          'PERFORM public.require_self_or_service(p_user_id);'),
      ('get_user_total_sales_count',       'p_user_id uuid, p_business_id uuid',      'PERFORM public.require_self_or_service(p_user_id);'),
      ('is_business_admin',                'user_id_param uuid, business_id_param uuid', 'IF NOT public.caller_is_self_or_service(user_id_param) THEN RETURN false; END IF;'),
      ('is_business_admin_check',          'user_id_param uuid, business_id_param uuid', 'IF NOT public.caller_is_self_or_service(user_id_param) THEN RETURN false; END IF;'),
      ('user_has_business_access',         'user_uid uuid, business_id_param uuid',   'IF NOT public.caller_is_self_or_service(user_uid) THEN RETURN false; END IF;'),
      ('check_shared_business_membership', 'p_caller_id uuid, p_target_id uuid',      'IF NOT public.caller_is_self_or_service(p_caller_id) THEN RETURN false; END IF;'),
      ('is_business_read_only',            'p_business_id uuid',                      'IF NOT public.caller_is_member_or_service(p_business_id) THEN RETURN false; END IF;')
    ) AS t(fn, identity_args, guard)
  LOOP
    SELECT p.oid INTO v_oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = r.fn
       AND pg_get_function_identity_arguments(p.oid) = r.identity_args;
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Function public.%(%) not found', r.fn, r.identity_args;
    END IF;

    v_def := pg_get_functiondef(v_oid);
    v_guard := '  ' || r.guard;
    IF position(r.guard IN v_def) > 0 THEN
      CONTINUE; -- already guarded (re-run)
    END IF;

    v_new := regexp_replace(v_def, '(\mBEGIN\M)', E'\\1\n' || v_guard, 'i');
    IF v_new = v_def OR replace(v_new, E'\n' || v_guard, '') <> v_def THEN
      RAISE EXCEPTION 'Could not insert exactly one guard line into %', r.fn;
    END IF;
    EXECUTE v_new;
  END LOOP;
END
$patch$;

-- 3. nobody without a session may execute any of them ------------------------------------------
DO $revoke$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND (p.prosecdef OR p.proname IN ('caller_is_self_or_service', 'caller_is_member_or_service'))
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END
$revoke$;

-- 4. and new functions no longer get it by default ---------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
