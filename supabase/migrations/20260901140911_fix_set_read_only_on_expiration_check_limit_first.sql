/*
# Fix set_all_businesses_read_only_on_expiration to check business count first

## Problem
The `set_all_businesses_read_only_on_expiration` function unconditionally sets
`must_choose_businesses = true` for ANY user whose subscription expires, even if
they only own 1 business on the free tier. This leaves users stuck on the
"choose which businesses to keep active" screen when they don't need to choose
anything.

## Fix
Before setting the flag, count owned businesses vs. the free-tier default limit (1).
If the user's businesses fit within the free-tier limit, auto-activate them and
leave the flag as false. Only set the flag when the user genuinely has more
businesses than the fallback tier allows.

## Modified Functions
- `set_all_businesses_read_only_on_expiration(p_user_id uuid)`: Now checks
  business count against free-tier limit before deciding whether to set the flag.

## Security
- No changes to RLS or policies.
*/

CREATE OR REPLACE FUNCTION set_all_businesses_read_only_on_expiration(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_owned_count integer;
  v_free_tier_limit integer := 1;
BEGIN
  SELECT COUNT(*) INTO v_owned_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  IF v_owned_count <= v_free_tier_limit THEN
    UPDATE businesses
    SET access_state = 'active'
    WHERE owner_user_id = p_user_id;

    UPDATE user_profiles
    SET must_choose_businesses = false
    WHERE user_id = p_user_id;
  ELSE
    UPDATE businesses
    SET access_state = 'read_only_sales'
    WHERE owner_user_id = p_user_id;

    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;
  END IF;
END;
$$;
