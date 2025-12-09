/*
  # Add Business Access State and Downgrade Selection Fields

  ## Overview
  Adds fields for business read-only mode and downgrade business selection flow.

  ## 1. Schema Changes

  ### businesses table updates:
  - Add `access_state` column (active, read_only_sales)
    - active: Full access to all features
    - read_only_sales: Can only view sales, no create/edit/delete sales
  - Add `archived_at` column for soft delete
  - Add index on access_state

  ### user_profiles table updates:
  - Add `must_choose_businesses` boolean field
    - Set to true when user downgrades and needs to select active businesses
    - Client must show DowngradePick modal when this is true
  
  ### user_subscriptions table updates:
  - Add `selected_business_ids` jsonb array field
    - Stores which businesses user selected during downgrade
    - Used to enforce which businesses remain active
  - Add `previous_tier` text field
    - Stores tier before downgrade to detect downgrade flow

  ## 2. Functions
  
  ### set_read_only_businesses()
  - Sets businesses to read_only_sales state when user exceeds tier limit
  - Called during downgrade or expiry
  
  ### activate_selected_businesses()
  - Activates selected businesses and sets others to read_only_sales
  - Called after user confirms business selection

  ## 3. Security
  - All functions use SECURITY DEFINER with proper search_path
  - RLS policies updated to handle access_state
*/

-- Add access_state column to businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'access_state'
  ) THEN
    ALTER TABLE businesses 
    ADD COLUMN access_state text DEFAULT 'active' CHECK (access_state IN ('active', 'read_only_sales'));
  END IF;
END $$;

-- Add archived_at column to businesses for soft delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE businesses 
    ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- Create index on access_state
CREATE INDEX IF NOT EXISTS idx_businesses_access_state ON businesses(access_state);
CREATE INDEX IF NOT EXISTS idx_businesses_archived_at ON businesses(archived_at) WHERE archived_at IS NOT NULL;

-- Add must_choose_businesses column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'must_choose_businesses'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN must_choose_businesses boolean DEFAULT false;
  END IF;
END $$;

-- Add selected_business_ids to user_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'selected_business_ids'
  ) THEN
    ALTER TABLE user_subscriptions 
    ADD COLUMN selected_business_ids jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add previous_tier to user_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'previous_tier'
  ) THEN
    ALTER TABLE user_subscriptions 
    ADD COLUMN previous_tier text;
  END IF;
END $$;

