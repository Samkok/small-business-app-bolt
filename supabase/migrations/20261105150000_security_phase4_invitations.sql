-- Security audit phase 4a: team membership needs the invitee's consent.
--
-- invite_user_to_business used to insert the membership row straight away, so any admin could
-- put any account into their business (and read its profile, push to it, make its sales land
-- there). It now records a pending invitation and notifies the person; the row in
-- user_business_roles is created only when they accept. Builds before 2.12 call the same RPC
-- and keep working: the invitation is created, the invitee accepts from a 2.12 build.

CREATE TABLE IF NOT EXISTS public.business_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('admin', 'staff')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days'
);
CREATE UNIQUE INDEX IF NOT EXISTS business_invitations_one_pending
  ON public.business_invitations (business_id, invitee_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_business_invitations_invitee ON public.business_invitations (invitee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_business_invitations_business ON public.business_invitations (business_id, status);

ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.business_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.business_invitations TO authenticated;
DROP POLICY IF EXISTS "Invitee and business admins can read invitations" ON public.business_invitations;
CREATE POLICY "Invitee and business admins can read invitations" ON public.business_invitations
  FOR SELECT TO authenticated
  USING (invitee_user_id = (SELECT auth.uid()) OR public.is_business_admin_check((SELECT auth.uid()), business_id));

-- The invitee is not a member of the business yet, and the notifications policies are
-- membership-scoped: let people read, mark and delete their own team_invite notifications.
DROP POLICY IF EXISTS "Invitees can read their team invitations" ON public.notifications;
CREATE POLICY "Invitees can read their team invitations" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND type = 'team_invite');
DROP POLICY IF EXISTS "Invitees can update their team invitations" ON public.notifications;
CREATE POLICY "Invitees can update their team invitations" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND type = 'team_invite')
  WITH CHECK (user_id = (SELECT auth.uid()) AND type = 'team_invite');
DROP POLICY IF EXISTS "Invitees can delete their team invitations" ON public.notifications;
CREATE POLICY "Invitees can delete their team invitations" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND type = 'team_invite');

