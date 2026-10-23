-- Editing a completed sale: lines (add, remove, quantity, price, item discount), customer,
-- sale discount, delivery and PAID/COD, all in one transaction. Stock follows the line
-- changes and every edit keeps a before/after record that the sale detail shows.

create table if not exists public.sale_edits (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  edited_by       uuid references auth.users(id) on delete set null,
  edited_by_name  text,
  edited_at       timestamptz not null default now(),
  reason          text,
  -- full snapshots of the sale header and its lines, before and after this edit
  before          jsonb not null,
  after           jsonb not null,
  -- the readable list of what changed, see edit_sale_atomic
  changes         jsonb not null default '[]'::jsonb
);

create index if not exists sale_edits_sale_id_edited_at_idx on public.sale_edits (sale_id, edited_at desc);

alter table public.sale_edits enable row level security;

drop policy if exists "Members can view sale edits" on public.sale_edits;
create policy "Members can view sale edits" on public.sale_edits
  for select to authenticated
  using (exists (
    select 1 from public.user_business_roles r
     where r.business_id = sale_edits.business_id and r.user_id = (select auth.uid())
  ));
-- Rows are written only by edit_sale_atomic (security definer): no insert/update/delete policy.

-- Base units in one sold unit (1 when the line has no unit)
create or replace function public.sale_edit_unit_factor(p_unit_id uuid)
returns integer
language sql stable
set search_path to 'public'
as $$
  select coalesce((select conversion_factor_to_base from public.units where id = p_unit_id), 1);
$$;

-- Moves stock for a line change. p_sold_delta is the change in units SOLD (positive takes
-- stock, negative returns it). Serialises on the product row and refuses to go below zero.
create or replace function public.sale_edit_apply_stock(
  p_product_id uuid, p_business_id uuid, p_sold_delta integer, p_caller uuid
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_before integer;
  v_after integer;
begin
  select coalesce(current_stock, 0) into v_before
    from public.products where id = p_product_id and business_id = p_business_id for update;
  if v_before is null then
    raise exception 'Product not found in this business';
  end if;
  if p_sold_delta = 0 then
    return jsonb_build_object('before', v_before, 'after', v_before);
  end if;
  v_after := v_before - p_sold_delta;
  if v_after < 0 then
    raise exception 'Insufficient stock for product % (have %, need % more)', p_product_id, v_before, p_sold_delta;
  end if;
  update public.products set current_stock = v_after, updated_at = now() where id = p_product_id;
  insert into public.product_history (product_id, changed_by_user_id, business_id, field_name, old_value, new_value)
  values (p_product_id, p_caller, p_business_id, 'current_stock', v_before::text, v_after::text);
  return jsonb_build_object('before', v_before, 'after', v_after);
end;
$$;

-- What a sale looks like right now: header fields that an edit can touch, plus its lines.
create or replace function public.sale_edit_snapshot(p_sale_id uuid)
returns jsonb
language sql stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'customer_id', s.customer_id,
    'customer_name', cu.name,
    'sale_discount_type', s.sale_discount_type,
    'sale_discount_value', s.sale_discount_value,
    'sale_discount_amount', s.sale_discount_amount,
    'subtotal_before_discount', s.subtotal_before_discount,
    'delivery_cost', coalesce(c.delivery_cost, 0),
    'delivery_charge', coalesce(c.delivery_charge, 0),
    'payment_status', s.payment_status,
    'total_amount', s.total_amount,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'product_id', ci.product_id,
        'product_name', p.name,
        'quantity', ci.quantity,
        'unit_id', ci.unit_id,
        'unit_name', u.name,
        'unit_price', ci.unit_price,
        'cost_per_unit', ci.cost_per_unit,
        'item_discount_type', ci.item_discount_type,
        'item_discount_value', ci.item_discount_value,
        'item_discount_scope', ci.item_discount_scope,
        'item_discount_amount', ci.item_discount_amount,
        'subtotal', ci.subtotal
      ) order by ci.created_at, ci.id)
      from public.cart_items ci
      left join public.products p on p.id = ci.product_id
      left join public.units u on u.id = ci.unit_id
      where ci.cart_id = s.cart_id
    ), '[]'::jsonb)
  )
  from public.sales s
  join public.carts c on c.id = s.cart_id
  left join public.customers cu on cu.id = s.customer_id
  where s.id = p_sale_id;
