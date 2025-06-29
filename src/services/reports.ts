import { supabase } from '../config/supabase';
import { salesService } from './sales';
import { expenseService } from './expenses';
import { productService } from './products.ts';
import { format, subDays, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, isSameMonth, formatISO, endOfDay } from 'date-fns';

function toDateString(date) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
}

export const reportsService = {
  async getDashboardStats(businessId: string) {
    
    const today = toDateString(new Date());
    const startOfMonth = toDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const endOfMonth = toDateString(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0,23, 59, 59 ));

    // Today's revenue
    const { data: todaySales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', today)
      .lt('sale_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const todayRevenue = todaySales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

    // Monthly revenue
    const { data: monthlySales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startOfMonth)
      .lte('sale_date', endOfMonth);

    const monthlyRevenue = monthlySales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

    // Monthly COGS (Cost of Goods Sold) - based on actual sold items
    const { data: monthlyCOGSData } = await supabase.rpc('calculate_cogs', {
      business_id_param: businessId,
      start_date: startOfMonth,
      end_date: endOfMonth
    });
    
    const monthlyCOGS = monthlyCOGSData || 0;

    // Calculate Total Profit (Revenue - COGS)
    const totalProfit = monthlyRevenue - monthlyCOGS;

    // Monthly expenses
    const { data: monthlyExpenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('business_id', businessId)
      .gte('expense_date', startOfMonth)
      .lte('expense_date', endOfMonth);

    const totalExpenses = monthlyExpenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

    // Net Profit = Total Profit - Total Expenses
    const netProfit = totalProfit - totalExpenses;

    // Low stock count
    const { data: lowStockProducts } = productService.getLowStockProducts(businessId);

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

    const { data: totalProductsSoldData, error } = await supabase.rpc('get_quantity_sold', {
      business_id_param: businessId,
      start_date: startOfMonth,
      end_date: endOfMonth
    });

    const totalProductsSold = totalProductsSoldData || 0;

    const { data: customersCountValue } = await supabase.rpc('get_distinct_customer_count_for_sales', {
      business_id_param: businessId,
      start_date_param: new Date(startOfMonth).toISOString(),
      end_date_param: new Date(endOfMonth).toISOString()
    });
    
    const totalCustomersBought = customersCountValue || 0;

    return {
      todayRevenue,
      monthlyRevenue,
      monthlyCOGS,
      totalProfit,
      totalExpenses,
      netProfit,
      lowStockCount,
      totalCustomers: totalCustomers || 0,
      totalProducts: totalProducts || 0,
      totalCustomersBought: totalCustomersBought || 0,
      totalProductsSold: totalProductsSold || 0
    };
  },

  async getTopProducts(businessId: string, limit = 5) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        quantity,
        products(name, price, cost_per_unit),
        carts!inner(
          sales!inner(
            business_id,
            sale_date,
            status
          )
        )
      `)
      .eq('carts.sales.business_id', businessId)
      .eq('carts.sales.status', 'completed')
      .gte('carts.sales.sale_date', startOfMonth)
      .lte('carts.sales.sale_date', endOfMonth);

    if (error) throw error;

    // Group by product and sum quantities
    const productSales: Record<string, { name: string; quantity: number; revenue: number; cost: number; profit: number }> = {};
    
    data.forEach(item => {
      const productName = item.products?.name || 'Unknown';
      const productPrice = item.products?.price || 0;
      const productCost = item.products?.cost_per_unit || 0;
      
      if (!productSales[productName]) {
        productSales[productName] = { 
          name: productName, 
          quantity: 0, 
          revenue: 0,
          cost: 0,
          profit: 0
        };
      }
      
      productSales[productName].quantity += item.quantity;
      productSales[productName].revenue += item.quantity * productPrice;
      productSales[productName].cost += item.quantity * productCost;
      productSales[productName].profit += item.quantity * (productPrice - productCost);
    });

    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  },

  async getTopCustomers(businessId: string, limit = 5) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('sales')
      .select(`
        total_amount,
        customers(name, phone)
      `)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startOfMonth)
      .lte('sale_date', endOfMonth);

    if (error) throw error;

    // Group by customer and sum amounts
    const customerSales: Record<string, { name: string; phone?: string; totalSpent: number; orderCount: number }> = {};
    
    data.forEach(sale => {
      const customerName = sale.customers?.name || 'Unknown';
      const customerPhone = sale.customers?.phone;
      
      if (!customerSales[customerName]) {
        customerSales[customerName] = { 
          name: customerName, 
          phone: customerPhone,
          totalSpent: 0, 
          orderCount: 0 
        };
      }
      
      customerSales[customerName].totalSpent += sale.total_amount;
      customerSales[customerName].orderCount += 1;
    });

    return Object.values(customerSales)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  },

  async getRevenueChart(businessId: string, startDate: string, endDate: string) {
    const endOfDate = endOfDay(endDate);
    console.log(endOfDate);
    const { data, error } = await supabase
      .from('sales')
      .select('total_amount, sale_date')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startDate.toISOString())
      .lte('sale_date', toDateString(new Date(endDate)))
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

  async getExpenseChart(businessId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select('amount, expense_date')
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
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

  async getProfitChart(businessId: string, startDate: string, endDate: string) {
    // Get sales data with COGS
    const salesData = await salesService.getSalesWithCOGS(businessId, startDate, endDate);
    
    // Get expense data
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .select('amount, expense_date')
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date');

    if (expenseError) throw expenseError;

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
        
        // Filter sales for this month
        const monthSales = salesData.filter(sale => {
          const saleMonth = sale.date.substring(0, 7); // YYYY-MM
          return saleMonth === monthStr;
        });
        
        // Calculate revenue, COGS, and profit for this month
        const revenue = monthSales.reduce((sum, sale) => sum + sale.revenue, 0);
        const cogs = monthSales.reduce((sum, sale) => sum + sale.cogs, 0);
        const profit = revenue - cogs;
        
        // Filter expenses for this month
        const monthExpenses = expenseData.filter(expense => {
          const expenseMonth = expense.expense_date.substring(0, 7); // YYYY-MM
          return expenseMonth === monthStr;
        });
        
        // Calculate total expenses for this month
        const expenses = monthExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        // Calculate net profit (profit - expenses)
        const netProfit = profit - expenses;
        
        return {
          date: format(month, 'yyyy-MM-dd'),
          label: format(month, 'MMM'),
          revenue,
          cogs,
          profit,
          expenses,
          netProfit
        };
      });
    } else {
      // Group by day
      const days = eachDayOfInterval({ start, end });
      
      result = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        
        // Filter sales for this day
        const daySales = salesData.filter(sale => {
          const saleDate = sale.date.split('T')[0];
          return saleDate === dayStr;
        });
        
        // Calculate revenue, COGS, and profit for this day
        const revenue = daySales.reduce((sum, sale) => sum + sale.revenue, 0);
        const cogs = daySales.reduce((sum, sale) => sum + sale.cogs, 0);
        const profit = revenue - cogs;
        
        // Filter expenses for this day
        const dayExpenses = expenseData.filter(expense => {
          const expenseDate = expense.expense_date.split('T')[0];
          return expenseDate === dayStr;
        });
        
        // Calculate total expenses for this day
        const expenses = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        // Calculate net profit (profit - expenses)
        const netProfit = profit - expenses;
        
        return {
          date: dayStr,
          label: format(day, 'dd/MM'),
          revenue,
          cogs,
          profit,
          expenses,
          netProfit
        };
      });
    }
    
    return result;
  },

  async getExpensesByCategory(businessId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        amount,
        expense_categories(name)
      `)
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

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
    const endDate = new Date(year, month + 1, 0).toISOString();
    
    try {
      // Get sales data for the month
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

      if (salesError) throw salesError;
      
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
        .select('total_cost')
        .eq('business_id', businessId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (inventoryError) throw inventoryError;
      
      // Calculate total revenue
      const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
      
      // Calculate total expenses
      const totalExpenses = expensesData.reduce((sum, expense) => sum + expense.amount, 0);
      
      // Calculate inventory changes (total cost of imports)
      const inventoryChanges = inventoryData.reduce((sum, item) => sum + item.total_cost, 0);
      
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
      
      // Calculate net income (revenue - expenses)
      const netIncome = totalRevenue - totalExpenses;
      
      // Calculate cash flows
      const operatingCashFlow = netIncome - inventoryChanges;
      const investingCashFlow = -equipmentPurchases;
      const financingCashFlow = ownerContributions - ownerWithdrawals;
      
      // Calculate net cash flow
      const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
      
      return {
        period: `${month + 1}/${year}`,
        netIncome,
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
  }
};