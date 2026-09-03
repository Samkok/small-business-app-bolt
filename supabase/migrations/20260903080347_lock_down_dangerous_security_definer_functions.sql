/*
# Lock Down Dangerous SECURITY DEFINER Functions

## Problem
Several SECURITY DEFINER functions accept an arbitrary user_id parameter and are
callable by any authenticated user. This allows privilege escalation:
- Any user can call set_all_businesses_active('victim-uuid') to manipulate another user's businesses
- Any user can call increment_sales_count('victim-uuid', ...) to tamper with sales counters

## Changes
1. Revoke EXECUTE from authenticated/anon on business-state mutation functions
   (set_all_businesses_active, set_all_businesses_read_only_on_expiration, set_read_only_businesses)
   These are only called from triggers/webhooks via service_role.
2. Add auth.uid() guard inside increment_sales_count and get_or_create_sales_count
   so authenticated callers can only operate on their own data.

## Security
- Only service_role can call business state mutation functions
- Sales count functions enforce auth.uid() = p_user_id for authenticated callers
- Triggers and webhook edge functions (which use service_role) are unaffected
*/

-- 1. Revoke public execute on business state functions (trigger/webhook-only)
REVOKE EXECUTE ON FUNCTION set_all_businesses_active(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_all_businesses_read_only_on_expiration(uuid) FROM public, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'set_read_only_businesses'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION set_read_only_businesses FROM public, anon, authenticated';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not revoke set_read_only_businesses: %', SQLERRM;
END $$;

-- 2. Drop and recreate increment_sales_count with auth.uid() guard
DROP FUNCTION IF EXISTS increment_sales_count(uuid, uuid);
CREATE FUNCTION increment_sales_count(p_user_id uuid, p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Guard: authenticated callers can only increment their own count
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot modify another user''s sales count';
  END IF;

  PERFORM get_or_create_sales_count(p_user_id, p_business_id);

  UPDATE user_sales_counts
  SET sales_count = sales_count + 1,
      last_updated = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND business_id = p_business_id
  RETURNING sales_count INTO v_count;

  RETURN COALESCE(v_count, 0);
END;
$function$;

-- 3. Drop and recreate get_or_create_sales_count with auth.uid() guard
DROP FUNCTION IF EXISTS get_or_create_sales_count(uuid, uuid);
CREATE FUNCTION get_or_create_sales_count(p_user_id uuid, p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Guard: authenticated callers can only access their own count
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot access another user''s sales count';
  END IF;

  SELECT sales_count INTO v_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_updated, updated_at)
    VALUES (p_user_id, p_business_id, 0, now(), now())
    ON CONFLICT (user_id, business_id) DO NOTHING;

    SELECT sales_count INTO v_count
    FROM user_sales_counts
    WHERE user_id = p_user_id AND business_id = p_business_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Ensure authenticated can still call the guarded functions
GRANT EXECUTE ON FUNCTION increment_sales_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_sales_count(uuid, uuid) TO authenticated;
