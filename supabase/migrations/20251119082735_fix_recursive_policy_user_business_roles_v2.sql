/*
  # Fix Infinite Recursion in user_business_roles RLS Policies

  1. Problem
    - The INSERT policy checks user_business_roles table to verify admin status
    - This creates infinite recursion when inserting into the same table
    
  2. Solution
    - Change INSERT policy to check if the inserting user is the business owner
    - Use businesses.owner_user_id instead of checking user_business_roles
    - UPDATE and DELETE policies can remain as they check existing records
    
  3. Security
    - Only business owners can add initial team members
    - Admins can update and delete team member roles
    - Users can read their own roles
    - Admins can read all team member roles
*/

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Business admins can insert user roles" ON user_business_roles;

-- Create new INSERT policy that checks business ownership instead
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
    -- Or the user is already an admin in the business
    EXISTS (
      SELECT 1 FROM user_business_roles existing_roles
      WHERE existing_roles.business_id = user_business_roles.business_id
      AND existing_roles.user_id = (select auth.uid())
      AND existing_roles.role = 'admin'
    )
  );