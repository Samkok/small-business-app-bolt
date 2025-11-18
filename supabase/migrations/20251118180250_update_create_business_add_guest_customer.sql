/*
  # Update create_business Function to Auto-Create Guest Customer

  1. Function Updates
    - Modifies the create_business function to automatically create a guest customer
    - Guest customer is created immediately after business creation
    - Ensures every new business has a guest customer from the start

  2. Guest Customer Properties
    - name: "Guest Customer"
    - is_system_customer: true
    - phone: NULL
    - Linked to the newly created business

  3. Benefits
    - Supports instant checkout flow out of the box
    - No runtime guest customer creation needed
    - Consistent behavior for all businesses
*/

-- Drop and recreate the create_business function with guest customer creation
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
    
    -- Create guest customer for the business
    INSERT INTO public.customers (
        name,
        business_id,
        is_system_customer,
        phone,
        created_at,
        updated_at
    ) VALUES (
        'Guest Customer',
        new_business_id,
        true,
        NULL,
        now(),
        now()
    );
    
    RETURN new_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;