/**
 * One place that says what a sale, a return and a refund are worth.
 *
 * Model (matches the cart summary, which shows delivery as a red deduction):
 *  - `delivery_cost` is a courier fee the business absorbs. `sales.total_amount`
 *    is therefore net proceeds: customer price − delivery fee.
 *  - Gross revenue for reporting is the customer price: total_amount + delivery_cost.
 *    Delivery fees are reported as an operating expense, never netted from revenue.
 *  - A return's `amount` is the value of the returned units at the price the customer
 *    actually paid (after item and cart discounts). `loss_amount` is the deduction the
 *    business keeps back from the refund. `adjusted_amount` is what is refunded.
 *    Revenue subtracts only the refund, so the retained deduction stays in revenue and
 *    must not be expensed again.
 */

export interface ReturnLikeAction {
  action_type?: string | null;
  amount?: number | string | null;
  adjusted_amount?: number | string | null;
}

export interface SaleLike {
  status?: string | null;
  total_amount?: number | string | null;
  delivery_cost?: number | string | null;
  carts?: { delivery_cost?: number | string | null } | null;
  sale_actions?: ReturnLikeAction[] | null;
}

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const LIVE_STATUSES = new Set(['completed', 'partially_returned']);

/** Amount actually refunded for one return action. 0 is a legitimate value (100% deduction). */
export function getReturnRefund(action: ReturnLikeAction | null | undefined): number {
  if (!action || action.action_type !== 'return') return 0;
  if (action.adjusted_amount !== null && action.adjusted_amount !== undefined) {
    return num(action.adjusted_amount);
  }
  return num(action.amount);
}

/** Total refunded across all return actions on a sale. */
export function getSaleRefunds(sale: SaleLike | null | undefined): number {
  return (sale?.sale_actions || []).reduce((sum, a) => sum + getReturnRefund(a), 0);
}

/** Courier fee recorded on the sale (falls back to the cart for older rows). */
export function getSaleDeliveryCost(sale: SaleLike | null | undefined): number {
  if (!sale) return 0;
  if (sale.delivery_cost !== null && sale.delivery_cost !== undefined) return num(sale.delivery_cost);
  return num(sale.carts?.delivery_cost);
}

/** Customer price net of refunds. Voided sales contribute nothing. */
export function getSaleGrossRevenue(sale: SaleLike | null | undefined): number {
  if (!sale || !LIVE_STATUSES.has(sale.status || '')) return 0;
  return num(sale.total_amount) + getSaleDeliveryCost(sale) - getSaleRefunds(sale);
}

/** Cash the business keeps from the sale after courier fee and refunds. */
export function getSaleNetProceeds(sale: SaleLike | null | undefined): number {
  if (!sale || !LIVE_STATUSES.has(sale.status || '')) return 0;
  return num(sale.total_amount) - getSaleRefunds(sale);
}

export interface RevenueSummary {
  grossRevenue: number;
  deliveryFees: number;
  refunds: number;
  netProceeds: number;
}

