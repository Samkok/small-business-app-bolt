/*
  # Enable pg_net Extension for Push Notifications

  1. Problem
    - Push notifications are not being sent to devices
    - The send_push_notification_on_insert() trigger function uses net.http_post()
    - This requires the pg_net extension which is not currently enabled

  2. Solution
    - Enable the pg_net extension
    - This allows database triggers to make HTTP requests to the Edge Function
    - Required for push notifications to work properly

  3. Security
    - pg_net is a Supabase-provided extension for secure HTTP requests from database
    - Only functions with SECURITY DEFINER can use it
    - Safe to enable for push notification functionality
*/

-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role (required for triggers)
GRANT USAGE ON SCHEMA extensions TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres;