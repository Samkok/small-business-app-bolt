/**
 * Inventory planning maths for the Product Insight screen. Pure functions, no I/O.
 *
 * Scaled-down demand planning for a single shop:
 *  - ABC on gross-profit contribution (A = top 80% of margin, B = next 15%, C = rest)
 *  - XYZ on demand variability (coefficient of variation of weekly demand)
 *  - Safety stock  = Z × σ_daily × √horizon, Z by ABC class (A 95%, B 90%, C 85% service)
 *  - Reorder point = daily demand × horizon + safety stock, horizon = lead time + review buffer
 *  - Suggested order = cover (horizon + 30 days) + safety stock − on hand, capped by the overstock limit
 *  - Kill list: C items with > 26 weeks of supply whose velocity halved versus the prior period
 */

export type AbcClass = 'A' | 'B' | 'C';
export type XyzClass = 'X' | 'Y' | 'Z';

export type ProductCategory =
  | 'out_of_stock'
  | 'must_order'
  | 'hot_selling'
  | 'do_not_order'
  | 'slow_moving'
  | 'healthy';

export interface PlanningSettings {
  hot_selling_min_units_per_day: number;
  slow_selling_max_units_per_day: number;
  reorder_warning_days: number;
  overstock_days_threshold: number;
  default_low_stock_level: number;
  lead_time_days: number;
}

export interface ProductDemandInput {
  id: string;
  name: string;
  price: number;
  currentStock: number;
  minStockLevel: number | null;
  costPerUnit: number;
  imageUrl?: string | null;
  isArchived: boolean;
  /** units sold per day of the current window, index 0 = first day; zeros included */
  dailyUnits: number[];
  totalRevenue: number;
  totalMargin: number;
  /** units sold in the window immediately before the current one */
  priorUnits: number;
}

export interface ClassifiedProduct {
  id: string;
  name: string;
  price: number;
  currentStock: number;
  minStockLevel: number;
  costPerUnit: number;
  imageUrl?: string | null;
  category: ProductCategory;
  totalUnitsSold: number;
  totalRevenue: number;
  totalMargin: number;
  dailySalesRate: number;
  daysOfStockRemaining: number | null;
  projectedStockoutDate: Date | null;
  abcClass: AbcClass;
  xyzClass: XyzClass;
  demandCv: number | null;
  safetyStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;
  stockCost: number;
  stockRetail: number;
  weeksOfSupply: number | null;
  /** change in units sold versus the prior window; null when the prior window had no sales */
  velocityChangePct: number | null;
  killCandidate: boolean;
}

export interface InsightSummary {
  totalActiveProducts: number;
  totalArchivedProducts: number;
  totalUnitsInStock: number;
  /** stock valued at selling price */
  totalStockValue: number;
  /** stock valued at cost: the cash tied up */
  totalStockCost: number;
  /** cost of stock that did not sell at all in the window */
  deadStockCost: number;
  avgSellingPrice: number;
  outOfStockCount: number;
  lowStockCount: number;
  inStockCount: number;
  categoryCounts: Record<ProductCategory, number>;
  abcCounts: Record<AbcClass, number>;
  classifiedProducts: ClassifiedProduct[];
  killList: ClassifiedProduct[];
  highestValueProducts: { id: string; name: string; price: number; currentStock: number; value: number }[];
  periodLabel: string;
}

const Z_BY_CLASS: Record<AbcClass, number> = { A: 1.65, B: 1.28, C: 1.04 };
const COVER_DAYS_BEYOND_HORIZON = 30;
const KILL_WEEKS_OF_SUPPLY = 26;

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** Roll a daily series up into weeks (last partial week kept). */
export function toWeekly(daily: number[]): number[] {
  const weeks: number[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    weeks.push(daily.slice(i, i + 7).reduce((a, b) => a + b, 0));
  }
  return weeks;
}

/** Coefficient of variation on weekly demand when there are at least two weeks, daily otherwise. Null with no sales. */
export function demandCv(daily: number[]): number | null {
  const series = daily.length >= 14 ? toWeekly(daily) : daily;
  const m = mean(series);
  if (m <= 0) return null;
  return stdDev(series) / m;
}

