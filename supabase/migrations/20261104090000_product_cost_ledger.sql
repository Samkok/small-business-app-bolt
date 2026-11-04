-- Product cost ledger
--
-- products.cost_per_unit is a moving weighted average per base unit. Until now three
-- engines wrote it (unattached DB triggers, the batch arrival code, and an all-time
-- recompute on batch delete) and none of them left a trail. From here on the average is
-- never written directly: every change is an event recorded in product_cost_events and
-- applied by apply_product_cost_event, which is the only writer.
--
-- Rules (see docs/product-cost-flow-recommendation.md):
--   opening            product created with stock S0 at cost C0
--   receipt            stock arrives: avg = (S*C + q*c) / (S + q); when the current cost is
--                      0 or stock is 0 the incoming cost becomes the cost ("cost unknown",
--                      not "free goods") and the event is recorded as a revaluation
--   receipt_reversal   a completed import is deleted: remove q at the cost it came in with;
--                      if the goods were already sold the average is kept, never reset to 0
--   manual_correction  owner/admin types a new cost with a reason; stock unchanged
--   revaluation        a receipt that set the cost because none was known
-- Sales, returns, stock adjustments and counts never move the average; they snapshot it.

-- 1. Precision: the average is kept to 4 places and rounded only for display.
alter table public.products alter column cost_per_unit type numeric(14,4);

-- 2. Ledger
create table if not exists public.product_cost_events (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  event_type      text not null check (event_type in ('opening', 'receipt', 'receipt_reversal', 'manual_correction', 'revaluation')),
  qty_delta       integer not null default 0,          -- base units added (+) or removed (-)
  unit_cost_in    numeric(14,4),                        -- landed cost per base unit of the units moved
  stock_before    integer not null,
  stock_after     integer not null,
  cost_before     numeric(14,4) not null,
  cost_after      numeric(14,4) not null,
  source_type     text check (source_type in ('product', 'inventory_batch', 'inventory_import')),
  source_id       uuid,
  reason          text,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);

create index if not exists product_cost_events_product_idx on public.product_cost_events (product_id, created_at desc);
create index if not exists product_cost_events_business_idx on public.product_cost_events (business_id, created_at desc);

alter table public.product_cost_events enable row level security;

drop policy if exists "Members can read product cost events" on public.product_cost_events;
create policy "Members can read product cost events"
  on public.product_cost_events for select to authenticated
  using (exists (
    select 1 from public.user_business_roles r
     where r.business_id = product_cost_events.business_id and r.user_id = (select auth.uid())
  ));
-- Rows are written only by the functions below (security definer): no insert/update/delete policy.

-- 3. Guard: nobody writes products.cost_per_unit except through the ledger.
create or replace function public.guard_product_cost_write()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.cost_per_unit is distinct from old.cost_per_unit
     and coalesce(current_setting('app.cost_event', true), '') <> '1' then
    raise exception 'cost_per_unit is managed by the cost ledger; call apply_product_cost_event'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_product_cost_write on public.products;
create trigger trg_guard_product_cost_write
  before update of cost_per_unit on public.products
  for each row execute function public.guard_product_cost_write();

-- 4. Opening event when a product is created.
create or replace function public.record_product_opening_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller uuid := auth.uid();
  v_name   text;
begin
  select full_name into v_name from public.user_profiles where user_id = v_caller;
  insert into public.product_cost_events (
    business_id, product_id, event_type, qty_delta, unit_cost_in,
    stock_before, stock_after, cost_before, cost_after,
    source_type, source_id, created_by, created_by_name
  ) values (
    new.business_id, new.id, 'opening', coalesce(new.current_stock, 0), coalesce(new.cost_per_unit, 0),
    0, coalesce(new.current_stock, 0), 0, coalesce(new.cost_per_unit, 0),
    'product', new.id, v_caller, v_name
  );
  return new;
end;
$$;

