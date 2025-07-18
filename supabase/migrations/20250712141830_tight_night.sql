/*
  # Create business management functions

  1. New Functions
    - Functions to create new businesses
    - Functions to invite users to businesses
    - Functions to manage user roles within businesses
*/

-- Function to create a new business
CREATE OR REPLACE FUNCTION create_business(
    business_name_param text,
    owner_user_id_param uuid DEFAULT auth.uid()
)
RETURNS uuid AS $$
DECLARE
    new_business_id uuid;
BEGIN
    -- Insert new business
    INSERT INTO public.businesses (
        owner_user_id,
        business_name,
        created_at,
        updated_at
    ) VALUES (
        owner_user_id_param,
        business_name_param,
        now(),
        now()
    )
    RETURNING id INTO new_business_id;
    
    -- Add owner as admin in user_business_roles
    INSERT INTO public.user_business_roles (
        user_id,
        business_id,
        role,
        created_at,
        updated_at
    ) VALUES (
        owner_user_id_param,
        new_business_id,
        'admin',
        now(),
        now()
    );
    
    RETURN new_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invite a user to a business
CREATE OR REPLACE FUNCTION invite_user_to_business(
    business_id_param uuid,
    user_email_param text,
    role_param text DEFAULT 'staff'
)
RETURNS boolean AS $$
DECLARE
    inviter_is_admin boolean;
    invited_user_id uuid;
BEGIN
    -- Check if the current user is an admin of the business
    SELECT EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE user_id = auth.uid()
        AND business_id = business_id_param
        AND role = 'admin'
    ) INTO inviter_is_admin;
    
    IF NOT inviter_is_admin THEN
        RAISE EXCEPTION 'Only business admins can invite users';
    END IF;
    
    -- Find the user ID for the provided email
    SELECT id INTO invited_user_id
    FROM auth.users
    WHERE email = user_email_param;
    
    IF invited_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email_param;
    END IF;
    
    -- Add the user to the business with the specified role
    INSERT INTO public.user_business_roles (
        user_id,
        business_id,
        role,
        created_at,
        updated_at
    ) VALUES (
        invited_user_id,
        business_id_param,
        role_param,
        now(),
        now()
    )
    ON CONFLICT (user_id, business_id) 
    DO UPDATE SET
        role = role_param,
        updated_at = now();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to change a user's role in a business
CREATE OR REPLACE FUNCTION change_user_business_role(
    business_id_param uuid,
    user_id_param uuid,
    new_role_param text
)
RETURNS boolean AS $$
DECLARE
    changer_is_admin boolean;
    target_is_last_admin boolean;
BEGIN
    -- Check if the current user is an admin of the business
    SELECT EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE user_id = auth.uid()
        AND business_id = business_id_param
        AND role = 'admin'
    ) INTO changer_is_admin;
    
    IF NOT changer_is_admin THEN
        RAISE EXCEPTION 'Only business admins can change user roles';
    END IF;
    
    -- If changing from admin to staff, check if this is the last admin
    IF new_role_param = 'staff' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.user_business_roles
            WHERE business_id = business_id_param
            AND role = 'admin'
            AND user_id = user_id_param
            AND (
                SELECT COUNT(*)
                FROM public.user_business_roles
                WHERE business_id = business_id_param
                AND role = 'admin'
            ) = 1
        ) INTO target_is_last_admin;
        
        IF target_is_last_admin THEN
            RAISE EXCEPTION 'Cannot change role of the last admin';
        END IF;
    END IF;
    
    -- Update the user's role
    UPDATE public.user_business_roles
    SET role = new_role_param,
        updated_at = now()
    WHERE user_id = user_id_param
    AND business_id = business_id_param;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a user from a business
CREATE OR REPLACE FUNCTION remove_user_from_business(
    business_id_param uuid,
    user_id_param uuid
)
RETURNS boolean AS $$
DECLARE
    remover_is_admin boolean;
    target_is_last_admin boolean;
    target_is_owner boolean;
BEGIN
    -- Check if the current user is an admin of the business
    SELECT EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE user_id = auth.uid()
        AND business_id = business_id_param
        AND role = 'admin'
    ) INTO remover_is_admin;
    
    IF NOT remover_is_admin THEN
        RAISE EXCEPTION 'Only business admins can remove users';
    END IF;
    
    -- Check if the target user is the owner of the business
    SELECT EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = business_id_param
        AND owner_user_id = user_id_param
    ) INTO target_is_owner;
    
    IF target_is_owner THEN
        RAISE EXCEPTION 'Cannot remove the business owner';
    END IF;
    
    -- Check if the target user is the last admin
    SELECT EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE business_id = business_id_param
        AND role = 'admin'
        AND user_id = user_id_param
        AND (
            SELECT COUNT(*)
            FROM public.user_business_roles
            WHERE business_id = business_id_param
            AND role = 'admin'
        ) = 1
    ) INTO target_is_last_admin;
    
    IF target_is_last_admin THEN
        RAISE EXCEPTION 'Cannot remove the last admin';
    END IF;
    
    -- Remove the user from the business
    DELETE FROM public.user_business_roles
    WHERE user_id = user_id_param
    AND business_id = business_id_param;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;