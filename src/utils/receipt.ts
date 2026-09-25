/**
 * Turns a sale into a customer receipt. Pure and I/O free (unit tested with tsx);
 * the PDF/print HTML and the on-screen/image view are dumb renderers of the
 * ReceiptModel built here, so they cannot disagree about the money.
 *
 * Rules that are easy to get wrong:
 *  - TOTAL is what the customer paid: items − item discounts − order discount.
 *    It is NOT sales.total_amount, which is after the courier fee the business
 *    absorbed (see src/utils/saleMoney.ts). total_amount + delivery_cost is the
 *    recorded customer price and is used to cross-check the lines.
 *  - Delivery has two payers (src/utils/deliveryPayer.ts). Shop pays: the fee is
 *    delivery_cost, the BUSINESS paid the courier, and the customer sees "FREE",
 *    never the amount. Customer pays: the fee is carts.delivery_charge, it is printed
 *    as its own line and ADDED to the TOTAL. It is not part of sales.total_amount or
 *    of revenue, so it is added after the cross-check below. No fee at all means the
 *    customer pays the courier directly, outside this receipt. Walk-in sales with no
 *    fee have no delivery line at all.
 *  - PAID or COD is printed as the payment type. A COD receipt does not print a
 *    "Paid by" method (nothing has been paid yet) and its total reads TOTAL DUE.
 *    Sales made before the field existed print only their payment method.
 *  - The staff member who made the sale is not printed.
 *  - A voided sale keeps its number and prints with a VOID stamp. A partially
 *    returned sale lists what came back, what was kept as a deduction and what was
 *    refunded.
 */

import { PaymentStatus, isPaymentStatus } from './paymentStatus';

export type ReceiptStatus = 'completed' | 'voided' | 'partially_returned' | 'refunded';

export interface ReceiptBusiness {
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  pageName?: string | null;
  footer?: string | null;
  /** bank / account details printed under "Pay to" */
  paymentNote?: string | null;
  /** payment QR image (KHQR, bank app) printed under "Pay to" */
  paymentQrUrl?: string | null;
}

/** The receipt total shown a second time in another currency, e.g. a USD sale in riel. */
export interface ReceiptSecondaryCurrency {
  currencyId: string;
  /** units of this currency per 1 USD (currencies.exchange_rate_to_usd) */
  rateToUsd: number;
}

export interface ReceiptLineInput {
  name: string;
  quantity: number;
  unitLabel?: string | null;
  unitPrice: number;
  itemDiscountAmount?: number | null;
  itemDiscountType?: 'percentage' | 'fixed' | null;
  itemDiscountValue?: number | null;
  itemDiscountScope?: 'per_unit' | 'total' | null;
}

export interface ReceiptReturnedItem {
  name: string;
  quantity: number;
  /** value of the returned units at the price the customer paid */
  amount: number;
  /** part of that value the business kept back */
  deduction: number;
  refunded: number;
}

export interface ReceiptInput {
  business: ReceiptBusiness;
  receiptNumber?: number | null;
  saleId?: string | null;
  /** built from a cart before the sale exists on the server (offline) */
  provisional?: boolean;
  date: string | Date;
  status: ReceiptStatus;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod?: string | null;
  /** PAID or COD; null / absent on sales made before the field existed */
  paymentStatus?: PaymentStatus | null;
  notes?: string | null;
  lines: ReceiptLineInput[];
  orderDiscountAmount?: number | null;
  orderDiscountType?: 'percentage' | 'fixed' | null;
  orderDiscountValue?: number | null;
  /** courier fee the business paid (free delivery for the customer) */
  deliveryCost?: number | null;
  /** delivery fee charged to the customer on top of the items; wins over deliveryCost */
  deliveryCharge?: number | null;
  /** false for walk-in sales: no delivery line is printed */
  deliveryApplies?: boolean;
  /** sales.total_amount + delivery cost, when the sale is recorded */
  recordedCustomerTotal?: number | null;
  returnedItems?: ReceiptReturnedItem[];
  currencyId?: string | null;
  /** units of the receipt currency per 1 USD, as saved on the sale (sales.exchange_rate_at_sale) */
  exchangeRateAtSale?: number | null;
  /** when set, the total is also printed in this currency at the saved rate */
  secondaryCurrency?: ReceiptSecondaryCurrency | null;
}

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitLabel: string | null;
  unitPrice: number;
  /** quantity × unitPrice */
  amount: number;
  discountLabel: string | null;
  discountAmount: number;
  /** amount − discountAmount */
  netAmount: number;
}

