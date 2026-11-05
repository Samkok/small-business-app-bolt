# BizManage business-logic review against POS / inventory / accounting standards

Date: 2026-11-05 · Commit reviewed: `98b7876` (uat, app 2.12.0) · Method: four read-only code maps
(products & pricing, sales & checkout, inventory & costing, reports & finance), compared against the
standards below. Every statement about the app cites a file; every "standard" statement names its source.

**Standards used**

| Area | Reference |
|---|---|
| Inventory costing | IAS 2 / ASC 330 (cost formula consistency, weighted average, landed cost components IAS 2.10-11, write-downs IAS 2.9 and 2.34) via the installed `inventory-costing` skill and its `calculate.py` |
| Stock accuracy | ABC cycle counting, blind counts, variance tolerance and recount, root-cause tracking (`cycle-counting` skill) |
| Demand / stock levels | ABC-XYZ, safety stock, reorder point (`inventory-demand-planning` skill; the app's `inventoryPlanning.ts` already implements this) |
| Financial statements | income statement structure, period close, cash vs accrual (`finance:financial-statements`, `finance:journal-entry`) |
| POS conventions | retail POS norms: sequential receipt numbers, tender/change, split tender, tax lines, manager-approved voids/refunds/price overrides, X/Z reports, exchanges, parked sales (no agent skill exists for this; see §1) |
| Security | OWASP Top 10:2025 (`owasp-security` skill) and the completed `security-audit` run-1 |

---

## 1. Are the installed skills the right ones?

- **Relevant and adequate:** `inventory-costing` (IAS 2 formulas, deterministic reference maths), `cycle-counting` (count program design, variance workflow), `inventory-demand-planning` (ABC/XYZ, safety stock — matches the app's Product Insight), `finance:financial-statements` / `finance:journal-entry` / `finance:variance-analysis` (statement structure, close), `owasp-security` + `security-audit` (the audit is done; the remaining items are business-logic authorisation, §7).
- **Not needed for this app:** `inventory-costing`'s FIFO/LIFO and standard-cost sections (the app is, correctly, moving weighted average), the `finance:sox-testing`/`audit-support` skills.
- **Missing from every catalogue checked:** there is no "point of sale" or "retail inventory management" agent skill in your claude.ai catalogue (searched: point of sale, retail, inventory management, pricing, COGS, accounting) nor on skills.sh/skillselion/openskillindex. POS conventions in this review therefore come from general retail-POS practice, stated explicitly where used. Writing a project skill from this document (`.claude/skills/bizmanage-domain/SKILL.md`) is the practical way to make these rules reusable.
- **Optional add for routine checks:** `yoanbernabeu/supabase-pentest-skills/supabase-audit-rls` (≈660 installs, RLS bypass testing before deploys) and `jeremylongshore/.../supabase-security-basics`. Neither goes beyond what run-1 already covered; they are useful as a cheap pre-release check, not as a replacement. Review their SKILL.md before installing.

---

## 2. Verdict at a glance

| Domain | Against standard | Headline |
|---|---|---|
| Product master data | **Partial** | Correct core (name, barcode, base/pack units, price per unit, cost per base unit); missing category/SKU/tax/supplier; no role gate on price/cost; several integrity gaps (§3) |
| Cost calculation | **Standard (IAS 2 weighted average)** | Single ledger, landed cost, per-base-unit average, snapshot at sale, reversal rules; gaps: no NRV write-down, no on-hand valuation report, freight allocated per base unit only (§4) |
| Receiving / imports | **Below standard** | No purchase order, no supplier, no partial receipt, non-atomic arrival, any member may receive (§5) |
| Stock adjustments / counts | **Above typical small-POS** | Blind counts, ABC frequency, reasons, cost snapshot, roles; gaps: no count freeze, no tolerance/recount, hard-delete of adjustments (§5) |
| Sales / POS | **Partial** | Carts, park, server-side discounts, sequential receipts, idempotent completion, offline queue, returns/void/edit with history, web orders; gaps: client-trusted totals, no tender/change/split/tax/shift, broken return lifecycle, two stock-accuracy defects (§6) |
| Reports / finance | **Partial** | Income statement shape is right (incl. IAS 2.34 write-offs); gaps: no ending-inventory valuation, inconsistent currency handling, dashboard ≠ statement, no period lock, COD counted as revenue with no receivable (§7) |
| Authorisation model | **Below standard** | RLS is role-blind for most tables; staff can change prices, set opening cost, receive stock, delete expenses, edit sales (§8) |

The six items marked **P0** in §9 are defects (wrong stock or wrong money), not missing features. Fix those first.

---

## 3. Product creation, units, price — UX flow versus standard

**What the app does** (`src/components/products/ProductForm.tsx:630-993`): one form for add/edit; order: image → name → barcode (single-unit) → currency → price → cost (+ reason on change) → stock & min stock → unit group with per-unit cards → description. Barcode required (4-50 chars, letters/digits/hyphens), generated EAN-13 with in-store prefix 2 (`generate_product_barcode`), scan-to-find switches to edit. Multi-unit: `unit_groups` → `units` (largest→smallest, last is base, integer factors, `conversion_factor_to_base`), `product_unit_prices` per unit (label, barcode, price), `products.price` = base-unit price, stock entered per unit and summed to base units. Cost: one `cost_per_unit` per base unit; non-base unit cost = base × factor at the moment of sale (`CartContext.tsx:428-441`).

**Standard retail master-data flow** (what a POS buyer expects): identity (name, SKU/internal code, GTIN-validated barcode, category) → unit of measure with pack hierarchy (each: barcode, sell price, optional purchase price) → cost (last/average, read-only for cashiers) → pricing rules (price per unit, margin shown, warn when price < cost, price history) → stock controls (min/reorder qty, lead time) → tax class → supplier. Factors are locked once stock or history exists.

**Assessment**

| Point | App | Standard | Gap |
|---|---|---|---|
| Base/pack units with integer factors, stock in base units, sell price per unit | Yes (`units.ts`, form unit cards) | Yes | None — this is the right model |
| Cost per base unit, pack cost derived | Yes (`productCost.ts`, `CartContext.tsx:438`) | Yes | None |
| Barcode uniqueness | Per table only; cross-table (product vs variant) checked on the client only (`ProductForm.tsx:350-356`); archived barcodes blocked forever | Unique across all sellable codes; GTIN check digit validated | Add a DB-level cross-table check; validate EAN/UPC check digit when 8/12/13 digits; allow re-use after archive |
| Price < cost warning, margin display | None | Standard | Add non-blocking warning and live margin on the form |
| Price 0 / blank variant price saved as 0 | Allowed | Usually blocked for sellable items | Require > 0 or an explicit "price on request" flag |
| Category / SKU / supplier / tax class | Absent (`database.ts:1096-1116`) | Standard | Category and SKU are cheap wins; tax depends on §6 |
| Factor edit after stock exists | Allowed, no re-scale (`UnitGroupEditModal.tsx:183-197`) | Locked or guarded | Block when stock > 0 or any `cart_items`/`inventory_imports` reference the unit |
| Variant save | delete-then-insert, two requests (`units.ts:198-236`); removing the group leaves orphan rows | Atomic | Move to one RPC |
| Variant price history | None | Price history is standard | Log to `product_history` like the base price |
| Who may edit price/cost | Any member (RLS `FOR ALL` on products, no `isStaff` on the inventory list); staff set opening cost on create; staff see cost everywhere | Manager-only price/cost; cashiers see no cost | §8 role matrix |
| **Cart line merge by product only** (`carts.ts:191-196`, `product-selection.tsx:160`) | A Box and a Bottle of the same product collapse into one line, priced at whichever came first | Lines are keyed by product + unit | **P0 defect** |
| **Instant checkout omits `unit_id`** (`src/services/instantCheckout.ts:147-159`) | A pack sold through instant checkout decrements raw quantity (1 box → −1 bottle) | Base-unit conversion always | **P0 defect** |

**Recommended creation flow (minimal change to the existing form):** keep the order but (1) validate GTIN check digits and cross-table uniqueness on blur *and* in the DB; (2) show margin % next to each unit price and warn when price < cost × factor; (3) hide cost and price inputs from staff on create as well as edit; (4) lock factors once used; (5) add Category and SKU (both optional, filterable); (6) save variants atomically. Costing itself needs no UX change: opening cost → receipts average it → manual correction with reason is the IAS 2 flow.

---

## 4. Cost calculation — single and multiple units

**Formula in production** (`20261104090000_product_cost_ledger.sql:162-212`): receipt `avg = (S·C + q·c)/(S + q)` per base unit, 4 dp; if `C ≤ 0` or `S ≤ 0` the incoming cost replaces the average (logged as `revaluation` when `C ≤ 0 and S > 0`); reversal removes units at their incoming cost and keeps the average when stock would hit 0; manual correction (owner/admin, reason) changes cost only; sales, returns, adjustments and counts snapshot and never move the average. Pack imports convert `qty·factor` and `cost ÷ factor` before averaging (`productCost.ts:123-129`). Verified against the `inventory-costing` skill's `weighted_average_cogs` reference: same moving-average definition.

**Landed cost** (`batchImport.ts:39-71`): `per_total` extras are spread by base-unit quantity; `per_unit` extras are charged **per base unit**. IAS 2.10-11 allows any systematic allocation; by quantity is acceptable. Two cautions: a `per_unit` shipping charge quoted per box is multiplied by the factor (likely not what the user typed — label it "per base unit" or allocate per imported unit), and allocation by value is the more common choice when a batch mixes cheap and expensive lines.

**Against IAS 2 / ASC 330**

| Requirement | App | Status |
|---|---|---|
| One formula for similar items, applied consistently | Weighted average everywhere, single writer with row lock | Meets |
| Cost = purchase price + import duties + transport, net of discounts | Base cost + allocated extras; no supplier discount/rebate field | Meets (minor) |
| Perpetual COGS at the cost when sold | `cart_items.cost_per_unit` snapshot (`CartContext.tsx:438`); `calculate_cogs` falls back to *current* cost when the snapshot is 0 | Meets; the fallback must be visible (it is, via `count_sales_lines_missing_cost`) but note `getProductFinancialSummary` (`reports.ts:1256`) ignores returns and `getSalesCOGSReport` (`reports.ts:1177`) skips currency conversion — three COGS code paths should be one |
| Lower of cost and NRV (IAS 2.9), reversal when NRV recovers | None | **Gap** — no on-hand valuation, no NRV test, no obsolescence provision |
| Write-downs and losses expensed when they occur (IAS 2.34) | `stock_adjustments` at snapshot cost, in the income statement | Meets |
| Audit trail of every cost change | `product_cost_events` + `product_history` | Meets (better than most small POS) |
| Zero-cost stock treated as "unknown", not free | Revaluation rule | Pragmatic and documented; make the 109 known zero-cost products a one-time backfill task |

**Ending inventory**: the only stock value is `inventoryPlanning.ts:200-231` on the insight screen. A standard set needs `Σ current_stock × cost_per_unit` (and at retail) in the reports, by date if possible (`product_history` makes a point-in-time rebuild feasible).

---

## 5. Receiving, imports, adjustments, counts

**Receiving** (`batchImport.ts`, `inventory.ts`): statuses `pending`→`completed` only; no purchase order, no ordered-vs-received quantity, no partial receipt, no supplier, no currency on imports (treated as default currency, `reports.ts:874-877`), completed batches cannot be edited (delete and re-import). Any member may create and receive (RLS `20251119081226…:407-470`).

Defects: `markBatchAsArrived` sets the batch `completed` **before** the per-line ledger calls and runs them as separate client calls (`batchImport.ts:170-276`) — a failure mid-way leaves a completed batch with un-received lines; the per-line `inventory_imports` update filters by `product_id + batch_id` only (`:248-257`), so the same product in two units in one batch gets both rows overwritten. Reports count **pending** imports as spend and cash outflow (`reports.ts:820-845, 880-960`) and sum imported units, not base units.

Standard: PO (or at least "expected") → receipt with partial quantities → landed cost → put-away, received by a stock role, in one transaction, with supplier and currency on the document. Minimum fix: move arrival into one SECURITY DEFINER RPC (lock batch, loop lines, call the cost event, set completed last), add `unit_id` to the line update, add `supplier` text and `currency_id` to batches, count spend at arrival.

**Adjustments and counts** (`20260916143147_stock_adjustments.sql`, `stock-count.tsx`): signed base-unit quantity, reason codes (damaged/expired/lost/sample/count/found/other), cost snapshot, `stock_after ≥ 0`, owner/admin only, blind mode, ABC frequency filter, session id. Against the `cycle-counting` skill this is a sound ABC program with blind counting — ahead of most small POS products.

Gaps against the skill's variance workflow: variance is computed at posting time with no count-start snapshot (sales during a count distort the variance — freeze the system quantity when the count starts, or post against the start snapshot ± movements); no tolerance threshold or recount step; no root-cause field on `count` adjustments; `delete_stock_adjustment` hard-deletes and "the write-off disappears from the statements" (`20260920162137…`) — standard is a reversing adjustment that keeps the trail; no accuracy KPI (counts within tolerance / total). Low-stock: `min_stock_level` and `get_low_stock_products` exist but **nothing generates a low-stock notification** even though the type and push handling exist — either wire a trigger on `products` or remove the dead handling.

---

## 6. Sales and checkout against POS conventions

**Present and standard-grade**: database carts with park/draft (`cart/[cartId].tsx:766-790`); server-computed item and cart discounts with caps (`cart_items_discount_trigger`, `cart_details_with_discounts`); per-business sequential receipt numbers assigned in-transaction (`assign_sale_receipt_number`), never reused, printed with barcode; idempotent completion; stock decrement in base units with refusal below zero; offline queue per account with replay; returns at price paid after cart discount with optional loss deduction and prorated delivery; void with loss options; sale edit through one RPC with before/after history; web orders with rate limits and server-set prices; receipt reprint by scanned number.

**Defects (money or stock wrong)**

| # | Defect | Where | Standard |
|---|---|---|---|
| P0-1 | Return quantity capped per call, not cumulatively; `fully_returned` is never set | `ReturnSaleForm.tsx:63`, `sales.ts:856-857`, `restore_sale_stock` checks `quantity ≤ cart_items.quantity` only | Returns are bounded by sold − already returned; a sale becomes fully returned when nothing is left |
| P0-2 | Void after a partial return restores **all** sold quantities again (double restore) | `voidSale` (`sales.ts:628-700`), Void button shown on `partially_returned` (`SaleDetailsContent.tsx:765`) | Void is only allowed before any return, or restores net quantities |
| P0-3 | Instant checkout omits `unit_id` → pack sales decrement raw quantity | `instantCheckout.ts:147-159` | Always convert to base units |
| P0-4 | Cart merges lines by product only | `carts.ts:191-196` | Key by product + unit |
| P0-5 | `complete_sale_atomic` trusts `p_total_amount`, discounts, subtotal and delivery from the client (`phase1:69-83`); `unit_price` is client-written | Server recomputes totals from `cart_details_with_discounts` inside the transaction (as `edit_sale_atomic` already does) and validates `p_customer_id`/`p_currency_id` belong to the business |
| P0-6 | Batch arrival non-atomic and unit-blind (§5) | `batchImport.ts` | One transaction |

**Missing features that a POS buyer expects** (each confirmed absent): amount tendered and change due; more than one payment method per sale (no `payments` table); tax/VAT at any level (Cambodia: 10 % VAT for registered businesses — at minimum a per-business tax rate and tax-inclusive/exclusive flag, with a tax line on the receipt and a tax report); shift/till: opening float, cash in/out, X/Z report, payment-method totals per day; manager approval for void/refund/price override (today any member can void, return, edit a sale and change prices); `sale_date` is unbounded (allow backdating only within an open period and to ≤ now); `refund` action and `refunded` status are unused — either wire a cash refund or remove them; `sale_actions` row and the status update are two non-atomic client requests (`sales.ts:839-864`) — move into an RPC; no receipt e-mail/SMS, no ESC/POS printer path (the app prints via the OS dialog, acceptable for phones, limiting for counters); no stock reservation for parked carts or web orders (acceptable, but show "committed" quantity).

---

## 7. Reports and finance

**Income statement** (`reports.ts:1089-1175`): revenue = `total_amount + absorbed delivery − return refunds` over completed/partially-returned sales; gross profit = revenue − COGS − write-offs + found (IAS 2.34); opex by category + delivery fees; net income; margins; refund deductions as a memo. This is the right shape for a trading business.

**Gaps**

- **Dashboard ≠ statement**: `getDashboardStats` profit = revenue − COGS without write-offs/found (`reports.ts:82-242`). Use one function.
- **No ending inventory / no inventory movement** (opening + purchases − COGS − write-offs = closing). Add a stock-valuation report; it also closes the IAS 2.9 NRV gap once a selling-price comparison is added.
- **COD recognised as revenue at sale date with no receivable**: fine for a cash-basis shop if labelled; add an "unpaid COD" list and total so the owner can collect, and exclude unpaid COD from cash-flow operating receipts.
- **Currency**: expenses never get `currency_id` (`ExpenseForm.tsx:93-101`); imports have none; expenses/adjustments/imports convert at *today's* rate while sales use the rate at sale; `getSalesCOGSReport`, customer reports, void/return/loss reports and sales history do no conversion at all; there is no rate history. Standard: rate at transaction date on every document, one conversion helper used by every report.
- **Period close**: completed sales can be edited at any later date (`edit_sale_atomic`), adjustments deleted, expenses hard-deleted with no history. Standard: a per-business "closed through" date that blocks edits/deletes before it (require a reversing entry instead), and an expense history table like `sale_edits`.
- **Top products includes refunded sales** (`getTopProducts` has no status filter) while revenue excludes them; `getTopCustomers` uses `current_total_amount` without the delivery add-back — align with `saleMoney.ts`.
- **Payment-method breakdown** and daily Z totals are absent (§6).
- **Capital expenses by keyword match** (`['equipment','asset','capital']`, `reports.ts:20`) — make it a flag on the category.
- Pending imports counted as spend/cash outflow (§5).

Exports: CSVs are formula-safe (`csvCell`) and cover sales, statement, cash flow, fees, spend, products; missing: currency column and payment status on the sales CSV, a stock-valuation CSV, PDF statements.

---

## 8. Authorisation model (business logic, post-audit)

The security audit closed the cross-tenant and ownership holes (phases 1-4). What remains is **role granularity inside a business**, which is where POS products differ most from this app:

| Action | App today | Standard POS |
|---|---|---|
| Change selling price / variant price | any member | manager; cashier price override needs approval and is logged |
| Set opening cost on create / see cost | any member (cost visible to staff on details and history) | manager only; cashiers see no cost |
| Receive stock, delete batches | any member | stock/manager role |
| Void, return, edit a sale | any member | cashier may return within limits; void/edit/backdate = manager approval; every action logged with approver |
| Create/delete expenses | any member, no history | manager; history kept |
| Adjust stock, post counts, change cost | owner/admin (correct) | same |

Recommendation: one `can_manage_catalog(business_id)` / `can_approve_sales_action(business_id)` pair of SQL helpers used by RLS `WITH CHECK` clauses and the RPCs, a `permissions` JSON on `user_business_roles` if finer control is wanted later, and `isStaff` gating in the product form, inventory list, expenses and sale-details actions. The phase-4b strict guards (`20261105160000`) should be applied as soon as 2.12 is the floor; they are part of this model.

---

## 9. Prioritised actions

**P0 — defects (wrong stock or wrong money) — FIXED 2026-11-05** (migration `20261105170000_p0_sale_integrity`, client 2.12)
1. Instant checkout passes `unit_id` on every `cart_items` insert (`instantCheckout.ts`). Done.
2. Cart lines are keyed by product + unit (`carts.ts`, `product-selection.tsx`, `CartContext.tsx`). Done.
3. Returns are capped server-side at sold − already returned (`record_sale_action`); the app derives "fully returned" from the return actions (`isFullyReturned`, no new status) and hides Void once any return exists; the server refuses a void after a return. Done.
4. `complete_sale_atomic` recomputes every money field from `cart_details_with_discounts` inside the transaction and ignores the caller's totals; customer and currency must belong to the business; the sale date is bounded to [now − 366 days, now + 5 min]; an empty cart is refused. Done.
5. Batch arrival is one RPC, `receive_inventory_batch(p_batch_id, p_lines, p_arrival_date)`: lines matched by `inventory_imports.id`, stock and cost through `apply_product_cost_event`, batch `completed` last. Done.
6. Void and return write the action row, the stock and the status in one transaction (`record_sale_action`); `performed_by` comes from the session. Done.

**P1 — standard conformance**
7. Role matrix (§8) in RLS `WITH CHECK` + UI gates; apply phase-4b guards when 2.12 is the floor.
8. Tender/change and split payments (`payments` table: sale_id, method, amount); payment-method totals per day.
9. Tax: per-business rate(s), inclusive/exclusive flag, tax line on receipt and in exports.
10. Period close date per business; reversing entries instead of hard deletes (adjustments, expenses); expense history.
11. Stock valuation report (on hand × avg cost, at retail) and a simple NRV check (price < cost list).
12. One currency path: `currency_id` on expenses and imports, rate-at-date, every report through `reportCurrency`.
13. Count freeze at start, tolerance + recount, root-cause field; low-stock notification trigger.
14. Receiving: supplier, currency, partial receipts; count spend at arrival.
15. Product form: GTIN check digit + cross-table barcode check in DB, price-below-cost warning with margin, lock factors once used, atomic variant save, variant price history, category/SKU.

**P2 — features**
16. Shift/till with opening float and Z report; receipt e-mail/SMS; ESC/POS printing; committed-stock display for parked/web carts; loyalty/promo codes.

The P0 items above were fixed on 2026-11-05; P1 and P2 remain the baseline for the next work items. Related: `docs/security-fix-plan.md`, `docs/product-cost-flow-recommendation.md`.