drop trigger if exists trg_record_product_opening_cost on public.products;
create trigger trg_record_product_opening_cost
  after insert on public.products
  for each row execute function public.record_product_opening_cost();

-- 5. The one writer.
create or replace function public.apply_product_cost_event(
  p_product_id  uuid,
  p_event_type  text,
  p_qty         integer default 0,          -- base units, always positive
  p_unit_cost   numeric default null,       -- per base unit
  p_source_type text default null,
  p_source_id   uuid default null,
  p_reason      text default null
)
returns public.product_cost_events
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller      uuid := auth.uid();
  v_product     record;
  v_stock_before integer;
  v_cost_before  numeric;
  v_stock_after  integer;
  v_cost_after   numeric;
  v_type         text := p_event_type;
  v_qty_delta    integer := 0;
  v_denom        numeric;
  v_name         text;
  v_row          public.product_cost_events;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_event_type not in ('receipt', 'receipt_reversal', 'manual_correction') then
    raise exception 'Unknown cost event type: %', p_event_type;
  end if;
  if p_source_type is not null and p_source_type not in ('product', 'inventory_batch', 'inventory_import') then
    raise exception 'Unknown cost event source: %', p_source_type;
  end if;

  -- Lock the product so two devices receiving stock at once serialise.
  select id, business_id, current_stock, cost_per_unit
    into v_product
    from public.products
   where id = p_product_id
   for update;
  if v_product.id is null then
    raise exception 'Product not found';
  end if;
  if not public.user_has_business_access(v_caller, v_product.business_id) then
    raise exception 'You are not a member of this business' using errcode = '42501';
  end if;

  v_stock_before := coalesce(v_product.current_stock, 0);
  v_cost_before  := coalesce(v_product.cost_per_unit, 0);

  if p_event_type = 'receipt' then
    if p_qty is null or p_qty <= 0 then
      raise exception 'Received quantity must be at least one base unit';
    end if;
    if p_unit_cost is null or p_unit_cost < 0 then
      raise exception 'Unit cost must be zero or more';
    end if;
    v_stock_after := v_stock_before + p_qty;
    v_qty_delta   := p_qty;
    if v_cost_before <= 0 or v_stock_before <= 0 then
      -- No usable cost on the shelf: the receipt sets it rather than averaging with "free" stock.
      v_cost_after := p_unit_cost;
      if v_cost_before <= 0 and v_stock_before > 0 then
        v_type := 'revaluation';
      end if;
    else
      v_cost_after := (v_stock_before * v_cost_before + p_qty * p_unit_cost) / v_stock_after;
    end if;

  elsif p_event_type = 'receipt_reversal' then
    if p_qty is null or p_qty <= 0 then
      raise exception 'Reversed quantity must be at least one base unit';
    end if;
    if p_unit_cost is null or p_unit_cost < 0 then
      raise exception 'Unit cost must be zero or more';
    end if;
    v_stock_after := greatest(0, v_stock_before - p_qty);
    v_qty_delta   := v_stock_after - v_stock_before;
    v_denom       := v_stock_before - p_qty;
    if v_denom <= 0 then
      -- The goods were already sold or counted out; keep the average rather than divide by nothing.
      v_cost_after := v_cost_before;
    else
      v_cost_after := greatest(0, (v_stock_before * v_cost_before - p_qty * p_unit_cost) / v_denom);
    end if;

  else -- manual_correction
    if not public.can_adjust_stock(v_product.business_id, v_caller) then
      raise exception 'Only the business owner or an admin can change the cost' using errcode = '42501';
    end if;
    if p_unit_cost is null or p_unit_cost < 0 then
      raise exception 'Unit cost must be zero or more';
    end if;
    if nullif(btrim(coalesce(p_reason, '')), '') is null then
      raise exception 'A reason is required to correct the cost';
    end if;
    v_stock_after := v_stock_before;
    v_cost_after  := p_unit_cost;
  end if;

  v_cost_after := round(v_cost_after, 4);

  perform set_config('app.cost_event', '1', true);
  update public.products
     set cost_per_unit = v_cost_after,
         current_stock = v_stock_after,
         updated_at    = now()
   where id = p_product_id;
  perform set_config('app.cost_event', '0', true);

  select full_name into v_name from public.user_profiles where user_id = v_caller;

  insert into public.product_cost_events (
    business_id, product_id, event_type, qty_delta, unit_cost_in,
    stock_before, stock_after, cost_before, cost_after,
    source_type, source_id, reason, created_by, created_by_name
  ) values (
    v_product.business_id, p_product_id, v_type, v_qty_delta,
    case when p_event_type = 'manual_correction' then null else round(p_unit_cost, 4) end,
    v_stock_before, v_stock_after, v_cost_before, v_cost_after,
    p_source_type, p_source_id, nullif(btrim(coalesce(p_reason, '')), ''), v_caller, v_name
  ) returning * into v_row;

  -- Keep the existing product history readable.
  if v_cost_after <> v_cost_before then
    insert into public.product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
    values (p_product_id, v_caller, v_product.business_id, 'cost_per_unit', v_cost_before::text, v_cost_after::text);
  end if;
  if v_stock_after <> v_stock_before then
    insert into public.product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
    values (p_product_id, v_caller, v_product.business_id, 'current_stock', v_stock_before::text, v_stock_after::text);
  end if;

  return v_row;