export function xyzClass(cv: number | null): XyzClass {
  if (cv === null) return 'Z';
  if (cv < 0.5) return 'X';
  if (cv <= 1.0) return 'Y';
  return 'Z';
}

/** ABC by cumulative share of a positive contribution measure. Items with no contribution are C. */
export function abcClasses(items: { id: string; contribution: number }[]): Record<string, AbcClass> {
  const out: Record<string, AbcClass> = {};
  const positive = items.filter(i => i.contribution > 0).sort((a, b) => b.contribution - a.contribution);
  const total = positive.reduce((s, i) => s + i.contribution, 0);
  let running = 0;
  for (const i of positive) {
    running += i.contribution;
    const share = running / total;
    out[i.id] = share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C';
  }
  for (const i of items) if (!out[i.id]) out[i.id] = 'C';
  // A single top item that alone exceeds 80% would otherwise become B; the biggest earner is always A.
  if (positive.length > 0) out[positive[0].id] = 'A';
  return out;
}

export function safetyStock(sigmaDaily: number, horizonDays: number, abc: AbcClass): number {
  return Z_BY_CLASS[abc] * sigmaDaily * Math.sqrt(Math.max(horizonDays, 1));
}

export function reorderPoint(dailyRate: number, horizonDays: number, ss: number): number {
  return dailyRate * Math.max(horizonDays, 1) + ss;
}

export function suggestedOrderQty(
  dailyRate: number,
  horizonDays: number,
  ss: number,
  onHand: number,
  overstockDays: number
): number {
  if (dailyRate <= 0) return 0;
  const target = dailyRate * (Math.max(horizonDays, 1) + COVER_DAYS_BEYOND_HORIZON) + ss;
  const cap = dailyRate * overstockDays;
  const upTo = Math.min(target, Math.max(cap, target > cap ? cap : target));
  return Math.max(0, Math.ceil(upTo - onHand));
}

