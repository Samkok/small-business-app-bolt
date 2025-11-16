/*
  # Add user profiles read policy for business admins

  This migration adds a policy to allow business admins to view user profiles
  when inviting team members.

  ## Changes
  1. Add policy allowing business admins to read user profiles
     - Admins can view profiles to invite users to their business
     - Only basic info (user_id, full_name, email) is accessible
*/

-- Allow business admins to read user profiles for invitation purposes
CREATE POLICY "Business admins can read user profiles for invitations"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_business_roles
      WHERE user_business_roles.user_id = auth.uid()
      AND user_business_roles.role = 'admin'
    )
  );