export interface ReceiptModel {
  business: ReceiptBusiness;
  numberLabel: string;
  date: Date;
  status: ReceiptStatus;
  stamp: 'VOID' | 'PROVISIONAL' | null;
  /** emphasis marks the payment type (PAID / COD) so renderers can print it bold */
  meta: { label: string; value: string; emphasis?: boolean }[];
  paymentStatus: PaymentStatus | null;
  /** 'TOTAL', or 'TOTAL DUE' when the money is still to be collected (COD) */
  totalLabel: string;
  lines: ReceiptLine[];
  itemsAtFullPrice: number;
  itemDiscountTotal: number;
  /** after item discounts, before the order discount */
  subtotal: number;
  orderDiscountLabel: string | null;
  orderDiscountAmount: number;
  /** only when the recorded customer price differs from the lines (edited sale) */
  adjustment: number;
  /** 'charged' carries `amount` (format it with the receipt's currency); the others carry `value` */
  delivery: { kind: 'free' | 'customer_pays' | 'charged' | 'none'; label: string | null; value: string | null; amount?: number };
  /** what the customer paid: the goods, plus the delivery fee when it was charged to them */
  total: number;
  totalSavings: number;
  refund: {
    items: ReceiptReturnedItem[];
    returnedValue: number;
    deductions: number;
    refunded: number;
    netPaid: number;
  } | null;
  notes: string | null;
  footer: string | null;
  currencyId: string | null;
  /** the total in a second currency at the rate saved on the sale; null when there is none */
  secondaryTotal: { amount: number; currencyId: string } | null;
  /** value encoded in the receipt barcode (the receipt number label); null for unnumbered or provisional receipts */
  barcodeValue: string | null;
}

const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : 0;
};
const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const clean = (s?: string | null) => {
  const t = (s ?? '').trim();
  return t.length > 0 ? t : null;
};
const trimNumber = (x: number) => String(parseFloat(x.toFixed(2)));

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  transfer: 'Transfer',
  other: 'Other',
};

/** R-000412 for numbered sales, #c10af8e8 for sales made before numbering, PROVISIONAL offline. */
export function receiptNumberLabel(receiptNumber?: number | null, saleId?: string | null): string {
  if (receiptNumber !== null && receiptNumber !== undefined && n(receiptNumber) > 0) {
    return `R-${String(Math.trunc(n(receiptNumber))).padStart(6, '0')}`;
  }
  const id = clean(saleId);
  return id ? `#${id.replace(/-/g, '').slice(0, 8)}` : 'PROVISIONAL';
}

function discountLabel(prefix: string, type?: string | null, value?: number | null, scope?: string | null): string {
  if (type === 'percentage' && n(value) > 0) {
    return `${prefix} ${trimNumber(n(value))}%${scope === 'per_unit' ? ' each' : ''}`;
  }
  return scope === 'per_unit' ? `${prefix} (each)` : prefix;
}

