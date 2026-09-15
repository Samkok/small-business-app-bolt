/**
 * Reporting currency.
 *
 * Every report is produced in one currency: the one the user picked, or the
 * business default. Rows recorded in another currency are converted, never
 * dropped. Legacy rows with no currency_id were written before multi-currency
 * existed and are treated as the business default.
 *
 * Rates are "units per USD" (`currencies.exchange_rate_to_usd`). A sale also
 * carries `exchange_rate_at_sale`, the rate of its own currency when it was
 * made; that snapshot is preferred so history does not move when rates change.
 */
import type { Currency } from '@/src/services/currencies';

export interface ReportCurrency {
  /** currency every figure is expressed in; null when the business has no currencies */
  targetId: string | null;
  defaultId: string | null;
  /** currency id → units per USD */
  rates: Record<string, number>;
}

export async function resolveReportCurrency(businessId: string, targetCurrencyId?: string | null): Promise<ReportCurrency> {
  let currencies: Currency[] = [];
  try {
    // Loaded lazily so the pure helpers below carry no Supabase / React Native dependency.
    const { currencyService } = await import('@/src/services/currencies');
    currencies = await currencyService.getCurrencies(businessId);
  } catch (error) {
    console.error('resolveReportCurrency: failed to load currencies', error);
  }
  const rates: Record<string, number> = {};
  for (const c of currencies) rates[c.id] = Number(c.exchange_rate_to_usd) || 1;
  const def = currencies.find(c => c.is_default) || currencies[0] || null;
  const targetId = targetCurrencyId && rates[targetCurrencyId] ? targetCurrencyId : def?.id ?? null;
  return { targetId, defaultId: def?.id ?? null, rates };
}

/** Multiplier that takes an amount in `fromCurrencyId` to the reporting currency. */
export function conversionFactor(
  rc: ReportCurrency,
  fromCurrencyId?: string | null,
  rateAtSale?: number | string | null
): number {
  if (!rc.targetId) return 1;
  const from = fromCurrencyId || rc.defaultId;
  if (!from || from === rc.targetId) return 1;
  const snapshot = rateAtSale !== null && rateAtSale !== undefined ? Number(rateAtSale) : 0;
  const fromRate = snapshot > 0 ? snapshot : rc.rates[from];
  const targetRate = rc.rates[rc.targetId];
  if (!fromRate || !targetRate) return 1;
  return targetRate / fromRate;
}

export function saleFactor(rc: ReportCurrency, sale: { currency_id?: string | null; exchange_rate_at_sale?: number | string | null } | null | undefined): number {
  return conversionFactor(rc, sale?.currency_id, sale?.exchange_rate_at_sale);
}

export function expenseFactor(rc: ReportCurrency, expense: { currency_id?: string | null } | null | undefined): number {
  return conversionFactor(rc, expense?.currency_id, null);
}

const SALE_FIELDS = ['total_amount', 'delivery_cost', 'current_total_amount', 'subtotal_before_discount', 'sale_discount_amount', 'returned_amount'];
const ACTION_FIELDS = ['amount', 'adjusted_amount', 'loss_amount', 'delivery_cost_amount'];
const META_FIELDS = ['originalAmount', 'adjustedAmount', 'lossAmount', 'unitPricePaid'];
const CART_FIELDS = ['delivery_cost', 'total_amount'];
const ITEM_FIELDS = ['unit_price', 'subtotal', 'original_subtotal', 'item_discount_amount', 'cost_per_unit'];
const PRODUCT_FIELDS = ['price', 'cost_per_unit'];

const scaleFields = (obj: any, fields: string[], factor: number) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out: any = { ...obj };
  for (const f of fields) {
    if (out[f] !== null && out[f] !== undefined && out[f] !== '') {
      const n = Number(out[f]);
      if (Number.isFinite(n)) out[f] = n * factor;
    }
  }
  return out;
};

/**
 * Returns a copy of a sale row (with whatever nested cart, items, products and
 * actions it carries) with every money field multiplied by `factor`.
 * Returns the same object when nothing needs converting.
 */
export function scaleSale<T>(sale: T, factor: number): T {
  if (!sale || factor === 1) return sale;
  const s: any = scaleFields(sale, SALE_FIELDS, factor);
  if (Array.isArray(s.sale_actions)) {
    s.sale_actions = s.sale_actions.map((a: any) => {
      const action = scaleFields(a, ACTION_FIELDS, factor);
      if (Array.isArray(action.items_metadata)) {
        action.items_metadata = action.items_metadata.map((m: any) => scaleFields(m, META_FIELDS, factor));
      }
      return action;
    });
  }
  const scaleCart = (cart: any) => {
    const c = scaleFields(cart, CART_FIELDS, factor);
    if (Array.isArray(c.cart_items)) {
      c.cart_items = c.cart_items.map((ci: any) => {
        const item = scaleFields(ci, ITEM_FIELDS, factor);
        if (item.products) item.products = scaleFields(item.products, PRODUCT_FIELDS, factor);
        return item;
      });
    }
    return c;
  };
  if (Array.isArray(s.carts)) s.carts = s.carts.map(scaleCart);
  else if (s.carts) s.carts = scaleCart(s.carts);
  return s as T;
}
