/*
# Create check_user_exists_by_email SECURITY DEFINER function

## Problem
The team invite flow calls `checkUserExists` which queries `user_profiles` directly.
RLS on `user_profiles` only allows reading your own profile or profiles of users
who share a business with you. When inviting a user who is NOT yet in any of your
businesses, the query returns nothing -- making it look like the user doesn't exist.

## Fix
Create a SECURITY DEFINER function that checks if a user_profile row exists for a
given email. It returns a minimal JSON object: exists (bool), user_id, and full_name.
It does NOT expose the full profile. Only authenticated users can call it.

## New Functions
- `check_user_exists_by_email(p_email text)`: Returns JSON with exists, user_id, full_name

## Security
- SECURITY DEFINER to bypass RLS (needed to look up users not yet in caller's businesses)
- Only returns existence + user_id + name -- no sensitive data leaked
- Restricted to authenticated role only
- search_path locked to public, pg_catalog
*/

CREATE OR REPLACE FUNCTION check_user_exists_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT user_id, full_name, email
  INTO v_profile
  FROM user_profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name
  );
END;
$$;

REVOKE ALL ON FUNCTION check_user_exists_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_user_exists_by_email(text) TO authenticated;
