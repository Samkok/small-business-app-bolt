/*
# Fix enforce_business_creation_limit trigger function

## Problem
The `enforce_business_creation_limit` trigger function references `NEW.created_by`,
but the `businesses` table uses `owner_user_id` instead. This causes:
  "record 'new' has no field 'created_by'"
whenever a new user tries to create their first business.

## Fix
Replace `NEW.created_by` with `NEW.owner_user_id` in the trigger function.

## Modified Functions
- `enforce_business_creation_limit`: Changed column reference from `created_by` to `owner_user_id`

## Security Impact
- None. Same logic, just corrected column name.
*/

CREATE OR REPLACE FUNCTION enforce_business_creation_limit()
RETURNS TRIGGER AS $$
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

  SELECT COUNT(*) INTO v_current_count
  FROM businesses b
  JOIN user_business_roles ubr ON ubr.business_id = b.id
  WHERE ubr.user_id = v_owner_id AND ubr.role = 'admin';

  SELECT COALESCE(max_owned_businesses, 1) INTO v_max_allowed
  FROM user_subscriptions
  WHERE user_id = v_owner_id;

  IF v_max_allowed IS NULL THEN
    v_max_allowed := 1;
  END IF;

  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Business creation limit reached. Current: %, Max: %', v_current_count, v_max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_catalog;
