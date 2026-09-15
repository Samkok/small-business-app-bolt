/*
  # Create multi-unit system tables

  1. New Tables
    - `unit_groups` - Groups of related units (e.g. "Box/Pack/Bottle")
      - `id` (uuid, primary key)
      - `business_id` (uuid, FK to businesses)
      - `name` (text, e.g. "Box/Pack/Bottle")
      - `created_at`, `updated_at`

    - `units` - Individual units within a group
      - `id` (uuid, primary key)
      - `unit_group_id` (uuid, FK to unit_groups)
      - `name` (text, e.g. "Box")
      - `barcode` (text, nullable)
      - `conversion_factor_to_base` (integer, NOT NULL) - How many base units this equals (e.g. Box=24, Pack=4, Bottle=1)
      - `sort_order` (integer) - 1=largest, 2=next, etc.
      - `is_base_unit` (boolean, default false) - True for the smallest unit (conversion_factor=1)
      - `created_at`

    - `product_unit_prices` - Per-unit pricing for products
      - `id` (uuid, primary key)
      - `product_id` (uuid, FK to products)
      - `unit_id` (uuid, FK to units)
      - `price` (numeric, NOT NULL)
      - `cost_per_unit` (numeric, nullable)
      - `currency_id` (uuid, FK to currencies, nullable)
      - `created_at`, `updated_at`

  2. Modified Tables
    - `products`: Add `unit_group_id` (uuid, nullable FK to unit_groups) - NULL means single-unit "piece"
    - `cart_items`: Add `unit_id` (uuid, nullable FK to units) - NULL means default unit
    - `inventory_imports`: Add `unit_id` (uuid, nullable FK to units) - NULL means base unit

  3. Security
    - RLS enabled on all new tables
    - Policies follow existing user_business_roles pattern

  4. Indexes
    - Partial unique index on units barcode within a unit group
    - Index on product_unit_prices for product lookups
*/

CREATE TABLE IF NOT EXISTS unit_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE unit_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business unit groups"
  ON unit_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = unit_groups.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert business unit groups"
  ON unit_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = unit_groups.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update business unit groups"
  ON unit_groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = unit_groups.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = unit_groups.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete business unit groups"
  ON unit_groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_roles
      WHERE user_business_roles.business_id = unit_groups.business_id
        AND user_business_roles.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_group_id uuid NOT NULL REFERENCES unit_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  barcode text,
  conversion_factor_to_base integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 1,
  is_base_unit boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view units"
  ON units FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM unit_groups ug
      JOIN user_business_roles ubr ON ubr.business_id = ug.business_id
      WHERE ug.id = units.unit_group_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert units"
  ON units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM unit_groups ug
      JOIN user_business_roles ubr ON ubr.business_id = ug.business_id
      WHERE ug.id = units.unit_group_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update units"
  ON units FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM unit_groups ug
      JOIN user_business_roles ubr ON ubr.business_id = ug.business_id
      WHERE ug.id = units.unit_group_id
        AND ubr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM unit_groups ug
      JOIN user_business_roles ubr ON ubr.business_id = ug.business_id
      WHERE ug.id = units.unit_group_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete units"
  ON units FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM unit_groups ug
      JOIN user_business_roles ubr ON ubr.business_id = ug.business_id
      WHERE ug.id = units.unit_group_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_units_unique_barcode_per_group
  ON units (barcode, unit_group_id)
  WHERE barcode IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_unit_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric,
  currency_id uuid REFERENCES currencies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_unit_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product unit prices"
  ON product_unit_prices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN user_business_roles ubr ON ubr.business_id = p.business_id
      WHERE p.id = product_unit_prices.product_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product unit prices"
  ON product_unit_prices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      JOIN user_business_roles ubr ON ubr.business_id = p.business_id
      WHERE p.id = product_unit_prices.product_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product unit prices"
  ON product_unit_prices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN user_business_roles ubr ON ubr.business_id = p.business_id
      WHERE p.id = product_unit_prices.product_id
        AND ubr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      JOIN user_business_roles ubr ON ubr.business_id = p.business_id
      WHERE p.id = product_unit_prices.product_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product unit prices"
  ON product_unit_prices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN user_business_roles ubr ON ubr.business_id = p.business_id
      WHERE p.id = product_unit_prices.product_id
        AND ubr.user_id = auth.uid()
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_unit_prices_unique
  ON product_unit_prices (product_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_product_unit_prices_product
  ON product_unit_prices (product_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'unit_group_id'
  ) THEN
    ALTER TABLE products ADD COLUMN unit_group_id uuid REFERENCES unit_groups(id);

  END IF;

END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cart_items' AND column_name = 'unit_id'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN unit_id uuid REFERENCES units(id);

  END IF;

END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_imports' AND column_name = 'unit_id'
  ) THEN
    ALTER TABLE inventory_imports ADD COLUMN unit_id uuid REFERENCES units(id);

  END IF;

END $$;

CREATE INDEX IF NOT EXISTS idx_products_unit_group_id ON products(unit_group_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_unit_id ON cart_items(unit_id);

CREATE INDEX IF NOT EXISTS idx_inventory_imports_unit_id ON inventory_imports(unit_id);

;
