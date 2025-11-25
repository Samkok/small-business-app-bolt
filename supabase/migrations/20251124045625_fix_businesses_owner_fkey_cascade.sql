/*
  # Fix businesses foreign key to support auth user deletion

  ## Problem
  The `businesses` table has a foreign key constraint to `auth.users(id)` without 
  ON DELETE CASCADE. This prevents deleting auth users when businesses still exist,
  even if the application code tries to delete them first.

  ## Solution
  Drop and recreate the foreign key constraint with ON DELETE CASCADE.
  When an auth user is deleted, their businesses will be automatically deleted by the database.

  ## Changes
  1. Drop existing `businesses_owner_user_id_fkey` constraint
  2. Recreate it with `ON DELETE CASCADE`

  ## Security
  - Maintains all existing RLS policies
  - No changes to permissions or access control
  - Only affects cascade behavior on deletion

  ## Notes
  - This ensures complete account deletion works properly
  - The database will handle the cascade, preventing foreign key violations
  - Application code still deletes businesses explicitly for cleaner logic
*/

-- Drop the existing foreign key constraint without CASCADE
ALTER TABLE public.businesses 
  DROP CONSTRAINT IF EXISTS businesses_owner_user_id_fkey;

-- Recreate the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.businesses 
  ADD CONSTRAINT businesses_owner_user_id_fkey 
  FOREIGN KEY (owner_user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
