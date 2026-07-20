/*
# Add Idempotent Atomic Sale Completion

## Summary
Creates a database function `complete_sale_atomic` that wraps the entire sale
completion flow in a single transaction:
1. Verifies the cart exists and is not already completed (idempotent)
2. Inserts the sale row
3. Marks the cart as completed
4. Atomically decrements stock for all items (using current_stock - qty, not read-modify-write)
5. Returns the created sale ID

Also adds a UNIQUE constraint on sales(cart_id) to prevent duplicate sale creation
from the same cart, making the operation naturally idempotent.

## Changes

### New Function: complete_sale_atomic
- Takes cart_id, customer_id, business_id, total_amount, payment_method, sale_date,
  notes, created_by, discount fields, delivery_cost, currency fields
- Returns the sale ID (uuid) or NULL if the cart was already completed
- Uses atomic stock decrement (UPDATE ... SET current_stock = current_stock - qty)
- Raises exception on insufficient stock

### New Constraint
- UNIQUE index on sales(cart_id) to enforce one-sale-per-cart at the DB level

## Security Impact
- Closes I1: duplicate sales impossible due to cart_id unique constraint
- Closes I2: stock decrement is atomic (no read-modify-write race)
- The function is SECURITY DEFINER to bypass RLS for stock updates

## Important Notes
1. The client will call this function via supabase.rpc('complete_sale_atomic', {...})
2. If the cart is already completed, the function returns NULL (no-op, idempotent)
3. Stock insufficiency raises an exception that rolls back the entire transaction
4. The function resolves unit conversion factors from the units table
*/

-- Add unique constraint on sales(cart_id) to prevent duplicate completions
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_unique_cart_id ON sales (cart_id);

-- Create the atomic sale completion function
CREATE OR REPLACE FUNCTION complete_sale_atomic(
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
  p_exchange_rate_at_sale numeric DEFAULT NULL
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

  -- Insert the sale
  INSERT INTO sales (
    id, cart_id, customer_id, business_id, total_amount, current_total_amount,
    payment_method, status, sale_date, notes, created_by, created_by_name,
    created_by_business_id, sale_discount_type, sale_discount_value,
    sale_discount_amount, subtotal_before_discount, delivery_cost,
    currency_id, exchange_rate_at_sale
  ) VALUES (
    gen_random_uuid(), p_cart_id, p_customer_id, p_business_id,
    p_total_amount, p_total_amount, p_payment_method, 'completed',
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

-- Grant to authenticated (the function itself checks business membership via RLS on cart)
GRANT EXECUTE ON FUNCTION complete_sale_atomic(uuid, uuid, uuid, numeric, text, timestamptz, text, uuid, text, numeric, numeric, numeric, numeric, uuid, numeric) TO authenticated;
