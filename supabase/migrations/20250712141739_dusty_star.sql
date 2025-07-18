/*
  # Migrate data and refactor businesses table

  1. Data Migration
    - Move user-specific data from businesses to user_profiles
    - Create initial entries in user_business_roles for existing businesses
    
  2. Schema Changes
    - Remove redundant columns from businesses table
    - Rename user_id to owner_user_id in businesses table
    
  3. Security
    - Temporarily disable RLS during data migration
    - Re-enable RLS after changes
*/

-- Disable RLS temporarily for data migration and schema changes
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

-- Migrate existing data from 'businesses' to 'user_profiles'
-- For each existing business, create a corresponding user_profile entry
INSERT INTO public.user_profiles (user_id, full_name, phone, address, avatar_url, created_at, updated_at)
SELECT
    b.user_id,
    b.full_name,
    b.phone,
    b.address,
    b.avatar_url,
    b.created_at,
    b.updated_at
FROM public.businesses AS b
ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at;

-- Create initial entries in 'user_business_roles' for existing businesses
-- Assume the user_id in the original 'profiles' table (now 'businesses') is the admin owner
INSERT INTO public.user_business_roles (user_id, business_id, role, created_at, updated_at)
SELECT
    b.user_id,
    b.id,
    b.role, -- Use the existing role from the profiles table
    b.created_at,
    b.updated_at
FROM public.businesses AS b
ON CONFLICT (user_id, business_id) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = EXCLUDED.updated_at;

-- Drop columns from 'businesses' that are now in 'user_profiles'
ALTER TABLE public.businesses
DROP COLUMN IF EXISTS full_name,
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS avatar_url,
DROP COLUMN IF EXISTS role;

-- Rename 'user_id' column in 'businesses' to 'owner_user_id'
ALTER TABLE public.businesses RENAME COLUMN user_id TO owner_user_id;

-- Re-enable RLS (policies will be updated in a later migration)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;