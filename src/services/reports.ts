import { supabase } from '../config/supabase';
import { salesService } from './sales';
import { expenseService } from './expenses';
import { productService } from './products.ts';
import { format, subDays, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, isSameMonth, formatISO, endOfDay } from 'date-fns';
import { getSaleGrossRevenue, getSaleDeliveryCost, summarizeRevenue } from '../utils/saleMoney';
import { resolveReportCurrency, conversionFactor, saleFactor, expenseFactor, scaleSale, ReportCurrency } from '../utils/reportCurrency';

/** Local-time bucket key so a 23:30 sale lands on today's bar, not tomorrow's UTC date. */
const bucketKey = (iso: string | null | undefined, unit: 'day' | 'month'): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return format(d, unit === 'day' ? 'yyyy-MM-dd' : 'yyyy-MM');
};

/** Expense categories treated as capital purchases on the cash flow statement. */
const CAPITAL_EXPENSE_KEYWORDS = ['equipment', 'asset', 'capital'];
const isCapitalExpense = (categoryName?: string | null) => {
  const n = (categoryName || '').toLowerCase();
  return CAPITAL_EXPENSE_KEYWORDS.some(k => n.includes(k));
};

/**
 * COGS in the reporting currency. calculate_cogs sums cost_per_unit in each
 * sale's own currency, so with more than one currency it is called per currency
 * and converted; untagged (legacy) sales are the remainder, in the default currency.
 */
async function getConvertedCOGS(businessId: string, startDate: string, endDate: string, rc: ReportCurrency): Promise<number> {
  const call = async (currencyId?: string) => {
    const { data } = await supabase.rpc('calculate_cogs', {
      business_id_param: businessId,
      start_date: startDate,
      end_date: endDate,
      ...(currencyId ? { currency_id_param: currencyId } : {})
    });
    return Number(data) || 0;
  };
  const ids = Object.keys(rc.rates);
  if (ids.length <= 1 || !rc.targetId) return call();
  const all = await call();
  let converted = 0;
  let tagged = 0;
  for (const id of ids) {
    const part = await call(id);
    tagged += part;
    converted += part * conversionFactor(rc, id);
  }
  converted += (all - tagged) * conversionFactor(rc, rc.defaultId);
  return converted;
}

