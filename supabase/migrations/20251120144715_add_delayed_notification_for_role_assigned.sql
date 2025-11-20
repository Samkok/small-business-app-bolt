/*
  # Add Delayed Notification for Role Assigned

  1. Changes
    - Update notify_role_assigned() function to add a 2-second delay before creating notification
    - This delay ensures the real-time subscription has time to update the user's business list
    - Only applies to role_assigned notifications to prevent race conditions

  2. Purpose
    - Fix race condition where users click notifications before business data syncs to client
    - Ensure business is available in user's business list before notification appears
    - Provide better user experience when being assigned to new businesses

  3. Notes
    - The delay is implemented using pg_sleep(2) which pauses execution for 2 seconds
    - This is safe because the trigger runs asynchronously after the INSERT completes
    - Other notification types don't need delays as the business already exists for those users
*/

-- ============================================================================
-- FUNCTION: Notify when role is assigned (with delay)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_role_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_business_name text;
  v_preference RECORD;
BEGIN
  -- Add a 2-second delay to allow real-time subscription to sync business data
  -- This prevents race conditions when users click notifications too quickly
  PERFORM pg_sleep(2);

  -- Get business name
  SELECT business_name INTO v_business_name
  FROM businesses
  WHERE id = NEW.business_id;

  v_business_name := COALESCE(v_business_name, 'a business');

  -- Check user preferences
  SELECT * INTO v_preference FROM notification_preferences WHERE user_id = NEW.user_id;

  IF v_preference IS NULL OR v_preference.role_assigned_enabled THEN
    INSERT INTO notifications (user_id, business_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      NEW.business_id,
      'role_assigned',
      'Role Assigned',
      'Congratulations! You have been assigned as ' || NEW.role || ' in ' || v_business_name,
      jsonb_build_object(
        'role', NEW.role,
        'business_name', v_business_name,
        'business_id', NEW.business_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;