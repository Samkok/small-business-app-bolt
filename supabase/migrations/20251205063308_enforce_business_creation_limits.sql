/*
  # Enforce Business Creation Limits
  
  ## Changes
  - Update create_business function to check subscription tier limits before creating a business
  - Raise exception if user has reached their business limit based on their tier:
    - Pro: 1 business
    - Pro Plus: 3 businesses
    - Max: unlimited
    - Free: unlimited (but sales are limited to 50 total)
  
  ## Security
  - Enforces business limits at database level
  - Prevents circumventing limits through client-side code
*/

CREATE OR REPLACE FUNCTION create_business(
    business_name_param text,
    owner_user_id_param uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_business_id uuid;
    v_can_create boolean;
    v_tier text;
    v_max_businesses integer;
    v_current_count integer;
BEGIN
    -- Check if user can create another business
    v_can_create := can_user_create_business(owner_user_id_param);
    
    IF NOT v_can_create THEN
        -- Get tier info for detailed error message
        SELECT tier, max_owned_businesses
        INTO v_tier, v_max_businesses
        FROM get_user_subscription_tier(owner_user_id_param);
        
        v_current_count := get_user_owned_business_count(owner_user_id_param);
        
        RAISE EXCEPTION 'BUSINESS_LIMIT_REACHED: You have reached the maximum number of businesses (%) allowed for your % subscription. Please upgrade to create more businesses.', 
            v_max_businesses, v_tier
            USING HINT = 'Current business count: ' || v_current_count;
    END IF;
    
    -- Insert new business
    INSERT INTO businesses (
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
    INSERT INTO user_business_roles (
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
    INSERT INTO customers (
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
$$;

COMMENT ON FUNCTION create_business(text, uuid) IS 'Creates a new business with subscription tier limits enforcement';
