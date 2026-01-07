/*
  # Create Automatic Sales Count Triggers

  ## Overview
  This migration creates triggers to automatically manage sales counts:
  1. Auto-increment trigger: When a sale is created, automatically increment the user's sales count
  2. Audit trigger: When sales count is updated, log the change to audit history
  3. Update get_or_create_sales_count to count ALL sales regardless of status

  ## New Functions
  
  ### auto_increment_sales_count()
  - Triggered AFTER INSERT on sales table
  - Automatically upserts user_sales_counts for the sale creator
  - Handles cases where count record doesn't exist yet
  
  ### log_sales_count_change()
  - Triggered AFTER UPDATE on user_sales_counts table
  - Logs all changes to user_sales_count_history
  - Captures old_count, new_count, and metadata

  ### Updated: get_or_create_sales_count()
  - Now counts ALL sales regardless of status (completed, voided, partially_returned)
  - Simplifies logic to count every sale as 1 sale

  ## Security
  - Functions run with SECURITY DEFINER to bypass RLS during automated operations
  - Only triggered by database events, not callable directly by users
*/

-- Update get_or_create_sales_count to count ALL sales regardless of status
CREATE OR REPLACE FUNCTION get_or_create_sales_count(p_user_id uuid, p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_actual_count integer;
BEGIN
  -- Get the cached count from user_sales_counts
  SELECT sales_count INTO v_count
  FROM user_sales_counts
  WHERE user_id = p_user_id AND business_id = p_business_id;

  -- If record doesn't exist, create it with actual count
  IF v_count IS NULL THEN
    -- Count ALL sales created by this user for this business (regardless of status)
    SELECT COUNT(*)::integer INTO v_actual_count
    FROM sales
    WHERE created_by = p_user_id 
    AND business_id = p_business_id;

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

-- Function to automatically increment sales count when a sale is created
CREATE OR REPLACE FUNCTION auto_increment_sales_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_count integer;
  v_new_count integer;
BEGIN
  -- Upsert the sales count (increment by 1)
  INSERT INTO user_sales_counts (user_id, business_id, sales_count)
  VALUES (NEW.created_by, NEW.business_id, 1)
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
    NEW.created_by,
    NEW.business_id,
    v_old_count,
    v_new_count,
    'new_sale',
    NEW.id,
    'increment',
    jsonb_build_object(
      'sale_id', NEW.id,
      'sale_status', NEW.status,
      'total_amount', NEW.total_amount
    )
  );

  RETURN NEW;
END;
$$;

-- Function to log all changes to user_sales_counts
CREATE OR REPLACE FUNCTION log_sales_count_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if the sales_count actually changed
  IF OLD.sales_count != NEW.sales_count THEN
    -- This will capture reconciliation corrections and manual adjustments
    -- (new_sale increments are logged by auto_increment_sales_count)
    -- Only log if not already logged by the auto_increment trigger
    IF NOT EXISTS (
      SELECT 1 FROM user_sales_count_history
      WHERE user_id = NEW.user_id
      AND business_id = NEW.business_id
      AND old_count = OLD.sales_count
      AND new_count = NEW.sales_count
      AND changed_at > now() - interval '1 second'
    ) THEN
      INSERT INTO user_sales_count_history (
        user_id,
        business_id,
        old_count,
        new_count,
        change_reason,
        action_type,
        metadata
      ) VALUES (
        NEW.user_id,
        NEW.business_id,
        OLD.sales_count,
        NEW.sales_count,
        CASE 
          WHEN NEW.sales_count > OLD.sales_count THEN 'manual_adjustment'
          ELSE 'reconciliation_correction'
        END,
        CASE 
          WHEN NEW.sales_count > OLD.sales_count THEN 'adjustment'
          ELSE 'correction'
        END,
        jsonb_build_object(
          'change_type', CASE 
            WHEN NEW.sales_count > OLD.sales_count THEN 'increase'
            ELSE 'decrease'
          END,
          'difference', NEW.sales_count - OLD.sales_count
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic sales count increment on sale creation
DROP TRIGGER IF EXISTS trigger_auto_increment_sales_count ON sales;
CREATE TRIGGER trigger_auto_increment_sales_count
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_sales_count();

-- Create trigger for logging sales count changes
DROP TRIGGER IF EXISTS trigger_log_sales_count_change ON user_sales_counts;
CREATE TRIGGER trigger_log_sales_count_change
  AFTER UPDATE ON user_sales_counts
  FOR EACH ROW
  EXECUTE FUNCTION log_sales_count_change();