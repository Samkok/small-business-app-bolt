/*
  # Migrate data and refactor businesses table
  
  1. Data Migration
     - Move user data from businesses to user_profiles
     - Create initial user_business_roles entries
  
  2. Schema Changes
     - Remove redundant columns from businesses table
     - Rename user_id to owner_user_id
*/

-- Disable RLS temporarily for data migration and schema changes
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

-- Migrate existing data from 'businesses' to 'user_profiles'
DO $$
DECLARE
    business_record RECORD;
BEGIN
    FOR business_record IN SELECT * FROM public.businesses
    LOOP
        -- Insert user profile data
        INSERT INTO public.user_profiles (
            user_id, 
            full_name, 
            created_at, 
            updated_at
        )
        VALUES (
            business_record.user_id,
            business_record.business_name,
            business_record.created_at,
            business_record.updated_at
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Create user business role
        INSERT INTO public.user_business_roles (
            user_id,
            business_id,
            role,
            created_at,
            updated_at
        )
        VALUES (
            business_record.user_id,
            business_record.id,
            'admin',
            business_record.created_at,
            business_record.updated_at
        )
        ON CONFLICT (user_id, business_id) DO NOTHING;
    END LOOP;
END
$$;

-- Rename 'user_id' column in 'businesses' to 'owner_user_id'
ALTER TABLE public.businesses RENAME COLUMN user_id TO owner_user_id;

-- Re-enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;