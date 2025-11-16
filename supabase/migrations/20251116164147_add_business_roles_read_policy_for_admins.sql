/*
  # Add read policy for business admins to view team members

  This migration adds a policy to allow business admins to view all team member
  roles in their business.

  ## Changes
  1. Add policy allowing business admins to read all user_business_roles in their businesses
     - Admins can view all team members to manage the team
     - Only applies to businesses where the user is an admin
*/

-- Allow business admins to read all team member roles in their businesses
CREATE POLICY "Business admins can read all team member roles"
  ON user_business_roles
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id
      FROM user_business_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
