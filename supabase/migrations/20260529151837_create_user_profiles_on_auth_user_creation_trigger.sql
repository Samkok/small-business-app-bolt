/*
  # Add trigger to auto-create user_profiles on auth.users INSERT

  1. Problem
    - user_profiles rows were being created client-side only
    - If the INSERT after signUp() failed (network, RLS timing, crash), 
      the user ended up as an orphan: they exist in auth.users but not user_profiles
    - This caused 6 orphaned users with businesses that had no matching profiles

  2. Fix
    - Create a database trigger function `handle_new_user_profile()`
    - Fires AFTER INSERT on auth.users
    - Inserts a user_profiles row with user_id, email, and a derived full_name
    - Uses ON CONFLICT DO NOTHING so the client-side insert remains harmless

  3. Security
    - Function runs as SECURITY DEFINER to bypass RLS
    - Search path set explicitly to prevent search path exploits
*/

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();
