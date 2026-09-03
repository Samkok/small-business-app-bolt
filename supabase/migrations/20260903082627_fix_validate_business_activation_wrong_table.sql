/*
# Fix validate_business_activation reading max_owned_businesses from wrong table

## Problem
- `validate_business_activation` reads `max_owned_businesses` from `user_profiles`,
  but that column only exists on `user_subscriptions`.
- The query always returns NULL, making the limit check always pass.
- Also adds auth.uid() guard.

## Changes
- Changed query source from `user_profiles` to `user_subscriptions`
- Added ORDER BY updated_at DESC LIMIT 1 for multi-row safety
- Added auth.uid() guard
*/

CREATE OR REPLACE FUNCTION public.validate_business_activation(p_user_id uuid)
RETURNS TABLE(is_valid boolean, business_count integer, max_allowed integer, active_count integer, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_business_count integer;
  v_max_allowed integer;
  v_active_count integer;
  v_is_valid boolean;
  v_error_message text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot validate another user''s business activation';
  END IF;

  SELECT COUNT(*) INTO v_business_count
  FROM businesses WHERE owner_user_id = p_user_id;

  SELECT COUNT(*) INTO v_active_count
  FROM businesses WHERE owner_user_id = p_user_id AND access_state = 'active';

  SELECT COALESCE(us.max_owned_businesses, 1) INTO v_max_allowed
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  ORDER BY us.updated_at DESC LIMIT 1;

  IF v_max_allowed IS NULL THEN v_max_allowed := 1; END IF;

  IF v_active_count < 1 THEN
    v_is_valid := false;
    v_error_message := 'At least one business must be active.';
  ELSIF v_active_count > v_max_allowed THEN
    v_is_valid := false;
    v_error_message := format('You can have at most %s active businesses. Currently %s are active.',
      v_max_allowed, v_active_count);
  ELSE
    v_is_valid := true;
    v_error_message := NULL;
  END IF;

  RETURN QUERY SELECT v_is_valid, v_business_count, v_max_allowed, v_active_count, v_error_message;
END;
$function$;
