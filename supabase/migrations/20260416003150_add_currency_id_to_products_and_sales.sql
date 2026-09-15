/*
  # Add currency references to products, cart_items, sales, and expenses

  1. Modified Tables
    - `products`: Add `currency_id` (uuid FK to currencies) - the currency the product is priced in
    - `cart_items`: Add `currency_id` (uuid FK to currencies) - snapshot of the currency at time of adding
    - `sales`: Add `currency_id` (uuid FK to currencies) and `exchange_rate_at_sale` (numeric) - the default currency and snapshot rate
    - `expenses`: Add `currency_id` (uuid FK to currencies) - currency of the expense

  2. Data Migration
    - Backfill all existing products with their business's default USD currency
    - Backfill all existing expenses with their business's default currency

  3. Important Notes
    - currency_id is nullable initially to allow backfilling, but new products should always have it set
    - exchange_rate_at_sale captures the conversion rate at the moment of sale for historical accuracy
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE products ADD COLUMN currency_id uuid REFERENCES currencies(id);

  END IF;

END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN currency_id uuid REFERENCES currencies(id);

  END IF;

END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN currency_id uuid REFERENCES currencies(id);

  END IF;

END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'exchange_rate_at_sale'
  ) THEN
    ALTER TABLE sales ADD COLUMN exchange_rate_at_sale numeric DEFAULT 1;

  END IF;

END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN currency_id uuid REFERENCES currencies(id);

  END IF;

END $$;

UPDATE products
SET currency_id = (
  SELECT c.id FROM currencies c
  WHERE c.business_id = products.business_id AND c.is_default = true
  LIMIT 1
)
WHERE currency_id IS NULL;

UPDATE expenses
SET currency_id = (
  SELECT c.id FROM currencies c
  WHERE c.business_id = expenses.business_id AND c.is_default = true
  LIMIT 1
)
WHERE currency_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_currency_id ON products(currency_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_currency_id ON cart_items(currency_id);

CREATE INDEX IF NOT EXISTS idx_sales_currency_id ON sales(currency_id);

CREATE INDEX IF NOT EXISTS idx_expenses_currency_id ON expenses(currency_id);

;