-- Inviting records a pending invitation; nothing joins the business yet ----------------------
CREATE OR REPLACE FUNCTION public.invite_user_to_business(business_id_param uuid, user_email_param text, role_param text DEFAULT 'staff'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_caller uuid := auth.uid();
    invited_user_id uuid;
    v_business_name text;
    v_inviter_name text;
    v_invitation_id uuid;
BEGIN
    PERFORM public.require_not_anon();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'invite_user_to_business needs a signed-in user' USING ERRCODE = '42501';
    END IF;
    IF role_param NOT IN ('admin', 'staff') THEN
        RAISE EXCEPTION 'Unknown role: %', role_param;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.user_business_roles
        WHERE user_id = v_caller AND business_id = business_id_param AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only business admins can invite users';
    END IF;

    SELECT id INTO invited_user_id FROM auth.users WHERE lower(email) = lower(trim(user_email_param));
    IF invited_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email_param;
    END IF;
    IF invited_user_id = v_caller THEN
        RAISE EXCEPTION 'You are already a member of this business';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_business_roles
               WHERE user_id = invited_user_id AND business_id = business_id_param) THEN
        RAISE EXCEPTION 'User is already a member of this business';
    END IF;

    -- A pending invitation is not duplicated; the earlier one stays valid
    IF EXISTS (SELECT 1 FROM public.business_invitations
               WHERE business_id = business_id_param AND invitee_user_id = invited_user_id
                 AND status = 'pending' AND expires_at > now()) THEN
        RETURN true;
    END IF;
    UPDATE public.business_invitations SET status = 'expired'
     WHERE business_id = business_id_param AND invitee_user_id = invited_user_id
       AND status = 'pending' AND expires_at <= now();

    INSERT INTO public.business_invitations (business_id, invitee_user_id, invited_by, role)
    VALUES (business_id_param, invited_user_id, v_caller, role_param)
    RETURNING id INTO v_invitation_id;

    SELECT business_name INTO v_business_name FROM public.businesses WHERE id = business_id_param;
    v_inviter_name := COALESCE(public.get_user_display_name(v_caller), 'A business admin');

    INSERT INTO public.notifications (user_id, business_id, type, title, message, data)
    VALUES (
        invited_user_id,
        business_id_param,
        'team_invite',
        'Team invitation',
        v_inviter_name || ' invited you to join ' || COALESCE(v_business_name, 'a business') || ' as ' || role_param || '. Open Select Business to accept or decline.',
        jsonb_build_object(
            'invitation_id', v_invitation_id,
            'business_id', business_id_param,
            'business_name', v_business_name,
            'role', role_param,
            'invited_by_name', v_inviter_name
        )
    );

    RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.invite_user_to_business(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_user_to_business(uuid, text, text) TO authenticated, service_role;

-- The invitee answers -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_business_invitation(p_invitation_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_inv record;
  v_business_name text;
  v_invitee_name text;
BEGIN
  PERFORM public.require_not_anon();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'respond_to_business_invitation needs a signed-in user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.business_invitations
   WHERE id = p_invitation_id AND invitee_user_id = v_caller FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer open (%)', v_inv.status;
  END IF;
  IF v_inv.expires_at <= now() THEN
    UPDATE public.business_invitations SET status = 'expired', responded_at = now() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.business_invitations SET status = 'declined', responded_at = now() WHERE id = v_inv.id;
    RETURN jsonb_build_object('status', 'declined', 'business_id', v_inv.business_id);
  END IF;

  INSERT INTO public.user_business_roles (user_id, business_id, role, created_at, updated_at)
  VALUES (v_caller, v_inv.business_id, v_inv.role, now(), now())
  ON CONFLICT (user_id, business_id) DO NOTHING;

  UPDATE public.business_invitations SET status = 'accepted', responded_at = now() WHERE id = v_inv.id;

  -- Tell whoever invited them (the role_assigned tap handler opens the business)
  IF v_inv.invited_by IS NOT NULL THEN
    SELECT business_name INTO v_business_name FROM public.businesses WHERE id = v_inv.business_id;
    v_invitee_name := COALESCE(public.get_user_display_name(v_caller), 'The invited user');
    INSERT INTO public.notifications (user_id, business_id, type, title, message, data)
    VALUES (
      v_inv.invited_by, v_inv.business_id, 'role_assigned', 'Invitation accepted',
      v_invitee_name || ' joined ' || COALESCE(v_business_name, 'your business') || ' as ' || v_inv.role || '.',
      jsonb_build_object('business_id', v_inv.business_id, 'business_name', v_business_name, 'role', v_inv.role, 'kind', 'invitation_accepted')
    );
  END IF;

  RETURN jsonb_build_object('status', 'accepted', 'business_id', v_inv.business_id, 'role', v_inv.role);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_business_invitation(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_business_invitation(uuid, boolean) TO authenticated, service_role;

-- An admin withdraws a pending invitation -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_business_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_inv record;
BEGIN
  PERFORM public.require_not_anon();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'cancel_business_invitation needs a signed-in user' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_inv FROM public.business_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_business_roles WHERE user_id = v_caller AND business_id = v_inv.business_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only business admins can cancel invitations' USING ERRCODE = '42501';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RETURN false;
  END IF;
  UPDATE public.business_invitations SET status = 'cancelled', responded_at = now() WHERE id = v_inv.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_business_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_business_invitation(uuid) TO authenticated, service_role;

-- Lists ----------------------------------------------------------------------------------------
-- What the signed-in user has been invited to (business names the invitee cannot read yet)
CREATE OR REPLACE FUNCTION public.get_my_business_invitations()
RETURNS TABLE (id uuid, business_id uuid, business_name text, business_image_url text, role text, invited_by_name text, created_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT i.id, i.business_id, b.business_name, b.business_image_url, i.role,
         COALESCE(public.get_user_display_name(i.invited_by), 'A business admin') AS invited_by_name,
         i.created_at, i.expires_at
  FROM public.business_invitations i
  JOIN public.businesses b ON b.id = i.business_id
  WHERE i.invitee_user_id = auth.uid()
    AND i.status = 'pending' AND i.expires_at > now()
  ORDER BY i.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_business_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_business_invitations() TO authenticated, service_role;

-- What a business's admins have sent and is still open
CREATE OR REPLACE FUNCTION public.get_business_pending_invitations(p_business_id uuid)
RETURNS TABLE (id uuid, invitee_user_id uuid, invitee_name text, invitee_email text, role text, created_at timestamptz, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT i.id, i.invitee_user_id, up.full_name, up.email, i.role, i.created_at, i.expires_at
  FROM public.business_invitations i
  LEFT JOIN public.user_profiles up ON up.user_id = i.invitee_user_id
  WHERE i.business_id = p_business_id
    AND i.status = 'pending' AND i.expires_at > now()
    AND EXISTS (SELECT 1 FROM public.user_business_roles r
                WHERE r.user_id = auth.uid() AND r.business_id = p_business_id AND r.role = 'admin')
  ORDER BY i.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_business_pending_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_business_pending_invitations(uuid) TO authenticated, service_role;
