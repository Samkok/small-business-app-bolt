-- Backfill product_history with cost_per_unit change records from import timeline
-- Each completed import changed the cost_per_unit via weighted average.
-- We reconstruct what old/new values were at each import event.

DO $$
DECLARE
  prod RECORD;
  imp RECORD;
  running_qty integer;
  running_cost numeric;
  prev_cost numeric;
  new_cost numeric;
  import_business_id uuid;
BEGIN
  FOR prod IN
    SELECT DISTINCT product_id FROM inventory_imports WHERE status = 'completed'
  LOOP
    running_qty := 0;
    running_cost := 0;
    prev_cost := 0;

    FOR imp IN
      SELECT ii.quantity, ii.final_unit_cost_per_item, ii.created_at, ii.imported_by, ii.business_id
      FROM inventory_imports ii
      WHERE ii.product_id = prod.product_id AND ii.status = 'completed'
      ORDER BY ii.created_at ASC
    LOOP
      -- Calculate what cost_per_unit became after this import
      running_qty := running_qty + imp.quantity;
      running_cost := running_cost + (imp.quantity * imp.final_unit_cost_per_item);

      IF running_qty > 0 THEN
        new_cost := ROUND(running_cost / running_qty, 2);
      ELSE
        new_cost := 0;
      END IF;

      -- Only log if cost actually changed
      IF new_cost IS DISTINCT FROM prev_cost THEN
        -- Check if this record already exists (idempotency)
        IF NOT EXISTS (
          SELECT 1 FROM product_history
          WHERE product_id = prod.product_id
            AND field_name = 'cost_per_unit'
            AND change_date = imp.created_at
        ) THEN
          INSERT INTO product_history (
            product_id, changed_by_user_id, business_id, field_name,
            old_value, new_value, change_date
          ) VALUES (
            prod.product_id,
            imp.imported_by,
            imp.business_id,
            'cost_per_unit',
            prev_cost::text,
            new_cost::text,
            imp.created_at
          );
        END IF;
      END IF;

      prev_cost := new_cost;
    END LOOP;
  END LOOP;
END $$;