export function buildReceiptModel(input: ReceiptInput): ReceiptModel {
  const lines: ReceiptLine[] = (input.lines || [])
    .filter(l => n(l.quantity) > 0)
    .map(l => {
      const amount = round2(n(l.quantity) * n(l.unitPrice));
      const discountAmount = round2(Math.min(Math.max(0, n(l.itemDiscountAmount)), amount));
      return {
        name: clean(l.name) || 'Item',
        quantity: n(l.quantity),
        unitLabel: clean(l.unitLabel),
        unitPrice: n(l.unitPrice),
        amount,
        discountLabel: discountAmount > 0 ? discountLabel('Item discount', l.itemDiscountType, l.itemDiscountValue, l.itemDiscountScope) : null,
        discountAmount,
        netAmount: round2(amount - discountAmount),
      };
    });

  const itemsAtFullPrice = round2(lines.reduce((s, l) => s + l.amount, 0));
  const itemDiscountTotal = round2(lines.reduce((s, l) => s + l.discountAmount, 0));
  const subtotal = round2(itemsAtFullPrice - itemDiscountTotal);
  const orderDiscountAmount = round2(Math.min(Math.max(0, n(input.orderDiscountAmount)), subtotal));
  const computedTotal = round2(subtotal - orderDiscountAmount);

  // The recorded customer price wins when it differs (a sale edited after the fact),
  // and the difference is shown so the receipt still adds up line by line.
  const recorded = input.recordedCustomerTotal;
  const hasRecorded = recorded !== null && recorded !== undefined && Number.isFinite(n(recorded));
  const adjustment = hasRecorded ? round2(n(recorded) - computedTotal) : 0;
  const goodsTotal = round2(computedTotal + (Math.abs(adjustment) >= 0.01 ? adjustment : 0));

  const deliveryCost = Math.max(0, n(input.deliveryCost));
  const deliveryCharge = round2(Math.max(0, n(input.deliveryCharge)));
  const delivery: ReceiptModel['delivery'] =
    deliveryCharge > 0
      ? { kind: 'charged', label: 'Delivery fee', value: null, amount: deliveryCharge }
      : input.deliveryApplies === false
        ? { kind: 'none', label: null, value: null }
        : deliveryCost > 0
          ? { kind: 'free', label: 'Delivery', value: 'FREE' }
          : { kind: 'customer_pays', label: 'Delivery', value: 'Paid by customer to courier' };
  // A charged delivery fee is part of what the customer pays, on top of the goods
  const total = round2(goodsTotal + deliveryCharge);

  const returned = (input.returnedItems || []).filter(r => n(r.quantity) > 0 || n(r.refunded) > 0);
  const refund = returned.length > 0
    ? (() => {
        const returnedValue = round2(returned.reduce((s, r) => s + n(r.amount), 0));
        const deductions = round2(returned.reduce((s, r) => s + n(r.deduction), 0));
        const refunded = round2(returned.reduce((s, r) => s + n(r.refunded), 0));
        return { items: returned, returnedValue, deductions, refunded, netPaid: round2(total - refunded) };
      })()
    : null;

  const paymentStatus: PaymentStatus | null = isPaymentStatus(input.paymentStatus) ? input.paymentStatus : null;

  const meta: ReceiptModel['meta'] = [];
  const customerName = clean(input.customerName);
  if (customerName) meta.push({ label: 'Customer', value: customerName });
  const customerPhone = clean(input.customerPhone);
  if (customerPhone) meta.push({ label: 'Phone', value: customerPhone });
  if (paymentStatus === 'paid') meta.push({ label: 'Payment', value: 'PAID', emphasis: true });
  if (paymentStatus === 'cod') meta.push({ label: 'Payment', value: 'COD (Cash on delivery)', emphasis: true });
  // Nothing has been paid on a COD sale yet, so a "Paid by" line would contradict it
  const payment = clean(input.paymentMethod);
  if (payment && paymentStatus !== 'cod') meta.push({ label: 'Paid by', value: PAYMENT_LABELS[payment.toLowerCase()] || payment });

  const date = input.date instanceof Date ? input.date : new Date(input.date);

  // The same total in the other currency, at the rate the sale was made at (a riel sale in
  // dollars, a dollar sale in riel). Skipped when either rate is unknown.
  let secondaryTotal: { amount: number; currencyId: string } | null = null;
  const secondary = input.secondaryCurrency;
  const saleRate = n(input.exchangeRateAtSale);
  if (secondary && secondary.currencyId !== (input.currencyId ?? null) && saleRate > 0 && n(secondary.rateToUsd) > 0) {
    secondaryTotal = { amount: round2((total / saleRate) * n(secondary.rateToUsd)), currencyId: secondary.currencyId };
  }

  return {
    business: {
      name: clean(input.business?.name) || 'Receipt',
      logoUrl: clean(input.business?.logoUrl),
      phone: clean(input.business?.phone),
      address: clean(input.business?.address),
      pageName: clean(input.business?.pageName),
      footer: clean(input.business?.footer),
    },
    numberLabel: input.provisional ? 'PROVISIONAL' : receiptNumberLabel(input.receiptNumber, input.saleId),
    date: isNaN(date.getTime()) ? new Date() : date,
    status: input.status,
    stamp: input.status === 'voided' ? 'VOID' : input.provisional ? 'PROVISIONAL' : null,
    meta,
    paymentStatus,
    totalLabel: paymentStatus === 'cod' && input.status !== 'voided' ? 'TOTAL DUE' : 'TOTAL',
    lines,
    itemsAtFullPrice,
    itemDiscountTotal,
    subtotal,
    orderDiscountLabel: orderDiscountAmount > 0 ? discountLabel('Order discount', input.orderDiscountType, input.orderDiscountValue, null) : null,
    orderDiscountAmount,
    adjustment: Math.abs(adjustment) >= 0.01 ? adjustment : 0,
    delivery,
    total,
    totalSavings: round2(itemDiscountTotal + orderDiscountAmount),
    refund,
    notes: clean(input.notes),
    footer: clean(input.business?.footer),
    currencyId: input.currencyId ?? null,
    secondaryTotal,
    barcodeValue: !input.provisional && n(input.receiptNumber) > 0 ? receiptNumberLabel(input.receiptNumber, input.saleId) : null,
  };
}

/**
 * Adapter from the shape returned by salesService.getSale (sale + customers +
 * carts.cart_items(products, units) + sale_actions) to a ReceiptInput.
 */
