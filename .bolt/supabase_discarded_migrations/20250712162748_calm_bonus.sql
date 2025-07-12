```sql
-- Add the email column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN email text;

-- Populate the new email column with data from auth.users
-- This is crucial for existing users
UPDATE public.user_profiles
SET email = auth.users.email
FROM auth.users
WHERE public.user_profiles.user_id = auth.users.id;

-- Add a NOT NULL constraint to the email column
-- This ensures all future user_profiles entries will have an email
ALTER TABLE public.user_profiles
ALTER COLUMN email SET NOT NULL;

-- Optionally, add a unique constraint if you want to enforce uniqueness
-- However, user_id is already unique and linked to auth.users, which enforces unique emails.
-- ALTER TABLE public.user_profiles
-- ADD CONSTRAINT user_profiles_email_key UNIQUE (email);

-- Create a function to update user_profiles.email when auth.users.email changes
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.user_profiles
    SET email = NEW.email
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger on auth.users to call the function
DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_update();
```