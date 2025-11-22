import { supabase } from '../config/supabase';
import { salesService } from './sales';
import { expenseService } from './expenses';
import { productService } from './products.ts';
import { format, subDays, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, isSameMonth, formatISO, endOfDay } from 'date-fns';

export const reportsService = {
  async getDashboardStats(businessId: string, year?: number, month?: number) {
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
      // Today's revenue
      const { data: todaySalesData } = await supabase
        .from('sales')
        .select(`
          total_amount,
          sale_actions!left(amount, action_type, adjusted_amount)
        `)
        .eq('business_id', businessId)
        .in('status', ['completed', 'partially_returned'])
        .gte('sale_date', todayStr)
        .lt('sale_date', tomorrowStr);

      const todayRevenue = todaySalesData?.reduce((sum, sale) => {
        const returnedAmount = sale.sale_actions
          ?.filter(action => action.action_type === 'return')
          ?.reduce((sum, action) => sum + (action.adjusted_amount || action.amount || 0), 0) || 0;
        return sum + (sale.total_amount - returnedAmount);
      }, 0) || 0;

      // Monthly revenue
      const { data: monthlySalesData } = await supabase
        .from('sales')
        .select(`
          total_amount,
          sale_actions!left(amount, action_type, adjusted_amount)
        `)
        .eq('business_id', businessId)
        .in('status', ['completed', 'partially_returned'])
        .gte('sale_date', startOfMonthStr)
        .lte('sale_date', endOfMonthStr);

      const monthlyRevenue = monthlySalesData?.reduce((sum, sale) => {
        const returnedAmount = sale.sale_actions
          ?.filter(action => action.action_type === 'return')
          ?.reduce((sum, action) => sum + (action.adjusted_amount || action.amount || 0), 0) || 0;
        return sum + (sale.total_amount - returnedAmount);
      }, 0) || 0;

      // Monthly COGS (Cost of Goods Sold) - based on actual sold items
      const { data: monthlyCOGSData } = await supabase.rpc('calculate_cogs', {
        business_id_param: businessId,
        start_date: startOfMonthStr,
        end_date: endOfMonthStr
      });
      
      const monthlyCOGS = monthlyCOGSData || 0;

      // Calculate Total Profit (Revenue - COGS)
      const totalProfit = monthlyRevenue - monthlyCOGS;

      // Monthly expenses
      const { data: monthlyExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('business_id', businessId)
        .gte('expense_date', startOfMonthStr)
        .lte('expense_date', endOfMonthStr);

      const totalExpenses = monthlyExpenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

      // Get loss amounts from sale actions (treated as expenses)
      const { data: lossData } = await supabase
        .from('sale_actions')
        .select(`
          loss_amount,
          sales!inner(business_id, sale_date)
        `)
        .eq('sales.business_id', businessId)
        .gte('sales.sale_date', startOfMonthStr)
        .lte('sales.sale_date', endOfMonthStr)
        .not('loss_amount', 'is', null)
        .gt('loss_amount', 0);

      const totalLossAmount = lossData?.reduce((sum, action) => sum + (action.loss_amount || 0), 0) || 0;

      // Net Profit = Total Profit - Total Expenses - Loss Amounts
      const netProfit = totalProfit - totalExpenses - totalLossAmount;

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
        totalExpenses,
        totalLossAmount,
        netProfit,
        lowStockCount,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        totalCustomersBought: totalCustomersBought || 0,
        totalProductsSold: totalProductsSold || 0
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return null;
    }
  },

  async getTopProducts(businessId: string, limit = 5, year?: number, month?: number) {
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

    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        quantity,
        product_id,
        unit_price,
        subtotal,
        products(id, name, price, cost_per_unit, description, image_url, barcode, current_stock, min_stock_level),
        carts!inner(
          sales!inner(
            id,
            business_id,
            sale_date,
            status,
            sale_actions(
              id,
              action_type,
              amount,
              adjusted_amount,
              items_metadata
            )
          )
        )
      `)
      .eq('carts.sales.business_id', businessId)
      .gte('carts.sales.sale_date', startOfMonthStr)
      .lte('carts.sales.sale_date', endOfMonthStr);

    if (error) throw error;

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

    data.forEach(item => {
      const sale = item.carts?.sales;

      // Skip voided sales
      if (!sale || isSaleVoided(sale)) {
        return;
      }

      const productId = item.products?.id || item.product_id || 'unknown';
      const productName = item.products?.name || 'Unknown';
      const productPrice = item.products?.price || 0;
      const productCost = item.products?.cost_per_unit || 0;

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

    return Object.values(productSales)
      .filter(product => product.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  },

  async getTopCustomers(businessId: string, limit = 5, year?: number, month?: number) {
    // Use provided year/month or default to current month
    const targetDate = year && month ? new Date(year, month - 1, 1) : new Date();
    const startOfMonthDate = startOfMonth(targetDate);
    const startOfMonthStr = startOfMonthDate.toISOString();

    const endOfMonthDate = endOfMonth(targetDate);
    endOfMonthDate.setHours(23, 59, 59, 999);
    const endOfMonthStr = endOfMonthDate.toISOString();

    const { data, error } = await supabase
      .from('sales')
      .select(`
        current_total_amount,
        customers(id, name, phone)
      `)
      .eq('business_id', businessId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startOfMonthStr)
      .lte('sale_date', endOfMonthStr);

    if (error) throw error;

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

  async getRevenueChart(businessId: string, startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('sales')
      .select('total_amount, sale_date')
      .eq('business_id', businessId)
      .eq('status', 'completed')
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
        
        const revenue = monthSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
        
        return {
          date: format(month, 'yyyy-MM-dd'),
          label: format(month, 'MMM'),
          revenue
        };
      });
    } else {
      // Group by day
      const days = eachDayOfInterval({ start, end });
      
      result = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const daySales = data.filter(sale => sale.sale_date.split('T')[0] === dayStr);
        const revenue = daySales.reduce((sum, sale) => sum + sale.total_amount, 0);
        
        return {
          date: dayStr,
          label: format(day, 'dd/MM'),
          revenue
        };
      });
    }
    
    return result;
  },

  async getExpenseChart(businessId: string, startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('expenses')
      .select('amount, expense_date')
      .eq('business_id', businessId)
      .gte('expense_date', startDate.toISOString())
      .lte('expense_date', endDate.toISOString())
      .order('expense_date');

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
        const monthExpenses = data.filter(expense => {
          const expenseDate = new Date(expense.expense_date);
          return isSameMonth(expenseDate, month);
        });
        
        const amount = monthExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        return {
          date: format(month, 'yyyy-MM-dd'),
          label: format(month, 'MMM'),
          amount
        };
      });
    } else {
      // Group by day
      const days = eachDayOfInterval({ start, end });
      
      result = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayExpenses = data.filter(expense => expense.expense_date.split('T')[0] === dayStr);
        const amount = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        return {
          date: dayStr,
          label: format(day, 'dd/MM'),
          amount
        };
      });
    }
    
    return result;
  },

  async getProfitChart(businessId: string, startDate: Date, endDate: Date) {
    // Get sales data that matches dashboard calculation (including partially returned)
    const { data: revenueData, error: revenueError } = await supabase
      .from('sales')
      .select(`
        total_amount,
        sale_date,
        sale_actions!left(amount, action_type, adjusted_amount)
      `)
      .eq('business_id', businessId)
      .in('status', ['completed', 'partially_returned'])
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', endDate.toISOString())
      .order('sale_date');

    if (revenueError) throw revenueError;

    // Get sales data with COGS for cost calculations
    const salesData = await salesService.getSalesWithCOGS(businessId, startDate.toISOString(), endDate.toISOString());
    
    // Get expense data
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .select('amount, expense_date')
      .eq('business_id', businessId)
      .gte('expense_date', startDate.toISOString())
      .lte('expense_date', endDate.toISOString())
      .order('expense_date');

    if (expenseError) throw expenseError;

    // Get loss data from sale actions
    const { data: lossData, error: lossError } = await supabase
      .from('sale_actions')
      .select(`
        loss_amount,
        created_at,
        sales!inner(business_id, sale_date)
      `)
      .eq('sales.business_id', businessId)
      .gte('sales.sale_date', startDate.toISOString())
      .lte('sales.sale_date', endDate.toISOString())
      .not('loss_amount', 'is', null)
      .gt('loss_amount', 0);

    if (lossError) throw lossError;

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
          const saleMonth = (sale.sale_date || '').substring(0, 7); // YYYY-MM
          return saleMonth === monthStr;
        });
        
        // Calculate revenue for this month (subtracting returned amounts with adjustments)
        const revenue = monthRevenueSales.reduce((sum, sale) => {
          const returnedAmount = sale.sale_actions
            ?.filter(action => action.action_type === 'return')
            ?.reduce((sum, action) => sum + (action.adjusted_amount || action.amount || 0), 0) || 0;
          return sum + (sale.total_amount - returnedAmount);
        }, 0);
        
        // Filter COGS sales data for this month
        const monthSales = salesData.filter(sale => {
          const saleMonth = (sale.date || '').substring(0, 7);
          return saleMonth === monthStr;
        });
        
        // Calculate COGS and profit for this month
        const cogs = monthSales.reduce((sum, sale) => sum + sale.cogs, 0);
        const profit = revenue - cogs;
        
        // Filter expenses for this month
        const monthExpenses = expenseData.filter(expense => {
          const expenseMonth = expense.expense_date.substring(0, 7); // YYYY-MM
          return expenseMonth === monthStr;
        });
        
        // Calculate total expenses for this month
        const expenses = monthExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

        // Filter loss amounts for this month
        const monthLosses = lossData?.filter(loss => {
          const lossMonth = (loss.sales?.sale_date || '').substring(0, 7);
          return lossMonth === monthStr;
        }) || [];

        // Calculate total loss for this month
        const lossAmount = monthLosses.reduce((sum, loss) => sum + (loss.loss_amount || 0), 0);

        // Calculate net profit (profit - expenses - losses)
        const netProfit = profit - expenses - lossAmount;

        return {
          date: format(month, 'yyyy-MM-dd'),
          label: format(month, 'MMM'),
          revenue,
          cogs,
          profit,
          expenses,
          lossAmount,
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
          const saleDate = (sale.sale_date || '').split('T')[0];
          return saleDate === dayStr;
        });
        
        // Calculate revenue for this day (subtracting returned amounts with adjustments)
        const revenue = dayRevenueSales.reduce((sum, sale) => {
          const returnedAmount = sale.sale_actions
            ?.filter(action => action.action_type === 'return')
            ?.reduce((sum, action) => sum + (action.adjusted_amount || action.amount || 0), 0) || 0;
          return sum + (sale.total_amount - returnedAmount);
        }, 0);
        
        // Filter COGS sales data for this day
        const daySales = salesData.filter(sale => {
          const saleDate = (sale.date || '').split('T')[0];
          return saleDate === dayStr;
        });
        
        // Calculate COGS and profit for this day
        const cogs = daySales.reduce((sum, sale) => sum + sale.cogs, 0);
        const profit = revenue - cogs;
        
        // Filter expenses for this day
        const dayExpenses = expenseData.filter(expense => {
          const expenseDate = expense.expense_date.split('T')[0];
          return expenseDate === dayStr;
        });
        
        // Calculate total expenses for this day
        const expenses = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);

        // Filter loss amounts for this day
        const dayLosses = lossData?.filter(loss => {
          const lossDate = (loss.sales?.sale_date || '').split('T')[0];
          return lossDate === dayStr;
        }) || [];

        // Calculate total loss for this day
        const lossAmount = dayLosses.reduce((sum, loss) => sum + (loss.loss_amount || 0), 0);

        // Calculate net profit (profit - expenses - losses)
        const netProfit = profit - expenses - lossAmount;

        return {
          date: dayStr,
          label: format(day, 'dd/MM'),
          revenue,
          cogs,
          profit,
          expenses,
          lossAmount,
          netProfit
        };
      });
    }
    
    return result;
  },

  async getExpensesByCategory(businessId: string, startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        amount,
        expense_categories(name)
      `)
      .eq('business_id', businessId)
      .gte('expense_date', startDate.toISOString())
      .lte('expense_date', endDate.toISOString());

    if (error) throw error;

    // Group by category
    const categoryTotals: Record<string, number> = {};
    let totalExpenses = 0;
    
    data.forEach(expense => {
      const categoryName = expense.expense_categories?.name || 'Uncategorized';
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
      totalExpenses += expense.amount;
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

  async getCashFlowStatement(businessId: string, month: number, year: number) {
    // Calculate date range for the month
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
    
    try {
      // Get sales data for the month (including partially returned sales)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          total_amount,
          sale_actions!left(amount, action_type, adjusted_amount)
        `)
        .eq('business_id', businessId)
        .in('status', ['completed', 'partially_returned'])
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

      if (salesError) throw salesError;

      // Calculate total revenue (subtracting returned amounts with adjustments)
      const totalRevenue = salesData?.reduce((sum, sale) => {
        const returnedAmount = sale.sale_actions
          ?.filter(action => action.action_type === 'return')
          ?.reduce((sum, action) => sum + (action.adjusted_amount || action.amount || 0), 0) || 0;
        return sum + (sale.total_amount - returnedAmount);
      }, 0) || 0;

      // Get monthly COGS (Cost of Goods Sold)
      const { data: monthlyCOGSData } = await supabase.rpc('calculate_cogs', {
        business_id_param: businessId,
        start_date: startDate,
        end_date: endDate
      });
      
      const monthlyCOGS = monthlyCOGSData || 0;

      // Get expenses data for the month
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, category_id, expense_categories(name)')
        .eq('business_id', businessId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (expensesError) throw expensesError;
      
      // Get inventory imports for the month
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory_imports')
        .select('total_cost_for_item')
        .eq('business_id', businessId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (inventoryError) throw inventoryError;
      
      // Calculate total expenses
      const totalExpenses = expensesData.reduce((sum, expense) => sum + expense.amount, 0);

      // Get loss amounts from sale actions
      const { data: lossData } = await supabase
        .from('sale_actions')
        .select(`
          loss_amount,
          sales!inner(business_id, sale_date)
        `)
        .eq('sales.business_id', businessId)
        .gte('sales.sale_date', startDate)
        .lte('sales.sale_date', endDate)
        .not('loss_amount', 'is', null)
        .gt('loss_amount', 0);

      const totalLossAmount = lossData?.reduce((sum, action) => sum + (action.loss_amount || 0), 0) || 0;

      // Calculate inventory changes (total cost of imports)
      const inventoryChanges = inventoryData.reduce((sum, item) => sum + item.total_cost_for_item, 0);

      // Identify equipment purchases (expenses in equipment category)
      const equipmentPurchases = expensesData
        .filter(expense => {
          const categoryName = expense.expense_categories?.name?.toLowerCase() || '';
          return categoryName.includes('equipment') || categoryName.includes('asset') || categoryName.includes('capital');
        })
        .reduce((sum, expense) => sum + expense.amount, 0);

      // For this example, we'll use placeholder values for owner contributions and withdrawals
      // In a real app, you would have a separate table to track these
      const ownerContributions = 0; // Placeholder
      const ownerWithdrawals = 0; // Placeholder

      // Calculate net income (revenue - COGS - expenses - loss amounts) to align with dashboard
      const grossProfit = totalRevenue - monthlyCOGS;
      const netIncome = grossProfit - totalExpenses - totalLossAmount;
      
      // Calculate cash flows
      const operatingCashFlow = netIncome - inventoryChanges;
      const investingCashFlow = -equipmentPurchases;
      const financingCashFlow = ownerContributions - ownerWithdrawals;
      
      // Calculate net cash flow
      const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
      
      return {
        period: `${month + 1}/${year}`,
        netIncome,
        totalLossAmount,
        inventoryChanges,
        operatingCashFlow,
        equipmentPurchases,
        investingCashFlow,
        ownerContributions,
        ownerWithdrawals,
        financingCashFlow,
        netCashFlow
      };
    } catch (error) {
      console.error('Error generating cash flow statement:', error);
      throw error;
    }
  },

  async getSalesCOGSReport(businessId: string, startDate: string, endDate: string) {
    // Get sales data
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        sale_date,
        cart_id,
        carts(
          cart_items(
            quantity,
            product_id,
            products(
              name,
              cost_per_unit
            )
          )
        )
      `)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date');

    if (!salesData) return [];

    // Process sales data to calculate COGS and profit
    return salesData.map(sale => {
      let totalCOGS = 0;
      let itemDetails = [];

      // Calculate COGS for each item in the sale
      if (sale.carts?.cart_items) {
        sale.carts.cart_items.forEach(item => {
          const costPerUnit = item.products?.cost_per_unit || 0;
          const itemCOGS = item.quantity * costPerUnit;
          totalCOGS += itemCOGS;

          itemDetails.push({
            product: item.products?.name || 'Unknown Product',
            quantity: item.quantity,
            costPerUnit,
            totalCost: itemCOGS
          });
        });
      }

      return {
        id: sale.id,
        date: sale.sale_date,
        revenue: sale.total_amount,
        cogs: totalCOGS,
        profit: sale.total_amount - totalCOGS,
        profitMargin: sale.total_amount > 0 ? ((sale.total_amount - totalCOGS) / sale.total_amount) * 100 : 0,
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
        .eq('carts.sales.status', 'completed')
        .gte('carts.sales.sale_date', startDate.toISOString())
        .lte('carts.sales.sale_date', endDate.toISOString());

      if (cartItemsError) throw cartItemsError;

      // Get product cost per unit
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('cost_per_unit')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      // Calculate totals
      const quantitySold = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = cartItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
      const costPerUnit = product?.cost_per_unit || 0;
      const totalCOGS = quantitySold * costPerUnit;
      const totalProfit = totalRevenue - totalCOGS;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      return {
        quantitySold,
        totalRevenue,
        costPerUnit,
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
        const daySales = data.filter(sale => sale.sale_date.split('T')[0] === dayStr);
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
      const totalVoidAdjustedAmount = voidActions.reduce((sum, action) => sum + (action.adjusted_amount || action.amount || 0), 0);
      const totalVoidLoss = voidActions.reduce((sum, action) => sum + (action.loss_amount || 0), 0);

      const totalReturnAmount = returnActions.reduce((sum, action) => sum + (action.amount || 0), 0);
      const totalReturnAdjustedAmount = returnActions.reduce((sum, action) => sum + (action.adjusted_amount || action.amount || 0), 0);
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
  }
};