export function receiptInputFromSale(sale: any, business: any): ReceiptInput {
  const cart = sale?.carts || {};
  const items: any[] = cart.cart_items || [];

  const deliveryCost = sale?.delivery_cost !== null && sale?.delivery_cost !== undefined ? n(sale.delivery_cost) : n(cart.delivery_cost);
  const orderDiscountType = sale?.sale_discount_type ?? cart.discount_type ?? null;
  const orderDiscountValue = sale?.sale_discount_value ?? cart.discount_value ?? null;

  const lines: ReceiptLineInput[] = items.map(ci => ({
    name: ci.products?.name || ci.product_name || 'Item',
    quantity: n(ci.quantity),
    unitLabel: ci.units?.name ?? null,
    unitPrice: n(ci.unit_price),
    itemDiscountAmount: n(ci.item_discount_amount),
    itemDiscountType: ci.item_discount_type ?? null,
    itemDiscountValue: ci.item_discount_value ?? null,
    itemDiscountScope: ci.item_discount_scope ?? null,
  }));

  // The sale row records the order discount actually applied; older rows only have the cart rule.
  let orderDiscountAmount: number;
  if (sale?.sale_discount_amount !== null && sale?.sale_discount_amount !== undefined) {
    orderDiscountAmount = n(sale.sale_discount_amount);
  } else {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice - n(l.itemDiscountAmount), 0);
    orderDiscountAmount = !orderDiscountType || n(orderDiscountValue) <= 0
      ? 0
      : orderDiscountType === 'percentage' ? subtotal * (n(orderDiscountValue) / 100) : Math.min(n(orderDiscountValue), subtotal);
  }

  const nameById = new Map<string, string>();
  items.forEach(ci => { if (ci.product_id) nameById.set(ci.product_id, ci.products?.name || ci.product_name || 'Item'); });

  const returnedItems: ReceiptReturnedItem[] = [];
  for (const action of sale?.sale_actions || []) {
    if (action?.action_type !== 'return') continue;
    const meta: any[] = Array.isArray(action.items_metadata) ? action.items_metadata : [];
    if (meta.length === 0) {
      returnedItems.push({
        name: 'Returned items',
        quantity: 0,
        amount: n(action.amount),
        deduction: n(action.loss_amount),
        refunded: action.adjusted_amount !== null && action.adjusted_amount !== undefined ? n(action.adjusted_amount) : n(action.amount),
      });
      continue;
    }
    for (const m of meta) {
      const amount = n(m.originalAmount);
      const deduction = n(m.lossAmount);
      returnedItems.push({
        name: m.productName || nameById.get(m.productId) || 'Item',
        quantity: n(m.quantity),
        amount,
        deduction,
        refunded: m.adjustedAmount !== null && m.adjustedAmount !== undefined ? n(m.adjustedAmount) : amount - deduction,
      });
    }
  }

  const status = (sale?.status || 'completed') as ReceiptStatus;

  return {
    business: {
      name: business?.business_name || '',
      logoUrl: business?.business_image_url ?? null,
      phone: business?.receipt_phone ?? null,
      address: business?.receipt_address ?? null,
      pageName: business?.receipt_page_name ?? null,
      footer: business?.receipt_footer ?? null,
      paymentNote: business?.receipt_payment_note ?? null,
      paymentQrUrl: business?.receipt_payment_qr_url ?? null,
    },
    receiptNumber: sale?.receipt_number ?? null,
    saleId: sale?.id ?? null,
    date: sale?.sale_date || sale?.created_at || new Date(),
    status,
    customerName: sale?.customers?.is_system_customer ? null : sale?.customers?.name ?? null,
    customerPhone: sale?.customers?.is_system_customer ? null : sale?.customers?.phone ?? null,
    paymentMethod: sale?.payment_method ?? null,
    paymentStatus: isPaymentStatus(sale?.payment_status) ? sale.payment_status : null,
    notes: sale?.notes ?? null,
    lines,
    orderDiscountAmount,
    orderDiscountType,
    orderDiscountValue,
    deliveryCost,
    // Only ever stored on the cart (carts.delivery_charge); a sale has exactly one cart
    deliveryCharge: n(cart.delivery_charge),
    deliveryApplies: sale?.customers?.platform !== 'walk_in',
    recordedCustomerTotal: sale?.total_amount !== null && sale?.total_amount !== undefined ? n(sale.total_amount) + deliveryCost : null,
    returnedItems,
    currencyId: sale?.currency_id ?? null,
    exchangeRateAtSale: sale?.exchange_rate_at_sale ?? null,
  };
}

/**
 * The currency to print the total in a second time: the business default when the sale is
 * in another currency, otherwise the first other currency the business keeps. Null when
 * the business has one currency.
 */
export function secondaryCurrencyFor(
  saleCurrencyId: string | null | undefined,
  currencies: { id: string; is_default: boolean; exchange_rate_to_usd: number }[]
): ReceiptSecondaryCurrency | null {
  if (!saleCurrencyId || currencies.length < 2) return null;
  const other = currencies.find(c => c.is_default && c.id !== saleCurrencyId) ?? currencies.find(c => c.id !== saleCurrencyId);
  return other && n(other.exchange_rate_to_usd) > 0 ? { currencyId: other.id, rateToUsd: n(other.exchange_rate_to_usd) } : null;
}
