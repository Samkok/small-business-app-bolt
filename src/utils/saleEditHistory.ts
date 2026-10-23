import type { SaleEditChange } from '@/src/services/sales';

/**
 * Turns one recorded change of a sale edit (sale_edits.changes, written by
 * edit_sale_atomic) into the lines the sale detail prints: a title, the before → after
 * detail, and the stock movement when the change touched stock.
 */

export interface SaleEditChangeText {
  title: string;
  detail: string;
  /** e.g. "Stock 25 → 24", only for item changes */
  stock?: string;
}

export interface DescribeOptions {
  /** money formatter in the sale's currency */
  fmt: (amount: number) => string;
  /** translation lookup; keys live under saleEdit.history */
  t: (key: string) => string;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

function qtyText(line: any, unitName: string | null | undefined): string {
  const qty = num(line?.quantity);
  return unitName ? `${qty} ${unitName}` : String(qty);
}

function discountText(line: any, fmt: (n: number) => string): string | null {
  if (!line?.item_discount_type) return null;
  const value = num(line.item_discount_value);
  if (!value) return null;
  return line.item_discount_type === 'percentage' ? `-${value}%` : `-${fmt(value)}`;
}

function lineText(line: any, unitName: string | null | undefined, fmt: (n: number) => string): string {
  const parts = [`${qtyText(line, unitName)} × ${fmt(num(line?.unit_price))}`];
  const discount = discountText(line, fmt);
  if (discount) parts.push(discount);
  return parts.join(', ');
}

function fieldValue(field: string, value: unknown, opts: DescribeOptions): string {
  if (value === null || value === undefined || value === '') return opts.t('saleEdit.history.none');
  switch (field) {
    case 'delivery_cost':
    case 'delivery_charge':
    case 'total_amount':
      return opts.fmt(num(value));
    case 'sale_discount_value':
      return String(num(value));
    case 'sale_discount_type':
      return value === 'percentage' ? opts.t('sales.percentage') : value === 'fixed' ? opts.t('sales.fixed') : String(value);
    case 'payment_status':
      return String(value).toUpperCase();
    default:
      return String(value);
  }
}

export function describeSaleEditChange(change: SaleEditChange, opts: DescribeOptions): SaleEditChangeText {
  const { fmt, t } = opts;
  const product = change.product_name || '';
  const stock =
    change.stock_before !== undefined && change.stock_after !== undefined && change.stock_before !== change.stock_after
      ? `${t('saleEdit.history.stock')} ${num(change.stock_before)} → ${num(change.stock_after)}`
      : undefined;

  switch (change.type) {
    case 'added':
      return { title: `${t('saleEdit.history.added')}: ${product}`, detail: lineText(change.after, change.unit_name, fmt), stock };
    case 'removed':
      return { title: `${t('saleEdit.history.removed')}: ${product}`, detail: lineText(change.before, change.unit_name, fmt), stock };
    case 'changed':
      return {
        title: `${t('saleEdit.history.changed')}: ${product}`,
        detail: `${lineText(change.before, change.unit_name, fmt)} → ${lineText(change.after, change.unit_name, fmt)}`,
        stock,
      };
    case 'field': {
      const field = change.field || '';
      const label = t(`saleEdit.history.fields.${field}`);
      return {
        title: label.startsWith('saleEdit.') ? field : label,
        detail: `${fieldValue(field, change.before, opts)} → ${fieldValue(field, change.after, opts)}`,
      };
    }
    default:
      return { title: String((change as any).type ?? ''), detail: '' };
  }
}

/** Sorted newest first, with the changes of each edit in the order they were recorded. */
export function sortSaleEdits<T extends { edited_at: string }>(edits: T[] | null | undefined): T[] {
  return [...(edits ?? [])].sort((a, b) => (a.edited_at < b.edited_at ? 1 : a.edited_at > b.edited_at ? -1 : 0));
}
