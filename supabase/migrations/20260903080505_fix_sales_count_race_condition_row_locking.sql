/*
# Fix Sales Count Race Condition with Row Locking

## Problem
Two concurrent sales can both pass the limit check (seeing count=49), then both
increment (resulting in 51, exceeding the 50-sale limit). The increment_sales_count
function does not lock the row during the check-then-increment sequence.

## Changes
- Add SELECT ... FOR UPDATE in increment_sales_count to serialize concurrent
  increments on the same (user_id, business_id) row
- This ensures the second concurrent sale sees the already-incremented count

## Modified Functions
- increment_sales_count(uuid, uuid) - adds row-level locking
*/

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

  -- Ensure the row exists
  PERFORM get_or_create_sales_count(p_user_id, p_business_id);

  -- Lock the row to prevent concurrent increments from racing past the limit
  SELECT sales_count INTO v_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id
  FOR UPDATE;

  -- Increment
  UPDATE user_sales_counts
  SET sales_count = v_count + 1,
      last_updated = now(),
      updated_at = now()
  WHERE user_id = p_user_id AND business_id = p_business_id
  RETURNING sales_count INTO v_count;

  RETURN COALESCE(v_count, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION increment_sales_count(uuid, uuid) TO authenticated;
