import { supabase } from '../config/supabase';
import { summarizeAdjustments, AdjustmentTotals } from '../utils/stockAdjustmentMath';

export { summarizeAdjustments };
export type { AdjustmentTotals };

/**
 * Stock adjustments: the immutable ledger of manual stock changes (damage,
 * expiry, loss, samples, count corrections, found stock). All writes go through
 * the adjust_product_stock / post_stock_count database functions so the ledger
 * row, the product's current_stock and product_history change together.
 */

export type AdjustmentReason = 'damaged' | 'expired' | 'lost' | 'sample' | 'count' | 'found' | 'other';

export interface AdjustmentReasonInfo {
  key: AdjustmentReason;
  label: string;
  hint: string;
  /** 'out' removes stock, 'in' adds stock, 'either' lets the user choose */
  direction: 'out' | 'in' | 'either';
}

export const ADJUSTMENT_REASONS: AdjustmentReasonInfo[] = [
  { key: 'damaged', label: 'Damaged', hint: 'Broken, spoiled or unsellable', direction: 'out' },
  { key: 'expired', label: 'Expired', hint: 'Past its use-by date', direction: 'out' },
  { key: 'lost', label: 'Lost / stolen', hint: 'Missing with no explanation', direction: 'out' },
  { key: 'sample', label: 'Sample / own use', hint: 'Given away or used by the business', direction: 'out' },
  { key: 'found', label: 'Found stock', hint: 'More on the shelf than recorded', direction: 'in' },
  { key: 'count', label: 'Count correction', hint: 'Physical count differed from the system', direction: 'either' },
  { key: 'other', label: 'Other', hint: 'Anything else, describe it in the note', direction: 'either' },
];

export const reasonLabel = (reason: string): string =>
  ADJUSTMENT_REASONS.find(r => r.key === reason)?.label || reason;

export interface StockAdjustment {
  id: string;
  business_id: string;
  product_id: string;
  unit_id: string | null;
  quantity: number;
  quantity_entered: number;
  reason: AdjustmentReason;
  unit_cost: number;
  total_cost: number;
  currency_id: string | null;
  stock_before: number;
  stock_after: number;
  notes: string | null;
  count_session_id: string | null;
  adjusted_by: string | null;
  adjusted_by_name: string | null;
  adjustment_date: string;
  created_at: string;
  products?: { name: string } | null;
  units?: { name: string } | null;
}

export interface StockCountResult {
  session_id: string;
  adjusted: number;
  unchanged: number;
  units_lost: number;
  units_found: number;
  cost_lost: number;
  cost_found: number;
}

const SELECT = '*, products(name), units(name)';

export const stockAdjustmentService = {
  /**
   * Post one adjustment. quantity is signed in the chosen unit (negative removes
   * stock); the database converts it to base units and refuses to go below zero.
   */
  async adjust(input: {
    businessId: string;
    productId: string;
    quantity: number;
    reason: AdjustmentReason;
    unitId?: string | null;
    notes?: string;
    adjustmentDate?: Date;
  }): Promise<StockAdjustment> {
    const { data, error } = await supabase.rpc('adjust_product_stock', {
      p_business_id: input.businessId,
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_reason: input.reason,
      p_unit_id: input.unitId || null,
      p_notes: input.notes || null,
      p_adjustment_date: (input.adjustmentDate || new Date()).toISOString(),
      p_count_session_id: null,
    } as any);
    if (error) throw error;
    return data as unknown as StockAdjustment;
  },

  /** Post a stock count: one 'count' adjustment per product whose counted quantity differs from the system. */
  async postCount(input: {
    businessId: string;
    items: { productId: string; counted: number }[];
    notes?: string;
    countDate?: Date;
  }): Promise<StockCountResult> {
    const { data, error } = await supabase.rpc('post_stock_count', {
      p_business_id: input.businessId,
      p_items: input.items.map(i => ({ product_id: i.productId, counted: Math.max(0, Math.round(i.counted)) })),
      p_notes: input.notes || null,
      p_count_date: (input.countDate || new Date()).toISOString(),
    } as any);
    if (error) throw error;
    return data as unknown as StockCountResult;
  },

  async getForProduct(productId: string, limit = 50): Promise<StockAdjustment[]> {
    const { data, error } = await supabase
      .from('stock_adjustments')
      .select(SELECT)
      .eq('product_id', productId)
      .order('adjustment_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as unknown as StockAdjustment[];
  },

  async getForBusiness(
    businessId: string,
    options: { startDate?: Date; endDate?: Date; reason?: AdjustmentReason | 'all'; limit?: number } = {}
  ): Promise<StockAdjustment[]> {
    let query = supabase
      .from('stock_adjustments')
      .select(SELECT)
      .eq('business_id', businessId)
      .order('adjustment_date', { ascending: false });
    if (options.startDate) query = query.gte('adjustment_date', options.startDate.toISOString());
    if (options.endDate) query = query.lte('adjustment_date', options.endDate.toISOString());
    if (options.reason && options.reason !== 'all') query = query.eq('reason', options.reason);
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as StockAdjustment[];
  },

  /** Totals for a period, in each adjustment's own currency (reports convert). */
  async getTotals(businessId: string, startDate: Date, endDate: Date): Promise<AdjustmentTotals> {
    const { data, error } = await supabase
      .from('stock_adjustments')
      .select('quantity, total_cost, reason, currency_id')
      .eq('business_id', businessId)
      .gte('adjustment_date', startDate.toISOString())
      .lte('adjustment_date', endDate.toISOString());
    if (error) throw error;
    return summarizeAdjustments((data || []) as any[]);
  },
};
