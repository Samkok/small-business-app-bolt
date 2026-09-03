/*
# Fix enforce_business_creation_limit to Count Ownership, Not Admin Roles

## Problem
The trigger counts businesses where the user has an 'admin' role in user_business_roles,
rather than businesses they actually own (via owner_user_id). A user who is an admin of
someone else's business gets counted toward their own creation limit.

## Changes
- Change the count query to use businesses.owner_user_id instead of
  user_business_roles with role='admin'
- This aligns with how every other function counts owned businesses

## Modified Functions
- enforce_business_creation_limit() trigger function
*/

CREATE OR REPLACE FUNCTION enforce_business_creation_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_owner_id uuid;
  v_current_count integer;
  v_max_allowed integer;
BEGIN
  v_owner_id := NEW.owner_user_id;
  IF v_owner_id IS NULL THEN
    v_owner_id := auth.uid();
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count businesses actually owned by this user (not admin roles)
  SELECT COUNT(*) INTO v_current_count
  FROM businesses
  WHERE owner_user_id = v_owner_id;

  SELECT COALESCE(max_owned_businesses, 1) INTO v_max_allowed
  FROM user_subscriptions
  WHERE user_id = v_owner_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_max_allowed IS NULL THEN
    v_max_allowed := 1;
  END IF;

  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Business creation limit reached. Current: %, Max: %', v_current_count, v_max_allowed;
  END IF;

  RETURN NEW;
END;
$function$;
