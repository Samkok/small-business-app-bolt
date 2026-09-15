/*
  # Add Delayed Notification for Role Assignments

  1. Changes
    - Update notify_role_assigned() function to add a 2-second delay before creating notifications
    - This delay ensures the real-time subscription has time to update the client's business list
    - Prevents race condition where users click notifications before business data is synced

  2. Purpose
    - Fix "business not found" errors when users quickly click on role assignment notifications
    - Ensure smooth user experience when being assigned to new businesses
    - Allow real-time subscription to propagate business data before notification appears

  3. Implementation
    - Uses pg_sleep(2) to introduce a 2-second delay
    - Only affects role assignment notifications
    - Other notification types remain unchanged for now (will be handled client-side)
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
  -- Get business name
  SELECT business_name INTO v_business_name
  FROM businesses
  WHERE id = NEW.business_id;

  v_business_name := COALESCE(v_business_name, 'a business');

  -- Check user preferences
  SELECT * INTO v_preference FROM notification_preferences WHERE user_id = NEW.user_id;

  IF v_preference IS NULL OR v_preference.role_assigned_enabled THEN
    -- Add a 2-second delay to allow real-time subscription to sync
    -- This prevents race conditions where the user clicks the notification
    -- before their business list is updated
    PERFORM pg_sleep(2);

    INSERT INTO notifications (user_id, business_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      NEW.business_id,
      'role_assigned',
      'Congratulations! You have been assigned as ' || NEW.role || ' in ' || v_business_name,
      'role_assigned',
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
;
