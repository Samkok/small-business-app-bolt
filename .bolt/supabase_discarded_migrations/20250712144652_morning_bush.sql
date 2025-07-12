/*
  # Fix infinite recursion in user_business_roles RLS policies

  1. Changes
    - Drop the problematic "Business admins can manage user roles" policy that causes infinite recursion
    - Create separate policies for INSERT, UPDATE, and DELETE operations
    - Keep the existing SELECT policy which doesn't cause recursion
*/

-- Temporarily disable RLS on user_business_roles
ALTER TABLE public.user_business_roles DISABLE ROW LEVEL SECURITY;

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Business admins can manage user roles" ON public.user_business_roles;

-- Create separate policies for each operation type
-- Policy for INSERT: Allow admins to add users to businesses they administer
CREATE POLICY "Business admins can insert user roles" ON public.user_business_roles
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_business_roles
      WHERE user_id = auth.uid() 
      AND business_id = NEW.business_id 
      AND role = 'admin'
    )
  );

-- Policy for UPDATE: Allow admins to update roles in businesses they administer
CREATE POLICY "Business admins can update user roles" ON public.user_business_roles
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_business_roles
      WHERE user_id = auth.uid() 
      AND business_id = business_id 
      AND role = 'admin'
    )
  );

-- Policy for DELETE: Allow admins to remove users from businesses they administer
CREATE POLICY "Business admins can delete user roles" ON public.user_business_roles
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_business_roles
      WHERE user_id = auth.uid() 
      AND business_id = business_id 
      AND role = 'admin'
    )
  );

-- Re-enable RLS on user_business_roles
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;