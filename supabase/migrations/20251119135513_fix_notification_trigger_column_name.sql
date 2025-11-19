/*
  # Fix Notification Trigger Column Name

  1. Issue
    - The sale_actions table uses `performed_by` column
    - The notification trigger was referencing `action_by` column
    
  2. Fix
    - Update notify_sale_voided() function to use correct column name `performed_by`
*/

-- Update the function to use the correct column name
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
  LEFT JOIN user_profiles up ON NEW.performed_by = up.user_id
  LEFT JOIN businesses b ON s.business_id = b.id
  WHERE s.id = NEW.sale_id;

  v_voider_name := COALESCE(v_sale.voider_name, 'Unknown User');
  v_business_name := COALESCE(v_sale.business_name, 'Your Business');
  v_reason := COALESCE(NEW.reason, 'No reason provided');
  v_owner_user_id := v_sale.owner_user_id;

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
          'total_amount', v_sale.total_amount
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
          'total_amount', v_sale.total_amount
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;