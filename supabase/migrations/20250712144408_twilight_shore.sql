```sql
-- Disable RLS temporarily for policy updates on user_business_roles
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Business admins can manage user roles" ON public.user_business_roles;

-- Create the corrected policy
-- This policy allows users to manage (ALL operations) roles within a business
-- if the current user (auth.uid()) is an 'admin' for that specific business_id.
CREATE POLICY "Business admins can manage user roles" ON public.user_business_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.user_business_roles AS ubr_check
      WHERE ubr_check.user_id = auth.uid()
        AND ubr_check.business_id = user_business_roles.business_id -- Reference the current row's business_id
        AND ubr_check.role = 'admin'
    )
  );

-- Re-enable RLS
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;
```