/*
# Edit or delete a stock adjustment

The adjustment ledger was append-only: a mistake had to be reversed with an opposite entry.
The owner wants to tap a record and correct it or remove it, with the stock put back.

Both actions stay atomic and auditable:
  - update_stock_adjustment(): re-computes the base quantity, applies only the DIFFERENCE to
    products.current_stock (refusing to go below zero), rewrites the ledger row and its cost.
  - delete_stock_adjustment(): takes the adjustment's quantity back out of current_stock
    (refusing to go below zero) and removes the row, so write-offs disappear from the statements.
  - Every edit and delete is copied to stock_adjustment_changes (the row before, the row after,
    who, when) and the stock movement is written to product_history, so "there is a record for
    every change to stock" still holds.

unit_cost on the row stays the snapshot taken when the adjustment was first posted, so an edit
changes the quantity written off, not the cost per unit it was valued at.
Owner or admin only (can_adjust_stock), same as posting. No anon access.
*/

CREATE TABLE IF NOT EXISTS public.stock_adjustment_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('edited', 'deleted')),
  old_row jsonb NOT NULL,
  new_row jsonb,
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_changes_business ON public.stock_adjustment_changes(business_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_changes_adjustment ON public.stock_adjustment_changes(adjustment_id);

ALTER TABLE public.stock_adjustment_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read stock adjustment changes" ON public.stock_adjustment_changes;
CREATE POLICY "Members can read stock adjustment changes"
  ON public.stock_adjustment_changes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_roles r
      WHERE r.business_id = stock_adjustment_changes.business_id
        AND r.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.stock_adjustment_changes FROM anon, authenticated;
GRANT SELECT ON public.stock_adjustment_changes TO authenticated;

CREATE OR REPLACE FUNCTION public.update_stock_adjustment(
  p_adjustment_id uuid,
  p_quantity numeric,
  p_reason text,
  p_unit_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.stock_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_old public.stock_adjustments;
  v_new public.stock_adjustments;
  v_product record;
  v_factor integer := 1;
  v_base_qty integer;
  v_current integer;
  v_new_stock integer;
  v_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old FROM public.stock_adjustments WHERE id = p_adjustment_id FOR UPDATE;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Adjustment not found';
  END IF;
  IF NOT public.can_adjust_stock(v_old.business_id, v_caller) THEN
    RAISE EXCEPTION 'Only the business owner or an admin can change a stock adjustment' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('damaged', 'expired', 'lost', 'sample', 'count', 'found', 'other') THEN
    RAISE EXCEPTION 'Unknown adjustment reason: %', p_reason;
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity must not be zero';
  END IF;

  -- Lock the product so concurrent sales and adjustments serialise
  SELECT id, current_stock, unit_group_id INTO v_product
    FROM public.products WHERE id = v_old.product_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF p_unit_id IS NOT NULL THEN
    SELECT conversion_factor_to_base INTO v_factor
      FROM public.units WHERE id = p_unit_id AND unit_group_id = v_product.unit_group_id;
    IF v_factor IS NULL THEN
      RAISE EXCEPTION 'Unit does not belong to this product';
    END IF;
  END IF;

  v_base_qty := round(p_quantity * v_factor)::integer;
  IF v_base_qty = 0 THEN
    RAISE EXCEPTION 'Adjustment is smaller than one base unit';
  END IF;

  v_current := COALESCE(v_product.current_stock, 0);
  -- take the old adjustment back out, put the corrected one in
  v_new_stock := v_current - v_old.quantity + v_base_qty;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'This change would take stock below zero (have %, would become %)', v_current, v_new_stock;
  END IF;

  SELECT full_name INTO v_name FROM public.user_profiles WHERE user_id = v_caller;

  UPDATE public.stock_adjustments
     SET quantity = v_base_qty,
         quantity_entered = p_quantity,
         unit_id = p_unit_id,
         reason = p_reason,
         notes = NULLIF(btrim(p_notes), ''),
         total_cost = v_base_qty * unit_cost,
         -- when the quantity changes, the snapshot is restated against today's stock
         stock_before = CASE WHEN v_base_qty = v_old.quantity THEN stock_before ELSE GREATEST(0, v_new_stock - v_base_qty) END,
         stock_after  = CASE WHEN v_base_qty = v_old.quantity THEN stock_after  ELSE v_new_stock END
   WHERE id = p_adjustment_id
   RETURNING * INTO v_new;

  IF v_new_stock <> v_current THEN
    UPDATE public.products SET current_stock = v_new_stock, updated_at = now() WHERE id = v_old.product_id;
    INSERT INTO public.product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
    VALUES (v_old.product_id, v_caller, v_old.business_id, 'current_stock', v_current::text, v_new_stock::text);
  END IF;

  INSERT INTO public.stock_adjustment_changes
    (adjustment_id, business_id, product_id, action, old_row, new_row, stock_before, stock_after, changed_by, changed_by_name)
  VALUES
    (v_old.id, v_old.business_id, v_old.product_id, 'edited', to_jsonb(v_old), to_jsonb(v_new), v_current, v_new_stock, v_caller, v_name);

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_stock_adjustment(p_adjustment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_old public.stock_adjustments;
  v_product record;
  v_current integer;
  v_new_stock integer;
  v_name text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old FROM public.stock_adjustments WHERE id = p_adjustment_id FOR UPDATE;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Adjustment not found';
  END IF;
  IF NOT public.can_adjust_stock(v_old.business_id, v_caller) THEN
    RAISE EXCEPTION 'Only the business owner or an admin can delete a stock adjustment' USING ERRCODE = '42501';
  END IF;

  SELECT id, current_stock INTO v_product FROM public.products WHERE id = v_old.product_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_current := COALESCE(v_product.current_stock, 0);
  v_new_stock := v_current - v_old.quantity;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Deleting this would take stock below zero (have %, the adjustment added %)', v_current, v_old.quantity;
  END IF;

  SELECT full_name INTO v_name FROM public.user_profiles WHERE user_id = v_caller;

  INSERT INTO public.stock_adjustment_changes
    (adjustment_id, business_id, product_id, action, old_row, new_row, stock_before, stock_after, changed_by, changed_by_name)
  VALUES
    (v_old.id, v_old.business_id, v_old.product_id, 'deleted', to_jsonb(v_old), NULL, v_current, v_new_stock, v_caller, v_name);

  DELETE FROM public.stock_adjustments WHERE id = p_adjustment_id;

  UPDATE public.products SET current_stock = v_new_stock, updated_at = now() WHERE id = v_old.product_id;
  INSERT INTO public.product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
  VALUES (v_old.product_id, v_caller, v_old.business_id, 'current_stock', v_current::text, v_new_stock::text);

  RETURN jsonb_build_object('id', v_old.id, 'product_id', v_old.product_id, 'stock_before', v_current, 'stock_after', v_new_stock);
END;
$$;

-- Supabase grants EXECUTE on new functions to anon by default: take it away explicitly
REVOKE ALL ON FUNCTION public.update_stock_adjustment(uuid, numeric, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_stock_adjustment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_stock_adjustment(uuid, numeric, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_stock_adjustment(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
