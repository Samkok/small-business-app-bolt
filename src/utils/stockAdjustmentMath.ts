/**
 * Pure maths for stock adjustments, kept free of react-native imports so it
 * can be unit tested with tsx.
 */

export interface AdjustmentTotals {
  /** Units removed and their cost, per currency (null key = product without currency) */
  writeOffs: { units: number; cost: number; byCurrency: Record<string, number> };
  found: { units: number; cost: number; byCurrency: Record<string, number> };
  byReason: Record<string, { count: number; units: number; cost: number }>;
  count: number;
}

/** Pure aggregation used by getTotals and the reports service. */
export function summarizeAdjustments(
  rows: { quantity: number; total_cost: number; reason: string; currency_id: string | null }[]
): AdjustmentTotals {
  const totals: AdjustmentTotals = {
    writeOffs: { units: 0, cost: 0, byCurrency: {} },
    found: { units: 0, cost: 0, byCurrency: {} },
    byReason: {},
    count: rows.length,
  };
  for (const r of rows) {
    const qty = Number(r.quantity) || 0;
    const cost = Number(r.total_cost) || 0;
    const key = r.currency_id || '';
    const bucket = qty < 0 ? totals.writeOffs : totals.found;
    bucket.units += Math.abs(qty);
    bucket.cost += Math.abs(cost);
    bucket.byCurrency[key] = (bucket.byCurrency[key] || 0) + Math.abs(cost);
    const reason = totals.byReason[r.reason] || { count: 0, units: 0, cost: 0 };
    reason.count += 1;
    reason.units += qty;
    reason.cost += cost;
    totals.byReason[r.reason] = reason;
  }
  return totals;
}
