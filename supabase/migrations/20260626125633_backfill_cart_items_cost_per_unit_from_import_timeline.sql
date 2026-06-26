-- Backfill cart_items.cost_per_unit by reconstructing the weighted average cost
-- at the time each sale was made, using the inventory_imports timeline.
--
-- Algorithm per product:
--   1. Sort completed imports by created_at ASC
--   2. Replay weighted average: at each import, compute cost_per_unit
--   3. For each cart_item (via its sale's sale_date), find the cost that was
--      in effect at that point in time (the last import before or on that date)
--   4. For sales before any import existed for that product, cost = 0

DO $$
DECLARE
  prod RECORD;
  imp RECORD;
  running_qty integer;
  running_cost numeric;
  cost_at_time numeric;
  cost_timeline jsonb;
  sale_rec RECORD;
  timeline_entry jsonb;
  best_cost numeric;
  best_date timestamptz;
  entry_date timestamptz;
  entry_cost numeric;
  i integer;
BEGIN
  -- Process each product that has imports
  FOR prod IN
    SELECT DISTINCT product_id FROM inventory_imports WHERE status = 'completed'
  LOOP
    -- Build a timeline of cost_per_unit values for this product
    running_qty := 0;
    running_cost := 0;
    cost_timeline := '[]'::jsonb;

    FOR imp IN
      SELECT quantity, final_unit_cost_per_item, created_at
      FROM inventory_imports
      WHERE product_id = prod.product_id AND status = 'completed'
      ORDER BY created_at ASC
    LOOP
      -- Weighted average calculation (same as markImportAsArrived)
      running_qty := running_qty + imp.quantity;
      running_cost := running_cost + (imp.quantity * imp.final_unit_cost_per_item);
      
      IF running_qty > 0 THEN
        cost_at_time := running_cost / running_qty;
      ELSE
        cost_at_time := 0;
      END IF;

      cost_timeline := cost_timeline || jsonb_build_object(
        'date', imp.created_at,
        'cost', cost_at_time
      );
    END LOOP;

    -- Now update cart_items for this product based on when the sale happened
    FOR sale_rec IN
      SELECT ci.id as cart_item_id, s.sale_date
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      JOIN sales s ON s.cart_id = c.id
      WHERE ci.product_id = prod.product_id
        AND (ci.cost_per_unit IS NULL OR ci.cost_per_unit = 0)
    LOOP
      -- Find the last timeline entry whose date <= sale_date
      best_cost := 0;
      best_date := NULL;

      FOR i IN 0..(jsonb_array_length(cost_timeline) - 1)
      LOOP
        timeline_entry := cost_timeline->i;
        entry_date := (timeline_entry->>'date')::timestamptz;
        entry_cost := (timeline_entry->>'cost')::numeric;

        IF entry_date <= sale_rec.sale_date THEN
          best_cost := entry_cost;
          best_date := entry_date;
        ELSE
          EXIT; -- Timeline is sorted, no need to continue
        END IF;
      END LOOP;

      -- Update the cart_item with the reconstructed cost
      UPDATE cart_items SET cost_per_unit = best_cost WHERE id = sale_rec.cart_item_id;
    END LOOP;
  END LOOP;

  -- For products without any imports, leave cost_per_unit = 0 (the default)
  -- This is correct: if no import ever existed, cost was unknown/zero
END $$;
