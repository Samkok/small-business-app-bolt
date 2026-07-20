/*
# Create check_shared_business_membership Function

## Summary
Creates a helper function used by the send-push-notification edge function to verify
that the caller shares at least one business with the target user before allowing
a push notification to be sent.

## New Function: check_shared_business_membership(uuid, uuid) -> boolean
- Returns TRUE if both users share at least one business via user_business_roles.
- SECURITY DEFINER so the edge function (running as service_role) can call it.
- Granted to service_role only (not callable by clients directly).

## Security Impact
- Prevents any authenticated user from sending push notifications to arbitrary users.
- Only users within the same business team can notify each other.
*/

CREATE OR REPLACE FUNCTION check_shared_business_membership(
  p_caller_id uuid,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_business_roles ubr_caller
    JOIN user_business_roles ubr_target
      ON ubr_caller.business_id = ubr_target.business_id
    WHERE ubr_caller.user_id = p_caller_id
      AND ubr_target.user_id = p_target_id
  );
END;
$$;

REVOKE ALL ON FUNCTION check_shared_business_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_shared_business_membership(uuid, uuid) TO service_role;
