/*
  # Stock adjustments

  An immutable ledger of every manual stock change (damage, expiry, loss, samples,
  count corrections, found stock). Rows are never edited or deleted from the app:
  a mistake is reversed with an opposite entry, so the history always explains how
  current_stock got where it is.

  ## Table: stock_adjustments
  - quantity          signed change in base units (+ found, - lost)
  - quantity_entered  what the user typed, in the unit they chose (unit_id)
  - unit_cost         product cost per base unit at posting time (snapshot)
  - total_cost        quantity * unit_cost, signed; negative = write-off at cost
  - currency_id       the product's currency at posting time
  - stock_before/after  product.current_stock around the change
  - count_session_id  groups the rows posted by one stock count

  ## Functions
  - adjust_product_stock(...)  locks the product row, refuses to go below zero,
    inserts the ledger row, updates current_stock and writes a product_history
    row, all in one transaction. Owner or admin only; staff cannot post.
  - post_stock_count(...)      takes [{product_id, counted}] and posts a 'count'
    adjustment for every product whose counted quantity differs from the system.

  ## Security
  - RLS: members of the business can read. No insert/update/delete policies, so
    the only write path is the SECURITY DEFINER functions above.
*/

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity <> 0),
  quantity_entered numeric NOT NULL,
  reason text NOT NULL CHECK (reason IN ('damaged', 'expired', 'lost', 'sample', 'count', 'found', 'other')),
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES public.currencies(id) ON DELETE SET NULL,
  stock_before integer NOT NULL,
  stock_after integer NOT NULL CHECK (stock_after >= 0),
  notes text,
  count_session_id uuid,
  adjusted_by uuid REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
  adjusted_by_name text,
  adjustment_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_business_date ON public.stock_adjustments(business_id, adjustment_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product ON public.stock_adjustments(product_id, adjustment_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_session ON public.stock_adjustments(count_session_id) WHERE count_session_id IS NOT NULL;

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read stock adjustments" ON public.stock_adjustments;
CREATE POLICY "Members can read stock adjustments"
  ON public.stock_adjustments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_roles r
      WHERE r.business_id = stock_adjustments.business_id
        AND r.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.stock_adjustments TO authenticated;

-- Owner or admin of the business; staff may read but not post.
CREATE OR REPLACE FUNCTION public.can_adjust_stock(p_business_id uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_user_id = p_user
    UNION ALL
    SELECT 1 FROM public.user_business_roles WHERE business_id = p_business_id AND user_id = p_user AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.can_adjust_stock(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_adjust_stock(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reason text,
  p_unit_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_adjustment_date timestamptz DEFAULT now(),
  p_count_session_id uuid DEFAULT NULL
)
RETURNS public.stock_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_product record;
  v_factor integer := 1;
  v_base_qty integer;
  v_new_stock integer;
  v_unit_cost numeric;
  v_name text;
  v_row public.stock_adjustments;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.can_adjust_stock(p_business_id, v_caller) THEN
    RAISE EXCEPTION 'Only the business owner or an admin can adjust stock';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('damaged', 'expired', 'lost', 'sample', 'count', 'found', 'other') THEN
    RAISE EXCEPTION 'Unknown adjustment reason: %', p_reason;
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity must not be zero';
  END IF;

  -- Lock the product so concurrent sales and adjustments serialise
  SELECT id, business_id, current_stock, cost_per_unit, currency_id, unit_group_id
    INTO v_product
    FROM public.products
   WHERE id = p_product_id
   FOR UPDATE;

  IF v_product.id IS NULL OR v_product.business_id <> p_business_id THEN
    RAISE EXCEPTION 'Product not found in this business';
  END IF;

  IF p_unit_id IS NOT NULL THEN
    SELECT conversion_factor_to_base INTO v_factor
      FROM public.units
     WHERE id = p_unit_id AND unit_group_id = v_product.unit_group_id;
    IF v_factor IS NULL THEN
      RAISE EXCEPTION 'Unit does not belong to this product';
    END IF;
  END IF;

  v_base_qty := round(p_quantity * v_factor)::integer;
  IF v_base_qty = 0 THEN
    RAISE EXCEPTION 'Adjustment is smaller than one base unit';
  END IF;

  v_new_stock := COALESCE(v_product.current_stock, 0) + v_base_qty;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Adjustment would take stock below zero (have %, removing %)',
      COALESCE(v_product.current_stock, 0), -v_base_qty;
  END IF;

  v_unit_cost := COALESCE(v_product.cost_per_unit, 0);
  SELECT full_name INTO v_name FROM public.user_profiles WHERE user_id = v_caller;

  INSERT INTO public.stock_adjustments (
    business_id, product_id, unit_id, quantity, quantity_entered, reason,
    unit_cost, total_cost, currency_id, stock_before, stock_after,
    notes, count_session_id, adjusted_by, adjusted_by_name, adjustment_date
  ) VALUES (
    p_business_id, p_product_id, p_unit_id, v_base_qty, p_quantity, p_reason,
    v_unit_cost, v_base_qty * v_unit_cost, v_product.currency_id,
    COALESCE(v_product.current_stock, 0), v_new_stock,
    NULLIF(btrim(p_notes), ''), p_count_session_id, v_caller, v_name,
    COALESCE(p_adjustment_date, now())
  )
  RETURNING * INTO v_row;

  UPDATE public.products
     SET current_stock = v_new_stock, updated_at = now()
   WHERE id = p_product_id;

  INSERT INTO public.product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
  VALUES (p_product_id, v_caller, p_business_id, 'current_stock',
          COALESCE(v_product.current_stock, 0)::text, v_new_stock::text);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, uuid, numeric, text, uuid, text, timestamptz, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, uuid, numeric, text, uuid, text, timestamptz, uuid) TO authenticated;

-- p_items: [{"product_id": uuid, "counted": integer}] in base units.
-- Returns {session_id, adjusted, unchanged, units_lost, units_found, cost_lost, cost_found}.
CREATE OR REPLACE FUNCTION public.post_stock_count(
  p_business_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_count_date timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_session uuid := gen_random_uuid();
  v_item jsonb;
  v_product_id uuid;
  v_counted integer;
  v_current integer;
  v_delta integer;
  v_row public.stock_adjustments;
  v_adjusted integer := 0;
  v_unchanged integer := 0;
  v_units_lost integer := 0;
  v_units_found integer := 0;
  v_cost_lost numeric := 0;
  v_cost_found numeric := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.can_adjust_stock(p_business_id, v_caller) THEN
    RAISE EXCEPTION 'Only the business owner or an admin can post a stock count';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No counted items';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_counted := (v_item->>'counted')::integer;
    IF v_product_id IS NULL OR v_counted IS NULL OR v_counted < 0 THEN
      RAISE EXCEPTION 'Invalid count row: %', v_item;
    END IF;

    SELECT current_stock INTO v_current
      FROM public.products
     WHERE id = v_product_id AND business_id = p_business_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in this business', v_product_id;
    END IF;

    v_delta := v_counted - COALESCE(v_current, 0);
    IF v_delta = 0 THEN
      v_unchanged := v_unchanged + 1;
      CONTINUE;
    END IF;

    v_row := public.adjust_product_stock(
      p_business_id, v_product_id, v_delta, 'count', NULL, p_notes, p_count_date, v_session
    );
    v_adjusted := v_adjusted + 1;
    IF v_delta < 0 THEN
      v_units_lost := v_units_lost - v_delta;
      v_cost_lost := v_cost_lost - v_row.total_cost;
    ELSE
      v_units_found := v_units_found + v_delta;
      v_cost_found := v_cost_found + v_row.total_cost;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'session_id', v_session,
    'adjusted', v_adjusted,
    'unchanged', v_unchanged,
    'units_lost', v_units_lost,
    'units_found', v_units_found,
    'cost_lost', v_cost_lost,
    'cost_found', v_cost_found
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_stock_count(uuid, jsonb, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.post_stock_count(uuid, jsonb, text, timestamptz) TO authenticated;
