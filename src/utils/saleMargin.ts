/**
 * Profit and margin of a sale that has not been made yet, from the same numbers
 * the checkout summaries already hold. Pure and I/O free (unit tested with tsx).
 *
 * Money model (same as src/utils/saleMoney.ts):
 *  - the customer pays the items after item and cart discounts
 *  - the courier fee is paid by the business out of that
 *  - profit = customer pays − cost of goods − courier fee
 *  - margin = profit ÷ customer pays
 *
 * `cost` on a line is the cost of ONE sold unit, so a Box of 24 must carry
 * 24 × the base unit's cost (see costPerSoldUnit).
 */

export interface MarginLine {
  quantity: number;
  /** cost of one sold unit (already multiplied up for box / pack variants) */
  cost: number;
}

export interface SaleMarginInput {
  /** items at list price, before any discount */
  itemsOriginalTotal: number;
  /** items after per-item discounts */
  itemsSubtotalAfterDiscount: number;
  /** whole-cart discount amount */
  cartDiscountAmount: number;
  /** courier fee the business absorbs */
  deliveryCost: number;
  lines: MarginLine[];
}

export interface SaleMargin {
  /** items at list price, before any discount */
  itemsOriginalTotal: number;
  /** per-item discounts given */
  itemDiscounts: number;
  /** whole-cart (order) discount given */
  cartDiscount: number;
  /** itemsOriginalTotal − itemDiscounts − cartDiscount */
  customerPays: number;
  /** itemDiscounts + cartDiscount */
  discounts: number;
  deliveryCost: number;
  cogs: number;
  profit: number;
  /** profit ÷ customer pays, in percent; 0 when nothing is charged */
  marginPct: number;
  /** what the margin would be at list price with no discount and no courier fee */
  fullPriceProfit: number;
  fullPriceMarginPct: number;
  /** margin points given away to discounts and the courier fee */
  marginPointsLost: number;
  /** lines whose cost is unknown (0), which makes the margin look better than it is */
  linesWithoutCost: number;
  hasItems: boolean;
  isLoss: boolean;
}

const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : 0;
};

/**
 * Cost of one sold unit. A recorded per-line cost wins; otherwise the product's
 * base-unit cost is multiplied by the unit's conversion factor (Box of 24 = 24×).
 */
export function costPerSoldUnit(recordedCost: unknown, baseUnitCost: unknown, conversionFactor: unknown = 1): number {
  const recorded = n(recordedCost);
  if (recorded > 0) return recorded;
  const factor = n(conversionFactor) > 0 ? n(conversionFactor) : 1;
  return Math.max(0, n(baseUnitCost)) * factor;
}

export function computeSaleMargin(input: SaleMarginInput): SaleMargin {
  const lines = (input.lines || []).filter(l => n(l.quantity) > 0);
  const original = Math.max(0, n(input.itemsOriginalTotal));
  const afterItemDiscounts = Math.max(0, n(input.itemsSubtotalAfterDiscount));
  const cartDiscount = Math.min(Math.max(0, n(input.cartDiscountAmount)), afterItemDiscounts);
  const deliveryCost = Math.max(0, n(input.deliveryCost));

  const itemDiscounts = Math.max(0, original - afterItemDiscounts);
  const customerPays = afterItemDiscounts - cartDiscount;
  const discounts = itemDiscounts + cartDiscount;
  const cogs = lines.reduce((sum, l) => sum + n(l.quantity) * Math.max(0, n(l.cost)), 0);
  const profit = customerPays - cogs - deliveryCost;
  const marginPct = customerPays > 0 ? (profit / customerPays) * 100 : 0;

  const fullPriceProfit = original - cogs;
  const fullPriceMarginPct = original > 0 ? (fullPriceProfit / original) * 100 : 0;

  return {
    itemsOriginalTotal: original,
    itemDiscounts,
    cartDiscount,
    customerPays,
    discounts,
    deliveryCost,
    cogs,
    profit,
    marginPct,
    fullPriceProfit,
    fullPriceMarginPct,
    marginPointsLost: original > 0 && customerPays > 0 ? fullPriceMarginPct - marginPct : 0,
    linesWithoutCost: lines.filter(l => n(l.cost) <= 0).length,
    hasItems: lines.length > 0,
    isLoss: lines.length > 0 && profit < 0,
  };
}
