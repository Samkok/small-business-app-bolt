/*
  # Fix Security Definer Views and Function Search Paths

  ## Changes

  ### 1. Security Definer Views → Security Invoker
  Six views were defined with SECURITY DEFINER, meaning they executed as the view
  owner (postgres) regardless of who queried them. This allows privilege escalation —
  a low-privilege user could access data from underlying tables they normally cannot
  read. Switching to SECURITY INVOKER (the default) means the view runs with the
  permissions of the calling user.

  Views fixed:
  - recent_reconciliation_history
  - sales_count_discrepancies_view
  - user_sales_count_history_report
  - sales_count_dashboard_metrics
  - sales_count_accuracy_report
  - cron_job_history

  ### 2. Mutable search_path in Functions
  Functions without a fixed search_path are vulnerable to search_path injection:
  an attacker who can create objects in a schema on the search_path could shadow
  system functions. Adding SET search_path = public, pg_catalog locks each function
  to a safe, predictable path.

  Functions fixed:
  - increment_subscription_sync_version
  - update_cart_item_discount_amounts
  - populate_sale_creator_name
  - populate_cart_creator_name
  - populate_expense_creator_name
  - populate_batch_importer_name
  - calculate_item_discount (5-argument overload that was missing the setting)
*/

-- ============================================================
-- Fix Security Definer Views
-- ============================================================
ALTER VIEW recent_reconciliation_history SET (security_invoker = on);
ALTER VIEW sales_count_discrepancies_view SET (security_invoker = on);
ALTER VIEW user_sales_count_history_report SET (security_invoker = on);
ALTER VIEW sales_count_dashboard_metrics SET (security_invoker = on);
ALTER VIEW sales_count_accuracy_report SET (security_invoker = on);
ALTER VIEW cron_job_history SET (security_invoker = on);

-- ============================================================
-- Fix mutable search_path: increment_subscription_sync_version
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_subscription_sync_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.sync_version = OLD.sync_version + 1;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix mutable search_path: update_cart_item_discount_amounts
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_cart_item_discount_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.original_subtotal := NEW.quantity * NEW.unit_price;

  NEW.item_discount_amount := calculate_item_discount(
    NEW.quantity,
    NEW.unit_price,
    NEW.item_discount_type,
    NEW.item_discount_value,
    COALESCE(NEW.item_discount_scope, 'total')
  );

  NEW.subtotal := NEW.original_subtotal - NEW.item_discount_amount;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix mutable search_path: populate_sale_creator_name
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_sale_creator_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.created_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix mutable search_path: populate_cart_creator_name
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_cart_creator_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.created_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix mutable search_path: populate_expense_creator_name
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_expense_creator_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.created_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix mutable search_path: populate_batch_importer_name
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_batch_importer_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.imported_by IS NOT NULL THEN
    SELECT COALESCE(up.full_name, up.email, 'Unknown User')
    INTO NEW.imported_by_name
    FROM public.user_profiles up
    WHERE up.user_id = NEW.imported_by;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix mutable search_path: calculate_item_discount (5-arg overload)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_item_discount(
  quantity integer,
  unit_price numeric,
  discount_type text,
  discount_value numeric,
  discount_scope text DEFAULT 'total'::text
)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  original_subtotal numeric;
  discount_amount numeric;
  effective_scope text;
BEGIN
  original_subtotal := quantity * unit_price;

  IF discount_type IS NULL OR discount_value IS NULL OR discount_value = 0 THEN
    RETURN 0;
  END IF;

  effective_scope := COALESCE(discount_scope, 'total');
  IF effective_scope NOT IN ('per_unit', 'total') THEN
    effective_scope := 'total';
  END IF;

  IF discount_type = 'percentage' THEN
    IF effective_scope = 'per_unit' THEN
      discount_amount := (unit_price * (discount_value / 100)) * quantity;
    ELSE
      discount_amount := original_subtotal * (discount_value / 100);
    END IF;
  ELSIF discount_type = 'fixed' THEN
    IF effective_scope = 'per_unit' THEN
      discount_amount := LEAST(discount_value, unit_price) * quantity;
    ELSE
      discount_amount := LEAST(discount_value, original_subtotal);
    END IF;
  ELSE
    discount_amount := 0;
  END IF;

  RETURN GREATEST(0, discount_amount);
END;
$$;
