/*
  # Add updated_at triggers for new tables
  
  1. Changes
     - Create triggers to automatically update the updated_at column
     - Apply to user_profiles and user_business_roles tables
*/

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on new tables
DO $$
BEGIN
    -- For user_profiles table
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_user_profiles_updated_at' 
        AND tgrelid = 'public.user_profiles'::regclass
    ) THEN
        CREATE TRIGGER set_user_profiles_updated_at
        BEFORE UPDATE ON public.user_profiles
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- For user_business_roles table
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_user_business_roles_updated_at' 
        AND tgrelid = 'public.user_business_roles'::regclass
    ) THEN
        CREATE TRIGGER set_user_business_roles_updated_at
        BEFORE UPDATE ON public.user_business_roles
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;