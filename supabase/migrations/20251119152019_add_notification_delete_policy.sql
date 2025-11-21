/*
  # Add DELETE policy for notifications

  1. Changes
    - Add RLS policy to allow users to delete their own notifications

  2. Security
    - Users can only delete notifications where they are the recipient (user_id matches auth.uid())
    - This prevents users from deleting other users' notifications
*/

-- Add DELETE policy for notifications table
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
