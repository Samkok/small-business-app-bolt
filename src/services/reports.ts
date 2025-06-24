import { supabase } from '../config/supabase';
import { salesService } from './sales';
import { expenseService } from './expenses';

export const reportsService = {
  async getDashboardStats(businessId: string) {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

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
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id')
      .eq('business_id', businessId)
      .filter('current_stock', 'lte', 'min_stock_level');

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

    return {
      todayRevenue,
      monthlyRevenue,
      monthlyCOGS,
      totalProfit,
      totalExpenses,
      netProfit,
      lowStockCount,
      totalCustomers: totalCustomers || 0,
      totalProducts: totalProducts || 0
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

  async getRevenueChart(businessId: string, days = 30) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const { data, error } = await supabase
      .from('sales')
      .select('total_amount, sale_date')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startDate.toISOString().split('T')[0])
      .lte('sale_date', endDate.toISOString().split('T')[0])
      .order('sale_date');

    if (error) throw error;

    // Group by date
    const dailyRevenue: Record<string, number> = {};
    
    data.forEach(sale => {
      const date = sale.sale_date.split('T')[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + sale.total_amount;
    });

    // Fill in missing dates with 0
    const result = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        revenue: dailyRevenue[dateStr] || 0
      });
    }

    return result;
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