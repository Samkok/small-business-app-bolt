-- Create the user_profiles table
CREATE TABLE public.user_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    phone text,
    address text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for user_profiles
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles USING btree (user_id);

-- Set up Row Level Security for user_profiles (users can manage their own profile)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own user profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own user profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own user profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Create the user_business_roles table
CREATE TABLE public.user_business_roles (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'staff', -- e.g., 'admin', 'staff'
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, business_id),
    CONSTRAINT user_business_roles_role_check CHECK (role IN ('admin', 'staff'))
);

-- Add indexes for user_business_roles
CREATE INDEX idx_user_business_roles_user_id ON public.user_business_roles USING btree (user_id);
CREATE INDEX idx_user_business_roles_business_id ON public.user_business_roles USING btree (business_id);

-- Set up Row Level Security for user_business_roles
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own roles
CREATE POLICY "Users can read their own business roles" ON public.user_business_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins of a business can manage roles within that business
CREATE POLICY "Business admins can manage user roles" ON public.user_business_roles
  FOR ALL USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );