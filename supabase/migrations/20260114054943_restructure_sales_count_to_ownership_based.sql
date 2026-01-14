/*
  # Restructure Sales Count System to Ownership-Based Tracking

  ## Overview
  This migration fundamentally changes how sales counts are tracked:
  - **OLD BEHAVIOR**: Sales counts tracked per user who CREATED the sale (created_by)
  - **NEW BEHAVIOR**: Sales counts track ALL sales for businesses OWNED by a user

  ## Why This Change?
  For subscription tier limits, what matters is how many sales exist in businesses
  a user OWNS, not who created those sales. Team members creating sales should
  increment the OWNER's count, not their own count.

  ## Changes Made

  1. **auto_increment_sales_count() Function**
     - Changed to increment count for business OWNER instead of sale creator
     - Looks up owner_user_id from businesses table
     - Maintains audit logging with metadata about who created vs who owns

  2. **reconcile_sales_count() Function**
     - Updated to count ALL sales for a business (regardless of creator)
     - Counts sales WHERE business_id matches, not WHERE created_by matches

  3. **reconcile_all_sales_counts() Function**
     - Now iterates by (business_id, owner_user_id) pairs
     - Processes each business once for its owner

  4. **check_sales_subscription_limit() Function**
     - Updated to check the business OWNER's total sales count
     - Blocks sales when owner has reached their tier limit

  5. **get_or_create_sales_count() Function**
     - Changed to count all sales for a business when user is the owner
     - No longer filters by created_by

  ## Impact
  - Team member sales will now count toward the business owner's tier limit
  - Free tier limit (50 sales) applies to total sales across all owned businesses
  - Sales creators who are not owners no longer have their own sales counts

  ## Data Migration
  After this migration runs, execute reconcile_all_sales_counts(true) to
  restructure existing data correctly.
*/

-- ============================================================================
-- 1. Update auto_increment_sales_count to increment OWNER's count
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_increment_sales_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id uuid;
  v_old_count integer;
  v_new_count integer;
