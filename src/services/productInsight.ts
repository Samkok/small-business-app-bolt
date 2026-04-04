import { supabase } from '../config/supabase';
import { Database } from '../types/database';

type InsightSettings = Database['public']['Tables']['product_insight_settings']['Row'];
type InsightSettingsUpdate = Database['public']['Tables']['product_insight_settings']['Update'];

export type ProductCategory =
  | 'out_of_stock'
  | 'must_order'
  | 'hot_selling'
  | 'do_not_order'
  | 'slow_moving'
  | 'healthy';

export interface ClassifiedProduct {
  id: string;
  name: string;
  price: number;
  currentStock: number;
  minStockLevel: number;
  costPerUnit: number;
  imageUrl?: string;
  category: ProductCategory;
  totalUnitsSold: number;
  totalRevenue: number;
  dailySalesRate: number;
  daysOfStockRemaining: number | null;
  projectedStockoutDate: Date | null;
}

export interface InsightSummary {
  totalActiveProducts: number;
  totalArchivedProducts: number;
  totalUnitsInStock: number;
  totalStockValue: number;
  avgSellingPrice: number;
  outOfStockCount: number;
  lowStockCount: number;
  inStockCount: number;
  categoryCounts: Record<ProductCategory, number>;
  classifiedProducts: ClassifiedProduct[];
  highestValueProducts: { id: string; name: string; price: number; currentStock: number; value: number }[];
  periodLabel: string;
}

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

  async fetchProductsAndSales(
    businessId: string,
    startDate: Date,
    endDate: Date
  ) {
    const [productsRes, salesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, price, current_stock, min_stock_level, cost_per_unit, image_url, is_archived')
        .eq('business_id', businessId),
      supabase
        .from('sales')
        .select('id, cart_id, status, sale_date')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('sale_date', startDate.toISOString())
        .lte('sale_date', endDate.toISOString()),
    ]);

    if (productsRes.error) throw productsRes.error;
    if (salesRes.error) throw salesRes.error;

    const products = productsRes.data || [];
    const sales = salesRes.data || [];

    if (sales.length === 0) {
      return { products, salesByProduct: {} as Record<string, { totalQty: number; totalRevenue: number }> };
    }

    const cartIds = sales.map((s) => s.cart_id);

    const batchSize = 200;
    const allCartItems: { product_id: string; quantity: number; unit_price: number }[] = [];

    for (let i = 0; i < cartIds.length; i += batchSize) {
      const batch = cartIds.slice(i, i + batchSize);
      const { data: items, error: itemsError } = await supabase
        .from('cart_items')
        .select('product_id, quantity, unit_price')
        .in('cart_id', batch);

      if (itemsError) throw itemsError;
      if (items) allCartItems.push(...items);
    }

    const salesByProduct: Record<string, { totalQty: number; totalRevenue: number }> = {};
    for (const item of allCartItems) {
      if (!item.product_id) continue;
      if (!salesByProduct[item.product_id]) {
        salesByProduct[item.product_id] = { totalQty: 0, totalRevenue: 0 };
      }
      salesByProduct[item.product_id].totalQty += item.quantity || 0;
      salesByProduct[item.product_id].totalRevenue += (item.quantity || 0) * (item.unit_price || 0);
    }

    return { products, salesByProduct };
  },

  classifyProducts(
    products: any[],
    salesByProduct: Record<string, { totalQty: number; totalRevenue: number }>,
    settings: Omit<InsightSettings, 'id' | 'business_id' | 'created_at' | 'updated_at'>,
    lookbackDays: number,
  ): InsightSummary {
    const active = products.filter((p) => !p.is_archived);
    const archived = products.filter((p) => p.is_archived);
    const effectiveDays = Math.max(lookbackDays, 1);

    const totalUnitsInStock = active.reduce((s, p) => s + (p.current_stock || 0), 0);
    const totalStockValue = active.reduce((s, p) => s + (p.current_stock || 0) * (p.price || 0), 0);
    const avgSellingPrice = active.length > 0 ? active.reduce((s, p) => s + (p.price || 0), 0) / active.length : 0;

    const defaultLow = settings.default_low_stock_level || 10;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let inStockCount = 0;

    const classified: ClassifiedProduct[] = active.map((p) => {
      const sales = salesByProduct[p.id] || { totalQty: 0, totalRevenue: 0 };
      const dailyRate = sales.totalQty / effectiveDays;
      const minLevel = p.min_stock_level || defaultLow;
      const stock = p.current_stock || 0;

      let daysRemaining: number | null = null;
      let stockoutDate: Date | null = null;

      if (dailyRate > 0 && stock > 0) {
        daysRemaining = stock / dailyRate;
        stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysRemaining));
      } else if (stock <= 0) {
        daysRemaining = 0;
      }

      if (stock <= 0) outOfStockCount++;
      else if (stock <= minLevel) lowStockCount++;
      else inStockCount++;

      const mustOrderThreshold = settings.reorder_warning_days + (settings.lead_time_days || 0);

      let category: ProductCategory;

      if (stock <= 0) {
        category = 'out_of_stock';
      } else if (
        dailyRate > settings.slow_selling_max_units_per_day &&
        daysRemaining !== null &&
        daysRemaining <= mustOrderThreshold
      ) {
        category = 'must_order';
      } else if (dailyRate >= settings.hot_selling_min_units_per_day) {
        category = 'hot_selling';
      } else if (
        daysRemaining !== null &&
        daysRemaining >= settings.overstock_days_threshold
      ) {
        category = 'do_not_order';
      } else if (stock > 0 && daysRemaining === null) {
        category = stock >= settings.overstock_days_threshold ? 'do_not_order' : 'slow_moving';
      } else if (dailyRate <= settings.slow_selling_max_units_per_day && stock > 0) {
        category = 'slow_moving';
      } else {
        category = 'healthy';
      }

      return {
        id: p.id,
        name: p.name,
        price: p.price || 0,
        currentStock: stock,
        minStockLevel: minLevel,
        costPerUnit: p.cost_per_unit || 0,
        imageUrl: p.image_url,
        category,
        totalUnitsSold: sales.totalQty,
        totalRevenue: sales.totalRevenue,
        dailySalesRate: dailyRate,
        daysOfStockRemaining: daysRemaining,
        projectedStockoutDate: stockoutDate,
      };
    });

    const categoryCounts: Record<ProductCategory, number> = {
      out_of_stock: 0,
      must_order: 0,
      hot_selling: 0,
      do_not_order: 0,
      slow_moving: 0,
      healthy: 0,
    };
    for (const p of classified) {
      categoryCounts[p.category]++;
    }

    const highestValue = active
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price || 0,
        currentStock: p.current_stock || 0,
        value: (p.current_stock || 0) * (p.price || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - effectiveDays);
    const periodLabel = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return {
      totalActiveProducts: active.length,
      totalArchivedProducts: archived.length,
      totalUnitsInStock,
      totalStockValue,
      avgSellingPrice,
      outOfStockCount,
      lowStockCount,
      inStockCount,
      categoryCounts,
      classifiedProducts: classified,
      highestValueProducts: highestValue,
      periodLabel,
    };
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