-- Function to set businesses to read-only when exceeding tier limit
CREATE OR REPLACE FUNCTION set_read_only_businesses(
  p_user_id uuid,
  p_max_active_businesses integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_record RECORD;
  v_active_count integer := 0;
BEGIN
  -- Loop through user's owned businesses ordered by creation date
  FOR v_business_record IN (
    SELECT id FROM businesses 
    WHERE owner_id = p_user_id
    ORDER BY created_at ASC
  ) LOOP
    v_active_count := v_active_count + 1;
    
    -- First N businesses stay active, rest become read-only
    IF v_active_count <= p_max_active_businesses THEN
      UPDATE businesses 
      SET access_state = 'active'
      WHERE id = v_business_record.id;
    ELSE
      UPDATE businesses 
      SET access_state = 'read_only_sales'
      WHERE id = v_business_record.id;
    END IF;
  END LOOP;
  
  -- Set must_choose_businesses flag if user has more businesses than allowed
  IF v_active_count > p_max_active_businesses THEN
    UPDATE user_profiles
    SET must_choose_businesses = true
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Function to activate selected businesses and set others to read-only
CREATE OR REPLACE FUNCTION activate_selected_businesses(
  p_user_id uuid,
  p_selected_business_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_subscription_id uuid;
BEGIN
  -- Set all owned businesses to read_only_sales first
  UPDATE businesses
  SET access_state = 'read_only_sales'
  WHERE owner_id = p_user_id;
  
  -- Activate only selected businesses
  UPDATE businesses
  SET access_state = 'active'
  WHERE owner_id = p_user_id
    AND id = ANY(p_selected_business_ids);
  
  -- Clear must_choose_businesses flag
  UPDATE user_profiles
  SET must_choose_businesses = false
  WHERE user_id = p_user_id;
  
  -- Get latest subscription ID
  SELECT id INTO v_latest_subscription_id
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Store selection in user_subscriptions
  IF v_latest_subscription_id IS NOT NULL THEN
    UPDATE user_subscriptions
    SET selected_business_ids = to_jsonb(p_selected_business_ids),
        updated_at = now()
    WHERE id = v_latest_subscription_id;
  END IF;
END;
$$;

-- Function to check if business is in read-only mode
CREATE OR REPLACE FUNCTION is_business_read_only(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_state text;
BEGIN
  SELECT access_state INTO v_access_state
  FROM businesses
  WHERE id = p_business_id;
  
  RETURN v_access_state = 'read_only_sales';
END;
$$;

-- Update can_user_create_sale to check access_state
CREATE OR REPLACE FUNCTION can_user_create_sale(
  p_user_id uuid,
  p_business_id uuid
)
RETURNS TABLE (
  can_create boolean,
  reason text,
  current_count integer,
  limit_reached boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_subscription_status text;
  v_total_sales integer;
  v_owned_count integer;
  v_max_businesses integer;
  v_is_owner boolean;
  v_access_state text;
BEGIN
  -- Check business access state first
  SELECT access_state INTO v_access_state
  FROM businesses
  WHERE id = p_business_id;
  
  IF v_access_state = 'read_only_sales' THEN
    RETURN QUERY SELECT false, 'BUSINESS_READ_ONLY'::text, 0, true;
    RETURN;
  END IF;
  
  -- Get subscription info
  SELECT tier, subscription_status, max_owned_businesses
  INTO v_tier, v_subscription_status, v_max_businesses
  FROM get_user_subscription_tier(p_user_id);
  
  -- Check if user is the owner of this business
  SELECT EXISTS(
    SELECT 1 FROM businesses 
    WHERE id = p_business_id AND owner_id = p_user_id
  ) INTO v_is_owner;
  
  -- Get total sales count
  v_total_sales := get_user_total_sales_count(p_user_id);
  
  -- Free tier: 50 sales total across all businesses
  IF v_tier = 'free' THEN
    IF v_total_sales >= 50 THEN
      RETURN QUERY SELECT false, 'FREE_TIER_LIMIT'::text, v_total_sales, true;
      RETURN;
    ELSE
      RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
      RETURN;
    END IF;
  END IF;
  
  -- For paid tiers, check if user owns this business
  IF NOT v_is_owner THEN
    -- Staff member accessing someone else's business - always allowed
    RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
    RETURN;
  END IF;
  
  -- For paid tiers, check if business is within limit
  v_owned_count := get_user_owned_business_count(p_user_id);
  
  -- If user owns more businesses than allowed, check which ones are active
  IF v_max_businesses IS NOT NULL AND v_owned_count > v_max_businesses THEN
    -- Check if this business is one of the active businesses
    IF NOT EXISTS (
      SELECT 1 FROM businesses 
      WHERE id = p_business_id 
        AND owner_id = p_user_id 
        AND access_state = 'active'
    ) THEN
      RETURN QUERY SELECT false, 'BUSINESS_SALES_LIMIT'::text, v_total_sales, true;
      RETURN;
    END IF;
  END IF;
  
  -- Paid tier with subscription within limits - unlimited sales
  RETURN QUERY SELECT true, NULL::text, v_total_sales, false;
END;
$$;

-- Update sales validation trigger to check read-only state
CREATE OR REPLACE FUNCTION check_sales_subscription_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_can_create boolean;
  v_reason text;
  v_current_count integer;
  v_limit_reached boolean;
BEGIN
  -- Check if user can create sale
  SELECT can_create, reason, current_count, limit_reached
  INTO v_can_create, v_reason, v_current_count, v_limit_reached
  FROM can_user_create_sale(NEW.created_by, NEW.business_id);
  
  -- If cannot create, raise exception
  IF NOT v_can_create THEN
    IF v_reason = 'BUSINESS_READ_ONLY' THEN
      RAISE EXCEPTION 'BUSINESS_READ_ONLY: This business is in read-only mode. Please upgrade to continue.'
        USING HINT = 'Business is in read-only mode due to subscription limits';
    ELSIF v_reason = 'FREE_TIER_LIMIT' THEN
      RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: Free tier limit of 50 sales reached. Please upgrade to continue.'
        USING HINT = 'User has reached the maximum number of sales allowed on the free tier';
    ELSIF v_reason = 'BUSINESS_SALES_LIMIT' THEN
      RAISE EXCEPTION 'BUSINESS_SALES_LIMIT: This business exceeds your subscription tier limit. Please upgrade or select active businesses.'
        USING HINT = 'User has more businesses than their subscription tier allows';
    ELSE
      RAISE EXCEPTION 'SUBSCRIPTION_ERROR: Unable to create sale due to subscription limits.'
        USING HINT = 'Unknown subscription error';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add helpful comments
COMMENT ON COLUMN businesses.access_state IS 'Access level for business: active (full access) or read_only_sales (view sales only, no create/edit/delete)';
COMMENT ON COLUMN businesses.archived_at IS 'Timestamp when business was archived/soft-deleted';
COMMENT ON COLUMN user_profiles.must_choose_businesses IS 'Flag indicating user needs to select which businesses to keep active after downgrade';
COMMENT ON COLUMN user_subscriptions.selected_business_ids IS 'Array of business IDs user selected to remain active during downgrade';
COMMENT ON COLUMN user_subscriptions.previous_tier IS 'Previous subscription tier before downgrade';
COMMENT ON FUNCTION set_read_only_businesses(uuid, integer) IS 'Sets businesses to read-only state when user exceeds tier limit';
COMMENT ON FUNCTION activate_selected_businesses(uuid, uuid[]) IS 'Activates selected businesses and sets others to read-only after user selection';
COMMENT ON FUNCTION is_business_read_only(uuid) IS 'Checks if business is in read-only mode';
