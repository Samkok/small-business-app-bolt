/*
# Add business membership check to complete_sale_atomic

## Problem
- `complete_sale_atomic` is SECURITY DEFINER and accepts arbitrary p_business_id
  and p_created_by without verifying that the caller is a member of the business.
- Any authenticated user could create a sale in any business, decrement stock,
  and attribute the sale to any user.

## Changes
- Added auth.uid() guard: caller must be a member of p_business_id
  (either owner or has a role in user_business_roles).
- Service-role callers (auth.uid() IS NULL) are still allowed through.
- p_created_by must match auth.uid() for authenticated callers.

## Security
- Closes the most critical IDOR-write vulnerability in the system
*/

CREATE OR REPLACE FUNCTION public.complete_sale_atomic(
  p_cart_id uuid,
  p_customer_id uuid,
  p_business_id uuid,
  p_total_amount numeric,
  p_payment_method text,
  p_sale_date timestamp with time zone DEFAULT now(),
  p_notes text DEFAULT NULL::text,
  p_created_by uuid DEFAULT NULL::uuid,
  p_sale_discount_type text DEFAULT NULL::text,
  p_sale_discount_value numeric DEFAULT NULL::numeric,
  p_sale_discount_amount numeric DEFAULT NULL::numeric,
  p_subtotal_before_discount numeric DEFAULT NULL::numeric,
  p_delivery_cost numeric DEFAULT NULL::numeric,
  p_currency_id uuid DEFAULT NULL::uuid,
  p_exchange_rate_at_sale numeric DEFAULT 1
)
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
BEGIN
  v_caller := auth.uid();

  -- Guard: authenticated callers must be a member of the business
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

  -- Lock the cart row and check its status
  SELECT status INTO v_cart_status
  FROM carts
  WHERE id = p_cart_id
  FOR UPDATE;

  IF v_cart_status IS NULL THEN
    RAISE EXCEPTION 'Cart not found: %', p_cart_id;
  END IF;

  IF v_cart_status = 'completed' THEN
    SELECT id INTO v_sale_id FROM sales WHERE cart_id = p_cart_id LIMIT 1;
    RETURN v_sale_id;
  END IF;

  SELECT full_name INTO v_created_by_name
  FROM user_profiles WHERE user_id = p_created_by;

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
    WHERE id = v_item.product_id AND current_stock >= v_base_quantity;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item.product_id;
    END IF;
  END LOOP;

  UPDATE carts SET status = 'completed', updated_at = now() WHERE id = p_cart_id;
  RETURN v_sale_id;
END;
$function$;
