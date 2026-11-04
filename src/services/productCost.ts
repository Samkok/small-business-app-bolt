import { supabase } from '../config/supabase';

/**
 * Product cost ledger.
 *
 * products.cost_per_unit is a moving weighted average per base unit. It is never written
 * directly: every change is an event applied by the apply_product_cost_event function
 * (migration 20261104090000_product_cost_ledger), which locks the product, computes the
 * new average, updates the product and records the row in product_cost_events.
 *
 *   receipt            stock arrives (batch or single import), landed cost per base unit
 *   receipt_reversal   a completed import is deleted; the units leave at the cost they came in with
 *   manual_correction  owner/admin types a new cost with a reason; stock unchanged
 *   opening            written by a trigger when the product is created
 *   revaluation        a receipt that set the cost because none was known (cost was 0)
 *   legacy_write       recorded by the guard trigger when an app build older than 2.11 wrote the cost directly
 *
 * Sales, returns, stock adjustments and counts never move the average; they snapshot it.
 */

export type ProductCostEventType =
  | 'opening'
  | 'receipt'
  | 'receipt_reversal'
  | 'manual_correction'
  | 'revaluation'
  /** a direct write by an app build from before the ledger (compatibility mode, see migration 20261104120000) */
  | 'legacy_write';

export type ProductCostSource = 'product' | 'inventory_batch' | 'inventory_import';

export interface ProductCostEvent {
  id: string;
  business_id: string;
  product_id: string;
  event_type: ProductCostEventType;
  qty_delta: number;
  unit_cost_in: number | null;
  stock_before: number;
  stock_after: number;
  cost_before: number;
  cost_after: number;
  source_type: ProductCostSource | null;
  source_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface ApplyInput {
  productId: string;
  type: 'receipt' | 'receipt_reversal' | 'manual_correction';
  /** base units moved; positive. 0 for a manual correction. */
  qty?: number;
  /** cost per base unit of the units moved, or the corrected cost */
  unitCost?: number;
  sourceType?: ProductCostSource;
  sourceId?: string;
  reason?: string;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

function normalise(row: any): ProductCostEvent {
  return {
    ...row,
    qty_delta: num(row.qty_delta),
    unit_cost_in: row.unit_cost_in == null ? null : num(row.unit_cost_in),
    stock_before: num(row.stock_before),
    stock_after: num(row.stock_after),
    cost_before: num(row.cost_before),
    cost_after: num(row.cost_after),
  };
}

export const productCostService = {
  async apply(input: ApplyInput): Promise<ProductCostEvent> {
    const { data, error } = await supabase.rpc('apply_product_cost_event', {
      p_product_id: input.productId,
      p_event_type: input.type,
      p_qty: Math.round(input.qty ?? 0),
      p_unit_cost: input.unitCost ?? null,
      p_source_type: input.sourceType ?? null,
      p_source_id: input.sourceId ?? null,
      p_reason: input.reason ?? null,
    } as any);
    if (error) throw error;
    return normalise(data);
  },

  /** Stock arrived: `qty` base units at `unitCost` per base unit (landed). */
  receive(productId: string, qty: number, unitCost: number, sourceType: ProductCostSource, sourceId: string) {
    return this.apply({ productId, type: 'receipt', qty, unitCost, sourceType, sourceId });
  },

  /** A completed import was deleted: take `qty` base units back out at the cost they came in with. */
  reverseReceipt(productId: string, qty: number, unitCost: number, sourceType: ProductCostSource, sourceId: string) {
    return this.apply({ productId, type: 'receipt_reversal', qty, unitCost, sourceType, sourceId });
  },

  /** Owner or admin sets the cost by hand. Past sales keep the cost they were sold at. */
  correct(productId: string, newCost: number, reason: string) {
    return this.apply({ productId, type: 'manual_correction', unitCost: newCost, reason, sourceType: 'product', sourceId: productId });
  },

  async getForProduct(productId: string, limit = 50): Promise<ProductCostEvent[]> {
    const { data, error } = await supabase
      .from('product_cost_events')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(normalise);
  },
};

/** Base-unit quantity and per-base-unit cost of one import line (qty × factor, cost ÷ factor). */
export function importLineToBaseUnits(quantity: number, unitCostPerImportedUnit: number, conversionFactor: number | null | undefined) {
  const factor = num(conversionFactor) > 0 ? num(conversionFactor) : 1;
  return {
    baseQty: Math.round(num(quantity) * factor),
    costPerBaseUnit: num(unitCostPerImportedUnit) / factor,
  };
}
