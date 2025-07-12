/*
  # Create business management functions
  
  1. New Functions
     - create_business: Creates a new business and assigns owner
     - invite_user_to_business: Invites a user to join a business
     - change_user_business_role: Changes a user's role in a business
     - remove_user_from_business: Removes a user from a business
     - user_has_business_access: Checks if a user has access to a business
*/

-- Function to create a new business and assign the owner
CREATE OR REPLACE FUNCTION public.create_business(
    business_name_param text,
    owner_user_id_param uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_business_id uuid;
BEGIN
    INSERT INTO public.businesses (business_name, owner_user_id)
    VALUES (business_name_param, owner_user_id_param)
    RETURNING id INTO new_business_id;

    INSERT INTO public.user_business_roles (user_id, business_id, role)
    VALUES (owner_user_id_param, new_business_id, 'admin');

    RETURN new_business_id;
END;
$$;

-- Function to invite a user to a business
CREATE OR REPLACE FUNCTION public.invite_user_to_business(
    business_id_param uuid,
    user_email_param text,
    role_param text DEFAULT 'staff'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invited_user_id uuid;
    inviter_role text;
BEGIN
    -- Check if the inviter is an admin of the business
    SELECT role INTO inviter_role
    FROM public.user_business_roles
    WHERE user_id = auth.uid() AND business_id = business_id_param;

    IF inviter_role IS NULL OR inviter_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can invite users to this business.';
    END IF;

    -- Get the user_id from auth.users table
    SELECT id INTO invited_user_id
    FROM auth.users
    WHERE email = user_email_param;

    IF invited_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % does not exist.', user_email_param;
    END IF;

    -- Insert the user into user_business_roles
    INSERT INTO public.user_business_roles (user_id, business_id, role)
    VALUES (invited_user_id, business_id_param, role_param)
    ON CONFLICT (user_id, business_id) DO UPDATE SET
        role = EXCLUDED.role,
        updated_at = now();

    RETURN TRUE;
END;
$$;

-- Function to change a user's role in a business
CREATE OR REPLACE FUNCTION public.change_user_business_role(
    business_id_param uuid,
    user_id_param uuid,
    new_role_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    inviter_role text;
    target_user_is_owner boolean;
BEGIN
    -- Check if the inviter is an admin of the business
    SELECT role INTO inviter_role
    FROM public.user_business_roles
    WHERE user_id = auth.uid() AND business_id = business_id_param;

    IF inviter_role IS NULL OR inviter_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can change user roles in this business.';
    END IF;

    -- Prevent changing the role of the business owner
    SELECT (owner_user_id = user_id_param) INTO target_user_is_owner
    FROM public.businesses
    WHERE id = business_id_param;

    IF target_user_is_owner THEN
        RAISE EXCEPTION 'Cannot change the role of the business owner.';
    END IF;

    -- Update the user's role
    UPDATE public.user_business_roles
    SET role = new_role_param, updated_at = now()
    WHERE user_id = user_id_param AND business_id = business_id_param;

    RETURN TRUE;
END;
$$;

-- Function to remove a user from a business
CREATE OR REPLACE FUNCTION public.remove_user_from_business(
    business_id_param uuid,
    user_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    inviter_role text;
    target_user_is_owner boolean;
BEGIN
    -- Check if the inviter is an admin of the business
    SELECT role INTO inviter_role
    FROM public.user_business_roles
    WHERE user_id = auth.uid() AND business_id = business_id_param;

    IF inviter_role IS NULL OR inviter_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can remove users from this business.';
    END IF;

    -- Prevent removing the business owner
    SELECT (owner_user_id = user_id_param) INTO target_user_is_owner
    FROM public.businesses
    WHERE id = business_id_param;

    IF target_user_is_owner THEN
        RAISE EXCEPTION 'Cannot remove the business owner.';
    END IF;

    -- Delete the user's role entry
    DELETE FROM public.user_business_roles
    WHERE user_id = user_id_param AND business_id = business_id_param;

    RETURN TRUE;
END;
$$;

-- Function to check if a user has access to a specific business
CREATE OR REPLACE FUNCTION public.user_has_business_access(
    user_uid uuid,
    business_id_param uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_access boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE user_id = user_uid AND business_id = business_id_param
    ) INTO has_access;

    RETURN has_access;
END;
$$;