-- Disable RLS temporarily for data migration and schema changes
ALTER TABLE public.businesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

-- Check if the businesses table has the necessary columns
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Check if the user_id column exists (it should be renamed to owner_user_id)
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'businesses'
        AND column_name = 'user_id'
    ) INTO column_exists;

    IF column_exists THEN
        -- Rename user_id to owner_user_id if it exists
        ALTER TABLE public.businesses RENAME COLUMN user_id TO owner_user_id;
    END IF;
END
$$;

-- Add business_name column if it doesn't exist
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'businesses'
        AND column_name = 'business_name'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE public.businesses ADD COLUMN business_name text NOT NULL DEFAULT 'My Business';
    END IF;
END
$$;

-- Migrate existing data from 'businesses' to 'user_profiles'
INSERT INTO public.user_profiles (user_id, full_name, phone, address, avatar_url, created_at, updated_at)
SELECT
    b.owner_user_id,
    COALESCE(b.business_name, 'User'),
    NULL,
    NULL,
    NULL,
    b.created_at,
    b.updated_at
FROM public.businesses AS b
ON CONFLICT (user_id) DO NOTHING;

-- Create initial entries in 'user_business_roles' for existing businesses
INSERT INTO public.user_business_roles (user_id, business_id, role, created_at, updated_at)
SELECT
    b.owner_user_id,
    b.id,
    'admin',
    b.created_at,
    b.updated_at
FROM public.businesses AS b
ON CONFLICT (user_id, business_id) DO NOTHING;

-- Re-enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;