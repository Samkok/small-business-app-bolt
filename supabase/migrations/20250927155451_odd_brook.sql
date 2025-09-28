/*
  # Create user_has_business_access RPC function

  1. Functions
    - `user_has_business_access` - Check if a user has access to a specific business
      - Parameters: user_uid (uuid), business_id_param (uuid)
      - Returns: boolean
      - Logic: Checks if user exists in user_business_roles table for the given business

  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Only checks user_business_roles table which already has RLS policies
*/

CREATE OR REPLACE FUNCTION user_has_business_access(
  user_uid uuid,
  business_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user has any role in the specified business
  RETURN EXISTS (
    SELECT 1 
    FROM user_business_roles 
    WHERE user_id = user_uid 
    AND business_id = business_id_param
  );
END;
$$;