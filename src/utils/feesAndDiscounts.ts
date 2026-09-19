/**
 * What a sale cost the business in money it chose to give up, as opposed to
 * expenses it was billed for:
 *  - delivery: the courier fee the business absorbs (sale row, falling back to the cart)
 *  - cartDiscount: the discount applied to the whole cart
 *  - itemDiscount: discounts applied to individual lines
 *
 * Amounts are as given at the time of sale, in the sale's own currency. Voided
 * sales cost nothing. Pure and I/O free so it can be unit tested with tsx.
 */

export interface FeeCartItemLike {
  quantity?: number | string | null;
  unit_price?: number | string | null;
  item_discount_amount?: number | string | null;
}

export interface FeeSaleLike {
  status?: string | null;
  delivery_cost?: number | string | null;
  sale_discount_amount?: number | string | null;
  carts?: {
    delivery_cost?: number | string | null;
    discount_type?: string | null;
    discount_value?: number | string | null;
    cart_items?: FeeCartItemLike[] | null;
  } | null;
}

export interface SaleFees {
  delivery: number;
  cartDiscount: number;
  itemDiscount: number;
  total: number;
}

const LIVE_STATUSES = new Set(['completed', 'partially_returned']);

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const ZERO: SaleFees = { delivery: 0, cartDiscount: 0, itemDiscount: 0, total: 0 };

export function saleFees(sale: FeeSaleLike | null | undefined): SaleFees {
  if (!sale || !LIVE_STATUSES.has(sale.status || '')) return { ...ZERO };

  const items = sale.carts?.cart_items || [];
  const itemDiscount = items.reduce((sum, ci) => sum + Math.max(0, num(ci.item_discount_amount)), 0);

  const delivery = Math.max(
    0,
    sale.delivery_cost !== null && sale.delivery_cost !== undefined ? num(sale.delivery_cost) : num(sale.carts?.delivery_cost)
  );

  // The sale row records the cart discount actually applied. Older rows may only
  // have the rule on the cart, so rebuild it the same way checkout does.
  let cartDiscount: number;
  if (sale.sale_discount_amount !== null && sale.sale_discount_amount !== undefined) {
    cartDiscount = num(sale.sale_discount_amount);
  } else {
    const type = sale.carts?.discount_type;
    const value = num(sale.carts?.discount_value);
    const subtotal = items.reduce(
      (sum, ci) => sum + num(ci.unit_price) * num(ci.quantity) - Math.max(0, num(ci.item_discount_amount)),
      0
    );
    if (!type || value <= 0) cartDiscount = 0;
    else if (type === 'percentage') cartDiscount = subtotal * (value / 100);
    else cartDiscount = Math.min(value, Math.max(0, subtotal));
  }
  cartDiscount = Math.max(0, cartDiscount);

  return { delivery, cartDiscount, itemDiscount, total: delivery + cartDiscount + itemDiscount };
}

export interface FeeBucket {
  deliveryFees: number;
  cartDiscounts: number;
  itemDiscounts: number;
  total: number;
  revenue: number;
  sales: number;
  salesWithDelivery: number;
  salesWithDiscount: number;
}

export const emptyFeeBucket = (): FeeBucket => ({
  deliveryFees: 0,
  cartDiscounts: 0,
  itemDiscounts: 0,
  total: 0,
  revenue: 0,
  sales: 0,
  salesWithDelivery: 0,
  salesWithDiscount: 0,
});

/** Add one sale's fees (already in the reporting currency via `factor`) to a bucket. */
export function addSaleToBucket(bucket: FeeBucket, fees: SaleFees, revenue: number, factor = 1): FeeBucket {
  bucket.deliveryFees += fees.delivery * factor;
  bucket.cartDiscounts += fees.cartDiscount * factor;
  bucket.itemDiscounts += fees.itemDiscount * factor;
  bucket.total += fees.total * factor;
  bucket.revenue += revenue * factor;
  bucket.sales += 1;
  if (fees.delivery > 0) bucket.salesWithDelivery += 1;
  if (fees.cartDiscount > 0 || fees.itemDiscount > 0) bucket.salesWithDiscount += 1;
  return bucket;
}

/** Fees as a share of what customers would have paid without any discount, in percent. */
export function feeShareOfRevenue(bucket: FeeBucket): number {
  const base = bucket.revenue + bucket.cartDiscounts + bucket.itemDiscounts;
  return base > 0 ? (bucket.total / base) * 100 : 0;
}