end;
$$;

revoke all on function public.apply_product_cost_event(uuid, text, integer, numeric, text, uuid, text) from public, anon;
grant execute on function public.apply_product_cost_event(uuid, text, integer, numeric, text, uuid, text) to authenticated;
revoke all on function public.guard_product_cost_write() from public, anon, authenticated;
revoke all on function public.record_product_opening_cost() from public, anon, authenticated;

-- 6. How many sold lines in a period have no cost at all (snapshot 0 and product cost 0).
--    Reports show this next to COGS so a missing cost is never read as 100% margin.
create or replace function public.count_sales_lines_missing_cost(
  p_business_id uuid,
  p_start       timestamptz,
  p_end         timestamptz
)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case
    when not public.user_has_business_access(auth.uid(), p_business_id) then 0
    else (
      select count(*)::integer
        from public.sales s
        join public.carts c on c.id = s.cart_id
        join public.cart_items ci on ci.cart_id = c.id
        join public.products p on p.id = ci.product_id
       where s.business_id = p_business_id
         and s.status in ('completed', 'partially_returned')
         and s.sale_date >= p_start and s.sale_date <= p_end
         and coalesce(ci.cost_per_unit, 0) = 0
         and coalesce(p.cost_per_unit, 0) = 0
    )
  end;
$$;

revoke all on function public.count_sales_lines_missing_cost(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.count_sales_lines_missing_cost(uuid, timestamptz, timestamptz) to authenticated;

-- 7. Seed: one opening row per existing product so every ledger explains the current state.
insert into public.product_cost_events (
  business_id, product_id, event_type, qty_delta, unit_cost_in,
  stock_before, stock_after, cost_before, cost_after,
  source_type, source_id, reason, created_at
)
select p.business_id, p.id, 'opening', coalesce(p.current_stock, 0), coalesce(p.cost_per_unit, 0),
       0, coalesce(p.current_stock, 0), 0, coalesce(p.cost_per_unit, 0),
       'product', p.id, 'State when the cost ledger was introduced', p.created_at
  from public.products p
 where not exists (select 1 from public.product_cost_events e where e.product_id = p.id);

-- 8. Dead code: these were never attached to a trigger, and the app no longer recomputes cost.
drop function if exists public.update_product_cost_per_unit();
drop function if exists public.handle_import_update();
drop function if exists public.handle_import_delete();
-- Written on every arrival, read by nothing: the cost of a sold unit is base cost × factor.
alter table public.product_unit_prices drop column if exists cost_per_unit;
