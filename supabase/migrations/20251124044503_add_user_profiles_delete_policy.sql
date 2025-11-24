/*
  # Add DELETE Policy for User Profiles Table

  1. Changes
    - Add DELETE policy for user_profiles table
    - Only users can delete their own profile
    
  2. Security
    - DELETE policy checks that the authenticated user owns the profile (user_id matches auth.uid())
    - This allows users to delete their own user profile
    - Required for complete account deletion flow
    
  3. Notes
    - This policy was missing from the original RLS setup
    - Without this policy, user profile deletions fail due to RLS blocking the operation
    - Users should delete all related data before deleting their profile
*/

-- Add DELETE policy for user_profiles table
CREATE POLICY "Users can delete own user profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
