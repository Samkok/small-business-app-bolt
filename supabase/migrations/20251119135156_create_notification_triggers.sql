/*
  # Create Notification Triggers

  1. Triggers Created
    - Sale created notification (notifies admins + owner when staff creates sale)
    - Sale voided notification (notifies admins + sale creator when sale is voided)
    - Role assignment notification (notifies user when assigned to business)

  2. Logic
    - Only send notifications to users who have them enabled in preferences
    - Don't notify the actor about their own actions
    - For sales: only notify admins and business owner
    - For void: notify admins and the original sale creator
    - For roles: notify the assigned user

  3. Functions
    - notify_sale_created() - creates notifications when sale is completed
    - notify_sale_voided() - creates notifications when sale is voided
    - notify_role_assigned() - creates notifications when role is assigned
*/

-- ============================================================================
-- FUNCTION: Notify when sale is created
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
          'total_amount', NEW.total_amount
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
    AND ubr.user_id != v_owner_user_id  -- Don't duplicate if owner is also admin
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
          'total_amount', NEW.total_amount
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- FUNCTION: Notify when sale is voided
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
  LEFT JOIN user_profiles up ON NEW.action_by = up.user_id
  LEFT JOIN businesses b ON s.business_id = b.id
  WHERE s.id = NEW.sale_id;

  v_voider_name := COALESCE(v_sale.voider_name, 'Unknown User');
  v_business_name := COALESCE(v_sale.business_name, 'Your Business');
  v_reason := COALESCE(NEW.reason, 'No reason provided');
  v_owner_user_id := v_sale.owner_user_id;

  -- Notify the original sale creator (if not the voider)
  IF v_sale.created_by IS NOT NULL AND v_sale.created_by != NEW.action_by THEN
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
          'total_amount', v_sale.total_amount
        )
      );
    END IF;
  END IF;

  -- Notify business owner (if not the voider or creator)
  IF v_owner_user_id IS NOT NULL 
     AND v_owner_user_id != NEW.action_by 
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
          'total_amount', v_sale.total_amount
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
    AND ubr.user_id != NEW.action_by
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
          'total_amount', v_sale.total_amount
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- FUNCTION: Notify when role is assigned
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_role_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_business_name text;
  v_preference RECORD;
BEGIN
  -- Get business name
  SELECT business_name INTO v_business_name
  FROM businesses
  WHERE id = NEW.business_id;

  v_business_name := COALESCE(v_business_name, 'a business');

  -- Check user preferences
  SELECT * INTO v_preference FROM notification_preferences WHERE user_id = NEW.user_id;
  
  IF v_preference IS NULL OR v_preference.role_assigned_enabled THEN
    INSERT INTO notifications (user_id, business_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      NEW.business_id,
      'role_assigned',
      'Role Assigned',
      'Congratulations! You have been assigned as ' || NEW.role || ' in ' || v_business_name,
      jsonb_build_object(
        'role', NEW.role,
        'business_name', v_business_name,
        'business_id', NEW.business_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger for sale creation
DROP TRIGGER IF EXISTS on_sale_created_notification ON sales;
CREATE TRIGGER on_sale_created_notification
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION notify_sale_created();

-- Trigger for sale voided
DROP TRIGGER IF EXISTS on_sale_voided_notification ON sale_actions;
CREATE TRIGGER on_sale_voided_notification
  AFTER INSERT ON sale_actions
  FOR EACH ROW
  EXECUTE FUNCTION notify_sale_voided();

-- Trigger for role assignment
DROP TRIGGER IF EXISTS on_role_assigned_notification ON user_business_roles;
CREATE TRIGGER on_role_assigned_notification
  AFTER INSERT ON user_business_roles
  FOR EACH ROW
  EXECUTE FUNCTION notify_role_assigned();