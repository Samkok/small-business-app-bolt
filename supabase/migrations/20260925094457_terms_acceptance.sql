-- Which version of the Terms each user accepted, so the app can ask again after a change.
-- New accounts pass the version in the sign-up metadata; the profile trigger stores it.
-- The current version lives in src/config/terms.ts; TermsUpdatePrompt asks when behind.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

COMMENT ON COLUMN public.user_profiles.terms_accepted_version IS 'Terms version (e.g. 1.4.0) the user last agreed to; the app prompts when it is behind the current version';

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name, terms_accepted_version, terms_accepted_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    NULLIF(NEW.raw_user_meta_data->>'terms_version', ''),
    CASE WHEN NULLIF(NEW.raw_user_meta_data->>'terms_version', '') IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
