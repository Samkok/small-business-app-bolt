/*
  # Update remove_user_from_business Function to Check User Existence

  1. Changes
    - Add check to verify if user_business_roles record exists before attempting deletion
    - Return specific error message when user is not found in the business
    - Improve error handling for edge cases

  2. Security
    - Maintains existing admin-only access control
    - Still prevents removal of business owner
    - Still prevents removal of last admin
    - Adds protection against deleting non-existent records
*/

CREATE OR REPLACE FUNCTION remove_user_from_business(
    business_id_param uuid,
    user_id_param uuid
)
RETURNS boolean AS $$
DECLARE
    remover_is_admin boolean;
    target_is_last_admin boolean;
    target_is_owner boolean;
    user_exists_in_business boolean;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;