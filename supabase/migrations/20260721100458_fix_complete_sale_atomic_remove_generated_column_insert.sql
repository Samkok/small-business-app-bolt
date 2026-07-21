/*
# Fix complete_sale_atomic: remove generated column from INSERT

## Problem
The `complete_sale_atomic` function inserts a value into `current_total_amount`,
which is a GENERATED ALWAYS column (computed as `total_amount - COALESCE(returned_amount, 0)`).
PostgreSQL does not allow inserting non-DEFAULT values into generated columns,
causing "cannot insert a non-DEFAULT value into column" errors when completing sales
from both the Checkout page and Quick Checkout.

## Fix
Remove `current_total_amount` from the INSERT column list and VALUES list.
The column is automatically computed by PostgreSQL.
*/

CREATE OR REPLACE FUNCTION public.complete_sale_atomic(
  p_cart_id uuid,
  p_customer_id uuid,
  p_business_id uuid,
  p_total_amount numeric,
  p_payment_method text,
  p_sale_date timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_sale_discount_type text DEFAULT NULL,
  p_sale_discount_value numeric DEFAULT NULL,
  p_sale_discount_amount numeric DEFAULT NULL,
  p_subtotal_before_discount numeric DEFAULT NULL,
  p_delivery_cost numeric DEFAULT NULL,
  p_currency_id uuid DEFAULT NULL,
  p_exchange_rate_at_sale numeric DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_cart_status text;
  v_item record;
  v_conversion_factor integer;
  v_base_quantity integer;
  v_rows_updated integer;
  v_created_by_name text;
BEGIN
  -- Lock the cart row and check its status
  SELECT status INTO v_cart_status
  FROM carts
  WHERE id = p_cart_id
  FOR UPDATE;

  IF v_cart_status IS NULL THEN
    RAISE EXCEPTION 'Cart not found: %', p_cart_id;
  END IF;

  -- Idempotent: if cart is already completed, return the existing sale
  IF v_cart_status = 'completed' THEN
    SELECT id INTO v_sale_id FROM sales WHERE cart_id = p_cart_id LIMIT 1;
    RETURN v_sale_id;
  END IF;

  -- Get creator name for audit
  SELECT full_name INTO v_created_by_name
  FROM user_profiles
  WHERE user_id = p_created_by;

  -- Insert the sale (without current_total_amount - it's a generated column)
  INSERT INTO sales (
    id, cart_id, customer_id, business_id, total_amount,
    payment_method, status, sale_date, notes, created_by, created_by_name,
    created_by_business_id, sale_discount_type, sale_discount_value,
    sale_discount_amount, subtotal_before_discount, delivery_cost,
    currency_id, exchange_rate_at_sale
  ) VALUES (
    gen_random_uuid(), p_cart_id, p_customer_id, p_business_id,
    p_total_amount, p_payment_method, 'completed',
    COALESCE(p_sale_date, now()), p_notes, p_created_by, v_created_by_name,
    p_business_id, p_sale_discount_type, p_sale_discount_value,
    p_sale_discount_amount, p_subtotal_before_discount, p_delivery_cost,
    p_currency_id, p_exchange_rate_at_sale
  )
  RETURNING id INTO v_sale_id;

  -- Atomically decrement stock for each cart item
  FOR v_item IN
    SELECT ci.product_id, ci.quantity, ci.unit_id
    FROM cart_items ci
    WHERE ci.cart_id = p_cart_id
  LOOP
    -- Resolve unit conversion factor
    IF v_item.unit_id IS NOT NULL THEN
      SELECT COALESCE(conversion_factor_to_base, 1) INTO v_conversion_factor
      FROM units WHERE id = v_item.unit_id;
      v_base_quantity := v_item.quantity * COALESCE(v_conversion_factor, 1);
    ELSE
      v_base_quantity := v_item.quantity;
    END IF;

    -- Atomic decrement with sufficient-stock check
    UPDATE products
    SET current_stock = current_stock - v_base_quantity,
        updated_at = now()
    WHERE id = v_item.product_id
      AND current_stock >= v_base_quantity;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item.product_id;
    END IF;
  END LOOP;

  -- Mark the cart as completed
  UPDATE carts
  SET status = 'completed', updated_at = now()
  WHERE id = p_cart_id;

  RETURN v_sale_id;
END;
$$;