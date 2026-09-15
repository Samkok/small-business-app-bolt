/*
  # Add unique barcode constraint per business

  1. Changes
    - Resolve existing duplicate barcodes by appending a suffix to duplicates
    - Add a partial unique index on `products(barcode, business_id)` where barcode is not null
      and product is not archived. This ensures within a single business, no two active products
      share the same barcode, while still allowing multiple products to have no barcode.
    - Add a standalone index on `products(barcode)` for fast barcode lookups

  2. Important Notes
    - Existing products with NULL barcodes are unaffected
    - Archived products are excluded from the uniqueness check so barcodes can be reused
    - One existing duplicate barcode (FF0006) is resolved by appending '-DUP' to the newer entry
*/

DO $$
DECLARE
  rec RECORD;

  dup RECORD;

  counter int;

BEGIN
  FOR rec IN
    SELECT barcode, business_id
    FROM products
    WHERE barcode IS NOT NULL AND is_archived = false
    GROUP BY barcode, business_id
    HAVING count(*) > 1
  LOOP
    counter := 0;

    FOR dup IN
      SELECT id
      FROM products
      WHERE barcode = rec.barcode
        AND business_id = rec.business_id
        AND is_archived = false
      ORDER BY created_at ASC
    LOOP
      IF counter > 0 THEN
        UPDATE products
        SET barcode = rec.barcode || '-DUP' || counter,
            updated_at = now()
        WHERE id = dup.id;

      END IF;

      counter := counter + 1;

    END LOOP;

  END LOOP;

END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_unique_barcode_per_business
  ON products (barcode, business_id)
  WHERE barcode IS NOT NULL AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_products_barcode_lookup
  ON products (barcode)
  WHERE barcode IS NOT NULL;

;
