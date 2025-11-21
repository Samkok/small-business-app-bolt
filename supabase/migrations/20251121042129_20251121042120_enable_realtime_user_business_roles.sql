/*
  # Enable Realtime for user_business_roles Table

  1. Realtime Configuration
    - Enables replica identity FULL for user_business_roles table
    - Required for DELETE events to include old row data in realtime subscriptions
    - Adds user_business_roles table to Supabase realtime publication

  2. Purpose
    - Enables real-time detection when users are removed from businesses
    - Allows immediate automatic business switching without page refresh
    - Supports instant notifications when business access changes

  3. Security Considerations
    - Existing RLS policies control what data users can see
    - Realtime events respect RLS policies
    - Users only receive events for their own user_id records

  4. Important Notes
    - REPLICA IDENTITY FULL captures complete row data for DELETE events
    - This allows DELETE handlers to access business_id and user_id from the old row
    - Without this, DELETE events would only include the primary key
*/

-- Enable replica identity FULL for user_business_roles table
-- This is required for DELETE events to include the old row data
ALTER TABLE public.user_business_roles REPLICA IDENTITY FULL;

-- Add user_business_roles table to Supabase realtime publication
-- This enables realtime subscriptions for INSERT, UPDATE, DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_business_roles;
