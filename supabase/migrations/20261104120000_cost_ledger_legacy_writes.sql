-- Cost ledger: compatibility with app builds older than 2.11
--
-- Builds before the cost ledger write products.cost_per_unit directly when a batch arrives
-- (and recompute it when a batch is deleted). Refusing those writes would block every stock
-- arrival on an old build, and the app has no forced-update mechanism. So until those builds
-- are gone the guard records a direct write as a `legacy_write` event instead of refusing it:
-- nothing is lost from the trail, and the new build never takes this path.
--
-- Follow-up (once `select count(*) from product_cost_events where event_type = 'legacy_write'
-- and created_at > now() - interval '14 days'` is 0): put the strict guard back, see
-- docs/product-cost-flow-recommendation.md section 6.

alter table public.product_cost_events drop constraint if exists product_cost_events_event_type_check;
alter table public.product_cost_events add constraint product_cost_events_event_type_check
  check (event_type in ('opening', 'receipt', 'receipt_reversal', 'manual_correction', 'revaluation', 'legacy_write'));

create or replace function public.guard_product_cost_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller uuid := auth.uid();
  v_name   text;
begin
  if new.cost_per_unit is distinct from old.cost_per_unit
     and coalesce(current_setting('app.cost_event', true), '') <> '1' then
    -- Compatibility mode: an app build from before the ledger wrote the cost directly.
    -- Record it so the trail stays complete; the strict guard returns in a later migration.
    select full_name into v_name from public.user_profiles where user_id = v_caller;
    insert into public.product_cost_events (
      business_id, product_id, event_type, qty_delta, unit_cost_in,
      stock_before, stock_after, cost_before, cost_after,
      source_type, source_id, reason, created_by, created_by_name
    ) values (
      new.business_id, new.id, 'legacy_write',
      coalesce(new.current_stock, 0) - coalesce(old.current_stock, 0), null,
      coalesce(old.current_stock, 0), coalesce(new.current_stock, 0),
      coalesce(old.cost_per_unit, 0), coalesce(new.cost_per_unit, 0),
      'product', new.id, 'Written directly by an app version from before the cost ledger',
      v_caller, v_name
    );
  end if;
  return new;
end;
$$;

revoke all on function public.guard_product_cost_write() from public, anon, authenticated;