export function classifyProducts(
  inputs: ProductDemandInput[],
  settings: PlanningSettings,
  lookbackDays: number
): InsightSummary {
  const days = Math.max(lookbackDays, 1);
  const active = inputs.filter(p => !p.isArchived);
  const archived = inputs.filter(p => p.isArchived);
  const horizon = Math.max((settings.lead_time_days || 0) + (settings.reorder_warning_days || 0), 1);
  const defaultLow = settings.default_low_stock_level || 10;

  const abc = abcClasses(active.map(p => ({
    id: p.id,
    contribution: p.totalMargin > 0 ? p.totalMargin : 0,
  })));
  // If nothing has a positive margin (costs not recorded), fall back to revenue so A still means "top sellers".
  if (active.every(p => p.totalMargin <= 0)) {
    const byRevenue = abcClasses(active.map(p => ({ id: p.id, contribution: p.totalRevenue })));
    for (const k of Object.keys(byRevenue)) abc[k] = byRevenue[k];
  }

  let outOfStockCount = 0, lowStockCount = 0, inStockCount = 0;
  let totalUnitsInStock = 0, totalStockValue = 0, totalStockCost = 0, deadStockCost = 0;

  const classified: ClassifiedProduct[] = active.map(p => {
    const stock = p.currentStock || 0;
    const totalUnits = p.dailyUnits.reduce((a, b) => a + b, 0);
    const dailyRate = totalUnits / days;
    const sigma = stdDev(p.dailyUnits.length ? p.dailyUnits : [0]);
    const cv = demandCv(p.dailyUnits);
    const cls = abc[p.id] || 'C';
    const ss = safetyStock(sigma, horizon, cls);
    const rop = reorderPoint(dailyRate, horizon, ss);
    const minLevel = p.minStockLevel || defaultLow;

    let daysRemaining: number | null = null;
    let stockoutDate: Date | null = null;
    if (stock <= 0) {
      daysRemaining = 0;
    } else if (dailyRate > 0) {
      daysRemaining = stock / dailyRate;
      stockoutDate = new Date();
      stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysRemaining));
    }

    if (stock <= 0) outOfStockCount++;
    else if (stock <= minLevel) lowStockCount++;
    else inStockCount++;

    const stockCost = stock * (p.costPerUnit || 0);
    const stockRetail = stock * (p.price || 0);
    totalUnitsInStock += stock;
    totalStockValue += stockRetail;
    totalStockCost += stockCost;
    if (totalUnits === 0 && stock > 0) deadStockCost += stockCost;

    let category: ProductCategory;
    if (stock <= 0) {
      category = 'out_of_stock';
    } else if (dailyRate > 0 && stock <= rop) {
      category = 'must_order';
    } else if (daysRemaining !== null && daysRemaining >= settings.overstock_days_threshold) {
      category = 'do_not_order';
    } else if (cls === 'A' || dailyRate >= settings.hot_selling_min_units_per_day) {
      category = 'hot_selling';
    } else if (totalUnits === 0 || (cls === 'C' && dailyRate <= settings.slow_selling_max_units_per_day)) {
      category = 'slow_moving';
    } else {
      category = 'healthy';
    }

    const qty = category === 'must_order' || category === 'out_of_stock'
      ? suggestedOrderQty(dailyRate, horizon, ss, stock, settings.overstock_days_threshold)
      : 0;

    const velocityChangePct = p.priorUnits > 0 ? ((totalUnits - p.priorUnits) / p.priorUnits) * 100 : null;
    const weeksOfSupply = daysRemaining === null ? null : daysRemaining / 7;
    const velocityHalved = p.priorUnits > 0 ? totalUnits < 0.5 * p.priorUnits : totalUnits === 0;
    const killCandidate = stock > 0 && cls === 'C' && velocityHalved
      && (weeksOfSupply === null || weeksOfSupply > KILL_WEEKS_OF_SUPPLY);

    return {
      id: p.id,
      name: p.name,
      price: p.price || 0,
      currentStock: stock,
      minStockLevel: minLevel,
      costPerUnit: p.costPerUnit || 0,
      imageUrl: p.imageUrl,
      category,
      totalUnitsSold: totalUnits,
      totalRevenue: p.totalRevenue,
      totalMargin: p.totalMargin,
      dailySalesRate: dailyRate,
      daysOfStockRemaining: daysRemaining,
      projectedStockoutDate: stockoutDate,
      abcClass: cls,
      xyzClass: xyzClass(cv),
      demandCv: cv,
      safetyStock: ss,
      reorderPoint: rop,
      suggestedOrderQty: qty,
      stockCost,
      stockRetail,
      weeksOfSupply,
      velocityChangePct,
      killCandidate,
    };
  });

  const categoryCounts: Record<ProductCategory, number> = {
    out_of_stock: 0, must_order: 0, hot_selling: 0, do_not_order: 0, slow_moving: 0, healthy: 0,
  };
  const abcCounts: Record<AbcClass, number> = { A: 0, B: 0, C: 0 };
  for (const p of classified) {
    categoryCounts[p.category]++;
    abcCounts[p.abcClass]++;
  }

  const killList = classified
    .filter(p => p.killCandidate)
    .sort((a, b) => b.stockCost - a.stockCost);

  const highestValueProducts = classified
    .map(p => ({ id: p.id, name: p.name, price: p.price, currentStock: p.currentStock, value: p.stockCost }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const periodLabel = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return {
    totalActiveProducts: active.length,
    totalArchivedProducts: archived.length,
    totalUnitsInStock,
    totalStockValue,
    totalStockCost,
    deadStockCost,
    avgSellingPrice: active.length ? active.reduce((s, p) => s + (p.price || 0), 0) / active.length : 0,
    outOfStockCount,
    lowStockCount,
    inStockCount,
    categoryCounts,
    abcCounts,
    classifiedProducts: classified,
    killList,
    highestValueProducts,
    periodLabel,
  };
}