BEGIN
  -- Look up the business owner
  SELECT owner_user_id INTO v_owner_user_id
  FROM businesses
  WHERE id = NEW.business_id;

  -- If business not found, raise an error
  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Business with id % not found', NEW.business_id;
  END IF;

  -- Upsert the sales count for the OWNER (increment by 1)
  INSERT INTO user_sales_counts (user_id, business_id, sales_count)
  VALUES (v_owner_user_id, NEW.business_id, 1)
  ON CONFLICT (user_id, business_id)
  DO UPDATE SET
    sales_count = user_sales_counts.sales_count + 1
  RETURNING sales_count - 1, sales_count INTO v_old_count, v_new_count;

  -- Log the change to audit history
  INSERT INTO user_sales_count_history (
    user_id,
    business_id,
    old_count,
    new_count,
    change_reason,
    sale_id,
    action_type,
    metadata
  ) VALUES (
    v_owner_user_id,
    NEW.business_id,
    v_old_count,
    v_new_count,
    'new_sale',
    NEW.id,
    'increment',
    jsonb_build_object(
      'sale_id', NEW.id,
      'sale_status', NEW.status,
      'total_amount', NEW.total_amount,
      'created_by_user_id', NEW.created_by,
      'business_owner_user_id', v_owner_user_id,
      'note', 'Sale created by ' ||
              CASE
                WHEN NEW.created_by = v_owner_user_id THEN 'owner'
                ELSE 'team member'
              END
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_increment_sales_count() IS
  'Auto-increments sales count for the business OWNER when a sale is created. All sales in a business count toward the owner''s tier limit, regardless of who created them.';

-- ============================================================================
-- 2. Update reconcile_sales_count to count all sales for owned businesses
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_sales_count(
  p_user_id uuid,
  p_business_id uuid,
  p_auto_correct boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached_count integer;
  v_actual_count integer;
  v_discrepancy integer;
  v_corrected boolean := false;
  v_is_owner boolean;
BEGIN
  -- Verify the user is the owner of this business
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id AND owner_user_id = p_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'User % is not the owner of business %', p_user_id, p_business_id;
  END IF;

  -- Get cached count
  SELECT sales_count INTO v_cached_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  -- Count ALL sales for this business (regardless of who created them)
  SELECT COUNT(*)::integer INTO v_actual_count
  FROM sales
  WHERE business_id = p_business_id;

  -- If no cached count exists, create one
  IF v_cached_count IS NULL THEN
    INSERT INTO user_sales_counts (user_id, business_id, sales_count)
    VALUES (p_user_id, p_business_id, v_actual_count);

    v_cached_count := v_actual_count;
    v_corrected := true;
  END IF;

  v_discrepancy := v_actual_count - v_cached_count;

  -- If there's a discrepancy and auto_correct is enabled, fix it
  IF v_discrepancy != 0 AND p_auto_correct THEN
    UPDATE user_sales_counts
    SET sales_count = v_actual_count,
        last_reconciled_at = now(),
        last_reconciliation_result = CASE
          WHEN v_discrepancy = 0 THEN 'accurate'
          ELSE 'corrected'
        END
    WHERE user_id = p_user_id AND business_id = p_business_id;

    -- The update trigger will automatically log this to history
    v_corrected := true;
  ELSIF v_discrepancy = 0 THEN
    -- Update last reconciled time even if no correction needed
    UPDATE user_sales_counts
    SET last_reconciled_at = now(),
        last_reconciliation_result = 'accurate'
    WHERE user_id = p_user_id AND business_id = p_business_id;
  END IF;

  -- Return summary
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'business_id', p_business_id,
    'cached_count', v_cached_count,
    'actual_count', v_actual_count,
    'discrepancy', v_discrepancy,
    'corrected', v_corrected,
    'status', CASE
      WHEN v_discrepancy = 0 THEN 'accurate'
      WHEN v_corrected THEN 'corrected'
      ELSE 'discrepancy_found'
    END
  );
END;
$$;

COMMENT ON FUNCTION reconcile_sales_count(uuid, uuid, boolean) IS
  'Reconciles sales count for a business owner. Counts ALL sales in the business regardless of who created them. Only the business owner can reconcile their own business.';

-- ============================================================================
-- 3. Update reconcile_all_sales_counts to iterate by business owner
-- ============================================================================

CREATE OR REPLACE FUNCTION reconcile_all_sales_counts(
  p_auto_correct boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_duration_ms integer;
  v_businesses_processed integer := 0;
  v_discrepancies_found integer := 0;
  v_corrections_made integer := 0;
  v_status text := 'success';
  v_error_message text;
  v_business record;
  v_result jsonb;
  v_log_id uuid;
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    -- Process each business and its owner
    FOR v_business IN
      SELECT id as business_id, owner_user_id
      FROM businesses
      WHERE owner_user_id IS NOT NULL
    LOOP
      v_businesses_processed := v_businesses_processed + 1;

      -- Reconcile this business for its owner
      v_result := reconcile_sales_count(
        v_business.owner_user_id,
        v_business.business_id,
        p_auto_correct
      );

      -- Track statistics
      IF (v_result->>'discrepancy')::integer != 0 THEN
        v_discrepancies_found := v_discrepancies_found + 1;

        IF (v_result->>'corrected')::boolean THEN
          v_corrections_made := v_corrections_made + 1;
        END IF;
      END IF;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    v_status := 'failed';
    v_error_message := SQLERRM;
  END;

  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

  -- Log the reconciliation run
  INSERT INTO reconciliation_log (
    execution_time,
    users_processed,
    discrepancies_found,
    corrections_made,
    execution_duration_ms,
    status,
    error_message,
    metadata
  ) VALUES (
    v_start_time,
    v_businesses_processed,
    v_discrepancies_found,
    v_corrections_made,
    v_duration_ms,
    v_status,
    v_error_message,
    jsonb_build_object(
      'auto_correct', p_auto_correct,
      'end_time', v_end_time,
      'note', 'Processes businesses and their owners (ownership-based counting)'
    )
  ) RETURNING id INTO v_log_id;

  -- Return summary
  RETURN jsonb_build_object(
    'log_id', v_log_id,
    'status', v_status,
    'businesses_processed', v_businesses_processed,
    'discrepancies_found', v_discrepancies_found,
    'corrections_made', v_corrections_made,
    'execution_duration_ms', v_duration_ms,
    'error_message', v_error_message
  );
END;
$$;

COMMENT ON FUNCTION reconcile_all_sales_counts(boolean) IS
  'Reconciles sales counts for all businesses and their owners. Processes each business once for its owner using ownership-based counting.';

-- ============================================================================
-- 4. Update check_sales_subscription_limit to check OWNER's limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_sales_subscription_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_user_id uuid;
  v_total_sales_count integer;
  v_tier text;
  v_subscription_status text;
  v_subscription_expiration timestamptz;
BEGIN
  -- Look up the business owner
  SELECT owner_user_id INTO v_owner_user_id
  FROM businesses
  WHERE id = NEW.business_id;

  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Business with id % not found', NEW.business_id;
  END IF;

  -- Get the owner's subscription tier and status
  SELECT
    tier,
    subscription_status,
    subscription_expiration_date
  INTO
    v_tier,
    v_subscription_status,
    v_subscription_expiration
  FROM user_subscriptions
  WHERE user_id = v_owner_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Set defaults if no subscription found
  IF v_tier IS NULL THEN
    v_tier := 'free';
    v_subscription_status := 'trial';
  END IF;

  -- Only enforce limits for free tier users
  IF v_tier = 'free' THEN
    -- Get total sales count across ALL owned businesses
    SELECT COALESCE(SUM(usc.sales_count), 0)::integer
    INTO v_total_sales_count
    FROM user_sales_counts usc
    INNER JOIN businesses b ON usc.business_id = b.id
    WHERE usc.user_id = v_owner_user_id
      AND b.owner_user_id = v_owner_user_id;

    -- Check if owner has exceeded free tier limit
    IF v_total_sales_count >= 50 THEN
      RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: The business owner has reached the free tier limit of 50 sales across all their businesses. Please upgrade to continue.'
        USING HINT = 'Business owner has reached the maximum number of sales allowed on the free tier';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_sales_subscription_limit() IS
  'Validates that the business OWNER has not exceeded their free tier sales limit before allowing sale creation. Checks total sales across all businesses owned by the owner.';

-- ============================================================================
-- 5. Update get_or_create_sales_count to count all sales for owned businesses
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_sales_count(p_user_id uuid, p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_actual_count integer;
  v_is_owner boolean;
BEGIN
  -- Check if user is the owner of this business
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id AND owner_user_id = p_user_id
  ) INTO v_is_owner;

  -- If user is not the owner, return 0 (they don't have a sales count for this business)
  IF NOT v_is_owner THEN
    RETURN 0;
  END IF;

  -- Get the cached count from user_sales_counts
  SELECT sales_count INTO v_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  -- If record doesn't exist, create it with actual count
  IF v_count IS NULL THEN
    -- Count ALL sales for this business (regardless of who created them)
    SELECT COUNT(*)::integer INTO v_actual_count
    FROM sales
    WHERE business_id = p_business_id;

    -- Insert the record
    INSERT INTO user_sales_counts (user_id, business_id, sales_count)
    VALUES (p_user_id, p_business_id, v_actual_count)
    ON CONFLICT (user_id, business_id)
    DO UPDATE SET sales_count = v_actual_count;

    RETURN v_actual_count;
  END IF;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_or_create_sales_count(uuid, uuid) IS
  'Returns sales count for a business owner. Counts ALL sales in the business regardless of who created them. Returns 0 if user is not the business owner.';

-- ============================================================================
-- 6. Update get_sales_count_discrepancies view function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sales_count_discrepancies()
RETURNS TABLE (
  user_id uuid,
  business_id uuid,
  cached_count integer,
  actual_count integer,
  discrepancy integer,
  last_reconciled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    usc.user_id,
    usc.business_id,
    usc.sales_count as cached_count,
    COALESCE(actual.count, 0)::integer as actual_count,
    (COALESCE(actual.count, 0) - usc.sales_count)::integer as discrepancy,
    usc.last_reconciled_at
  FROM user_sales_counts usc
  INNER JOIN businesses b ON usc.business_id = b.id
  LEFT JOIN (
    -- Count ALL sales per business (regardless of creator)
    SELECT business_id, COUNT(*)::integer as count
    FROM sales
    GROUP BY business_id
  ) actual ON actual.business_id = usc.business_id
  WHERE COALESCE(actual.count, 0) != usc.sales_count
    AND b.owner_user_id = usc.user_id;
END;
$$;

COMMENT ON FUNCTION get_sales_count_discrepancies() IS
  'Returns sales count discrepancies for business owners. Counts ALL sales per business regardless of creator.';

-- ============================================================================
-- 7. Add helpful admin function to check a user's complete sales picture
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_sales_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owned_businesses jsonb;
  v_total_sales integer;
  v_tier text;
  v_subscription_status text;
BEGIN
  -- Get tier info
  SELECT tier, subscription_status
  INTO v_tier, v_subscription_status
  FROM user_subscriptions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_tier IS NULL THEN
    v_tier := 'free';
    v_subscription_status := 'trial';
  END IF;

  -- Get all owned businesses with their sales counts
  SELECT jsonb_agg(
    jsonb_build_object(
      'business_id', b.id,
      'business_name', b.business_name,
      'sales_count', COALESCE(
        (SELECT COUNT(*)::integer FROM sales WHERE business_id = b.id),
        0
      ),
      'cached_count', COALESCE(usc.sales_count, 0)
    )
  )
  INTO v_owned_businesses
  FROM businesses b
  LEFT JOIN user_sales_counts usc ON usc.business_id = b.id AND usc.user_id = p_user_id
  WHERE b.owner_user_id = p_user_id;

  -- Calculate total sales across all owned businesses
  SELECT COALESCE(SUM(sales_count), 0)::integer
  INTO v_total_sales
  FROM user_sales_counts usc
  INNER JOIN businesses b ON usc.business_id = b.id
  WHERE usc.user_id = p_user_id
    AND b.owner_user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'tier', v_tier,
    'subscription_status', v_subscription_status,
    'total_sales_all_businesses', v_total_sales,
    'free_tier_limit', 50,
    'remaining_sales', CASE WHEN v_tier = 'free' THEN GREATEST(0, 50 - v_total_sales) ELSE NULL END,
    'is_at_limit', CASE WHEN v_tier = 'free' THEN v_total_sales >= 50 ELSE false END,
    'owned_businesses', COALESCE(v_owned_businesses, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION get_user_sales_summary(uuid) IS
  'Returns a complete summary of a user''s sales across all owned businesses. Useful for debugging and admin purposes.';

GRANT EXECUTE ON FUNCTION get_user_sales_summary(uuid) TO authenticated;

-- ============================================================================
-- Migration Complete - Manual Reconciliation Required
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'IMPORTANT: Sales count system has been restructured to ownership-based tracking.';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Run: SELECT reconcile_all_sales_counts(true);';
  RAISE NOTICE '   This will restructure all existing sales counts correctly.';
  RAISE NOTICE '';
  RAISE NOTICE '2. Verify: SELECT * FROM get_sales_count_discrepancies();';
  RAISE NOTICE '   This should return zero rows after reconciliation.';
  RAISE NOTICE '=================================================================';
END $$;