/** Sum a list of live sales (already filtered to completed | partially_returned by the caller or not). */
export function summarizeRevenue(sales: SaleLike[] | null | undefined): RevenueSummary {
  const out: RevenueSummary = { grossRevenue: 0, deliveryFees: 0, refunds: 0, netProceeds: 0 };
  for (const s of sales || []) {
    if (!LIVE_STATUSES.has(s.status || '')) continue;
    out.grossRevenue += getSaleGrossRevenue(s);
    out.deliveryFees += getSaleDeliveryCost(s);
    out.refunds += getSaleRefunds(s);
    out.netProceeds += getSaleNetProceeds(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Refund calculation for returns
// ---------------------------------------------------------------------------

export interface ReturnRequestItem {
  productId: string;
  quantity: number;
  lossType?: 'none' | 'fixed' | 'percentage';
  lossAmount?: number;
  lossPercentage?: number;
}

export interface ReturnableCartItem {
  product_id: string;
  quantity: number;
  unit_price?: number | string | null;
  subtotal?: number | string | null;
  products?: { name?: string | null } | null;
}

export interface ReturnableSale {
  subtotal_before_discount?: number | string | null;
  sale_discount_amount?: number | string | null;
  delivery_cost?: number | string | null;
  carts?: {
    delivery_cost?: number | string | null;
    discount_type?: string | null;
    discount_value?: number | string | null;
    cart_items?: ReturnableCartItem[] | null;
  } | null;
}

export interface ReturnRefundLine {
  productId: string;
  productName: string;
  quantity: number;
  /** price the customer paid per unit, after item and cart discounts */
  unitPricePaid: number;
  /** quantity × unitPricePaid */
  originalAmount: number;
  lossAmount: number;
  lossPercentage: number;
  lossType?: 'fixed' | 'percentage';
  /** originalAmount − lossAmount, never below 0 */
  adjustedAmount: number;
}

export interface ReturnRefund {
  items: ReturnRefundLine[];
  /** Σ originalAmount: value of returned goods at the price paid */
  itemsAmount: number;
  /** Σ lossAmount: kept back by the business */
  totalLoss: number;
  /** prorated courier fee refunded on top, when the caller opts in */
  deliveryRefund: number;
  /** cash handed back to the customer */
  refund: number;
}

/**
 * Share of the customer price that survives the cart-level discount.
 * Uses the amounts frozen on the sale; falls back to the cart's discount rule.
 */
export function getCartDiscountFactor(sale: ReturnableSale): number {
  const items = sale.carts?.cart_items || [];
  const itemsSubtotal = num(sale.subtotal_before_discount) || items.reduce((s, ci) => s + num(ci.subtotal), 0);
  if (itemsSubtotal <= 0) return 1;

  let discount = num(sale.sale_discount_amount);
  if (!discount && sale.carts?.discount_type && num(sale.carts?.discount_value) > 0) {
    const value = num(sale.carts.discount_value);
    discount = sale.carts.discount_type === 'percentage'
      ? itemsSubtotal * (value / 100)
      : Math.min(value, itemsSubtotal);
  }
  const factor = 1 - discount / itemsSubtotal;
  return Math.min(1, Math.max(0, factor));
}

export function calculateReturnRefund(
  sale: ReturnableSale,
  requested: ReturnRequestItem[],
  options?: { includeDeliveryCost?: boolean }
): ReturnRefund {
  const cartItems = sale.carts?.cart_items || [];
  const factor = getCartDiscountFactor(sale);
  const lines: ReturnRefundLine[] = [];

  for (const req of requested) {
    if (!req || req.quantity <= 0) continue;
    const ci = cartItems.find(c => c.product_id === req.productId);
    if (!ci || !ci.quantity) continue;

    const lineSubtotal = ci.subtotal !== null && ci.subtotal !== undefined
      ? num(ci.subtotal)
      : num(ci.unit_price) * ci.quantity;
    const unitPricePaid = (lineSubtotal / ci.quantity) * factor;
    const quantity = Math.min(req.quantity, ci.quantity);
    const originalAmount = round2(unitPricePaid * quantity);

    let lossAmount = 0;
    let lossType: 'fixed' | 'percentage' | undefined;
    if (req.lossType === 'fixed' && num(req.lossAmount) > 0) {
      lossType = 'fixed';
      lossAmount = Math.min(originalAmount, num(req.lossAmount));
    } else if (req.lossType === 'percentage' && num(req.lossPercentage) > 0) {
      lossType = 'percentage';
      lossAmount = round2(originalAmount * (num(req.lossPercentage) / 100));
    }

    lines.push({
      productId: req.productId,
      productName: ci.products?.name || 'Unknown',
      quantity,
      unitPricePaid: round2(unitPricePaid),
      originalAmount,
      lossAmount: round2(lossAmount),
      lossPercentage: lossType === 'percentage' ? num(req.lossPercentage) : 0,
      lossType,
      adjustedAmount: round2(Math.max(0, originalAmount - lossAmount)),
    });
  }

  const itemsAmount = round2(lines.reduce((s, l) => s + l.originalAmount, 0));
  const totalLoss = round2(lines.reduce((s, l) => s + l.lossAmount, 0));

  let deliveryRefund = 0;
  const deliveryCost = sale.delivery_cost !== null && sale.delivery_cost !== undefined
    ? num(sale.delivery_cost)
    : num(sale.carts?.delivery_cost);
  if (options?.includeDeliveryCost && deliveryCost > 0) {
    const totalUnits = cartItems.reduce((s, c) => s + (c.quantity || 0), 0);
    const returnedUnits = lines.reduce((s, l) => s + l.quantity, 0);
    if (totalUnits > 0) deliveryRefund = round2(deliveryCost * (returnedUnits / totalUnits));
  }

  const refund = round2(Math.max(0, itemsAmount - totalLoss + deliveryRefund));
  return { items: lines, itemsAmount, totalLoss, deliveryRefund, refund };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
