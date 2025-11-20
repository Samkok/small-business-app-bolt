/*
  # Automatic Notification Cleanup on Business Access Removal

  1. Changes
    - Create trigger function to automatically delete user notifications when removed from a business
    - Create trigger on user_business_roles DELETE to invoke cleanup function
    - Create manual cleanup function for orphaned notifications
    - Update RLS policy on notifications to validate business access

  2. Security
    - Notifications are automatically removed when user loses access to business
    - RLS policy ensures users can only see notifications for businesses they have access to
    - Manual cleanup function for administrative use

  3. Functions
    - `cleanup_user_notifications_on_business_removal()` - Trigger function for automatic cleanup
    - `cleanup_orphaned_notifications()` - Manual cleanup for orphaned notifications
*/

-- Function to automatically clean up user notifications when they're removed from a business
CREATE OR REPLACE FUNCTION cleanup_user_notifications_on_business_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Delete all notifications for the user related to the business they're being removed from
  DELETE FROM notifications
  WHERE user_id = OLD.user_id
    AND business_id = OLD.business_id;
  
  -- Log the cleanup for debugging
  RAISE LOG 'Cleaned up notifications for user % from business %', OLD.user_id, OLD.business_id;
  
  RETURN OLD;
END;
$$;

-- Create trigger on user_business_roles table to cleanup notifications on DELETE
DROP TRIGGER IF EXISTS trigger_cleanup_notifications_on_business_removal ON user_business_roles;
CREATE TRIGGER trigger_cleanup_notifications_on_business_removal
  BEFORE DELETE ON user_business_roles
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_user_notifications_on_business_removal();

-- Function to manually clean up orphaned notifications (notifications where user no longer has business access)
CREATE OR REPLACE FUNCTION cleanup_orphaned_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete notifications where the user no longer has access to the business
  WITH deleted AS (
    DELETE FROM notifications n
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_business_roles ubr
      WHERE ubr.user_id = n.user_id
        AND ubr.business_id = n.business_id
    )
    RETURNING n.id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RAISE LOG 'Cleaned up % orphaned notifications', deleted_count;
  
  RETURN deleted_count;
END;
$$;

-- Drop existing notification SELECT policy
DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;

-- Create updated RLS policy that validates business access
CREATE POLICY "Users can read notifications for accessible businesses"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM user_business_roles ubr
      WHERE ubr.user_id = (SELECT auth.uid())
        AND ubr.business_id = notifications.business_id
    )
  );

-- Update the UPDATE policy to also check business access
DROP POLICY IF EXISTS "Users can update their own notification read status" ON notifications;

CREATE POLICY "Users can update notifications for accessible businesses"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM user_business_roles ubr
      WHERE ubr.user_id = (SELECT auth.uid())
        AND ubr.business_id = notifications.business_id
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM user_business_roles ubr
      WHERE ubr.user_id = (SELECT auth.uid())
        AND ubr.business_id = notifications.business_id
    )
  );

-- Update the DELETE policy to also check business access
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Users can delete notifications for accessible businesses"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM user_business_roles ubr
      WHERE ubr.user_id = (SELECT auth.uid())
        AND ubr.business_id = notifications.business_id
    )
  );
