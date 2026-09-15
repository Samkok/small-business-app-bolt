/*
  # Fix Role Assigned Notification Column Order

  1. Changes
    - Fix the notify_role_assigned() function to have correct column order in INSERT
    - Title and message were swapped in the previous migration

  2. Purpose
    - Ensure notifications display correctly with proper title and message
*/

-- ============================================================================
-- FUNCTION: Notify when role is assigned (with delay) - Fixed version
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
;
