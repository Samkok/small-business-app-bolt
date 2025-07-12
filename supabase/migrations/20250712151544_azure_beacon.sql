
-- Drop the existing foreign key constraint first to allow data modification
ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;

-- Update existing 'created_by' values to NULL
-- This is necessary because the old 'created_by' values were business_ids,
-- which are not valid user_ids in auth.users.
UPDATE public.expenses
SET created_by = NULL
WHERE created_by IS NOT NULL;

-- Add the correct foreign key constraint referencing auth.users(id)
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Re-create the 'update_updated_at_column' function if it was dropped or corrupted
-- This function is used by triggers to automatically update 'updated_at' timestamps.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Re-create the trigger for the 'expenses' table if it was dropped
-- This ensures 'updated_at' is managed correctly for expenses.
DROP TRIGGER IF EXISTS set_expenses_updated_at ON public.expenses;
CREATE TRIGGER set_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Re-create the trigger for the 'user_profiles' table if it was dropped
-- This ensures 'updated_at' is managed correctly for user profiles.
DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Re-create the trigger for the 'user_business_roles' table if it was dropped
-- This ensures 'updated_at' is managed correctly for user business roles.
DROP TRIGGER IF EXISTS set_user_business_roles_updated_at ON public.user_business_roles;
CREATE TRIGGER set_user_business_roles_updated_at
BEFORE UPDATE ON public.user_business_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Re-apply RLS policies for user_business_roles to ensure they are correct
-- This addresses the "infinite recursion" issue from earlier.
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business admins can manage user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can insert user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can update user roles" ON public.user_business_roles;
DROP POLICY IF EXISTS "Business admins can delete user roles" ON public.user_business_roles;

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

ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;