/*
  # Update change_user_business_role Function to Check User Existence

  1. Changes
    - Add check to verify if user_business_roles record exists before attempting to update
    - Return specific error message when user is not found in the business
    - Improve error handling for edge cases

  2. Security
    - Maintains existing admin-only access control
    - Still prevents demoting the last admin
    - Adds protection against updating non-existent records
*/

CREATE OR REPLACE FUNCTION change_user_business_role(
    business_id_param uuid,
    user_id_param uuid,
    new_role_param text
)
RETURNS boolean AS $$
DECLARE
    changer_is_admin boolean;
    target_is_last_admin boolean;
    user_exists_in_business boolean;
    rows_updated integer;
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
    
    -- Check if the target user exists in the business
    SELECT EXISTS (
        SELECT 1
        FROM public.user_business_roles
        WHERE user_id = user_id_param
        AND business_id = business_id_param
    ) INTO user_exists_in_business;
    
    IF NOT user_exists_in_business THEN
        RAISE EXCEPTION 'User is not a member of this business or has already been removed';
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
    
    -- Get the number of rows updated
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    -- Double check that the update succeeded
    IF rows_updated = 0 THEN
        RAISE EXCEPTION 'Failed to update user role - user may have been removed';
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;