/*
  # Enable Realtime for User Sales Counts

  1. Changes
    - Enable RLS on user_sales_counts table (if not already enabled)
    - Add SELECT policy for authenticated users to read their own sales count records
    - Ensure realtime publication is enabled for user_sales_counts table

  2. Purpose
    - Allow real-time pub/sub updates for sales count changes
    - Ensure users can subscribe to their own sales count data
    - Enable instant UI updates when sales counts change in the database

  3. Security
    - Users can only read sales counts for businesses they own
    - RLS policies ensure data isolation between users
    - Realtime subscriptions are filtered by user_id
*/

-- Enable RLS on user_sales_counts (if not already enabled)
ALTER TABLE user_sales_counts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to recreate with correct logic)
DROP POLICY IF EXISTS "Users can read their own sales counts" ON user_sales_counts;

-- Create policy to allow users to read sales counts for businesses they own
CREATE POLICY "Users can read their own sales counts"
  ON user_sales_counts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Enable realtime for user_sales_counts table (if not already enabled)
-- This allows clients to subscribe to changes on this table
DO $$
BEGIN
  -- Try to add the table to the publication, ignore if it already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_sales_counts;
  EXCEPTION
    WHEN duplicate_object THEN
      -- Table is already in the publication, which is fine
      RAISE NOTICE 'user_sales_counts is already in supabase_realtime publication';
  END;
END $$;
