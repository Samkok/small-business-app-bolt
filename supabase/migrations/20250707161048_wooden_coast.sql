/*
  # Add Profile Avatar Support

  1. New Columns
    - `profiles.avatar_url` (text, optional) - Stores the URL to the user's profile image

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions or access control
*/

-- Add avatar_url column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;