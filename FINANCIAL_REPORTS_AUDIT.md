# Financial Reports Audit

Reviewed 2026-09-15 on the `uat` branch against the live database (`tevtbyffttmbttekhejk`, 1,938 sales, 3 partial returns, 46 voids). Scope: dashboard stats, income statement, cash flow statement, overview charts, top products/customers, CSV exports. Presentation rules checked against the `financial-statements` skill (ASC 220/230 conventions: revenue gross of fulfilment costs, expenses by function, indirect cash flow reconciles net income through working-capital changes).

## Status (2026-09-15, later the same day)

Findings 1 and 2 are fixed on `uat` (uncommitted). Findings 6, 8 and 9 were fixed along the way because they are the same question. Findings 3, 4, 5, 7 and 10 are still open.

| # | Finding | Status |
|---|---|---|
| 1 | Loss counted twice | Fixed. `loss_amount` is now "deduction kept back from the refund"; it stays in revenue and is no longer subtracted from net income. Reported as a memo line. |
| 2 | Delivery netted out of revenue; refunds over gross price | Fixed. Revenue = customer price (`total_amount + delivery_cost`) net of refunds; "Delivery Fees" is an expense line. Refunds use the price actually paid after the cart discount. |
| 6 | Two net-amount definitions | Fixed by migration `20260915100000_returned_amount_use_refunded_amount.sql` (trigger uses refunded amount, backfills the 3 negative sales). **Not yet applied to production.** |
| 8 | CSV differs from screen | Fixed. Both call `reportsService.getIncomeStatement`. |
| 9 | `adjusted_amount \|\| amount` | Fixed everywhere (`??`). |

Single source of truth: `src/utils/saleMoney.ts` (`getSaleGrossRevenue`, `summarizeRevenue`, `calculateReturnRefund`). `salesService.returnItems` and `ReturnSaleForm` share `calculateReturnRefund`, so the refund shown before confirming equals the refund recorded.

Effect on the busiest business for August 2026 (61 live sales, computed on live data):

| | Before | After |
|---|---|---|
| Revenue | 2,583.00 | 2,662.50 (gross of courier fees) |
| COGS | 1,082.55 | 1,082.55 |
| Gross margin | 58.1% | 59.3% |
| Operating expenses | 955.19 | 955.19 |
| Delivery fees | hidden in revenue | 79.50 |
| Net income | 545.26 | 545.26 |

Net income is unchanged for a month with no return deductions; revenue, expenses and margin are restated. Months containing a return with a deduction gain that deduction back in net income.

Apply the migration when ready:

```bash
supabase db push
```

---


## How the numbers are built today

```
Revenue        = Σ sales.total_amount − Σ return.adjusted_amount     (status completed | partially_returned)
COGS           = calculate_cogs()  = Σ qty × snapshot cost − returned units × cost
Gross profit   = Revenue − COGS
Expenses       = Σ expenses.amount (by category)
Losses         = Σ sale_actions.loss_amount  (voids + returns)
Net income     = Gross profit − Expenses − Losses
```

`sales.total_amount` comes from the `cart_details_with_discounts` view:
`final_total = items_subtotal_after_discount − cart_discount − delivery_cost`.
Delivery is **subtracted** from the sale, so `total_amount` is cash remitted after the courier's fee, not the price the customer paid.

What is consistent and correct: the dashboard, income statement screen and profit chart share one revenue formula; COGS uses the cost snapshot on `cart_items.cost_per_unit` with a product fallback; voided sales are excluded everywhere; returns reverse COGS for the returned units; the sale itself is written atomically.

## Findings, most serious first

### 1. Return and void "loss" is counted twice — HIGH
`salesService.returnItems` computes `adjusted_amount = refund − loss`, i.e. the business keeps the loss as a restocking fee. Revenue already subtracts only the adjusted refund, so the fee stays in revenue. The statement then subtracts the same amount again as "Losses (Voids & Returns)". Meanwhile the returned unit is put back in stock and its COGS reversed, so it is not treated as damaged either.

Live example (sale 54.50, one item 3.50 returned with 1.50 loss, 2.00 refunded):

| | Statement today | Reality |
|---|---|---|
| Revenue | 52.50 | 52.50 (customer kept 2.00 back) |
| Losses | 1.50 | 0 (fee retained, item restocked) |
| Net effect | 51.00 | 52.50 |

Where: `reportsService.getDashboardStats`, `getProfitChart`, `getCashFlowStatement`, `app/(app)/reports/income-statement.tsx`. Fix: decide one meaning. If loss is a retained fee, delete the loss deduction from net income (keep it as an informational line). If loss means damaged goods, do not restock or reverse COGS for those units and subtract the gross refund from revenue instead of the adjusted one.

