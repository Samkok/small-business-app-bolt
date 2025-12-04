/*
  Fix Subscription Tables Replica Identity for Realtime

  1. Changes
    - Set REPLICA IDENTITY FULL on user_subscriptions table
    - Set REPLICA IDENTITY FULL on user_sales_counts table
  
  2. Why This Is Needed
    - Supabase Realtime requires REPLICA IDENTITY to be set on tables
    - Without it, postgres_changes events cannot capture the full row data
    - This causes CHANNEL_ERROR when trying to subscribe to changes
  
  3. What REPLICA IDENTITY FULL Does
    - Captures complete row data for INSERT/UPDATE/DELETE events
    - Required for realtime subscriptions to work properly
    - Allows RLS policies to be applied correctly on realtime events
*/

-- Set replica identity for user_subscriptions
ALTER TABLE public.user_subscriptions REPLICA IDENTITY FULL;

-- Set replica identity for user_sales_counts
ALTER TABLE public.user_sales_counts REPLICA IDENTITY FULL;
