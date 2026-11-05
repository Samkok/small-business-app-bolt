-- Security audit phase 4b: strict stock and cost guards.
--
-- DO NOT APPLY until every installed build is 2.12 or newer. Builds before 2.12 write
-- products.current_stock directly on void/return (recorded in direct_stock_writes since phase
-- 1) and builds before 2.11 write products.cost_per_unit directly on batch arrival (recorded as
-- legacy_write cost events). The gate below refuses to run while either log has rows from the
-- last 14 days, so applying this early fails loudly instead of breaking old builds.
--
-- Check before applying:
--   select count(*) from public.direct_stock_writes where created_at > now() - interval '14 days';
--   select count(*) from public.product_cost_events where event_type = 'legacy_write' and created_at > now() - interval '14 days';

DO $$
DECLARE
  n_stock integer;
  n_cost integer;
BEGIN
  SELECT count(*) INTO n_stock FROM public.direct_stock_writes WHERE created_at > now() - interval '14 days';
  SELECT count(*) INTO n_cost FROM public.product_cost_events WHERE event_type = 'legacy_write' AND created_at > now() - interval '14 days';
  IF n_stock > 0 OR n_cost > 0 THEN
    RAISE EXCEPTION 'Not yet: % direct stock writes and % legacy cost writes in the last 14 days; builds before 2.12 are still in use', n_stock, n_cost;
  END IF;
END $$;

-- Stock: after 2.12 no client path writes current_stock directly (void/return use
-- restore_sale_stock; everything else was already an RPC), so a direct API write is refused.
CREATE OR REPLACE FUNCTION public.guard_product_stock_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.current_stock IS DISTINCT FROM OLD.current_stock THEN
    RAISE EXCEPTION 'current_stock is managed by the stock functions (adjust_product_stock, restore_sale_stock, apply_product_cost_event)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_product_stock_write() FROM PUBLIC, anon, authenticated;

-- Cost: the strict guard from docs/product-cost-flow-recommendation.md section 6
CREATE OR REPLACE FUNCTION public.guard_product_cost_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.cost_per_unit IS DISTINCT FROM OLD.cost_per_unit
     AND COALESCE(current_setting('app.cost_event', true), '') <> '1' THEN
    RAISE EXCEPTION 'cost_per_unit is managed by the cost ledger; call apply_product_cost_event'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_product_cost_write() FROM PUBLIC, anon, authenticated;
-- legacy_write stays in the event-type check so the historic rows remain valid.
