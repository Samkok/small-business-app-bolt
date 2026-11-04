# Product cost: findings and recommended flow

Status: implemented in code on 2026-11-04 (migration `supabase/migrations/20261104090000_product_cost_ledger.sql`,
`src/services/productCost.ts`, import services, product form, product details, product card, income summary).
Applied to the live project on 2026-11-04 through the Supabase MCP as version `20261104153714`
(the file name and the live version differ; do not re-apply). 182 opening rows were seeded.
Sections 1 and 2 describe the state before the change.

## 1. What the app does today

`products.cost_per_unit` is meant to be a moving weighted average per base unit
(IAS 2 / ASC 330 "weighted average" formula). Three separate engines try to maintain it
and they disagree with each other.

| Engine | Where | Method | Attached / used? |
|---|---|---|---|
| DB triggers | `update_product_cost_per_unit`, `handle_import_update`, `handle_import_delete` | moving average on import insert, reverse-and-reapply on edit/delete | **Not attached.** No trigger exists on `inventory_imports` or `products`. Dead code. |
| App, forward | `batchImport.ts` `markBatchAsArrived` | moving average per base unit, landed costs allocated, conversion factor applied | Yes. 139 of 139 imports came through this path. Writes **no** `product_history` row. |
| App, reverse | `products.ts` `recalculateProductCost` (called on batch edit/delete) | **all-time average of completed imports only** | Yes. Ignores the opening cost typed at product creation and the running average. Deleting the only import resets the cost to 0. |
| App, single import | `inventory.ts` `markImportAsArrived` | moving average, **no conversion factor** | Reachable but never used (0 single imports). Would mis-cost a box import. |

Other facts that matter:

- Sales snapshot the cost at add-to-cart (`cart_items.cost_per_unit = base cost × unit factor`).
  Sale edits, returns and stock adjustments snapshot too and never change the average. That part is correct.
- `product_unit_prices.cost_per_unit` is written on every arrival and read by nothing. Sold-unit cost is always base cost × factor.
- `ProductForm` accepts a cost on **create only**. On edit the field is hidden, and `updateCostPerUnit` has no callers. A typo at creation cannot be fixed in the app.
- `recalculateProductCost` rounds to 2 decimals; the forward path does not. The two paths produce different numbers for the same data.
- Every write is read-then-write from the phone. Two devices receiving stock for the same product at the same moment lose one update.

## 2. What the data shows (live project, 2026-11-04)

| Measure | Value |
|---|---|
| Active products | 161 |
| Active products with stock > 0 and cost 0 | 109 (68%) |
| ...of which never imported (stock typed in at creation) | 109 |
| Products created in the last 60 days with a cost > 0 | 2 of 46 |
| Sold lines in the last 90 days carrying cost 0 | 27.8% |
| Stock adjustments that snapshotted cost 0 | 13 of 27 |
| `product_history` cost rows ever / last 30 days | 125 / 0 |

Reading: almost nobody enters a cost, the only path in use writes no history, and more than a
quarter of recent sales report 100% margin. The profit reports are overstated and there is no
trail to explain any cost figure.

## 3. Recommended design: one ledger, one function

Principle: **the average is never written directly. Every change is an event, the event is stored,
and the stored cost is just the result of the last event.** Same idea as `sale_edits` for sales.

### 3.1 Table `product_cost_events` (append-only)

| Column | Meaning |
|---|---|
| `id`, `business_id`, `product_id` | keys, RLS by business like the other tables |
| `event_type` | `opening` · `receipt` · `receipt_reversal` · `manual_correction` · `revaluation` |
| `qty_delta` | base units added (+) or removed (−); 0 for a correction |
| `unit_cost_in` | landed cost per base unit of the units received or reversed; null for a correction |
| `stock_before`, `stock_after` | base units |
| `cost_before`, `cost_after` | per base unit, unrounded, `numeric(14,4)` |
| `source_type`, `source_id` | `inventory_batch` / `inventory_import` / `product` / null |
| `reason` | free text, required for `manual_correction` |
| `created_by`, `created_at` | who and when |

### 3.2 RPC `apply_product_cost_event(...)` (SECURITY DEFINER, one per line item)

1. `SELECT ... FOR UPDATE` on the product row (fixes the two-device race).
2. Compute the new state by event type (rules in 3.3).
3. Update `products.cost_per_unit` and `current_stock` in the same statement.
4. Insert the ledger row and a `product_history` row (`cost_per_unit`, `current_stock`) so the
   existing history UI keeps working.
5. Return `cost_before`, `cost_after`, `stock_after`.

Guard: a `BEFORE UPDATE` trigger on `products` rejects a change to `cost_per_unit` unless a
session flag set by the RPC is present. Then no client, trigger or future script can bypass the ledger.
Revoke `anon` on the RPC and check `auth.role()` like the other definer functions.

### 3.3 Rules per event