### 2. Delivery cost is netted out of revenue and breaks refunds — HIGH
Because `final_total` subtracts delivery, revenue on every report is net of courier fees (808.25 across live completed sales) with no delivery expense line, so gross margin is understated and expenses are incomplete. Worse, `returnItems` refunds `cart_items.subtotal / quantity`, which is gross of delivery and gross of the cart-level discount, so a refund can exceed the sale total. Three live sales now have a negative `current_total_amount`; one shows revenue 0 and a −2.00 loss for a sale where the customer was refunded exactly what they paid.

Fix: present revenue as items − discounts, add a "Delivery fees" operating expense line (from `sales.delivery_cost`), and compute refunds from the price actually paid per unit (apply the cart discount proportion; handle delivery explicitly through `delivery_cost_included`).

### 3. The cash flow statement is the income statement relabelled — HIGH
`getCashFlowStatement`: operating cash flow = net income + equipment purchases. Inventory purchases are fetched (`inventory_imports.total_cost_for_item`) and then never used. For a cash-basis shop the operating section must add back COGS (not cash this month) and subtract cash paid for stock this month; the loss line (non-cash) should be added back. Owner contributions and withdrawals are hardcoded 0 yet rendered as real lines. Equipment is detected by category name containing "equipment", "asset" or "capital". "Net change in cash" therefore does not describe cash.

Fix: operating = net income + COGS + losses − inventory purchases (use `purchase_date`, not `created_at`) ± equipment reclass; drop or wire the owner lines; make the capital-expense classification an explicit category flag.

### 4. Revenue chart disagrees with the statements — MEDIUM
`getRevenueChart` counts only `status = 'completed'` and uses raw `total_amount` (no partial returns, no return deductions). The profit chart and income statement on the same screen include `partially_returned` net of returns. Same date range, two revenue figures.

### 5. Daily and monthly chart buckets use UTC dates — MEDIUM
Charts bucket by `sale_date.split('T')[0]` and `substring(0, 7)` (UTC) but label with local days and months, while statement queries use local boundaries. 105 of 1,938 live sales (5.4%) were made between 17:00 and 24:00 UTC, which is after midnight in Cambodia, so they land on the previous day's bar and, at month end, in the previous month. Affects `getRevenueChart`, `getExpenseChart`, `getProfitChart`, `getCustomerSpendingChart`.

### 6. Two different "net sale amount" definitions — MEDIUM
Trigger `update_sale_returned_amount` adds the gross return `amount` to `sales.returned_amount`; `current_total_amount` is generated from it. Top customers, customer spending and engagement use that column, so they net the gross refund while the statements net the adjusted refund. The same sale shows 51.00 in Top Customers and 52.50 on the income statement.

### 7. Multi-currency is ignored by the statements — MEDIUM, latent
Income statement, cash flow, all charts and the CSV exports sum `total_amount` across currencies with no conversion. The dashboard has a currency selector but calls `getDashboardStats(businessId, year, month)` without it. No live business has sales in more than one currency yet, so nothing is wrong today; it will be the first time one adds a second currency (feature shipped 2026-08-30).

### 8. CSV income statement is computed differently from the screen — LOW
`exportService.exportIncomeStatementToCsv` uses `salesService.getSalesWithCOGS` (client-side COGS) and omits the loss line; the screen uses the `calculate_cogs` RPC and includes it. The two can disagree.

### 9. `adjusted_amount || amount` fallback — LOW
Used in nine places. When a return is a 100% loss, `adjusted_amount` is legitimately 0 and the code falls back to the gross amount. No live rows hit this yet.

### 10. Small ones — LOW
`get_distinct_customer_count_for_sales` counts customers of voided sales. `calculate_cogs` inner-joins `products`, so items whose product row was deleted vanish from COGS. `getTopProducts` falls back to the current product price when a cart item has no subtotal.

## Suggested order of work

1. Findings 1 and 2 together: they are both about what a sale and a return are worth. Settle the meaning of `loss_amount` and of `delivery_cost`, then fix `returnItems`, the trigger and the revenue formula in one change. Add a backfill for the three negative sales.
2. Finding 3: rewrite `getCashFlowStatement` and its CSV.
3. Findings 4, 6, 8: make every consumer call one shared "net revenue for a sale" helper (`calculateSaleDisplayAmount` in `src/utils/profitCalculation.ts` is the right seed) and route the chart through it.
4. Finding 5: bucket by local date on the client, or return `sale_date AT TIME ZONE` from the DB.
5. Finding 7: thread `currencyId` through every report call and convert with `exchange_rate_at_sale` when no filter is set.

## About the skill

`anthropics/knowledge-work-plugins@financial-statements` is installed at `~/.agents/skills/financial-statements` (4K installs, official). It is a presentation and variance-analysis workflow, not a code checker: it gives the standard income statement, balance sheet and indirect cash flow layouts, materiality thresholds, and the GAAP rules used above. Invoke it as `/financial-statements monthly 2026-08` when you want a statement produced from exported data. Nothing in the ecosystem audits report code for a POS app; this document is that audit.
