/*
  # Enable Realtime for user_profiles Table

  1. Changes
    - Set REPLICA IDENTITY FULL on user_profiles table
    - Add user_profiles table to supabase_realtime publication
  
  2. Why This Is Needed
    - Supabase Realtime requires REPLICA IDENTITY to be set on tables
    - Without it, postgres_changes events cannot capture the full row data
    - This causes realtime subscriptions to fail even with correct filters
  
  3. What REPLICA IDENTITY FULL Does
    - Captures complete row data for INSERT/UPDATE/DELETE events
    - Required for realtime subscriptions to work properly
    - Allows RLS policies to be applied correctly on realtime events
  
  4. Use Case
    - The app listens to changes in must_choose_businesses field
    - When this field is updated in the database, the app needs to react immediately
    - Without realtime enabled, changes only appear after app reload
*/

-- Set replica identity for user_profiles
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;

-- Add user_profiles to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
