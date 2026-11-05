-- P0 integrity fixes from docs/business-logic-standards-review.md section 9.
-- Applied live on 2026-11-05 through the Supabase MCP (see the live version in
-- supabase_migrations.schema_migrations; it differs from this file name). Do not re-apply.
--
-- 1. complete_sale_atomic recomputes every money field from cart_details_with_discounts inside
--    the transaction (the client values are ignored), checks that the customer and currency
--    belong to the business, refuses an empty cart and bounds the sale date.
-- 2. record_sale_action: void and return are one transaction (cumulative return cap, stock
--    restore, sale_actions row, status) and a sale with returns can no longer be voided.
-- 3. receive_inventory_batch: a batch arrival is one transaction, lines matched by id.

-- 1. complete_sale_atomic ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_sale_atomic(p_cart_id uuid, p_customer_id uuid, p_business_id uuid, p_total_amount numeric, p_payment_method text, p_sale_date timestamp with time zone DEFAULT now(), p_notes text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid, p_sale_discount_type text DEFAULT NULL::text, p_sale_discount_value numeric DEFAULT NULL::numeric, p_sale_discount_amount numeric DEFAULT NULL::numeric, p_subtotal_before_discount numeric DEFAULT NULL::numeric, p_delivery_cost numeric DEFAULT NULL::numeric, p_currency_id uuid DEFAULT NULL::uuid, p_exchange_rate_at_sale numeric DEFAULT 1, p_payment_status text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_sale_id uuid;
v_cart_status text;
v_item record;
v_conversion_factor integer;
v_base_quantity integer;
v_rows_updated integer;
v_created_by_name text;
v_caller uuid;
v_totals record;
v_sale_date timestamptz;
BEGIN
v_caller := auth.uid();

IF v_caller IS NULL AND COALESCE(auth.role(), '') = 'anon' THEN
RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
END IF;

IF v_caller IS NOT NULL THEN
IF p_created_by IS NOT NULL AND p_created_by != v_caller THEN
RAISE EXCEPTION 'Cannot create a sale on behalf of another user';
END IF;

IF NOT EXISTS (
SELECT 1 FROM businesses WHERE id = p_business_id AND owner_user_id = v_caller
UNION ALL
SELECT 1 FROM user_business_roles WHERE business_id = p_business_id AND user_id = v_caller
) THEN
RAISE EXCEPTION 'You are not a member of this business';
END IF;
END IF;

IF p_payment_status IS NOT NULL AND p_payment_status NOT IN ('paid', 'cod') THEN
RAISE EXCEPTION 'Unknown payment status: %', p_payment_status;
END IF;

-- The customer and the currency must belong to the same business as the sale
IF p_customer_id IS NOT NULL AND NOT EXISTS (
SELECT 1 FROM customers WHERE id = p_customer_id AND business_id = p_business_id
) THEN
RAISE EXCEPTION 'Customer not found in this business';
END IF;
IF p_currency_id IS NOT NULL AND NOT EXISTS (
SELECT 1 FROM currencies WHERE id = p_currency_id AND business_id = p_business_id
) THEN
RAISE EXCEPTION 'Currency not found in this business';
END IF;

-- Backdating is allowed within a year; the future is not
v_sale_date := COALESCE(p_sale_date, now());
IF v_sale_date > now() + interval '5 minutes' OR v_sale_date < now() - interval '366 days' THEN
RAISE EXCEPTION 'Sale date must be within the last year and not in the future';
END IF;

-- The cart must belong to the business the caller was checked against
SELECT status INTO v_cart_status
FROM carts
WHERE id = p_cart_id AND business_id = p_business_id
FOR UPDATE;

IF v_cart_status IS NULL THEN
RAISE EXCEPTION 'Cart not found: %', p_cart_id;
END IF;

IF v_cart_status = 'completed' THEN
SELECT id INTO v_sale_id FROM sales WHERE cart_id = p_cart_id LIMIT 1;
RETURN v_sale_id;
END IF;

IF NOT EXISTS (SELECT 1 FROM cart_items WHERE cart_id = p_cart_id) THEN
RAISE EXCEPTION 'Cart is empty';
END IF;

-- Money comes from the server-side view, never from the caller
SELECT d.items_original_total, d.cart_discount_type, d.cart_discount_value,
       d.cart_discount_amount, d.delivery_cost, d.final_total
INTO v_totals
FROM cart_details_with_discounts d
WHERE d.cart_id = p_cart_id;
IF v_totals.final_total IS NULL THEN
RAISE EXCEPTION 'Cart totals unavailable';
END IF;

SELECT full_name INTO v_created_by_name
FROM user_profiles WHERE user_id = p_created_by;

INSERT INTO sales (
id, cart_id, customer_id, business_id, total_amount,
payment_method, status, sale_date, notes, created_by, created_by_name,
created_by_business_id, sale_discount_type, sale_discount_value,
sale_discount_amount, subtotal_before_discount, delivery_cost,
currency_id, exchange_rate_at_sale, payment_status
) VALUES (
gen_random_uuid(), p_cart_id, p_customer_id, p_business_id,
v_totals.final_total, p_payment_method, 'completed',
v_sale_date, p_notes, p_created_by, v_created_by_name,
p_business_id, v_totals.cart_discount_type, v_totals.cart_discount_value,
NULLIF(v_totals.cart_discount_amount, 0), v_totals.items_original_total, NULLIF(v_totals.delivery_cost, 0),
p_currency_id, p_exchange_rate_at_sale, p_payment_status
)
RETURNING id INTO v_sale_id;

FOR v_item IN
SELECT ci.product_id, ci.quantity, ci.unit_id
FROM cart_items ci WHERE ci.cart_id = p_cart_id
LOOP
IF v_item.unit_id IS NOT NULL THEN
SELECT COALESCE(conversion_factor_to_base, 1) INTO v_conversion_factor
FROM units WHERE id = v_item.unit_id;
v_base_quantity := v_item.quantity * COALESCE(v_conversion_factor, 1);
ELSE
v_base_quantity := v_item.quantity;
END IF;

UPDATE products
SET current_stock = current_stock - v_base_quantity, updated_at = now()
WHERE id = v_item.product_id AND business_id = p_business_id AND current_stock >= v_base_quantity;

GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
IF v_rows_updated = 0 THEN
RAISE EXCEPTION 'Insufficient stock for product %', v_item.product_id;
END IF;
END LOOP;

UPDATE carts SET status = 'completed', updated_at = now() WHERE id = p_cart_id;
RETURN v_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_sale_atomic(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, text, numeric, numeric, numeric, numeric, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_sale_atomic(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, text, numeric, numeric, numeric, numeric, uuid, numeric, text) TO authenticated, service_role;

-- 2. record_sale_action -------------------------------------------------------------------------
-- Void: only a completed sale with no returns; every sold unit goes back to stock.
-- Return: items capped at sold minus already returned; stock restored; status partially_returned
-- (the app shows "fully returned" when nothing is left). The money fields are what the client
-- computed with calculateReturnRefund / calculateVoidAmount; the quantities are enforced here.
CREATE OR REPLACE FUNCTION public.record_sale_action(
  p_sale_id uuid,
  p_action_type text,
  p_reason text,
  p_amount numeric,
  p_adjusted_amount numeric DEFAULT NULL,
  p_delivery_cost_included boolean DEFAULT false,
  p_delivery_cost_amount numeric DEFAULT 0,
  p_loss_amount numeric DEFAULT 0,
  p_loss_percentage numeric DEFAULT 0,
  p_loss_type text DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_sale record;
  v_lines jsonb := '[]'::jsonb;
  v_item record;
  v_sold integer;
  v_returned integer;
  v_before integer;
  v_after integer;
  v_action_id uuid;
  v_status text;
  v_remaining jsonb;
BEGIN
  PERFORM public.require_not_anon();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'record_sale_action needs a signed-in user' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT s.id, s.business_id, s.cart_id, s.status INTO v_sale FROM sales s WHERE s.id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM businesses WHERE id = v_sale.business_id AND owner_user_id = v_caller
    UNION ALL
    SELECT 1 FROM user_business_roles WHERE business_id = v_sale.business_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'You are not a member of this business' USING ERRCODE = '42501';
  END IF;

  IF p_action_type = 'void' THEN
    IF v_sale.status <> 'completed' THEN
      RAISE EXCEPTION 'Only a completed sale can be voided (status: %)', v_sale.status;
    END IF;
    IF EXISTS (SELECT 1 FROM sale_actions WHERE sale_id = p_sale_id AND action_type IN ('return', 'void')) THEN
      RAISE EXCEPTION 'This sale has returns; return the remaining items instead of voiding';
    END IF;
    -- Every line goes back in the unit it was sold in (a product sold in two units is two lines)
    FOR v_item IN
      SELECT ci.product_id, ci.quantity, COALESCE(u.conversion_factor_to_base, 1) AS factor
        FROM cart_items ci LEFT JOIN units u ON u.id = ci.unit_id
       WHERE ci.cart_id = v_sale.cart_id
    LOOP
      SELECT COALESCE(current_stock, 0) INTO v_before
        FROM products WHERE id = v_item.product_id AND business_id = v_sale.business_id FOR UPDATE;
      IF v_before IS NULL THEN
        RAISE EXCEPTION 'Product % not found in this business', v_item.product_id;
      END IF;
      v_after := v_before + v_item.quantity * v_item.factor;
      UPDATE products SET current_stock = v_after, updated_at = now() WHERE id = v_item.product_id;
      INSERT INTO product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
      VALUES (v_item.product_id, v_caller, v_sale.business_id, 'current_stock', v_before::text, v_after::text);
    END LOOP;
    v_status := 'voided';

  ELSIF p_action_type = 'return' THEN
    IF v_sale.status NOT IN ('completed', 'partially_returned') THEN
      RAISE EXCEPTION 'Items cannot be returned from a sale with status %', v_sale.status;
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'No items to return';
    END IF;
    FOR v_item IN
      SELECT COALESCE(i->>'productId', i->>'product_id')::uuid AS product_id, (i->>'quantity')::integer AS quantity
      FROM jsonb_array_elements(p_items) i
    LOOP
      IF v_item.product_id IS NULL OR COALESCE(v_item.quantity, 0) < 1 THEN
        RAISE EXCEPTION 'Invalid return line';
      END IF;
      SELECT COALESCE(sum(ci.quantity), 0) INTO v_sold FROM cart_items ci
       WHERE ci.cart_id = v_sale.cart_id AND ci.product_id = v_item.product_id;
      IF v_sold = 0 THEN
        RAISE EXCEPTION 'Product % was not part of this sale', v_item.product_id;
      END IF;
      SELECT COALESCE(sum((e->>'quantity')::integer), 0) INTO v_returned
        FROM sale_actions sa, jsonb_array_elements(COALESCE(sa.items_metadata, '[]'::jsonb)) e
       WHERE sa.sale_id = p_sale_id AND sa.action_type = 'return'
         AND COALESCE(e->>'productId', e->>'product_id') = v_item.product_id::text;
      IF v_item.quantity > v_sold - v_returned THEN
        RAISE EXCEPTION 'Cannot return % of product %: % sold, % already returned',
          v_item.quantity, v_item.product_id, v_sold, v_returned;
      END IF;
      v_lines := v_lines || jsonb_build_object('product_id', v_item.product_id, 'quantity', v_item.quantity);
    END LOOP;
    PERFORM public.restore_sale_stock(p_sale_id, v_lines);
    v_status := 'partially_returned';

  ELSE
    RAISE EXCEPTION 'Unsupported action: %', p_action_type;
  END IF;

  INSERT INTO sale_actions (
    sale_id, action_type, reason, performed_by, amount, adjusted_amount,
    delivery_cost_included, delivery_cost_amount, loss_amount, loss_percentage, loss_type, items_metadata
  ) VALUES (
    p_sale_id, p_action_type, p_reason, v_caller, p_amount, COALESCE(p_adjusted_amount, p_amount),
    COALESCE(p_delivery_cost_included, false), COALESCE(p_delivery_cost_amount, 0),
    COALESCE(p_loss_amount, 0), COALESCE(p_loss_percentage, 0), p_loss_type,
    CASE WHEN p_action_type = 'return' THEN p_items ELSE NULL END
  ) RETURNING id INTO v_action_id;

  UPDATE sales SET status = v_status WHERE id = p_sale_id;

  -- What is still returnable, per product
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', t.product_id, 'remaining', t.remaining)), '[]'::jsonb)
    INTO v_remaining
  FROM (
    SELECT ci.product_id,
           sum(ci.quantity) - COALESCE((
             SELECT sum((e->>'quantity')::integer)
               FROM sale_actions sa, jsonb_array_elements(COALESCE(sa.items_metadata, '[]'::jsonb)) e
              WHERE sa.sale_id = p_sale_id AND sa.action_type = 'return'
                AND COALESCE(e->>'productId', e->>'product_id') = ci.product_id::text), 0) AS remaining
      FROM cart_items ci WHERE ci.cart_id = v_sale.cart_id
     GROUP BY ci.product_id
  ) t;

  RETURN jsonb_build_object(
    'action_id', v_action_id,
    'status', v_status,
    'remaining', v_remaining,
    'fully_returned', v_status = 'partially_returned' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_remaining) r WHERE (r->>'remaining')::integer > 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.record_sale_action(uuid, text, text, numeric, numeric, boolean, numeric, numeric, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale_action(uuid, text, text, numeric, numeric, boolean, numeric, numeric, numeric, text, jsonb) TO authenticated, service_role;

-- 3. receive_inventory_batch --------------------------------------------------------------------
-- p_lines: [{import_id, final_unit_cost_per_item, total_cost_for_item, base_qty, cost_per_base_unit}]
-- computed by the client from the batch's extra costs. Lines are matched by their row id, so the
-- same product in two units is two lines; stock and cost move through the cost ledger; the batch
-- is marked completed last, all in one transaction.
CREATE OR REPLACE FUNCTION public.receive_inventory_batch(p_batch_id uuid, p_lines jsonb, p_arrival_date timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_batch record;
  v_line record;
  v_product uuid;
  v_count integer := 0;
BEGIN
  PERFORM public.require_not_anon();
  IF v_caller IS NULL AND COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'No lines to receive';
  END IF;

  SELECT b.id, b.business_id, b.status INTO v_batch FROM inventory_batches b WHERE b.id = p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;
  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM businesses WHERE id = v_batch.business_id AND owner_user_id = v_caller
    UNION ALL
    SELECT 1 FROM user_business_roles WHERE business_id = v_batch.business_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'You are not a member of this business' USING ERRCODE = '42501';
  END IF;
  IF v_batch.status = 'completed' THEN
    RETURN jsonb_build_object('batch_id', p_batch_id, 'already_completed', true);
  END IF;

  FOR v_line IN
    SELECT (l->>'import_id')::uuid AS import_id,
           (l->>'final_unit_cost_per_item')::numeric AS final_unit_cost,
           (l->>'total_cost_for_item')::numeric AS total_cost,
           (l->>'base_qty')::integer AS base_qty,
           (l->>'cost_per_base_unit')::numeric AS cost_per_base_unit
    FROM jsonb_array_elements(p_lines) l
  LOOP
    IF v_line.import_id IS NULL OR COALESCE(v_line.base_qty, 0) < 1 OR v_line.cost_per_base_unit IS NULL OR v_line.cost_per_base_unit < 0 THEN
      RAISE EXCEPTION 'Invalid receiving line';
    END IF;
    SELECT product_id INTO v_product FROM inventory_imports
     WHERE id = v_line.import_id AND batch_id = p_batch_id FOR UPDATE;
    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Import line % does not belong to this batch', v_line.import_id;
    END IF;

    UPDATE inventory_imports
       SET final_unit_cost_per_item = v_line.final_unit_cost,
           total_cost_for_item = v_line.total_cost,
           status = 'completed',
           arrival_date = p_arrival_date
     WHERE id = v_line.import_id;

    PERFORM public.apply_product_cost_event(v_product, 'receipt', v_line.base_qty, v_line.cost_per_base_unit, 'inventory_batch', p_batch_id, NULL);
    v_count := v_count + 1;
  END LOOP;

  UPDATE inventory_batches SET status = 'completed', arrival_date = p_arrival_date, updated_at = now() WHERE id = p_batch_id;
  RETURN jsonb_build_object('batch_id', p_batch_id, 'lines', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.receive_inventory_batch(uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_inventory_batch(uuid, jsonb, timestamptz) TO authenticated, service_role;