$$;

-- p_items: the complete list of lines the sale should have after the edit:
--   [{ id?: existing cart_item id, product_id, quantity, unit_id?, unit_price,
--      item_discount_type?, item_discount_value?, item_discount_scope? }]
-- A line with an id is updated (same product), a line without an id is added, and any
-- current line missing from the list is removed. Header fields are changed only when the
-- matching p_set_* flag is true (p_delivery_amount: when not null).
create or replace function public.edit_sale_atomic(
  p_sale_id uuid,
  p_items jsonb,
  p_set_customer boolean default false,
  p_customer_id uuid default null,
  p_set_discount boolean default false,
  p_discount_type text default null,
  p_discount_value numeric default null,
  p_delivery_amount numeric default null,
  p_delivery_payer text default null,
  p_set_payment_status boolean default false,
  p_payment_status text default null,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_cart public.carts%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_item jsonb;
  v_old public.cart_items%rowtype;
  v_product record;
  v_keep uuid[] := '{}';
  v_qty integer;
  v_price numeric;
  v_unit uuid;
  v_dtype text;
  v_dval numeric;
  v_dscope text;
  v_factor integer;
  v_delta integer;
  v_stock jsonb;
  v_cost numeric;
  v_new_id uuid;
  v_removed record;
  v_summary record;
  v_name text;
  v_edit_id uuid;
  v_field text;
  v_customer uuid := p_customer_id;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;
  if not exists (
    select 1 from public.user_business_roles where business_id = v_sale.business_id and user_id = v_caller
  ) then
    raise exception 'You are not a member of this business';
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'Only a completed sale can be edited (this one is %)', v_sale.status;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one item';
  end if;
  if p_delivery_payer is not null and p_delivery_payer not in ('shop', 'customer') then
    raise exception 'Unknown delivery payer: %', p_delivery_payer;
  end if;
  if p_set_payment_status and p_payment_status is not null and p_payment_status not in ('paid', 'cod') then
    raise exception 'Unknown payment status: %', p_payment_status;
  end if;
  if p_set_discount and p_discount_type is not null and p_discount_type not in ('percentage', 'fixed') then
    raise exception 'Unknown discount type: %', p_discount_type;
  end if;

  select * into v_cart from public.carts where id = v_sale.cart_id for update;
  v_before := public.sale_edit_snapshot(p_sale_id);

  -- Lines kept or added
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 then
      raise exception 'Quantity must be at least 1';
    end if;
    v_price := coalesce((v_item->>'unit_price')::numeric, 0);
    if v_price < 0 then
      raise exception 'Price cannot be negative';
    end if;
    v_unit := nullif(v_item->>'unit_id', '')::uuid;
    v_dtype := nullif(v_item->>'item_discount_type', '');
    v_dval := coalesce(nullif(v_item->>'item_discount_value', '')::numeric, 0);
    v_dscope := coalesce(nullif(v_item->>'item_discount_scope', ''), 'total');
    if v_dtype is not null and v_dtype not in ('percentage', 'fixed') then
      raise exception 'Unknown item discount type: %', v_dtype;
    end if;
    if v_dtype is null then
      v_dval := 0;
    end if;

    if nullif(v_item->>'id', '') is not null then
      select * into v_old from public.cart_items
       where id = (v_item->>'id')::uuid and cart_id = v_cart.id for update;
      if v_old.id is null then
        raise exception 'Sale line not found';
      end if;
      if v_old.product_id <> (v_item->>'product_id')::uuid then
        raise exception 'A line cannot change product; remove it and add the other product';
      end if;
      if v_unit is not null and v_unit is distinct from v_old.unit_id then
        raise exception 'A line cannot change unit; remove it and add the product in the other unit';
      end if;
      v_unit := v_old.unit_id;
      v_keep := v_keep || v_old.id;

      if v_old.quantity <> v_qty or v_old.unit_price <> v_price
         or v_old.item_discount_type is distinct from v_dtype
         or coalesce(v_old.item_discount_value, 0) <> v_dval
         or coalesce(v_old.item_discount_scope, 'total') <> v_dscope then
        v_factor := public.sale_edit_unit_factor(v_old.unit_id);
        v_delta := (v_qty - v_old.quantity) * v_factor;
        v_stock := public.sale_edit_apply_stock(v_old.product_id, v_sale.business_id, v_delta, v_caller);
        update public.cart_items
           set quantity = v_qty, unit_price = v_price, item_discount_type = v_dtype,
               item_discount_value = v_dval, item_discount_scope = v_dscope, updated_at = now()
         where id = v_old.id;
        select name into v_name from public.products where id = v_old.product_id;
        v_changes := v_changes || jsonb_build_object(
          'type', 'changed', 'product_id', v_old.product_id, 'product_name', v_name,
          'unit_name', (select name from public.units where id = v_old.unit_id),
          'before', jsonb_build_object('quantity', v_old.quantity, 'unit_price', v_old.unit_price,
                                       'item_discount_type', v_old.item_discount_type, 'item_discount_value', v_old.item_discount_value),
          'after', jsonb_build_object('quantity', v_qty, 'unit_price', v_price,
                                      'item_discount_type', v_dtype, 'item_discount_value', v_dval),
          'stock_delta', -v_delta, 'stock_before', v_stock->'before', 'stock_after', v_stock->'after');
      end if;
    else
      select id, name, cost_per_unit, currency_id, unit_group_id into v_product
        from public.products where id = (v_item->>'product_id')::uuid and business_id = v_sale.business_id;
      if v_product.id is null then
        raise exception 'Product not found in this business';
      end if;
      if v_unit is not null and not exists (
        select 1 from public.units where id = v_unit and unit_group_id = v_product.unit_group_id
      ) then
        raise exception 'Unit does not belong to this product';
      end if;
      v_factor := public.sale_edit_unit_factor(v_unit);
      v_delta := v_qty * v_factor;
      v_stock := public.sale_edit_apply_stock(v_product.id, v_sale.business_id, v_delta, v_caller);
      -- Cost of one sold unit, the same rule the cart uses when a product is added
      v_cost := coalesce(v_product.cost_per_unit, 0) * v_factor;
      insert into public.cart_items (
        cart_id, product_id, quantity, unit_price, unit_id, currency_id, cost_per_unit,
        item_discount_type, item_discount_value, item_discount_scope
      ) values (
        v_cart.id, v_product.id, v_qty, v_price, v_unit, v_product.currency_id, v_cost,
        v_dtype, v_dval, v_dscope
      ) returning id into v_new_id;
      v_keep := v_keep || v_new_id;
      v_changes := v_changes || jsonb_build_object(
        'type', 'added', 'product_id', v_product.id, 'product_name', v_product.name,
        'unit_name', (select name from public.units where id = v_unit),
        'after', jsonb_build_object('quantity', v_qty, 'unit_price', v_price,
                                    'item_discount_type', v_dtype, 'item_discount_value', v_dval),
        'stock_delta', -v_delta, 'stock_before', v_stock->'before', 'stock_after', v_stock->'after');
    end if;
  end loop;

  -- Lines removed
  for v_removed in
    select ci.*, p.name as product_name, u.name as unit_name
      from public.cart_items ci
      left join public.products p on p.id = ci.product_id
      left join public.units u on u.id = ci.unit_id
     where ci.cart_id = v_cart.id and not (ci.id = any (v_keep))
  loop
    v_factor := public.sale_edit_unit_factor(v_removed.unit_id);
    v_delta := -(v_removed.quantity * v_factor);
    v_stock := public.sale_edit_apply_stock(v_removed.product_id, v_sale.business_id, v_delta, v_caller);
    delete from public.cart_items where id = v_removed.id;
    v_changes := v_changes || jsonb_build_object(
      'type', 'removed', 'product_id', v_removed.product_id, 'product_name', v_removed.product_name,
      'unit_name', v_removed.unit_name,
      'before', jsonb_build_object('quantity', v_removed.quantity, 'unit_price', v_removed.unit_price,
                                   'item_discount_type', v_removed.item_discount_type, 'item_discount_value', v_removed.item_discount_value),
      'stock_delta', -v_delta, 'stock_before', v_stock->'before', 'stock_after', v_stock->'after');
  end loop;

  -- Header: the cart holds customer, discount and delivery; the sale mirrors them.
  -- "No customer" is the business's guest customer: a cart always has one.
  if p_set_customer then
    if v_customer is null then
      select id into v_customer from public.customers
       where business_id = v_sale.business_id and is_system_customer = true
       order by created_at limit 1;
      if v_customer is null then
        raise exception 'This business has no guest customer to assign';
      end if;
    elsif not exists (select 1 from public.customers where id = v_customer and business_id = v_sale.business_id) then
      raise exception 'Customer not found in this business';
    end if;
    update public.carts set customer_id = v_customer where id = v_cart.id;
  end if;
  if p_set_discount then
    update public.carts set discount_type = p_discount_type, discount_value = p_discount_value where id = v_cart.id;
  end if;
  if p_delivery_amount is not null then
    -- One payer holds the amount (carts_delivery_one_payer): shop pays = delivery_cost,
    -- deducted; customer pays = delivery_charge, receipt only
    if coalesce(p_delivery_payer, 'shop') = 'customer' then
      update public.carts set delivery_cost = 0, delivery_charge = round(greatest(p_delivery_amount, 0), 2) where id = v_cart.id;
    else
      update public.carts set delivery_cost = round(greatest(p_delivery_amount, 0), 2), delivery_charge = 0 where id = v_cart.id;
    end if;
  end if;
  update public.carts set updated_at = now() where id = v_cart.id;

  select * into v_summary from public.cart_details_with_discounts where cart_id = v_cart.id;

  update public.sales
     set total_amount = v_summary.final_total,
         subtotal_before_discount = v_summary.items_original_total,
         sale_discount_amount = v_summary.cart_discount_amount,
         delivery_cost = v_summary.delivery_cost,
         customer_id = case when p_set_customer then v_customer else customer_id end,
         sale_discount_type = case when p_set_discount then p_discount_type else sale_discount_type end,
         sale_discount_value = case when p_set_discount then p_discount_value else sale_discount_value end,
         payment_status = case when p_set_payment_status then p_payment_status else payment_status end
   where id = p_sale_id;

  v_after := public.sale_edit_snapshot(p_sale_id);

  foreach v_field in array array['customer_name', 'sale_discount_type', 'sale_discount_value',
                                 'delivery_cost', 'delivery_charge', 'payment_status', 'total_amount'] loop
    if v_before->v_field is distinct from v_after->v_field then
      v_changes := v_changes || jsonb_build_object('type', 'field', 'field', v_field,
                                                   'before', v_before->v_field, 'after', v_after->v_field);
    end if;
  end loop;

  if jsonb_array_length(v_changes) = 0 then
    return jsonb_build_object('changed', false, 'total_amount', v_after->'total_amount');
  end if;

  select full_name into v_name from public.user_profiles where user_id = v_caller;
  insert into public.sale_edits (sale_id, business_id, edited_by, edited_by_name, reason, before, after, changes)
  values (p_sale_id, v_sale.business_id, v_caller, v_name, nullif(btrim(p_reason), ''), v_before, v_after, v_changes)
  returning id into v_edit_id;

  return jsonb_build_object('changed', true, 'edit_id', v_edit_id, 'changes', v_changes,
                            'total_amount', v_after->'total_amount');
end;
$$;

-- Only signed-in members call the editor; the helpers run inside it and are not exposed
revoke all on function public.edit_sale_atomic(uuid, jsonb, boolean, uuid, boolean, text, numeric, numeric, text, boolean, text, text) from public, anon;
grant execute on function public.edit_sale_atomic(uuid, jsonb, boolean, uuid, boolean, text, numeric, numeric, text, boolean, text, text) to authenticated;
revoke all on function public.sale_edit_apply_stock(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.sale_edit_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.sale_edit_unit_factor(uuid) from public, anon, authenticated;
