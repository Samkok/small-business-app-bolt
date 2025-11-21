/*
  # Add Push Token to User Profiles

  1. Changes
    - Add expo_push_token column to user_profiles table to store device push tokens
    - Create index for faster lookups by push token

  2. Security
    - Users can update their own push token via existing RLS policies
*/

-- Add expo_push_token column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'expo_push_token'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN expo_push_token text;
  END IF;
END $$;

-- Create index for push token lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_expo_push_token ON user_profiles(expo_push_token) WHERE expo_push_token IS NOT NULL;
