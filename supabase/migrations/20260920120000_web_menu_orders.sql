/*
  # Public web menu + web orders (phase 1)

  A business can publish a public menu link. A customer opens it in a browser, picks
  products, leaves a name + phone, and the order lands in the app as an ACTIVE CART
  (Sales tab -> Active Carts). The owner reviews it and checks out through the normal
  flow (complete_sale_atomic), which is what decrements stock and creates the sale.

  The browser never touches these tables. Everything goes through two edge functions
  (menu-get, menu-order) running as the service role, which call the two SECURITY DEFINER
  functions below. anon / authenticated get no EXECUTE on them.

  1. businesses: menu_slug, menu_enabled, menu_telegram, menu_note
  2. carts: source ('app' | 'web'), order_ref, web_order_token
  3. web_order_log (rate limiting, service role only)
  4. web_order_blocked_phones (per-business blocklist, managed by members)
  5. notifications: new type 'web_order_received' + preference column
  6. menu_normalize_phone(), get_public_menu(), create_web_order(), get_web_order_status()
  7. realtime on carts so a web order appears without pull-to-refresh
*/

-- ---------------------------------------------------------------------------
-- 1. businesses: public menu settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS menu_slug text,
  ADD COLUMN IF NOT EXISTS menu_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_telegram text,
  ADD COLUMN IF NOT EXISTS menu_note text;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_menu_slug_format
    CHECK (menu_slug IS NULL OR menu_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  ADD CONSTRAINT businesses_menu_slug_not_reserved
    CHECK (menu_slug IS NULL OR menu_slug NOT IN (
      'api', 'admin', 'app', 'menu', 'order', 'orders', 'refer', 'privacy', 'terms',
      'contact', 'about', 'login', 'signup', 'www', 'static', 'help', 'support',
      'bizmanage', 'delete-guide'
    )),
  ADD CONSTRAINT businesses_menu_telegram_format
    CHECK (menu_telegram IS NULL OR menu_telegram ~ '^[A-Za-z0-9_]{4,32}$'),
  ADD CONSTRAINT businesses_menu_note_length
    CHECK (menu_note IS NULL OR char_length(menu_note) <= 500),
  -- A menu can only be switched on once it has a link name.
  ADD CONSTRAINT businesses_menu_enabled_needs_slug
    CHECK (NOT menu_enabled OR menu_slug IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS businesses_menu_slug_key
  ON public.businesses (menu_slug) WHERE menu_slug IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. carts: where the cart came from
-- ---------------------------------------------------------------------------
ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS order_ref text,
  ADD COLUMN IF NOT EXISTS web_order_token uuid;

ALTER TABLE public.carts
  ADD CONSTRAINT carts_source_check CHECK (source IN ('app', 'web'));

CREATE UNIQUE INDEX IF NOT EXISTS carts_business_order_ref_key
  ON public.carts (business_id, order_ref) WHERE order_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS carts_web_order_token_key
  ON public.carts (web_order_token) WHERE web_order_token IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. web_order_log: one row per accepted web order, used for rate limiting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_order_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  ip_hash text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_order_log_business_created ON public.web_order_log (business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_web_order_log_ip_created ON public.web_order_log (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_web_order_log_phone_created ON public.web_order_log (business_id, phone, created_at);

-- RLS on with no policies: only the service role (which bypasses RLS) can touch it.
ALTER TABLE public.web_order_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_order_log FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. web_order_blocked_phones: per-business blocklist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_order_blocked_phones (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone text NOT NULL, -- stored normalized, see menu_normalize_phone()
  created_by uuid REFERENCES public.user_profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, phone)
);

ALTER TABLE public.web_order_blocked_phones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_order_blocked_phones FROM anon;

CREATE POLICY "Users can manage business blocked phones" ON public.web_order_blocked_phones
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_business_roles
    WHERE user_business_roles.business_id = web_order_blocked_phones.business_id
      AND user_business_roles.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_business_roles
    WHERE user_business_roles.business_id = web_order_blocked_phones.business_id
      AND user_business_roles.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 5. notifications: new type + preference
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('sale_created', 'sale_voided', 'role_assigned', 'low_stock',
                  'expense_added', 'team_invite', 'web_order_received'));

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS web_orders_enabled boolean DEFAULT true;

-- ---------------------------------------------------------------------------
-- 6. functions
-- ---------------------------------------------------------------------------

-- Digits only; a Cambodian number written with the country code (+855 12 345 678)
-- becomes the local form (012345678) so both spellings match the same customer.
CREATE OR REPLACE FUNCTION public.menu_normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN d LIKE '855%' AND length(d) >= 11 THEN '0' || substr(d, 4)
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') AS d) s;
$$;

-- Public menu payload. Only columns that are safe to show a stranger: never
-- cost_per_unit, barcode, min_stock_level or exact stock beyond what can be ordered.
CREATE OR REPLACE FUNCTION public.get_public_menu(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_business RECORD;
  v_currency jsonb;
  v_products jsonb;
BEGIN
  SELECT b.id, b.business_name, b.business_image_url, b.receipt_phone, b.receipt_address,
         b.menu_slug, b.menu_telegram, b.menu_note
  INTO v_business
  FROM businesses b
  WHERE b.menu_slug = lower(trim(p_slug))
    AND b.menu_enabled
    AND b.archived_at IS NULL
    AND COALESCE(b.access_state, 'active') = 'active';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object('id', c.id, 'code', c.code, 'symbol', c.symbol)
  INTO v_currency
  FROM currencies c
  WHERE c.business_id = v_business.id AND c.is_default
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'description', p.description,
           'image_url', p.image_url,
           'price', p.price,
           'currency', CASE WHEN pc.id IS NULL THEN v_currency
                            ELSE jsonb_build_object('id', pc.id, 'code', pc.code, 'symbol', pc.symbol) END,
           -- Checkout refuses to sell more than is in stock, so the menu must not offer it.
           'max_qty', LEAST(GREATEST(COALESCE(p.current_stock, 0), 0), 99)
         ) ORDER BY p.name), '[]'::jsonb)
  INTO v_products
  FROM products p
  LEFT JOIN currencies pc ON pc.id = p.currency_id
  WHERE p.business_id = v_business.id
    AND NOT p.is_archived;

  RETURN jsonb_build_object(
    'business', jsonb_build_object(
      'name', v_business.business_name,
      'image_url', v_business.business_image_url,
      'phone', v_business.receipt_phone,
      'address', v_business.receipt_address,
      'slug', v_business.menu_slug,
      'telegram', v_business.menu_telegram,
      'note', v_business.menu_note,
      'currency', v_currency
    ),
    'products', v_products
  );
