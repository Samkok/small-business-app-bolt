/*
  # Expand Notification Types

  1. Changes
    - Add more notification types for better coverage
    - Add 'low_stock' and 'expense_added' types
    - Ensure all notification functionality works properly

  2. Reason
    - Support more notification scenarios
    - Make notification system more comprehensive
*/

-- Drop the existing check constraint
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add updated constraint with more types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('sale_created', 'sale_voided', 'role_assigned', 'low_stock', 'expense_added', 'team_invite'));

-- Ensure notification preferences table has default values for existing users
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT id FROM auth.users LOOP
    INSERT INTO notification_preferences (user_id, sales_created_enabled, sales_voided_enabled, role_assigned_enabled)
    VALUES (v_user.id, true, true, true)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;