- **opening** (product created with stock S₀ and cost C₀): cost = C₀, stock = S₀. Blank cost = 0.
- **receipt** (batch arrival, per item, landed cost per base unit `c`, quantity `q` in base units):
  - if `cost_before = 0` **or** `stock_before ≤ 0`: cost = `c` and the event is tagged
    `revaluation` as well. Existing zero-cost stock is treated as "cost unknown", not as free
    goods. Averaging 100 units at 0 with 10 units at 6 to get 0.55 is the current behaviour and it is wrong.
  - otherwise: `cost_after = (stock_before × cost_before + q × c) / (stock_before + q)`.
- **receipt_reversal** (completed import edited or deleted): remove the units at the cost they
  came in with: `cost_after = (stock_before × cost_before − q × c) / (stock_before − q)`.
  If the denominator is ≤ 0 (the goods were already sold) keep `cost_before` and set stock to 0.
  Never recompute from all imports; never reset to 0. An edit is a reversal followed by a new receipt.
- **manual_correction** (new, owner-only, from the product edit screen): cost = the value typed,
  stock unchanged, reason required. This is the fix for the "accidentally entered the cost" case.
- Stock adjustments, stock counts, sales, sale edits, returns: **no cost event**. Quantity moves at
  the current average and the line snapshots the cost, exactly as today.

Precision: store 4 decimals, round only when displaying in the product's currency.

### 3.4 What the user sees

- **Product edit**: the cost field is shown when editing. Changing it asks for a reason and
  states "Past sales keep the cost they were sold at." Owner only, matching `user_subscriptions` RLS.
- **Product details**: a "Cost history" card, newest first, one line per event:
  `Received 24 × $5.20 (Batch #12) · $5.00 → $5.11 · by Dara`. Reuse the `sale_edits` card pattern.
- **Inventory list and product details**: a "No cost" badge when cost is 0 and stock > 0.
- **Profit reports**: a footnote "N sold lines have no cost recorded" whenever a 0-cost
  snapshot fell back to 0, so margin is never silently overstated.

### 3.5 What goes away

- The three unattached DB functions.
- `recalculateProductCost`, `updateCostPerUnit`, the cost block in `inventory.ts` single import,
  and the cost block in `batchImport.ts` (replaced by one RPC call per item).
- Writes to `product_unit_prices.cost_per_unit` (nothing reads it).

## 4. Rollout order

1. **Database**: table, RPC, guard trigger, RLS. Seed one `opening` event per existing product
   from its current `cost_per_unit` and `current_stock` so every ledger starts balanced.
2. **App services**: batch arrival, batch edit and batch delete call the RPC. Delete the client math.
3. **UI**: cost on edit with reason, cost history card, "No cost" badge, report footnote.
4. **Cleanup**: drop dead functions and the single-import cost path. Update `CODEBASE_MAP.md`.
5. **Backfill decision for the owner**: the 109 products with stock and no cost need a cost
   typed in once (manual correction) or will pick up the first receipt's cost automatically under 3.3.

## 5. Edge cases covered by the rules

- Import received before the product has any stock → cost = landed cost.
- Import deleted after the goods were sold → stock floors at 0, average kept.
- Box or pack imports → always converted to base units before averaging; sold-unit cost stays base × factor.
- Two cashiers receiving the same product at once → row lock serialises them.
- Price typo at creation → manual correction with a visible before/after; past sales unchanged.
- Stock typo at creation → existing stock adjustment flow (already snapshots cost).

## 6. Compatibility with builds before 2.11, and the follow-up

Builds older than 2.11 write `products.cost_per_unit` directly during batch arrival and recompute
it on batch delete. The app has no forced-update mechanism, so refusing those writes would block
stock arrivals for every user who has not updated. Migration `20261104120000_cost_ledger_legacy_writes`
(applied live 2026-11-04 as version `20261104160818`; file name and live version differ, do not re-apply) therefore puts the guard in **compatibility mode**: a direct write is
allowed and recorded as a `legacy_write` event (before/after cost and stock, who wrote it). The new
build never takes that path, so every `legacy_write` row is a user still on an old build.

Check, every week or two:

```sql
select count(*) from product_cost_events
 where event_type = 'legacy_write' and created_at > now() - interval '14 days';
```

When it returns 0, restore the strict guard with this migration (not written to the migrations
folder yet, so nothing unapplied sits there):

```sql
create or replace function public.guard_product_cost_write()
returns trigger language plpgsql set search_path = public, pg_catalog as $$
begin
  if new.cost_per_unit is distinct from old.cost_per_unit
     and coalesce(current_setting('app.cost_event', true), '') <> '1' then
    raise exception 'cost_per_unit is managed by the cost ledger; call apply_product_cost_event'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_product_cost_write() from public, anon, authenticated;
```

Keep `legacy_write` in the event type check so the historic rows stay valid.

