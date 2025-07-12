```sql
-- Disable RLS temporarily for policy updates
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies on user_business_roles
-- Ensure all previous policies are dropped to avoid conflicts
DROP POLICY IF EXISTS "Business admins can manage user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can insert user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can update user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can delete user roles" ON public.user_business_roles;

-- Create specific policies for INSERT, UPDATE, and DELETE
-- These policies allow admins to manage roles within their business
CREATE POLICY "Business admins can insert user roles" ON public.user_business_roles
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );

CREATE POLICY "Business admins can update user roles" ON public.user_business_roles
  FOR UPDATE USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  ) WITH CHECK (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );

CREATE POLICY "Business admins can delete user roles" ON public.user_business_roles
  FOR DELETE USING (
    business_id IN (
      SELECT ubr.business_id
      FROM public.user_business_roles ubr
      WHERE ubr.user_id = auth.uid() AND ubr.role = 'admin'
    )
  );

-- Re-enable RLS
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;
```