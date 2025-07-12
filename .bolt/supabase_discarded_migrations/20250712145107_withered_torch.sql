```sql
-- Disable RLS temporarily for all affected tables to prevent conflicts during re-creation
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

-- Drop existing triggers that use update_updated_at_column
DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS set_user_business_roles_updated_at ON public.user_business_roles;

-- Re-create the update_updated_at_column function to ensure it's not corrupted
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create triggers for updated_at on user_profiles and user_business_roles
CREATE TRIGGER set_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_user_business_roles_updated_at
BEFORE UPDATE ON public.user_business_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drop all existing policies on public.user_business_roles to ensure a clean slate
DROP POLICY IF EXISTS "Business admins can manage user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Users can read their own business roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can insert user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can update user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can delete user roles" ON public.user_business_roles;


-- Recreate policies for public.user_business_roles
-- Policy: Users can read their own roles
CREATE POLICY "Users can read their own business roles" ON public.user_business_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Business admins can insert user roles
CREATE POLICY "Business admins can insert user roles" ON public.user_business_roles
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );

-- Policy: Business admins can update user roles
CREATE POLICY "Business admins can update user roles" ON public.user_business_roles
  FOR UPDATE USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );

-- Policy: Business admins can delete user roles
CREATE POLICY "Business admins can delete user roles" ON public.user_business_roles
  FOR DELETE USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );

-- Re-enable RLS for affected tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;
```