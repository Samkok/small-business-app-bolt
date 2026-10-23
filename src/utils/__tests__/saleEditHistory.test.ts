// Run with: npx tsx src/utils/__tests__/saleEditHistory.test.ts
import assert from 'node:assert/strict';
import { describeSaleEditChange, sortSaleEdits } from '../saleEditHistory';

const labels: Record<string, string> = {
  'saleEdit.history.added': 'Added',
  'saleEdit.history.removed': 'Removed',
  'saleEdit.history.changed': 'Changed',
  'saleEdit.history.stock': 'Stock',
  'saleEdit.history.none': 'None',
  'saleEdit.history.fields.customer_name': 'Customer',
  'saleEdit.history.fields.total_amount': 'Total',
  'saleEdit.history.fields.payment_status': 'Payment status',
  'sales.percentage': 'Percentage',
  'sales.fixed': 'Fixed',
};
const opts = { fmt: (n: number) => `$${n.toFixed(2)}`, t: (k: string) => labels[k] ?? k };

// quantity change with stock movement
{
  const r = describeSaleEditChange({
    type: 'changed', product_name: 'City d', unit_name: null,
    before: { quantity: 1, unit_price: 5300, item_discount_type: null, item_discount_value: 0 },
    after: { quantity: 2, unit_price: 5300, item_discount_type: null, item_discount_value: 0 },
    stock_delta: -1, stock_before: 25, stock_after: 24,
  }, opts);
  assert.equal(r.title, 'Changed: City d');
  assert.equal(r.detail, '1 × $5300.00 → 2 × $5300.00');
  assert.equal(r.stock, 'Stock 25 → 24');
}

// added line with a unit and an item discount
{
  const r = describeSaleEditChange({
    type: 'added', product_name: 'Cola', unit_name: 'Box',
    after: { quantity: 2, unit_price: 12, item_discount_type: 'percentage', item_discount_value: 10 },
    stock_before: 15, stock_after: 13,
  }, opts);
  assert.equal(r.title, 'Added: Cola');
  assert.equal(r.detail, '2 Box × $12.00, -10%');
  assert.equal(r.stock, 'Stock 15 → 13');
}

// removed line: stock goes back up
{
  const r = describeSaleEditChange({
    type: 'removed', product_name: 'Special', unit_name: null,
    before: { quantity: 1, unit_price: 6750, item_discount_type: 'fixed', item_discount_value: 50 },
    stock_before: 16, stock_after: 17,
  }, opts);
  assert.equal(r.title, 'Removed: Special');
  assert.equal(r.detail, '1 × $6750.00, -$50.00');
  assert.equal(r.stock, 'Stock 16 → 17');
}

// header fields: money, status and a cleared value
{
  assert.deepEqual(describeSaleEditChange({ type: 'field', field: 'total_amount', before: 22550, after: 21800 }, opts),
    { title: 'Total', detail: '$22550.00 → $21800.00' });
  assert.deepEqual(describeSaleEditChange({ type: 'field', field: 'payment_status', before: 'paid', after: 'cod' }, opts),
    { title: 'Payment status', detail: 'PAID → COD' });
  assert.deepEqual(describeSaleEditChange({ type: 'field', field: 'customer_name', before: null, after: 'Guest Customer' }, opts),
    { title: 'Customer', detail: 'None → Guest Customer' });
  // an unknown field falls back to its raw name rather than a missing translation key
  assert.equal(describeSaleEditChange({ type: 'field', field: 'something_new', before: 1, after: 2 }, opts).title, 'something_new');
}

// newest edit first
{
  const sorted = sortSaleEdits([{ edited_at: '2026-10-01T00:00:00Z' }, { edited_at: '2026-10-19T00:00:00Z' }]);
  assert.equal(sorted[0].edited_at, '2026-10-19T00:00:00Z');
}

console.log('saleEditHistory tests passed');
