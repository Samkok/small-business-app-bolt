/*
# Only the owner changes the online menu

The online menu follows the OWNER's plan: it is public only while the business is `active`,
which the owner's subscription decides. Team members (admin or staff) may view and share the
link and QR code, but must not switch the menu on or off or rename it.

RLS lets any admin UPDATE a business row (name, logo, receipt details), so the app hiding the
switch is not enough. This trigger refuses a change to menu_slug, menu_enabled, menu_telegram
or menu_note unless the caller is the owner. Calls without a user (service role, SQL editor,
migrations) are allowed. Other columns are not affected.
*/
CREATE OR REPLACE FUNCTION public.enforce_menu_owner_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
IF auth.uid() IS NOT NULL
   AND auth.uid() IS DISTINCT FROM NEW.owner_user_id
   AND (NEW.menu_slug IS DISTINCT FROM OLD.menu_slug
        OR NEW.menu_enabled IS DISTINCT FROM OLD.menu_enabled
        OR NEW.menu_telegram IS DISTINCT FROM OLD.menu_telegram
        OR NEW.menu_note IS DISTINCT FROM OLD.menu_note) THEN
RAISE EXCEPTION 'Only the owner of this business can change its online menu'
USING ERRCODE = '42501';
END IF;
RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_menu_owner_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_menu_owner_only ON public.businesses;
CREATE TRIGGER enforce_menu_owner_only
BEFORE UPDATE OF menu_slug, menu_enabled, menu_telegram, menu_note ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.enforce_menu_owner_only();
