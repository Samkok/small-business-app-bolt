/*
  # Fix infinite recursion in user_business_roles policy

  This migration fixes the infinite recursion issue by:
  1. Dropping the recursive policy
  2. Creating a helper function that uses SECURITY DEFINER to bypass RLS
  3. Creating a new policy using the helper function

  ## Changes
  1. Drop the problematic policy
  2. Create helper function to check if user is admin
  3. Recreate policy using the helper function
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Business admins can read all team member roles" ON user_business_roles;

-- Create a helper function to check if user is admin of a business
-- Using SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION is_business_admin(user_id_param uuid, business_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_business_roles
    WHERE user_id = user_id_param
    AND business_id = business_id_param
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create the policy using the helper function
CREATE POLICY "Business admins can read all team member roles"
  ON user_business_roles
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin(auth.uid(), business_id)
  );
