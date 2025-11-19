/*
  # Fix Infinite Recursion in user_business_roles RLS Policies (Complete Fix)

  1. Problem
    - Multiple policies check user_business_roles to verify admin status
    - This creates infinite recursion when querying the same table
    - Affects SELECT, INSERT, UPDATE, and DELETE policies
    
  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS
    - Use this function in all policies to check admin status
    - This breaks the recursion cycle
    
  3. Security
    - Function is marked STABLE and has secure search_path
    - Only checks if user has admin role, no data modification
    - All policies remain properly secured
*/

-- Create a helper function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION is_business_admin_check(
  user_id_param uuid,
  business_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_business_roles.user_id = user_id_param
    AND user_business_roles.business_id = business_id_param
    AND user_business_roles.role = 'admin'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_business_admin_check(uuid, uuid) TO authenticated;

-- ============================================================================
-- RECREATE ALL POLICIES USING THE HELPER FUNCTION
-- ============================================================================

-- DROP existing policies
DROP POLICY IF EXISTS "Users can read their own business roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business admins can read all team member roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business owners and admins can insert user roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business admins can update user roles" ON user_business_roles;
DROP POLICY IF EXISTS "Business admins can delete user roles" ON user_business_roles;

-- SELECT policy: Users can read their own roles
CREATE POLICY "Users can read their own business roles"
  ON user_business_roles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- SELECT policy: Admins can read all team member roles
CREATE POLICY "Business admins can read all team member roles"
  ON user_business_roles FOR SELECT
  TO authenticated
  USING (
    is_business_admin_check((select auth.uid()), user_business_roles.business_id)
  );

-- INSERT policy: Business owners or admins can add team members
CREATE POLICY "Business owners and admins can insert user roles"
  ON user_business_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Either the user is the business owner
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = user_business_roles.business_id
      AND businesses.owner_user_id = (select auth.uid())
    )
    OR
    -- Or the user is an admin (checked via SECURITY DEFINER function)
    is_business_admin_check((select auth.uid()), user_business_roles.business_id)
  );

-- UPDATE policy: Only admins can update roles
CREATE POLICY "Business admins can update user roles"
  ON user_business_roles FOR UPDATE
  TO authenticated
  USING (
    is_business_admin_check((select auth.uid()), user_business_roles.business_id)
  )
  WITH CHECK (
    is_business_admin_check((select auth.uid()), user_business_roles.business_id)
  );

-- DELETE policy: Only admins can remove team members
CREATE POLICY "Business admins can delete user roles"
  ON user_business_roles FOR DELETE
  TO authenticated
  USING (
    is_business_admin_check((select auth.uid()), user_business_roles.business_id)
  );