END;
$$;

-- Creates the customer (if new), the active cart, its items and the owner/admin
-- notifications in one transaction. Prices always come from products, never the caller.
-- Errors are raised as 'WEB_ORDER:<code>' so the edge function can map them to a response.
CREATE OR REPLACE FUNCTION public.create_web_order(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,               -- [{ "product_id": uuid, "quantity": int }]
  p_address text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_business RECORD;
  v_name text := NULLIF(trim(regexp_replace(COALESCE(p_customer_name, ''), '\s+', ' ', 'g')), '');
  v_phone text := menu_normalize_phone(p_customer_phone);
  v_address text := NULLIF(trim(COALESCE(p_address, '')), '');
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_lines jsonb;
  v_line RECORD;
  v_line_count int;
  v_matched_count int;
  v_customer_id uuid;
  v_cart_id uuid;
  v_order_ref text;
  v_token uuid := gen_random_uuid();
  v_total numeric;
  v_item_count int;
  v_cart_notes text;
  v_recipient RECORD;
  v_preference RECORD;
BEGIN
  -- ---- business -----------------------------------------------------------
  SELECT b.id, b.business_name, b.owner_user_id
  INTO v_business
  FROM businesses b
  WHERE b.menu_slug = lower(trim(p_slug))
    AND b.menu_enabled
    AND b.archived_at IS NULL
    AND COALESCE(b.access_state, 'active') = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WEB_ORDER:menu_not_found';
  END IF;

  -- ---- input --------------------------------------------------------------
  IF v_name IS NULL OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_name';
  END IF;
  IF length(v_phone) < 8 OR length(v_phone) > 15 THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_phone';
  END IF;
  IF char_length(COALESCE(v_address, '')) > 300 OR char_length(COALESCE(v_note, '')) > 500 THEN
    RAISE EXCEPTION 'WEB_ORDER:text_too_long';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_items';
  END IF;

  -- One row per product, quantities of duplicate lines added together.
  SELECT jsonb_agg(jsonb_build_object('product_id', s.product_id, 'quantity', s.quantity))
  INTO v_lines
  FROM (
    SELECT (i->>'product_id')::uuid AS product_id,
           SUM((i->>'quantity')::int)::int AS quantity
    FROM jsonb_array_elements(p_items) i
    GROUP BY 1
  ) s;

  v_line_count := COALESCE(jsonb_array_length(v_lines), 0);
  IF v_line_count < 1 OR v_line_count > 50 THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_items';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int) WHERE quantity IS NULL OR quantity < 1 OR quantity > 999) THEN
    RAISE EXCEPTION 'WEB_ORDER:invalid_quantity';
  END IF;

  SELECT count(*) INTO v_matched_count
  FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int)
  JOIN products p ON p.id = l.product_id
  WHERE p.business_id = v_business.id AND NOT p.is_archived;

  IF v_matched_count <> v_line_count THEN
    RAISE EXCEPTION 'WEB_ORDER:product_unavailable';
  END IF;

  -- Checkout (complete_sale_atomic) refuses to oversell, so refuse here too.
  SELECT l.product_id, p.name, COALESCE(p.current_stock, 0) AS stock
  INTO v_line
  FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int)
  JOIN products p ON p.id = l.product_id
  WHERE l.quantity > COALESCE(p.current_stock, 0)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'WEB_ORDER:insufficient_stock:%:%', v_line.product_id, v_line.stock;
  END IF;

  -- ---- abuse limits -------------------------------------------------------
  IF EXISTS (SELECT 1 FROM web_order_blocked_phones bp
             WHERE bp.business_id = v_business.id AND bp.phone = v_phone) THEN
    RAISE EXCEPTION 'WEB_ORDER:blocked';
  END IF;

  IF (SELECT count(*) FROM web_order_log
      WHERE business_id = v_business.id AND phone = v_phone
        AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;

  IF p_ip_hash IS NOT NULL AND
     (SELECT count(*) FROM web_order_log
      WHERE ip_hash = p_ip_hash AND created_at > now() - interval '1 hour') >= 6 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;

  IF (SELECT count(*) FROM web_order_log
      WHERE business_id = v_business.id
        AND created_at > now() - interval '1 day') >= 300 THEN
    RAISE EXCEPTION 'WEB_ORDER:rate_limited';
  END IF;

  -- ---- customer: match on normalized phone inside this business -----------
  SELECT c.id INTO v_customer_id
  FROM customers c
  WHERE c.business_id = v_business.id
    AND NOT c.is_system_customer
    AND menu_normalize_phone(c.phone) = v_phone
  ORDER BY c.created_at
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    -- platform stays 'other': the app's customer form only accepts its own platform list.
    INSERT INTO customers (name, phone, address, platform, notes, business_id)
    VALUES (v_name, v_phone, v_address, 'other', 'Added from online menu', v_business.id)
    RETURNING id INTO v_customer_id;
  ELSIF v_address IS NOT NULL THEN
    -- Never overwrite what the owner typed; only fill an empty address.
    UPDATE customers SET address = v_address, updated_at = now()
    WHERE id = v_customer_id AND NULLIF(trim(COALESCE(address, '')), '') IS NULL;
  END IF;

  -- ---- cart ---------------------------------------------------------------
  LOOP
    v_order_ref := 'W-' || upper(substr(md5(gen_random_uuid()::text), 1, 5));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM carts WHERE business_id = v_business.id AND order_ref = v_order_ref);
  END LOOP;

  v_cart_notes := concat_ws(E'\n',
    'Online order ' || v_order_ref || ' - ' || v_name,
    CASE WHEN v_address IS NOT NULL THEN 'Address: ' || v_address END,
    CASE WHEN v_note IS NOT NULL THEN 'Note: ' || v_note END);

  INSERT INTO carts (customer_id, status, business_id, created_by, created_by_business_id,
                     notes, source, order_ref, web_order_token)
  VALUES (v_customer_id, 'active', v_business.id, v_business.owner_user_id, v_business.id,
          v_cart_notes, 'web', v_order_ref, v_token)
  RETURNING id INTO v_cart_id;

  -- Base unit only (unit_id NULL), so cost_per_unit is the product's own cost.
  -- subtotal / original_subtotal / item_discount_amount are set by cart_items_discount_trigger.
  INSERT INTO cart_items (cart_id, product_id, quantity, unit_price, cost_per_unit, currency_id)
  SELECT v_cart_id, p.id, l.quantity, p.price, COALESCE(p.cost_per_unit, 0), p.currency_id
  FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int)
  JOIN products p ON p.id = l.product_id;

  SELECT d.final_total INTO v_total FROM cart_details_with_discounts d WHERE d.cart_id = v_cart_id;
  SELECT COALESCE(sum(l.quantity), 0) INTO v_item_count FROM jsonb_to_recordset(v_lines) AS l(product_id uuid, quantity int);

  UPDATE carts SET total_amount = COALESCE(v_total, 0) WHERE id = v_cart_id;

  INSERT INTO web_order_log (business_id, cart_id, ip_hash, phone)
  VALUES (v_business.id, v_cart_id, p_ip_hash, v_phone);

  -- ---- notify owner + admins (push is sent by on_notification_insert_send_push) ----
  FOR v_recipient IN
    SELECT v_business.owner_user_id AS user_id
    UNION
    SELECT ubr.user_id FROM user_business_roles ubr
    WHERE ubr.business_id = v_business.id AND ubr.role = 'admin'
  LOOP
    SELECT * INTO v_preference FROM notification_preferences WHERE user_id = v_recipient.user_id;

    IF v_preference IS NULL OR COALESCE(v_preference.web_orders_enabled, true) THEN
      INSERT INTO notifications (user_id, business_id, type, title, message, data)
      VALUES (
        v_recipient.user_id,
        v_business.id,
        'web_order_received',
        'New online order',
        'In ' || v_business.business_name || ', ' || v_name || ' ordered ' || v_item_count ||
          CASE WHEN v_item_count = 1 THEN ' item' ELSE ' items' END || ' from your menu (' || v_order_ref || ')',
        jsonb_build_object(
          'cart_id', v_cart_id,
          'order_ref', v_order_ref,
          'customer_name', v_name,
          'customer_phone', v_phone,
          'total_amount', COALESCE(v_total, 0),
          'business_id', v_business.id,
          'business_name', v_business.business_name
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_ref', v_order_ref,
    'token', v_token,
    'total', COALESCE(v_total, 0),
    'item_count', v_item_count
  );
END;
$$;

-- What the customer's "order status" page may see. The token is the only credential.
-- A cart the owner deleted simply stops resolving, which the page shows as cancelled.
CREATE OR REPLACE FUNCTION public.get_web_order_status(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT jsonb_build_object(
    'order_ref', c.order_ref,
    'status', CASE c.status WHEN 'active' THEN 'received'
                            WHEN 'completed' THEN 'confirmed'
                            ELSE 'cancelled' END,
    'created_at', c.created_at,
    'business_name', b.business_name,
    'business_slug', b.menu_slug,
    'business_telegram', b.menu_telegram,
    'business_phone', b.receipt_phone
  )
  FROM carts c
  JOIN businesses b ON b.id = c.business_id
  WHERE c.web_order_token = p_token AND c.source = 'web';
$$;

-- Service role only. Supabase grants EXECUTE to anon/authenticated by default.
REVOKE ALL ON FUNCTION public.get_public_menu(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_web_order(text, text, text, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_web_order_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_menu(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_web_order(text, text, text, jsonb, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_web_order_status(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. realtime: let the app see a web order arrive (RLS still applies per subscriber)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'carts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.carts;
  END IF;
END $$;
