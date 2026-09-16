import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import {
  classifyProducts as planClassify,
  ProductDemandInput,
  PlanningSettings,
} from '../utils/inventoryPlanning';

export type {
  ProductCategory,
  ClassifiedProduct,
  InsightSummary,
  AbcClass,
  XyzClass,
} from '../utils/inventoryPlanning';

type InsightSettings = Database['public']['Tables']['product_insight_settings']['Row'];
type InsightSettingsUpdate = Database['public']['Tables']['product_insight_settings']['Update'];

const DEFAULT_SETTINGS: Omit<InsightSettings, 'id' | 'business_id' | 'created_at' | 'updated_at'> = {
  lookback_days: 30,
  custom_start_date: undefined,
  custom_end_date: undefined,
  use_custom_range: false,
  hot_selling_min_units_per_day: 1.0,
  slow_selling_max_units_per_day: 0.1,
  reorder_warning_days: 7,
  overstock_days_threshold: 90,
  default_low_stock_level: 10,
  lead_time_days: 0,
};

/** Per-product demand gathered from sales, ready for the planning maths. */
export interface DemandData {
  products: any[];
  demandByProduct: Record<string, { daily: Record<string, number>; revenue: number; margin: number; priorUnits: number }>;
  windowStart: Date;
  windowEnd: Date;
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const productInsightService = {
  getDefaultSettings() {
    return { ...DEFAULT_SETTINGS };
  },

  async getSettings(businessId: string): Promise<InsightSettings | null> {
    const { data, error } = await supabase
      .from('product_insight_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsertSettings(businessId: string, settings: Partial<InsightSettingsUpdate>): Promise<InsightSettings> {
    const { data, error } = await supabase
      .from('product_insight_settings')
      .upsert(
        {
          business_id: businessId,
          ...settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Products plus demand for the window and for the equally long window before it.
   * Counts completed and partially returned sales, subtracts returned units, and
   * converts unit-variant quantities (boxes, packs) to base units so velocity and
   * stock are in the same unit.
   */
  async fetchProductsAndSales(businessId: string, startDate: Date, endDate: Date): Promise<DemandData> {
    const windowMs = Math.max(endDate.getTime() - startDate.getTime(), 24 * 60 * 60 * 1000);
    const priorStart = new Date(startDate.getTime() - windowMs);

    const [productsRes, salesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, price, current_stock, min_stock_level, cost_per_unit, image_url, is_archived')
        .eq('business_id', businessId),
      supabase
        .from('sales')
        .select('id, cart_id, status, sale_date, sale_actions(action_type, items_metadata)')
        .eq('business_id', businessId)
        .in('status', ['completed', 'partially_returned'])
        .gte('sale_date', priorStart.toISOString())
        .lte('sale_date', endDate.toISOString()),
    ]);

    if (productsRes.error) throw productsRes.error;
    if (salesRes.error) throw salesRes.error;

    const products = productsRes.data || [];
    const sales = salesRes.data || [];
    const demandByProduct: DemandData['demandByProduct'] = {};
    if (sales.length === 0) return { products, demandByProduct, windowStart: startDate, windowEnd: endDate };

    const productCost = new Map<string, number>();
    for (const p of products as any[]) productCost.set(p.id, Number(p.cost_per_unit) || 0);

    const saleByCart = new Map<string, any>();
    for (const s of sales as any[]) saleByCart.set(s.cart_id, s);

    const cartIds = (sales as any[]).map(s => s.cart_id).filter(Boolean);
    const batchSize = 200;
    const items: any[] = [];
    for (let i = 0; i < cartIds.length; i += batchSize) {
      const { data, error } = await supabase
        .from('cart_items')
        .select('cart_id, product_id, quantity, unit_price, subtotal, cost_per_unit, unit_id')
        .in('cart_id', cartIds.slice(i, i + batchSize));
      if (error) throw error;
      if (data) items.push(...data);
    }

    // Unit conversion factors for lines sold in a variant unit
    const unitIds = Array.from(new Set(items.map(i => i.unit_id).filter(Boolean)));
    const factorByUnit = new Map<string, number>();
    if (unitIds.length > 0) {
      const { data: units } = await supabase
        .from('units')
        .select('id, conversion_factor_to_base')
        .in('id', unitIds);
      for (const u of (units || []) as any[]) factorByUnit.set(u.id, Number(u.conversion_factor_to_base) || 1);
    }

    const bucket = (productId: string) => {
      if (!demandByProduct[productId]) demandByProduct[productId] = { daily: {}, revenue: 0, margin: 0, priorUnits: 0 };
      return demandByProduct[productId];
    };
    const startMs = startDate.getTime();

    for (const item of items) {
      if (!item.product_id) continue;
      const sale = saleByCart.get(item.cart_id);
      if (!sale) continue;
      const factor = item.unit_id ? factorByUnit.get(item.unit_id) || 1 : 1;
      const soldUnits = Number(item.quantity) || 0;

      // Returned units for this line, in sold units
      let returnedUnits = 0;
      if (sale.status === 'partially_returned') {
        for (const a of sale.sale_actions || []) {
          if (a.action_type !== 'return' || !Array.isArray(a.items_metadata)) continue;
          for (const m of a.items_metadata) if (m.productId === item.product_id) returnedUnits += Number(m.quantity) || 0;
        }
      }
      const netUnits = Math.max(0, soldUnits - returnedUnits);
      const baseUnits = netUnits * factor;
      if (baseUnits <= 0) continue;

      const lineRevenue = item.subtotal !== null && item.subtotal !== undefined
        ? Number(item.subtotal) * (netUnits / soldUnits || 0)
        : Number(item.unit_price || 0) * netUnits;
      const unitCost = item.cost_per_unit && Number(item.cost_per_unit) > 0
        ? Number(item.cost_per_unit)
        : (productCost.get(item.product_id) || 0) * factor;
      const lineMargin = lineRevenue - unitCost * netUnits;

      const b = bucket(item.product_id);
      const saleMs = new Date(sale.sale_date).getTime();
      if (saleMs < startMs) {
        b.priorUnits += baseUnits;
      } else {
        const key = dayKey(sale.sale_date);
        b.daily[key] = (b.daily[key] || 0) + baseUnits;
        b.revenue += lineRevenue;
        b.margin += lineMargin;
      }
    }

    return { products, demandByProduct, windowStart: startDate, windowEnd: endDate };
  },

  classifyProducts(
    products: any[],
    demand: DemandData['demandByProduct'],
    settings: PlanningSettings,
    lookbackDays: number,
    windowStart?: Date
  ) {
    const days = Math.max(lookbackDays, 1);
    const start = windowStart ? new Date(windowStart) : (() => { const d = new Date(); d.setDate(d.getDate() - days); return d; })();
    const keys: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      keys.push(dayKey(d.toISOString()));
    }

    const inputs: ProductDemandInput[] = products.map((p: any) => {
      const d = demand[p.id];
      return {
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        currentStock: Number(p.current_stock) || 0,
        minStockLevel: p.min_stock_level ?? null,
        costPerUnit: Number(p.cost_per_unit) || 0,
        imageUrl: p.image_url,
        isArchived: !!p.is_archived,
        dailyUnits: keys.map(k => (d?.daily[k] || 0)),
        totalRevenue: d?.revenue || 0,
        totalMargin: d?.margin || 0,
        priorUnits: d?.priorUnits || 0,
      };
    });

    return planClassify(inputs, settings, days);
  },

  getDateRange(
    settings: Pick<InsightSettings, 'use_custom_range' | 'custom_start_date' | 'custom_end_date' | 'lookback_days'>
  ): { startDate: Date; endDate: Date; lookbackDays: number } {
    if (settings.use_custom_range && settings.custom_start_date && settings.custom_end_date) {
      const startDate = new Date(settings.custom_start_date);
      const endDate = new Date(settings.custom_end_date);
      const diffMs = endDate.getTime() - startDate.getTime();
      const lookbackDays = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 1);
      return { startDate, endDate, lookbackDays };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (settings.lookback_days || 30));
    return { startDate, endDate, lookbackDays: settings.lookback_days || 30 };
  },
};
