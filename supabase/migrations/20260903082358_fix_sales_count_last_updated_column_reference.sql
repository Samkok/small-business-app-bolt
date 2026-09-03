/*
# Fix last_updated column reference in sales count functions

## Problem
- `increment_sales_count` and `get_or_create_sales_count` reference a column
  called `last_updated` which does not exist on `user_sales_counts`.
- The actual column is `last_counted_at` (plus `updated_at`).
- This causes a runtime error every time either function is called,
  breaking sales counting entirely.

## Changes
- DROP + CREATE `get_or_create_sales_count` (return type is integer, safe to replace)
- DROP + CREATE `increment_sales_count` (return type is integer, safe to replace)
- Both now reference `last_counted_at` instead of `last_updated`
- All existing guards (auth.uid(), FOR UPDATE lock) are preserved

## Security
- No changes to SECURITY DEFINER status or grants
*/

-- Fix get_or_create_sales_count
DROP FUNCTION IF EXISTS public.get_or_create_sales_count(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_or_create_sales_count(p_user_id uuid, p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot access another user''s sales count';
  END IF;

  SELECT sales_count INTO v_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    INSERT INTO user_sales_counts (user_id, business_id, sales_count, last_counted_at, updated_at)
    VALUES (p_user_id, p_business_id, 0, now(), now())
    ON CONFLICT (user_id, business_id) DO NOTHING;

    SELECT sales_count INTO v_count
    FROM user_sales_counts
    WHERE user_id = p_user_id AND business_id = p_business_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Fix increment_sales_count
DROP FUNCTION IF EXISTS public.increment_sales_count(uuid, uuid);
CREATE OR REPLACE FUNCTION public.increment_sales_count(p_user_id uuid, p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot modify another user''s sales count';
  END IF;

  PERFORM get_or_create_sales_count(p_user_id, p_business_id);

  SELECT sales_count INTO v_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id
  FOR UPDATE;

  UPDATE user_sales_counts
  SET sales_count = v_count + 1,
      last_counted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND business_id = p_business_id
  RETURNING sales_count INTO v_count;

  RETURN COALESCE(v_count, 0);
END;
$function$;
