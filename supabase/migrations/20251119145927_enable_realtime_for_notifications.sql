/*
  # Enable Realtime for Notifications Table

  1. Changes
    - Enable realtime replication for notifications table
    - This allows clients to receive real-time updates when notifications are created

  2. Security
    - Realtime respects RLS policies, so users will only receive their own notifications
*/

-- Enable realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
