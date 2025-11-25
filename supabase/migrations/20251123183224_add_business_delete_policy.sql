/*
  # Add DELETE Policy for Businesses Table

  1. Changes
    - Add DELETE policy for businesses table
    - Only business owners can delete their businesses
    
  2. Security
    - DELETE policy checks that the authenticated user is the owner (owner_user_id matches auth.uid())
    - This allows business owners to delete their own businesses
    - Required for account deletion flow where users need to delete all owned businesses
    
  3. Notes
    - This policy was missing from the original RLS setup
    - Without this policy, business deletions fail due to RLS blocking the operation
*/

-- Add DELETE policy for businesses table
CREATE POLICY "Business owners can delete their businesses"
  ON businesses FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = owner_user_id);
