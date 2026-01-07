/*
  # Create Consistency Safeguard Function

  ## Overview
  Creates a function that ensures `selected_business_ids` remains consistent with actual business states.
  This function is called automatically to fix inconsistencies and prevent data integrity issues.

  ## Purpose
  - Ensures `selected_business_ids` accurately reflects which businesses are active
  - Handles cases where all businesses should be active (clears the field)
  - Populates `selected_business_ids` with oldest N businesses when needed
  - Provides detailed logging for debugging and audit trails

  ## Function Details
  - `ensure_selected_business_ids_consistency(p_user_id uuid)` - Main safeguard function
  - Called after subscription changes, business selection, and periodically for data integrity

  ## Scenarios Handled
  1. All businesses are active and tier allows unlimited → Clear `selected_business_ids`
  2. Active businesses count exceeds count in `selected_business_ids` → Auto-populate with oldest
  3. `selected_business_ids` contains inactive businesses → Update to match reality (keep oldest)
  4. Data is already consistent → No changes needed

  ## Security
  - Uses SECURITY DEFINER with proper search_path for secure execution
  - Only affects data for the specified user
  - Includes detailed RAISE NOTICE logging for observability
*/

-- Function to ensure selected_business_ids stays consistent with actual business states
CREATE OR REPLACE FUNCTION ensure_selected_business_ids_consistency(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count integer;
  v_total_count integer;
  v_tier text;
  v_max_businesses integer;
  v_current_selected_ids jsonb;
  v_selected_count integer;
  v_oldest_active_businesses uuid[];
BEGIN
  RAISE NOTICE '[Consistency Safeguard] Starting consistency check for user: %', p_user_id;

  -- Get user's subscription tier and limits
  SELECT tier, max_owned_businesses
  INTO v_tier, v_max_businesses
  FROM get_user_subscription_tier(p_user_id)
  LIMIT 1;

  RAISE NOTICE '[Consistency Safeguard] User tier: %, max businesses allowed: %', v_tier, v_max_businesses;

  -- Count active and total businesses
  SELECT
    COUNT(*) FILTER (WHERE access_state = 'active'),
    COUNT(*)
  INTO v_active_count, v_total_count
  FROM businesses
  WHERE owner_user_id = p_user_id;

  RAISE NOTICE '[Consistency Safeguard] Active businesses: %, Total businesses: %', v_active_count, v_total_count;

  -- Get current selected_business_ids
  SELECT selected_business_ids
  INTO v_current_selected_ids
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  v_selected_count := COALESCE(jsonb_array_length(v_current_selected_ids), 0);
  RAISE NOTICE '[Consistency Safeguard] Current selected_business_ids count: %', v_selected_count;

  -- SCENARIO 1: All businesses are active and tier allows unlimited or covers all
  IF v_active_count = v_total_count AND (v_max_businesses IS NULL OR v_max_businesses >= v_total_count) THEN
    IF v_selected_count > 0 THEN
      RAISE NOTICE '[Consistency Safeguard] SCENARIO 1: All businesses active, clearing selected_business_ids';
      UPDATE user_subscriptions
      SET selected_business_ids = '[]'::jsonb
      WHERE user_id = p_user_id;
      RAISE NOTICE '[Consistency Safeguard] Cleared selected_business_ids successfully';
    ELSE
      RAISE NOTICE '[Consistency Safeguard] SCENARIO 1: All businesses active, selected_business_ids already empty - consistent';
    END IF;
    RETURN;
  END IF;

  -- SCENARIO 2: More active businesses than selected_business_ids count
  -- This means selected_business_ids is outdated or empty
  IF v_active_count > v_selected_count THEN
    RAISE NOTICE '[Consistency Safeguard] SCENARIO 2: Active count (%) > selected count (%), auto-populating with oldest active', v_active_count, v_selected_count;

    -- Get the oldest active businesses
    SELECT ARRAY_AGG(id ORDER BY created_at ASC)
    INTO v_oldest_active_businesses
    FROM (
      SELECT id, created_at
      FROM businesses
      WHERE owner_user_id = p_user_id AND access_state = 'active'
      ORDER BY created_at ASC
    ) sub;

    UPDATE user_subscriptions
    SET selected_business_ids = to_jsonb(v_oldest_active_businesses)
    WHERE user_id = p_user_id;

    RAISE NOTICE '[Consistency Safeguard] Auto-populated selected_business_ids with % oldest active businesses', v_active_count;
    RETURN;
  END IF;

  -- SCENARIO 3: selected_business_ids is not empty but doesn't match active businesses
  IF v_selected_count > 0 THEN
    -- Check if selected_business_ids contains businesses that aren't active
    DECLARE
      v_selected_array text[];
      v_active_from_selected integer;
    BEGIN
      -- Convert jsonb array to text array for comparison
      SELECT ARRAY(SELECT jsonb_array_elements_text(v_current_selected_ids))
      INTO v_selected_array;

      -- Count how many of the selected businesses are actually active
      SELECT COUNT(*)
      INTO v_active_from_selected
      FROM businesses
      WHERE owner_user_id = p_user_id
        AND id = ANY(v_selected_array::uuid[])
        AND access_state = 'active';

      RAISE NOTICE '[Consistency Safeguard] SCENARIO 3: Checking consistency - % businesses in selected_business_ids, % are active', v_selected_count, v_active_from_selected;

      IF v_active_from_selected != v_selected_count OR v_active_from_selected != v_active_count THEN
        RAISE NOTICE '[Consistency Safeguard] SCENARIO 3: Mismatch detected, updating selected_business_ids with oldest % active businesses', v_active_count;

        -- Get the oldest N active businesses (where N = current active count)
        SELECT ARRAY_AGG(id ORDER BY created_at ASC)
        INTO v_oldest_active_businesses
        FROM (
          SELECT id, created_at
          FROM businesses
          WHERE owner_user_id = p_user_id AND access_state = 'active'
          ORDER BY created_at ASC
        ) sub;

        UPDATE user_subscriptions
        SET selected_business_ids = to_jsonb(v_oldest_active_businesses)
        WHERE user_id = p_user_id;

        RAISE NOTICE '[Consistency Safeguard] Updated selected_business_ids to match active businesses (kept oldest)';
      ELSE
        RAISE NOTICE '[Consistency Safeguard] SCENARIO 3: Data is consistent, no changes needed';
      END IF;
    END;
  ELSE
    RAISE NOTICE '[Consistency Safeguard] selected_business_ids is empty and should stay empty (some businesses are read-only)';
  END IF;

  RAISE NOTICE '[Consistency Safeguard] Consistency check completed for user: %', p_user_id;
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION ensure_selected_business_ids_consistency(uuid) IS 'Ensures selected_business_ids remains consistent with actual business access states. Automatically fixes inconsistencies and logs detailed information for debugging.';
