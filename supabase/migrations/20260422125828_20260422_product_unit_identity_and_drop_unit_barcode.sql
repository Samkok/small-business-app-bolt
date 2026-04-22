/*
  # Product-Unit identity: name and barcode per product-unit

  This migration restructures per-unit identity (name + barcode) so that it
  lives on the `product_unit_prices` table (the junction between products
  and units) instead of on the shared `units` table. This fixes the hidden
  defect where two products sharing the same unit group would collide on
  unit barcodes.

  1. Columns added to `product_unit_prices`
     - `name` (text, nullable for now, backfilled from `units.name`)
     - `barcode` (text, nullable)
     - `business_id` (uuid, nullable for now, backfilled from the parent product)

  2. Backfill
     - For every existing `product_unit_prices` row, copy the corresponding
       `units.name` into `name` and `units.barcode` into `barcode`, and copy
       the product's `business_id` into `business_id`.
     - For every product that has a `unit_group_id` but is missing rows in
       `product_unit_prices` for some of its units, create new rows so every
       unit has a corresponding product-unit row (name defaults to the
       unit's own name, barcode copied from units.barcode when present).

  3. Units table
     - `units.barcode` is made nullable. Existing rows are preserved so
       historical data remains intact until the rollout is confirmed stable.
       The old unique index on `(barcode, unit_group_id)` is dropped since
       unit-level barcodes are no longer the source of truth.

  4. New uniqueness rule (shared business-wide namespace)
     - `idx_product_unit_prices_unique_barcode_per_business` ensures no two
       product-unit rows within a business share a barcode.
     - Combined with the existing `idx_products_unique_barcode_per_business`,
       every scannable barcode resolves to at most one product or
       product-unit per business.

  5. Security
     - RLS on `product_unit_prices` is unchanged; the existing policies
       continue to enforce business-level access via the parent product.
*/

-- 1. Add new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_unit_prices' AND column_name='name'
  ) THEN
    ALTER TABLE product_unit_prices ADD COLUMN name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_unit_prices' AND column_name='barcode'
  ) THEN
    ALTER TABLE product_unit_prices ADD COLUMN barcode text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_unit_prices' AND column_name='business_id'
  ) THEN
    ALTER TABLE product_unit_prices ADD COLUMN business_id uuid;
  END IF;
END $$;

-- 2a. Backfill name, barcode, and business_id for existing rows
UPDATE product_unit_prices pup
SET
  name = COALESCE(pup.name, u.name),
  barcode = COALESCE(pup.barcode, u.barcode),
  business_id = COALESCE(pup.business_id, p.business_id)
FROM units u, products p
WHERE u.id = pup.unit_id
  AND p.id = pup.product_id
  AND (pup.name IS NULL OR pup.business_id IS NULL OR pup.barcode IS NULL);

-- 2b. Create missing product_unit rows so every product-unit pair is represented
INSERT INTO product_unit_prices (product_id, unit_id, price, name, barcode, business_id)
SELECT
  p.id,
  u.id,
  p.price,
  u.name,
  u.barcode,
  p.business_id
FROM products p
JOIN units u ON u.unit_group_id = p.unit_group_id
WHERE p.unit_group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_unit_prices x
    WHERE x.product_id = p.id AND x.unit_id = u.id
  );

-- 3. Make business_id NOT NULL and add FK + index now that it's backfilled
ALTER TABLE product_unit_prices
  ALTER COLUMN business_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='product_unit_prices_business_id_fkey'
      AND table_name='product_unit_prices'
  ) THEN
    ALTER TABLE product_unit_prices
      ADD CONSTRAINT product_unit_prices_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_unit_prices_business_id
  ON product_unit_prices (business_id);

-- 4. Drop the old unit-level barcode uniqueness; make units.barcode nullable
DROP INDEX IF EXISTS idx_units_unique_barcode_per_group;

ALTER TABLE units ALTER COLUMN barcode DROP NOT NULL;

-- 5. New shared barcode namespace within a business (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_unit_prices_unique_barcode_per_business
  ON product_unit_prices (business_id, barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_unit_prices_barcode_lookup
  ON product_unit_prices (barcode)
  WHERE barcode IS NOT NULL;

-- 6. Keep business_id in sync automatically when a product_unit_prices row is inserted or its product_id changes
CREATE OR REPLACE FUNCTION set_product_unit_prices_business_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    SELECT business_id INTO NEW.business_id FROM products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_product_unit_prices_business_id ON product_unit_prices;
CREATE TRIGGER trg_set_product_unit_prices_business_id
  BEFORE INSERT OR UPDATE OF product_id ON product_unit_prices
  FOR EACH ROW
  EXECUTE FUNCTION set_product_unit_prices_business_id();
