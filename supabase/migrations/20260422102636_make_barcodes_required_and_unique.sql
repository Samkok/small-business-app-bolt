/*
  # Make barcodes required and enforce uniqueness

  ## Summary
  Barcodes are now mandatory for all products and units. This migration:

  1. Backfills any existing NULL unit barcodes with a unique placeholder (none exist
     for products;
 2 exist for units at time of writing).
  2. Drops the old partial unique indexes (which only applied when barcode IS NOT NULL)
     and replaces them with unconditional unique indexes — since the column will be NOT NULL,
     the WHERE clause is no longer needed and a plain unique index is cleaner.
  3. Sets barcode NOT NULL on both products and units.

  ## Changes

  ### products
  - `barcode text` → `barcode text NOT NULL`
  - Drops partial index `idx_products_unique_barcode_per_business` (WHERE barcode IS NOT NULL)
  - Creates unconditional unique index `idx_products_unique_barcode_per_business`
    on (barcode, business_id) — uniqueness is still scoped per business, not global,
    so the same barcode can appear in two different businesses.

  ### units
  - `barcode text` → `barcode text NOT NULL`
  - Drops partial index `idx_units_unique_barcode_per_group` (WHERE barcode IS NOT NULL)
  - Creates unconditional unique index `idx_units_unique_barcode_per_group`
    on (barcode, unit_group_id) — uniqueness is scoped per unit group.

  ## Notes
  - The lookup index `idx_products_barcode_lookup` is left unchanged (it is a non-unique
    performance index used by barcode search queries).
  - No data is lost;
 backfilled placeholder values are clearly marked so users know
    to replace them via the product/unit edit form.
*/

-- ── 1. Backfill NULL unit barcodes ──────────────────────────────────────────
-- Assign a unique placeholder so the NOT NULL constraint can be applied cleanly.
-- The placeholder format NEEDS-BARCODE-<id-prefix> is human-readable and will
-- fail the app's format validation on first edit, prompting the user to set a real value.
UPDATE units
SET barcode = 'NEEDS-BARCODE-' || substring(id::text, 1, 8)
WHERE barcode IS NULL;

-- Products already have no NULLs, but add the same safety net in case.
UPDATE products
SET barcode = 'NEEDS-BARCODE-' || substring(id::text, 1, 8)
WHERE barcode IS NULL;

-- ── 2. Drop old partial unique indexes ──────────────────────────────────────
DROP INDEX IF EXISTS idx_products_unique_barcode_per_business;

DROP INDEX IF EXISTS idx_units_unique_barcode_per_group;

-- ── 3. Create unconditional unique indexes ───────────────────────────────────
-- Products: unique barcode within a business (different businesses may share barcodes)
CREATE UNIQUE INDEX idx_products_unique_barcode_per_business
  ON products (barcode, business_id);

-- Units: unique barcode within a unit group
CREATE UNIQUE INDEX idx_units_unique_barcode_per_group
  ON units (barcode, unit_group_id);

-- ── 4. Apply NOT NULL constraints ────────────────────────────────────────────
ALTER TABLE products ALTER COLUMN barcode SET NOT NULL;

ALTER TABLE units    ALTER COLUMN barcode SET NOT NULL;

;