export const reportsService = {
  async getDashboardStats(businessId: string, year?: number, month?: number, currencyId?: string) {
    if (!businessId) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString();

    // Use provided year/month or default to current month
    const targetDate = year && month ? new Date(year, month - 1, 1) : today;
    const startOfMonthDate = startOfMonth(targetDate);
    const startOfMonthStr = startOfMonthDate.toISOString();

    const endOfMonthDate = endOfMonth(targetDate);
    endOfMonthDate.setHours(23, 59, 59, 999);
    const endOfMonthStr = endOfMonthDate.toISOString();

    try {
      const rc = await resolveReportCurrency(businessId, currencyId);

      // Today's revenue
      let todaySalesQuery = supabase
        .from('sales')
        .select(`
          total_amount,
          delivery_cost,
          status,
          currency_id,
          exchange_rate_at_sale,
          sale_actions!left(amount, action_type, adjusted_amount)
        `)
        .eq('business_id', businessId)
        .in('status', ['completed', 'partially_returned'])
        .gte('sale_date', todayStr)
        .lt('sale_date', tomorrowStr);
      const { data: todayRaw } = await todaySalesQuery;
      const todaySalesData = (todayRaw || []).map(sale => scaleSale(sale, saleFactor(rc, sale)));
      const todayRevenue = summarizeRevenue(todaySalesData).grossRevenue;

      // Monthly revenue
      let monthlySalesQuery = supabase
        .from('sales')
        .select(`
          total_amount,
          delivery_cost,
          status,
          currency_id,
          exchange_rate_at_sale,
          sale_actions!left(amount, action_type, adjusted_amount)
        `)
        .eq('business_id', businessId)
        .in('status', ['completed', 'partially_returned'])
        .gte('sale_date', startOfMonthStr)
        .lte('sale_date', endOfMonthStr);
      const { data: monthlyRaw } = await monthlySalesQuery;
      const monthlySalesData = (monthlyRaw || []).map(sale => scaleSale(sale, saleFactor(rc, sale)));

      // Gross revenue = customer price (sale total + courier fee) net of refunds.
      const monthlySummary = summarizeRevenue(monthlySalesData);
      const monthlyRevenue = monthlySummary.grossRevenue;
      const deliveryFees = monthlySummary.deliveryFees;

      // Monthly COGS (Cost of Goods Sold) - based on actual sold items
      const monthlyCOGS = await getConvertedCOGS(businessId, startOfMonthStr, endOfMonthStr, rc);

      // Calculate Total Profit (Revenue - COGS)
      const totalProfit = monthlyRevenue - monthlyCOGS;

      // Monthly expenses
      let expensesQuery = supabase
        .from('expenses')
        .select('amount, currency_id')
        .eq('business_id', businessId)
        .gte('expense_date', startOfMonthStr)
        .lte('expense_date', endOfMonthStr);
      const { data: monthlyExpenses } = await expensesQuery;

      const operatingExpenses = (monthlyExpenses || []).reduce((sum, expense) => sum + Number(expense.amount) * expenseFactor(rc, expense), 0);
      // Courier fees are a cost of the business, reported as an expense rather than netted from revenue.
      const totalExpenses = operatingExpenses + deliveryFees;

      // Get loss amounts from sale actions (treated as expenses)
      let lossQuery = supabase
        .from('sale_actions')
        .select(`
          loss_amount,
          sales!inner(business_id, sale_date, currency_id)
        `)
        .eq('sales.business_id', businessId)
        .gte('sales.sale_date', startOfMonthStr)
        .lte('sales.sale_date', endOfMonthStr)
        .not('loss_amount', 'is', null)
        .gt('loss_amount', 0);
      const { data: lossData } = await lossQuery;

      // Deductions the business kept back from refunds. Revenue already subtracts only the
      // refunded amount, so this money is still inside revenue and must not be expensed again.
      const refundDeductionsRetained = (lossData || []).reduce((sum, action) => sum + Number(action.loss_amount || 0) * conversionFactor(rc, (action as any).sales?.currency_id), 0);

      // Net Profit = Gross Profit - Operating Expenses - Delivery Fees
      const netProfit = totalProfit - totalExpenses;

      // Low stock count
      const lowStockProducts = await productService.getLowStockProducts(businessId);
      const lowStockCount = lowStockProducts?.length || 0;

      // Total customers
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      // Total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      // Get total products sold for completed and partially returned sales
      const totalProductsSold = await salesService.getTotalProductsSoldByStatuses(
        businessId,
        startOfMonthStr,
        endOfMonthStr,
        ['completed', 'partially_returned']
      );

      const { data: customersCountValue } = await supabase.rpc('get_distinct_customer_count_for_sales', {
        business_id_param: businessId,
        start_date_param: startOfMonthStr,
        end_date_param: endOfMonthStr
      });
      
      const totalCustomersBought = customersCountValue || 0;

      return {
        todayRevenue,
        monthlyRevenue,
        monthlyCOGS,
        totalProfit,
        operatingExpenses,
        deliveryFees,
        totalExpenses,
        refundDeductionsRetained,
        netProfit,
        lowStockCount,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        totalCustomersBought: totalCustomersBought || 0,
        totalProductsSold: totalProductsSold || 0,
        currencyId: rc.targetId
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return null;
    }
  },

  async getTopProducts(businessId: string, limit = 5, year?: number, month?: number, currencyId?: string) {
    // Helper to check if a sale is completely voided
    const isSaleVoided = (sale: any): boolean => {
      if (!sale.sale_actions || sale.sale_actions.length === 0) return false;
      return sale.sale_actions.some((action: any) => action.action_type === 'void');
    };

    // Helper to get returned quantity for a specific product
    const getReturnedQuantityForProduct = (sale: any, productId: string): number => {
      if (!sale.sale_actions || sale.sale_actions.length === 0) return 0;

      let returnedQty = 0;
      const returns = sale.sale_actions.filter((action: any) => action.action_type === 'return');

      returns.forEach((returnAction: any) => {
        if (returnAction.items_metadata) {
          const returnedItems = returnAction.items_metadata;
          const productReturn = returnedItems.find((item: any) => item.productId === productId);
          if (productReturn) {
            returnedQty += productReturn.quantity || 0;
          }
        }
      });

      return returnedQty;
    };

    // Helper to get returned revenue for a specific product
    const getReturnedRevenueForProduct = (sale: any, productId: string): number => {
      if (!sale.sale_actions || sale.sale_actions.length === 0) return 0;

      let returnedRevenue = 0;
      const returns = sale.sale_actions.filter((action: any) => action.action_type === 'return');

      returns.forEach((returnAction: any) => {
        if (returnAction.items_metadata) {
          const returnedItems = returnAction.items_metadata;
          const productReturn = returnedItems.find((item: any) => item.productId === productId);
          if (productReturn) {
            returnedRevenue += parseFloat(productReturn.adjustedAmount || 0);
          }
        }
      });

      return returnedRevenue;
    };

    // Use provided year/month or default to current month
    const targetDate = year && month ? new Date(year, month - 1, 1) : new Date();
    const startOfMonthDate = startOfMonth(targetDate);
    const startOfMonthStr = startOfMonthDate.toISOString();

    const endOfMonthDate = endOfMonth(targetDate);
    endOfMonthDate.setHours(23, 59, 59, 999);
    const endOfMonthStr = endOfMonthDate.toISOString();

    let topProductsQuery = supabase
      .from('sales')
      .select(`
        id,
        business_id,
        sale_date,
        status,
        currency_id,
        exchange_rate_at_sale,
        sale_actions(
          id,
          action_type,
          amount,
          adjusted_amount,
          items_metadata
        ),
        carts!inner(
          id,
          cart_items(
            quantity,
            product_id,
            unit_price,
            cost_per_unit,
            subtotal,
            products(id, name, price, cost_per_unit, description, image_url, barcode, current_stock, min_stock_level)
          )
        )
      `)
      .eq('business_id', businessId)
      .gte('sale_date', startOfMonthStr)
      .lte('sale_date', endOfMonthStr);
    const { data: rawData, error } = await topProductsQuery;

    if (error) throw error;
    const rc = await resolveReportCurrency(businessId, currencyId);
    const data = (rawData || []).map(sale => scaleSale(sale, saleFactor(rc, sale)));

    // Group by product and sum net quantities (excluding voided sales and subtracting returns)
    const productSales: Record<string, {
      id: string;
      name: string;
      price: number;
      description?: string;
      image_url?: string;
      barcode?: string;
      current_stock: number;
      min_stock_level: number;
      cost_per_unit: number;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number
    }> = {};

    data.forEach(sale => {
      // Skip voided sales
      if (isSaleVoided(sale)) {
        return;
      }

      // Get cart items from this sale
      const cartItems = sale.carts?.cart_items || [];

      // Process each product in this sale
      cartItems.forEach((item: any) => {
        const productId = item.product_id || item.products?.id || 'unknown';
        const productName = item.products?.name || 'Unknown';
        const productPrice = item.products?.price || 0;
        const productCost = (item.cost_per_unit && item.cost_per_unit > 0) ? item.cost_per_unit : (item.products?.cost_per_unit || 0);

        // Initialize product entry if not exists
        if (!productSales[productId]) {
          productSales[productId] = {
            id: productId,
            name: productName,
            price: productPrice,
            description: item.products?.description,
            image_url: item.products?.image_url,
            barcode: item.products?.barcode,
            current_stock: item.products?.current_stock || 0,
            min_stock_level: item.products?.min_stock_level || 0,
            cost_per_unit: productCost,
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }

        // Calculate net quantity (original - returned)
        const originalQuantity = item.quantity || 0;
        const returnedQuantity = getReturnedQuantityForProduct(sale, productId);
        const netQuantity = originalQuantity - returnedQuantity;

        // Only add if net quantity is positive
        if (netQuantity > 0) {
          // Calculate net revenue
          const originalRevenue = item.subtotal || (originalQuantity * productPrice);
          const returnedRevenue = getReturnedRevenueForProduct(sale, productId);
          const netRevenue = originalRevenue - returnedRevenue;

          // Calculate net cost and profit
          const netCost = netQuantity * productCost;
          const netProfit = netRevenue - netCost;

          // Add to totals
          productSales[productId].quantity += netQuantity;
          productSales[productId].revenue += netRevenue;
          productSales[productId].cost += netCost;
          productSales[productId].profit += netProfit;
        }
      });
    });

    return Object.values(productSales)
      .filter(product => product.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  },

  async getTopCustomers(businessId: string, limit = 5, year?: number, month?: number, currencyId?: string) {
    // Use provided year/month or default to current month
    const targetDate = year && month ? new Date(year, month - 1, 1) : new Date();
    const startOfMonthDate = startOfMonth(targetDate);
    const startOfMonthStr = startOfMonthDate.toISOString();

    const endOfMonthDate = endOfMonth(targetDate);
    endOfMonthDate.setHours(23, 59, 59, 999);
    const endOfMonthStr = endOfMonthDate.toISOString();

    let topCustomersQuery = supabase
      .from('sales')
      .select(`
        current_total_amount,
        currency_id,
        exchange_rate_at_sale,
        customers(id, name, phone)
      `)
      .eq('business_id', businessId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startOfMonthStr)
      .lte('sale_date', endOfMonthStr);
    const { data: rawData, error } = await topCustomersQuery;

    if (error) throw error;
    const rc = await resolveReportCurrency(businessId, currencyId);
    const data = (rawData || []).map(sale => scaleSale(sale, saleFactor(rc, sale)));

    // Group by customer and sum amounts
    const customerSales: Record<string, { id: string; name: string; phone?: string; totalSpent: number; orderCount: number }> = {};
    
    data.forEach(sale => {
      const customerId = sale.customers?.id || 'unknown';
      const customerName = sale.customers?.name || 'Unknown';
      const customerPhone = sale.customers?.phone;
      
      if (!customerSales[customerId]) {
        customerSales[customerId] = { 
          id: customerId,
          name: customerName, 
          phone: customerPhone,
          totalSpent: 0, 
          orderCount: 0 
        };
      }
      
      customerSales[customerId].totalSpent += sale.current_total_amount || 0;
      customerSales[customerId].orderCount += 1;
    });

    return Object.values(customerSales)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  },

  async getRevenueChart(businessId: string, startDate: Date, endDate: Date, currencyId?: string) {
    // Same definition as the statements: completed and partially returned sales,
    // customer price net of refunds, in the reporting currency.
    const { data, error } = await supabase
      .from('sales')
      .select(`
        total_amount,
        delivery_cost,
        status,
        sale_date,
        currency_id,
        exchange_rate_at_sale,
        sale_actions!left(amount, action_type, adjusted_amount)
      `)
      .eq('business_id', businessId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', endDate.toISOString())
      .order('sale_date');

    if (error) throw error;
    const rc = await resolveReportCurrency(businessId, currencyId);
    const sales = (data || []).map(sale => scaleSale(sale, saleFactor(rc, sale)));

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const groupByMonth = dayDiff > 31;

    if (groupByMonth) {
      return eachMonthOfInterval({ start, end }).map(month => {
        const key = format(month, 'yyyy-MM');
        const revenue = sales
          .filter(sale => bucketKey(sale.sale_date, 'month') === key)
          .reduce((sum, sale) => sum + getSaleGrossRevenue(sale), 0);
        return { date: format(month, 'yyyy-MM-dd'), label: format(month, 'MMM'), revenue };
      });
    }

    return eachDayOfInterval({ start, end }).map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const revenue = sales
        .filter(sale => bucketKey(sale.sale_date, 'day') === key)
        .reduce((sum, sale) => sum + getSaleGrossRevenue(sale), 0);
      return { date: key, label: format(day, 'dd/MM'), revenue };
    });
  },

  async getExpenseChart(businessId: string, startDate: Date, endDate: Date, currencyId?: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select('amount, expense_date, currency_id')
      .eq('business_id', businessId)
      .gte('expense_date', startDate.toISOString())
      .lte('expense_date', endDate.toISOString())
      .order('expense_date');

    if (error) throw error;
    const rc = await resolveReportCurrency(businessId, currencyId);
    const expenses = (data || []).map(e => ({ ...e, amount: Number(e.amount) * expenseFactor(rc, e) }));

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const groupByMonth = dayDiff > 31;

    if (groupByMonth) {
      return eachMonthOfInterval({ start, end }).map(month => {
        const key = format(month, 'yyyy-MM');
        const amount = expenses
          .filter(e => bucketKey(e.expense_date, 'month') === key)
          .reduce((sum, e) => sum + e.amount, 0);
        return { date: format(month, 'yyyy-MM-dd'), label: format(month, 'MMM'), amount };
      });
    }

    return eachDayOfInterval({ start, end }).map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const amount = expenses
        .filter(e => bucketKey(e.expense_date, 'day') === key)
        .reduce((sum, e) => sum + e.amount, 0);
      return { date: key, label: format(day, 'dd/MM'), amount };
    });
  },

  async getProfitChart(businessId: string, startDate: Date, endDate: Date, currencyId?: string) {
    // Get sales data that matches dashboard calculation (including partially returned)
    const { data: revenueRaw, error: revenueError } = await supabase
      .from('sales')
      .select(`
        total_amount,
        delivery_cost,
        status,
        sale_date,
        currency_id,
        exchange_rate_at_sale,
        sale_actions!left(amount, action_type, adjusted_amount)
      `)
      .eq('business_id', businessId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', endDate.toISOString())
      .order('sale_date');

    if (revenueError) throw revenueError;

    // Get sales data with COGS for cost calculations
    const salesData = await salesService.getSalesWithCOGS(businessId, startDate.toISOString(), endDate.toISOString(), currencyId);
    
    // Get expense data
    const { data: expenseRaw, error: expenseError } = await supabase
      .from('expenses')
      .select('amount, expense_date, currency_id')
      .eq('business_id', businessId)
      .gte('expense_date', startDate.toISOString())
      .lte('expense_date', endDate.toISOString())
      .order('expense_date');

    if (expenseError) throw expenseError;

    // Get loss data from sale actions
    const { data: lossRaw, error: lossError } = await supabase
      .from('sale_actions')
      .select(`
        loss_amount,
        created_at,
        sales!inner(business_id, sale_date, currency_id)
      `)
      .eq('sales.business_id', businessId)
      .gte('sales.sale_date', startDate.toISOString())
      .lte('sales.sale_date', endDate.toISOString())
      .not('loss_amount', 'is', null)
      .gt('loss_amount', 0);

    if (lossError) throw lossError;

    // Everything in the reporting currency
    const rc = await resolveReportCurrency(businessId, currencyId);
    const revenueData = (revenueRaw || []).map(sale => scaleSale(sale, saleFactor(rc, sale)));
    const expenseData = (expenseRaw || []).map(expense => ({ ...expense, amount: Number(expense.amount) * expenseFactor(rc, expense) }));
    const lossData = (lossRaw || []).map(loss => ({ ...loss, loss_amount: Number(loss.loss_amount || 0) * conversionFactor(rc, (loss as any).sales?.currency_id) }));

    // Convert dates to JS Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Determine if we should group by day or month based on date range
    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const groupByMonth = dayDiff > 31;
    
    let result = [];
    
    if (groupByMonth) {
      // Group by month
      const months = eachMonthOfInterval({ start, end });
      
      result = months.map(month => {
        const monthStr = format(month, 'yyyy-MM');
        
        // Filter revenue data for this month (including partially returned)
        const monthRevenueSales = revenueData.filter(sale => {
          const saleMonth = bucketKey(sale.sale_date, 'month');
          return saleMonth === monthStr;
        });
        
        // Gross revenue (customer price net of refunds) and the courier fees behind it
        const revenue = monthRevenueSales.reduce((sum, sale) => sum + getSaleGrossRevenue(sale), 0);
        const deliveryFees = monthRevenueSales.reduce((sum, sale) => sum + getSaleDeliveryCost(sale), 0);
        
        // Filter COGS sales data for this month
        const monthSales = salesData.filter(sale => {
          const saleMonth = bucketKey(sale.date, 'month');
          return saleMonth === monthStr;
        });
        
        // Calculate COGS and profit for this month
        const cogs = monthSales.reduce((sum, sale) => sum + sale.cogs, 0);
        const profit = revenue - cogs;
        
        // Filter expenses for this month
        const monthExpenses = expenseData.filter(expense => {
          const expenseMonth = bucketKey(expense.expense_date, 'month');
          return expenseMonth === monthStr;
        });
        
        // Operating expenses plus courier fees
        const operatingExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const expenses = operatingExpenses + deliveryFees;

        // Filter loss amounts for this month
        const monthLosses = lossData?.filter(loss => {
          const lossMonth = bucketKey((loss as any).sales?.sale_date, 'month');
          return lossMonth === monthStr;
        }) || [];

        // Calculate total loss for this month
        const lossAmount = monthLosses.reduce((sum, loss) => sum + (loss.loss_amount || 0), 0);

        // Net profit = gross profit - operating expenses - delivery fees.
        // Refund deductions kept by the business are already inside revenue.
        const netProfit = profit - expenses;

        return {
          date: format(month, 'yyyy-MM-dd'),
          label: format(month, 'MMM'),
          revenue,
          cogs,
          profit,
          expenses,
          operatingExpenses,
          deliveryFees,
          refundDeductionsRetained: lossAmount,
          netProfit
        };
      });
    } else {
      // Group by day
      const days = eachDayOfInterval({ start, end });
      
      result = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        
        // Filter revenue data for this day (including partially returned)
        const dayRevenueSales = revenueData.filter(sale => {
          const saleDate = bucketKey(sale.sale_date, 'day');
          return saleDate === dayStr;
        });
        
        // Gross revenue (customer price net of refunds) and the courier fees behind it
        const revenue = dayRevenueSales.reduce((sum, sale) => sum + getSaleGrossRevenue(sale), 0);
        const deliveryFees = dayRevenueSales.reduce((sum, sale) => sum + getSaleDeliveryCost(sale), 0);
        
        // Filter COGS sales data for this day
        const daySales = salesData.filter(sale => {
          const saleDate = bucketKey(sale.date, 'day');
          return saleDate === dayStr;
        });
        
        // Calculate COGS and profit for this day
        const cogs = daySales.reduce((sum, sale) => sum + sale.cogs, 0);
        const profit = revenue - cogs;
        
        // Filter expenses for this day
        const dayExpenses = expenseData.filter(expense => {
          const expenseDate = bucketKey(expense.expense_date, 'day');
          return expenseDate === dayStr;
        });
        
        // Operating expenses plus courier fees
        const operatingExpenses = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const expenses = operatingExpenses + deliveryFees;

        // Filter loss amounts for this day
        const dayLosses = lossData?.filter(loss => {
          const lossDate = bucketKey((loss as any).sales?.sale_date, 'day');
          return lossDate === dayStr;
        }) || [];

        // Calculate total loss for this day
        const lossAmount = dayLosses.reduce((sum, loss) => sum + (loss.loss_amount || 0), 0);

        // Net profit = gross profit - operating expenses - delivery fees.
        // Refund deductions kept by the business are already inside revenue.
        const netProfit = profit - expenses;

        return {
          date: dayStr,
          label: format(day, 'dd/MM'),
          revenue,
          cogs,
          profit,
          expenses,
          operatingExpenses,
          deliveryFees,
          refundDeductionsRetained: lossAmount,
          netProfit
        };
      });
    }
    
    return result;
  },

  async getExpensesByCategory(businessId: string, startDate: Date, endDate: Date, currencyId?: string) {
    const { data, error } = await supabase
      .from('expenses')
            .select(`
        amount,
        currency_id,
        expense_categories(name)
      `)
      .eq('business_id', businessId)
      .gte('expense_date', startDate.toISOString())
      .lte('expense_date', endDate.toISOString());

    if (error) throw error;
    const rc = await resolveReportCurrency(businessId, currencyId);

    // Group by category, in the reporting currency
    const categoryTotals: Record<string, number> = {};
    let totalExpenses = 0;

    (data || []).forEach(expense => {
      const categoryName = expense.expense_categories?.name || 'Uncategorized';
      const amount = Number(expense.amount) * expenseFactor(rc, expense);
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + amount;
      totalExpenses += amount;
    });

    // Convert to array and calculate percentages
    const result = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    }));

    // Sort by amount (descending)
    return result.sort((a, b) => b.amount - a.amount);
  },

  /**
   * Cash flow statement for one month, indirect method, in the reporting currency.
   *
   * Sales are settled at the time of sale (cash, card, transfer), so net income
   * is the starting point. COGS is not a cash movement in the month it is
   * recognised; the cash left when the stock was bought. Stock bought this
   * month is therefore subtracted and COGS added back. Expenses in a capital
   * category are moved from operations to investing. There is no owner-equity
   * ledger in the app, so no financing section is presented.
   */
  async getCashFlowStatement(businessId: string, month: number, year: number, currencyId?: string) {
    const startDateObj = new Date(year, month, 1);
    const endDateObj = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const startDate = startDateObj.toISOString();
    const endDate = endDateObj.toISOString();

    try {
      const statement = await this.getIncomeStatement(businessId, startDate, endDate, currencyId);
      if (!statement) throw new Error('No income statement');
      const rc = await resolveReportCurrency(businessId, currencyId);

      // Cash paid for stock this month (imports have no currency column: business default)
      const { data: imports, error: importsError } = await supabase
        .from('inventory_imports')
        .select('total_cost_for_item, purchase_date')
        .eq('business_id', businessId)
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate);
      if (importsError) throw importsError;
      const inventoryPurchases = (imports || []).reduce((sum, row) => sum + Number(row.total_cost_for_item || 0), 0)
        * conversionFactor(rc, rc.defaultId);

      // Capital purchases recorded as expenses: out of operations, into investing
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, currency_id, expense_categories(name)')
        .eq('business_id', businessId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);
      if (expensesError) throw expensesError;
      const equipmentPurchases = (expensesData || [])
        .filter(expense => isCapitalExpense((expense as any).expense_categories?.name))
        .reduce((sum, expense) => sum + Number(expense.amount) * expenseFactor(rc, expense), 0);

      const netIncome = statement.netIncome;
      const cogsAddBack = statement.cogs.total;
      const operatingCashFlow = netIncome + cogsAddBack - inventoryPurchases + equipmentPurchases;
      const investingCashFlow = -equipmentPurchases;
      const netCashFlow = operatingCashFlow + investingCashFlow;

      return {
        period: `${month + 1}/${year}`,
        currencyId: rc.targetId,
        revenue: statement.revenue.total,
        cogs: cogsAddBack,
        operatingExpenses: statement.expenses.operating,
        deliveryFees: statement.expenses.deliveryFees,
        netIncome,
        cogsAddBack,
        inventoryPurchases,
        equipmentPurchases,
        operatingCashFlow,
        investingCashFlow,
        netCashFlow,
        refundDeductionsRetained: statement.refundDeductionsRetained
      };
    } catch (error) {
      console.error('Error generating cash flow statement:', error);
      throw error;
    }
  },

  /**
   * Income statement for a period. Single source for the screen and the CSV export.
   *
   * Revenue is the customer price (sale total + courier fee) net of refunds.
   * Courier fees are an operating expense. Deductions kept back from refunds are
   * already inside revenue and are reported for information only.
   */
  async getIncomeStatement(businessId: string, startDate: string, endDate: string, currencyId?: string) {
    if (!businessId) return null;

    const rc = await resolveReportCurrency(businessId, currencyId);

    const { data: salesRaw, error: salesError } = await supabase
      .from('sales')
      .select(`
        total_amount,
        delivery_cost,
        status,
        currency_id,
        exchange_rate_at_sale,
        sale_actions!left(amount, action_type, adjusted_amount, loss_amount)
      `)
      .eq('business_id', businessId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);
    if (salesError) throw salesError;
    const salesData = (salesRaw || []).map(sale => scaleSale(sale, saleFactor(rc, sale)));

    const revenue = summarizeRevenue(salesData);

    const totalCOGS = await getConvertedCOGS(businessId, startDate, endDate, rc);
    const grossProfit = revenue.grossRevenue - totalCOGS;

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('amount, currency_id, expense_categories(name)')
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);
    if (expensesError) throw expensesError;

    const categoryTotals: Record<string, number> = {};
    for (const expense of expensesData || []) {
      const name = (expense as any).expense_categories?.name || 'Uncategorized';
      categoryTotals[name] = (categoryTotals[name] || 0) + (Number((expense as any).amount) || 0) * expenseFactor(rc, expense as any);
    }
    const categories = Object.entries(categoryTotals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
    const operatingExpenses = categories.reduce((sum, c) => sum + c.total, 0);
    const totalExpenses = operatingExpenses + revenue.deliveryFees;

    const refundDeductionsRetained = (salesData || []).reduce((sum, sale) => {
      const kept = (sale.sale_actions || [])
        .filter((a: any) => a.action_type === 'return')
        .reduce((s: number, a: any) => s + (Number(a.loss_amount) || 0), 0);
      return sum + kept;
    }, 0);

    const netIncome = grossProfit - totalExpenses;

    return {
      period: { start: startDate, end: endDate },
      currencyId: rc.targetId,
      revenue: {
        gross: revenue.grossRevenue + revenue.refunds,
        refunds: revenue.refunds,
        total: revenue.grossRevenue
      },
      cogs: { total: totalCOGS },
      grossProfit,
      grossMargin: revenue.grossRevenue > 0 ? (grossProfit / revenue.grossRevenue) * 100 : 0,
      expenses: {
        categories,
        operating: operatingExpenses,
        deliveryFees: revenue.deliveryFees,
        total: totalExpenses
      },
      refundDeductionsRetained,
      netIncome,
      netMargin: revenue.grossRevenue > 0 ? (netIncome / revenue.grossRevenue) * 100 : 0
    };
  },

  async getSalesCOGSReport(businessId: string, startDate: string, endDate: string) {
    // Get sales data
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        delivery_cost,
        sale_date,
        status,
        cart_id,
        sale_actions(action_type, adjusted_amount, amount, items_metadata),
        carts(
          cart_items(
            quantity,
            product_id,
            cost_per_unit,
            products(
              name,
              cost_per_unit
            )
          )
        )
      `)
      .eq('business_id', businessId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date');

    if (!salesData) return [];

    return salesData.map(sale => {
      let totalCOGS = 0;
      let revenue = getSaleGrossRevenue(sale);
      const itemDetails: any[] = [];
      const costMap = new Map<string, number>();

      if (sale.carts?.cart_items) {
        sale.carts.cart_items.forEach(item => {
          const costPerUnit = (item.cost_per_unit && item.cost_per_unit > 0) ? item.cost_per_unit : (item.products?.cost_per_unit || 0);
          const itemCOGS = item.quantity * costPerUnit;
          totalCOGS += itemCOGS;
          if (item.product_id) costMap.set(item.product_id, costPerUnit);

          itemDetails.push({
            product: item.products?.name || 'Unknown Product',
            quantity: item.quantity,
            costPerUnit,
            totalCost: itemCOGS
          });
        });
      }

      if (sale.status === 'partially_returned' && (sale as any).sale_actions) {
        for (const action of (sale as any).sale_actions) {
          if (action.action_type !== 'return') continue;
          const items = action.items_metadata as any[] || [];
          for (const m of items) {
            const cost = costMap.get(m.productId) || 0;
            totalCOGS -= cost * (m.quantity || 0);
          }
        }
      }

      return {
        id: sale.id,
        date: sale.sale_date,
        revenue,
        cogs: totalCOGS,
        deliveryCost: getSaleDeliveryCost(sale),
        profit: revenue - totalCOGS,
        profitMargin: revenue > 0 ? ((revenue - totalCOGS) / revenue) * 100 : 0,
        items: itemDetails
      };
    });
  },

  async getProductFinancialSummary(productId: string, businessId: string, startDate: Date, endDate: Date) {
    try {
      // Get all sales containing this product
      const { data: cartItems, error: cartItemsError } = await supabase
        .from('cart_items')
        .select(`
          quantity,
          unit_price,
          subtotal,
          cost_per_unit,
          carts!inner(
            sales!inner(
              id,
              sale_date,
              status,
              business_id
            )
          )
        `)
        .eq('product_id', productId)
        .eq('carts.sales.business_id', businessId)
        .in('carts.sales.status', ['completed', 'partially_returned'])
        .gte('carts.sales.sale_date', startDate.toISOString())
        .lte('carts.sales.sale_date', endDate.toISOString());

      if (cartItemsError) throw cartItemsError;

      // Get product cost per unit (fallback for items without snapshot)
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('cost_per_unit')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      // Calculate totals using snapshot cost where available
      const quantitySold = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = cartItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
      const fallbackCost = product?.cost_per_unit || 0;
      const totalCOGS = cartItems.reduce((sum, item) => {
        const itemCost = (item.cost_per_unit && item.cost_per_unit > 0) ? item.cost_per_unit : fallbackCost;
        return sum + item.quantity * itemCost;
      }, 0);
      const totalProfit = totalRevenue - totalCOGS;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      return {
        quantitySold,
        totalRevenue,
        costPerUnit: quantitySold > 0 ? totalCOGS / quantitySold : (product?.cost_per_unit || 0),
        totalCOGS,
        totalProfit,
        profitMargin
      };
    } catch (error) {
      console.error('Error getting product financial summary:', error);
      throw error;
    }
  },

  async getCustomerSpendingChart(businessId: string, customerId: string, startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('sales')
      .select('current_total_amount, sale_date')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', endDate.toISOString())
      .order('sale_date');

    if (error) throw error;

    // Convert dates to JS Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Determine if we should group by day or month based on date range
    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const groupByMonth = dayDiff > 31;
    
    let result = [];
    
    if (groupByMonth) {
      // Group by month
      const months = eachMonthOfInterval({ start, end });
      
      result = months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthSales = data.filter(sale => {
          const saleDate = new Date(sale.sale_date);
          return isSameMonth(saleDate, month);
        });
        
        const spending = monthSales.reduce((sum, sale) => sum + parseFloat(sale.current_total_amount || sale.total_amount), 0);
        
        return {
          date: format(month, 'yyyy-MM-dd'),
          label: format(month, 'MMM'),
          spending
        };
      });
    } else {
      // Group by day
      const days = eachDayOfInterval({ start, end });
      
      result = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const daySales = data.filter(sale => bucketKey(sale.sale_date, 'day') === dayStr);
        const spending = daySales.reduce((sum, sale) => sum + parseFloat(sale.current_total_amount || sale.total_amount), 0);
        
        return {
          date: dayStr,
          label: format(day, 'dd/MM'),
          spending
        };
      });
    }
    
    return result;
  },

  async getCustomerEngagementMetrics(businessId: string, customerId: string, startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        current_total_amount,
        sale_date,
        carts(
          cart_items(
            quantity,
            products(name)
          )
        )
      `)
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', endDate.toISOString())
      .order('sale_date', { ascending: false });

    if (error) throw error;

    const totalSpent = data.reduce((sum, sale) => sum + parseFloat(sale.current_total_amount || 0), 0);
    const totalOrders = data.length;
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastOrderDate = data.length > 0 ? data[0].sale_date : null;
    
    // Calculate total items purchased
    const totalItems = data.reduce((sum, sale) => {
      const items = sale.carts?.cart_items || [];
      return sum + items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);
    
    // Get unique products purchased
    const uniqueProducts = new Set();
    data.forEach(sale => {
      const items = sale.carts?.cart_items || [];
      items.forEach(item => {
        if (item.products?.name) {
          uniqueProducts.add(item.products.name);
        }
      });
    });

    return {
      totalSpent,
      totalOrders,
      averageOrderValue,
      lastOrderDate,
      totalItems,
      uniqueProductsPurchased: uniqueProducts.size
    };
  },

  async getVoidReturnSummary(businessId: string, startDate: Date, endDate: Date) {
    try {
      const { data, error } = await supabase
        .from('sale_actions')
        .select(`
          id,
          action_type,
          amount,
          adjusted_amount,
          delivery_cost_included,
          delivery_cost_amount,
          loss_amount,
          loss_percentage,
          loss_type,
          reason,
          created_at,
          sales!inner(
            id,
            total_amount,
            sale_date,
            business_id
          )
        `)
        .eq('sales.business_id', businessId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('action_type', ['void', 'return'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const voidActions = data.filter(action => action.action_type === 'void');
      const returnActions = data.filter(action => action.action_type === 'return');

      const totalVoidAmount = voidActions.reduce((sum, action) => sum + (action.amount || 0), 0);
      const totalVoidAdjustedAmount = voidActions.reduce((sum, action) => sum + (action.adjusted_amount ?? action.amount ?? 0), 0);
      const totalVoidLoss = voidActions.reduce((sum, action) => sum + (action.loss_amount || 0), 0);

      const totalReturnAmount = returnActions.reduce((sum, action) => sum + (action.amount || 0), 0);
      const totalReturnAdjustedAmount = returnActions.reduce((sum, action) => sum + (action.adjusted_amount ?? action.amount ?? 0), 0);
      const totalReturnLoss = returnActions.reduce((sum, action) => sum + (action.loss_amount || 0), 0);

      const totalDeliveryCostExcluded = [...voidActions, ...returnActions]
        .filter(action => !action.delivery_cost_included)
        .reduce((sum, action) => sum + (action.delivery_cost_amount || 0), 0);

      return {
        voidSummary: {
          count: voidActions.length,
          totalAmount: totalVoidAmount,
          totalAdjustedAmount: totalVoidAdjustedAmount,
          totalLoss: totalVoidLoss,
          actions: voidActions,
        },
        returnSummary: {
          count: returnActions.length,
          totalAmount: totalReturnAmount,
          totalAdjustedAmount: totalReturnAdjustedAmount,
          totalLoss: totalReturnLoss,
          actions: returnActions,
        },
        overallSummary: {
          totalActions: data.length,
          totalGrossAmount: totalVoidAmount + totalReturnAmount,
          totalAdjustedAmount: totalVoidAdjustedAmount + totalReturnAdjustedAmount,
          totalLossAmount: totalVoidLoss + totalReturnLoss,
          totalDeliveryCostExcluded: totalDeliveryCostExcluded,
        },
      };
    } catch (error) {
      console.error('Error getting void/return summary:', error);
      throw error;
    }
  },

  async getLossAnalysis(businessId: string, startDate: Date, endDate: Date) {
    try {
      const { data, error } = await supabase
        .from('sale_actions')
        .select(`
          id,
          action_type,
          loss_amount,
          loss_percentage,
          loss_type,
          reason,
          created_at,
          sales!inner(
            id,
            total_amount,
            business_id
          )
        `)
        .eq('sales.business_id', businessId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('loss_amount', 'is', null)
        .gt('loss_amount', 0);

      if (error) throw error;

      const totalLoss = data.reduce((sum, action) => sum + (action.loss_amount || 0), 0);
      const averageLoss = data.length > 0 ? totalLoss / data.length : 0;

      const byType = {
        fixed: data.filter(a => a.loss_type === 'fixed'),
        percentage: data.filter(a => a.loss_type === 'percentage'),
      };

      const byActionType = {
        void: data.filter(a => a.action_type === 'void'),
        return: data.filter(a => a.action_type === 'return'),
      };

      const averagePercentageLoss = byType.percentage.length > 0
        ? byType.percentage.reduce((sum, a) => sum + (a.loss_percentage || 0), 0) / byType.percentage.length
        : 0;

      return {
        totalLoss,
        averageLoss,
        totalActionsWithLoss: data.length,
        byLossType: {
          fixed: {
            count: byType.fixed.length,
            totalLoss: byType.fixed.reduce((sum, a) => sum + (a.loss_amount || 0), 0),
          },
          percentage: {
            count: byType.percentage.length,
            totalLoss: byType.percentage.reduce((sum, a) => sum + (a.loss_amount || 0), 0),
            averagePercentage: averagePercentageLoss,
          },
        },
        byActionType: {
          void: {
            count: byActionType.void.length,
            totalLoss: byActionType.void.reduce((sum, a) => sum + (a.loss_amount || 0), 0),
          },
          return: {
            count: byActionType.return.length,
            totalLoss: byActionType.return.reduce((sum, a) => sum + (a.loss_amount || 0), 0),
          },
        },
        actions: data,
      };
    } catch (error) {
      console.error('Error getting loss analysis:', error);
      throw error;
    }
  },

  async getDeliveryCostImpact(businessId: string, startDate: Date, endDate: Date) {
    try {
      const { data, error } = await supabase
        .from('sale_actions')
        .select(`
          id,
          action_type,
          delivery_cost_included,
          delivery_cost_amount,
          created_at,
          sales!inner(
            id,
            business_id
          )
        `)
        .eq('sales.business_id', businessId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('action_type', ['void', 'return']);

      if (error) throw error;

      const withDelivery = data.filter(a => a.delivery_cost_included);
      const withoutDelivery = data.filter(a => !a.delivery_cost_included);

      const totalDeliveryIncluded = withDelivery.reduce((sum, a) => sum + (a.delivery_cost_amount || 0), 0);
      const totalDeliveryExcluded = withoutDelivery.reduce((sum, a) => sum + (a.delivery_cost_amount || 0), 0);

      return {
        totalActions: data.length,
        actionsWithDeliveryIncluded: withDelivery.length,
        actionsWithDeliveryExcluded: withoutDelivery.length,
        totalDeliveryIncluded,
        totalDeliveryExcluded,
        totalDeliveryCostSaved: totalDeliveryExcluded,
      };
    } catch (error) {
      console.error('Error getting delivery cost impact:', error);
      throw error;
    }
  },

  async getSalesHistoryReport(
    businessId: string,
    startDate: string,
    endDate: string,
    options?: {
      status?: string;
      paymentMethod?: string;
      createdBy?: string;
      offset?: number;
      limit?: number;
    }
  ) {
    if (!businessId) {
      console.warn('reportsService.getSalesHistoryReport called without businessId');
      return { sales: [], totalCount: 0, creators: [], stats: null };
    }

    const { status, paymentMethod, createdBy, offset = 0, limit = 20 } = options || {};

    try {
      // Build the query for sales with creator information
      let query = supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          total_amount,
          delivery_cost,
          payment_method,
          status,
          notes,
          created_by,
          created_by_name,
          created_at,
          customers(id, name, phone),
          carts(
            id,
            created_by_name,
            total_amount,
            discount_type,
            discount_value,
            delivery_cost,
            cart_items(quantity, product_id, unit_price, cost_per_unit, item_discount_amount, products(cost_per_unit))
          ),
          sale_actions(
            id,
            action_type,
            amount,
            adjusted_amount,
            items_metadata,
            reason,
            created_at
          )
        `, { count: 'exact' })
        .eq('business_id', businessId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false });

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (paymentMethod && paymentMethod !== 'all') {
        query = query.eq('payment_method', paymentMethod);
      }

      if (createdBy) {
        query = query.eq('created_by', createdBy);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: sales, error, count } = await query;

      if (error) throw error;

      // Get unique creators for filter dropdown
      const { data: creatorsData } = await supabase
        .from('sales')
        .select('created_by, created_by_name')
        .eq('business_id', businessId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .not('created_by_name', 'is', null);

      const uniqueCreators = creatorsData
        ? Array.from(
            new Map(
              creatorsData.map(item => [item.created_by, item])
            ).values()
          ).map(creator => ({
            id: creator.created_by,
            name: creator.created_by_name
          }))
        : [];

      // Calculate statistics
      const totalSales = sales?.length || 0;
      const totalRevenue = sales?.reduce((sum, sale) => sum + getSaleGrossRevenue(sale), 0) || 0;

      const stats = {
        totalSales,
        totalRevenue,
        averageSale: totalSales > 0 ? totalRevenue / totalSales : 0,
      };

      return {
        sales: sales || [],
        totalCount: count || 0,
        creators: uniqueCreators,
        stats,
      };
    } catch (error) {
      console.error('Error getting sales history report:', error);
      throw error;
    }
  },

  async getSalesCreatorStats(
    businessId: string,
    startDate: string,
    endDate: string
  ) {
    if (!businessId) return [];

    try {
      const { data: sales } = await supabase
        .from('sales')
        .select(`
          created_by,
          created_by_name,
          total_amount,
          delivery_cost,
          status,
          sale_actions(action_type, amount, adjusted_amount)
        `)
        .eq('business_id', businessId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .in('status', ['completed', 'partially_returned', 'voided']);

      if (!sales) return [];

      // Group by creator
      const creatorStats = sales.reduce((acc, sale) => {
        const creatorId = sale.created_by || 'unknown';
        const creatorName = sale.created_by_name || 'Unknown User';

        if (!acc[creatorId]) {
          acc[creatorId] = {
            id: creatorId,
            name: creatorName,
            totalSales: 0,
            totalRevenue: 0,
            completedSales: 0,
            voidedSales: 0,
          };
        }

        acc[creatorId].totalSales++;

        if (sale.status === 'voided') {
          acc[creatorId].voidedSales++;
        } else {
          acc[creatorId].completedSales++;
          acc[creatorId].totalRevenue += getSaleGrossRevenue(sale);
        }

        return acc;
      }, {} as Record<string, any>);

      return Object.values(creatorStats).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      console.error('Error getting sales creator stats:', error);
      throw error;
    }
  }
};