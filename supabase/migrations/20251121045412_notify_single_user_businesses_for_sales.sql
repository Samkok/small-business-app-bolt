/*
  # Notify Single-User Businesses for Sales

  1. Problem
    - In single-person businesses, the owner doesn't receive notifications when they create/void sales
    - This means they never see any sale notifications in their notification center
    - Makes testing difficult and provides no audit trail for solo business owners

  2. Solution
    - Modify notify_sale_created() to send notification to creator if they are the only admin/owner
    - Modify notify_sale_voided() to send notification to voider if they are the only admin/owner
    - This provides an audit log and improves user experience for solo businesses

  3. Logic
    - Count total potential recipients (owner + admins excluding creator/voider)
    - If count is 0, send notification to the creator/voider themselves
    - Otherwise, keep existing behavior (don't notify yourself)
*/

-- ============================================================================
-- FUNCTION: Notify when sale is created (with single-user business support)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_sale_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_sale RECORD;
  v_customer_name text;
  v_creator_name text;
  v_business_name text;
  v_admin_user RECORD;
  v_owner_user_id uuid;
  v_preference RECORD;
  v_recipient_count integer;
BEGIN
  -- Only process completed sales
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get sale details with customer and creator info
  SELECT
    s.*,
    c.name as customer_name,
    up.full_name as creator_name,
    b.business_name,
    b.owner_user_id
  INTO v_sale
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN user_profiles up ON s.created_by = up.user_id
  LEFT JOIN businesses b ON s.business_id = b.id
  WHERE s.id = NEW.id;

  v_customer_name := COALESCE(v_sale.customer_name, 'Guest');
  v_creator_name := COALESCE(v_sale.creator_name, 'Unknown User');
  v_business_name := COALESCE(v_sale.business_name, 'Your Business');
  v_owner_user_id := v_sale.owner_user_id;

  -- Count potential recipients (owner + admins, excluding creator)
  SELECT COUNT(DISTINCT user_id) INTO v_recipient_count
  FROM (
    -- Owner (if different from creator)
    SELECT v_owner_user_id as user_id
    WHERE v_owner_user_id IS NOT NULL AND v_owner_user_id != NEW.created_by
    UNION
    -- Admins (excluding creator)
    SELECT ubr.user_id
    FROM user_business_roles ubr
    WHERE ubr.business_id = NEW.business_id
    AND ubr.role = 'admin'
    AND ubr.user_id != NEW.created_by
  ) recipients;

  -- If no other recipients, notify the creator (single-user business scenario)
  IF v_recipient_count = 0 THEN
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = NEW.created_by;

    IF v_preference IS NULL OR v_preference.sales_created_enabled THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        NEW.created_by,
        NEW.business_id,
        'sale_created',
        'New Sale Created',
        'In ' || v_business_name || ', you just created a new sale for ' || v_customer_name,
        jsonb_build_object(
          'sale_id', NEW.id,
          'customer_name', v_customer_name,
          'creator_name', v_creator_name,
          'total_amount', NEW.total_amount,
          'business_id', NEW.business_id,
          'business_name', v_business_name
        )
      );
    END IF;
    
    RETURN NEW;
  END IF;

  -- Otherwise, notify owner and admins (excluding creator)
  -- Notify business owner (if not the creator)
  IF v_owner_user_id IS NOT NULL AND v_owner_user_id != NEW.created_by THEN
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = v_owner_user_id;

    IF v_preference IS NULL OR v_preference.sales_created_enabled THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        v_owner_user_id,
        NEW.business_id,
        'sale_created',
        'New Sale Created',
        'In ' || v_business_name || ', ' || v_creator_name || ' just created a new sale for ' || v_customer_name,
        jsonb_build_object(
          'sale_id', NEW.id,
          'customer_name', v_customer_name,
          'creator_name', v_creator_name,
          'total_amount', NEW.total_amount,
          'business_id', NEW.business_id,
          'business_name', v_business_name
        )
      );
    END IF;
  END IF;

  -- Notify all admins (excluding the creator)
  FOR v_admin_user IN
    SELECT DISTINCT ubr.user_id
    FROM user_business_roles ubr
    WHERE ubr.business_id = NEW.business_id
    AND ubr.role = 'admin'
    AND ubr.user_id != NEW.created_by
    AND ubr.user_id != v_owner_user_id
  LOOP
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = v_admin_user.user_id;

    IF v_preference IS NULL OR v_preference.sales_created_enabled THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        v_admin_user.user_id,
        NEW.business_id,
        'sale_created',
        'New Sale Created',
        'In ' || v_business_name || ', ' || v_creator_name || ' just created a new sale for ' || v_customer_name,
        jsonb_build_object(
          'sale_id', NEW.id,
          'customer_name', v_customer_name,
          'creator_name', v_creator_name,
          'total_amount', NEW.total_amount,
          'business_id', NEW.business_id,
          'business_name', v_business_name
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- FUNCTION: Notify when sale is voided (with single-user business support)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_sale_voided()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_sale RECORD;
  v_voider_name text;
  v_business_name text;
  v_reason text;
  v_admin_user RECORD;
  v_owner_user_id uuid;
  v_preference RECORD;
  v_recipient_count integer;
BEGIN
  -- Only process void actions
  IF NEW.action_type != 'void' THEN
    RETURN NEW;
  END IF;

  -- Get sale and voider details
  SELECT
    s.*,
    up.full_name as voider_name,
    b.business_name,
    b.owner_user_id
  INTO v_sale
  FROM sales s
  LEFT JOIN user_profiles up ON NEW.performed_by = up.user_id
  LEFT JOIN businesses b ON s.business_id = b.id
  WHERE s.id = NEW.sale_id;

  v_voider_name := COALESCE(v_sale.voider_name, 'Unknown User');
  v_business_name := COALESCE(v_sale.business_name, 'Your Business');
  v_reason := COALESCE(NEW.reason, 'No reason provided');
  v_owner_user_id := v_sale.owner_user_id;

  -- Count potential recipients (creator + owner + admins, excluding voider)
  SELECT COUNT(DISTINCT user_id) INTO v_recipient_count
  FROM (
    -- Creator (if different from voider)
    SELECT v_sale.created_by as user_id
    WHERE v_sale.created_by IS NOT NULL AND v_sale.created_by != NEW.performed_by
    UNION
    -- Owner (if different from voider and creator)
    SELECT v_owner_user_id as user_id
    WHERE v_owner_user_id IS NOT NULL 
    AND v_owner_user_id != NEW.performed_by
    AND v_owner_user_id != v_sale.created_by
    UNION
    -- Admins (excluding voider and creator)
    SELECT ubr.user_id
    FROM user_business_roles ubr
    WHERE ubr.business_id = v_sale.business_id
    AND ubr.role = 'admin'
    AND ubr.user_id != NEW.performed_by
    AND ubr.user_id != v_sale.created_by
    AND ubr.user_id != v_owner_user_id
  ) recipients;

  -- If no other recipients, notify the voider (single-user business scenario)
  IF v_recipient_count = 0 THEN
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = NEW.performed_by;

    IF v_preference IS NULL OR v_preference.sales_voided_enabled THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        NEW.performed_by,
        v_sale.business_id,
        'sale_voided',
        'Sale Voided',
        'In ' || v_business_name || ', you just voided a sale for reason: ' || v_reason,
        jsonb_build_object(
          'sale_id', NEW.sale_id,
          'voider_name', v_voider_name,
          'reason', v_reason,
          'total_amount', v_sale.total_amount,
          'business_id', v_sale.business_id,
          'business_name', v_business_name
        )
      );
    END IF;
    
    RETURN NEW;
  END IF;

  -- Otherwise, notify creator, owner, and admins (excluding voider)
  -- Notify the original sale creator (if not the voider)
  IF v_sale.created_by IS NOT NULL AND v_sale.created_by != NEW.performed_by THEN
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = v_sale.created_by;

    IF v_preference IS NULL OR v_preference.sales_voided_enabled THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        v_sale.created_by,
        v_sale.business_id,
        'sale_voided',
        'Sale Voided',
        'In ' || v_business_name || ', ' || v_voider_name || ' just voided a sale for reason: ' || v_reason,
        jsonb_build_object(
          'sale_id', NEW.sale_id,
          'voider_name', v_voider_name,
          'reason', v_reason,
          'total_amount', v_sale.total_amount,
          'business_id', v_sale.business_id,
          'business_name', v_business_name
        )
      );
    END IF;
  END IF;

  -- Notify business owner (if not the voider or creator)
  IF v_owner_user_id IS NOT NULL
     AND v_owner_user_id != NEW.performed_by
     AND v_owner_user_id != v_sale.created_by THEN
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = v_owner_user_id;

    IF v_preference IS NULL OR v_preference.sales_voided_enabled THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        v_owner_user_id,
        v_sale.business_id,
        'sale_voided',
        'Sale Voided',
        'In ' || v_business_name || ', ' || v_voider_name || ' just voided a sale for reason: ' || v_reason,
        jsonb_build_object(
          'sale_id', NEW.sale_id,
          'voider_name', v_voider_name,
          'reason', v_reason,
          'total_amount', v_sale.total_amount,
          'business_id', v_sale.business_id,
          'business_name', v_business_name
        )
      );
    END IF;
  END IF;

  -- Notify all admins (excluding voider and creator)
  FOR v_admin_user IN
    SELECT DISTINCT ubr.user_id
    FROM user_business_roles ubr
    WHERE ubr.business_id = v_sale.business_id
    AND ubr.role = 'admin'
    AND ubr.user_id != NEW.performed_by
    AND ubr.user_id != v_sale.created_by
    AND ubr.user_id != v_owner_user_id
  LOOP
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = v_admin_user.user_id;

    IF v_preference IS NULL OR v_preference.sales_voided_enabled THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        v_admin_user.user_id,
        v_sale.business_id,
        'sale_voided',
        'Sale Voided',
        'In ' || v_business_name || ', ' || v_voider_name || ' just voided a sale for reason: ' || v_reason,
        jsonb_build_object(
          'sale_id', NEW.sale_id,
          'voider_name', v_voider_name,
          'reason', v_reason,
          'total_amount', v_sale.total_amount,
          'business_id', v_sale.business_id,
          'business_name', v_business_name
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;