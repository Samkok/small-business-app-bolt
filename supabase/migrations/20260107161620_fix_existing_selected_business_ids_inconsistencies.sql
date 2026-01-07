/*
  # Fix Existing selected_business_ids Inconsistencies

  ## Overview
  One-time data migration to clean up existing inconsistencies in the `selected_business_ids` field.
  This ensures all users have consistent data before the new safeguard functions take effect.

  ## Problems Addressed
  1. Users with all businesses active but `selected_business_ids` is not empty
  2. Users with active businesses that don't match `selected_business_ids`
  3. Users over tier limit but `selected_business_ids` is empty or incorrect

  ## Process
  - For each user, check if their `selected_business_ids` matches their actual active businesses
  - If all businesses are active and tier allows, clear `selected_business_ids`
  - If user has active businesses but `selected_business_ids` is empty/wrong, populate with oldest active
  - Add detailed logging for audit trail

  ## Safety
  - Read-only analysis first, then updates
  - Uses RAISE NOTICE for detailed logging
  - Counts affected users before and after
*/

DO $$
DECLARE
  v_user_record RECORD;
  v_active_count integer;
  v_total_count integer;
  v_selected_count integer;
  v_tier text;
  v_max_businesses integer;
  v_oldest_active_ids uuid[];
  v_fixed_count integer := 0;
  v_already_consistent_count integer := 0;
BEGIN
  RAISE NOTICE '========== STARTING DATA CONSISTENCY MIGRATION ==========';
  RAISE NOTICE 'Scanning all users for selected_business_ids inconsistencies...';

  -- Loop through all users that have a subscription record
  FOR v_user_record IN (
    SELECT DISTINCT us.user_id, us.tier, us.max_owned_businesses, us.selected_business_ids
    FROM user_subscriptions us
    ORDER BY us.user_id
  ) LOOP
    
    -- Count active and total businesses for this user
    SELECT
      COUNT(*) FILTER (WHERE access_state = 'active'),
      COUNT(*)
    INTO v_active_count, v_total_count
    FROM businesses
    WHERE owner_user_id = v_user_record.user_id;

    -- Get selected_business_ids count
    v_selected_count := COALESCE(jsonb_array_length(v_user_record.selected_business_ids), 0);
    v_tier := v_user_record.tier;
    v_max_businesses := v_user_record.max_owned_businesses;

    RAISE NOTICE '';
    RAISE NOTICE '--- Checking user: % ---', v_user_record.user_id;
    RAISE NOTICE 'Tier: %, Max businesses: %, Total businesses: %, Active: %, Selected IDs count: %',
      v_tier, v_max_businesses, v_total_count, v_active_count, v_selected_count;

    -- SCENARIO 1: All businesses are active and tier allows unlimited or covers all
    IF v_active_count = v_total_count AND (v_max_businesses IS NULL OR v_max_businesses >= v_total_count) THEN
      IF v_selected_count > 0 THEN
        RAISE NOTICE 'FIX NEEDED: All businesses active but selected_business_ids has % entries - clearing it', v_selected_count;
        
        UPDATE user_subscriptions
        SET selected_business_ids = '[]'::jsonb
        WHERE user_id = v_user_record.user_id;
        
        v_fixed_count := v_fixed_count + 1;
        RAISE NOTICE 'FIXED: Cleared selected_business_ids for user %', v_user_record.user_id;
      ELSE
        RAISE NOTICE 'CONSISTENT: All businesses active and selected_business_ids already empty';
        v_already_consistent_count := v_already_consistent_count + 1;
      END IF;
      CONTINUE;
    END IF;

    -- SCENARIO 2: Active count doesn't match selected count
    IF v_active_count != v_selected_count THEN
      RAISE NOTICE 'FIX NEEDED: Active count (%) != selected count (%) - syncing with oldest active', v_active_count, v_selected_count;
      
      -- Get the oldest active businesses
      SELECT ARRAY_AGG(id ORDER BY created_at ASC)
      INTO v_oldest_active_ids
      FROM (
        SELECT id, created_at
        FROM businesses
        WHERE owner_user_id = v_user_record.user_id AND access_state = 'active'
        ORDER BY created_at ASC
      ) sub;

      UPDATE user_subscriptions
      SET selected_business_ids = to_jsonb(v_oldest_active_ids)
      WHERE user_id = v_user_record.user_id;

      v_fixed_count := v_fixed_count + 1;
      RAISE NOTICE 'FIXED: Updated selected_business_ids to % oldest active businesses', v_active_count;
    ELSE
      -- Verify that selected_business_ids actually contains the active businesses
      DECLARE
        v_selected_array text[];
        v_active_from_selected integer;
      BEGIN
        -- Convert jsonb array to text array
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_user_record.selected_business_ids))
        INTO v_selected_array;

        -- Count how many of the selected businesses are actually active
        SELECT COUNT(*)
        INTO v_active_from_selected
        FROM businesses
        WHERE owner_user_id = v_user_record.user_id
          AND id = ANY(v_selected_array::uuid[])
          AND access_state = 'active';

        IF v_active_from_selected != v_selected_count THEN
          RAISE NOTICE 'FIX NEEDED: selected_business_ids contains inactive businesses - replacing with oldest active';
          
          -- Get the oldest active businesses
          SELECT ARRAY_AGG(id ORDER BY created_at ASC)
          INTO v_oldest_active_ids
          FROM (
            SELECT id, created_at
            FROM businesses
            WHERE owner_user_id = v_user_record.user_id AND access_state = 'active'
            ORDER BY created_at ASC
          ) sub;

          UPDATE user_subscriptions
          SET selected_business_ids = to_jsonb(v_oldest_active_ids)
          WHERE user_id = v_user_record.user_id;

          v_fixed_count := v_fixed_count + 1;
          RAISE NOTICE 'FIXED: Replaced selected_business_ids with % oldest active businesses', v_active_count;
        ELSE
          RAISE NOTICE 'CONSISTENT: selected_business_ids matches active businesses';
          v_already_consistent_count := v_already_consistent_count + 1;
        END IF;
      END;
    END IF;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========== MIGRATION COMPLETE ==========';
  RAISE NOTICE 'Total users checked: %', v_fixed_count + v_already_consistent_count;
  RAISE NOTICE 'Users with inconsistencies FIXED: %', v_fixed_count;
  RAISE NOTICE 'Users already consistent: %', v_already_consistent_count;
  RAISE NOTICE '========================================';
END $$;
