import { supabase } from '../config/supabase';
import { processSalesImport, processSalesImportFromFile } from '../utils/salesImportProcessor';
import { processBulkInventoryImport, processBulkInventoryImportFromFile } from '../utils/bulkImportProcessor';
import { reportsService } from './reports';
import { salesService } from './sales';

export const importService = {
  /**
   * Import sales data from CSV content
   * @param csvContent CSV content as string
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importSalesFromCsv(csvContent: string, profileId: string) {

    if (typeof csvContent !== 'string' || !csvContent) return '';
    if (typeof profileId !== 'string' || !profileId) return;
    
    return processSalesImport(csvContent, profileId);
  },

  /**
   * Import sales data from a CSV file
   * @param file CSV file
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importSalesFromFile(file: File, profileId: string) {
    
    if (typeof profileId !== 'string' || !profileId) return []; // Return empty array for consistency with processSalesImport
    
    return processSalesImportFromFile(file, profileId);
  },

  /**
   * Import inventory data from CSV content
   * @param csvContent CSV content as string
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importInventoryFromCsv(csvContent: string, profileId: string) {

    if (typeof csvContent !== 'string' || !csvContent) return { totalRecords: 0, successCount: 0, failureCount: 0, results: [] }; // Return empty result object
    if (typeof profileId !== 'string' || !profileId) return;
    
    return processBulkInventoryImport(csvContent, profileId);
  },

  /**
   * Import inventory data from a CSV file
   * @param file CSV file
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importInventoryFromFile(file: File, profileId: string) {

    if (typeof profileId !== 'string' || !profileId) return { totalRecords: 0, successCount: 0, failureCount: 0, results: [] }; // Return empty result object
    return processBulkInventoryImportFromFile(file, profileId);
  },

  /**
   * Generate a sample sales CSV template
   * @returns CSV template string
   */
  generateSalesCsvTemplate() {
    return `created_at(carts),created_by(carts),business_id(carts),customer_id(carts),product_id(cart_items),quantity(cart_items),unit_price(cart_items),original_subtotal(cart_items),discount_type(cart_items),discount_value(cart_items),item_discount_value(cart_items),item_discount_amount(cart_items),delivery_cost(carts),subtotal(cart_items),notes(carts),payment_method(sales)
2023-01-01,your_profile_id,your_business_id,customer_id,product_id,1,10.00,10.00,,,,,0,10.00,,cash
2023-01-02,your_profile_id,your_business_id,customer_id,product_id,2,15.00,30.00,percentage,10,10,3.00,0,27.00,Sample note,card`;
  },

  /**
   * Generate a sample inventory import CSV template
   * @returns CSV template string
   */
  generateInventoryImportCsvTemplate() {
    return `product_id,quantity,base_unit_cost,cost_type_1,amount_1,calculation_type_1,cost_type_2,amount_2,calculation_type_2
product_id_1,10,5.00,Shipping,2.00,per_total,Tax,0.50,per_unit
product_id_2,20,3.50,Handling,1.00,per_total,,0.00,`;
  },

  /**
   * Export sales data to CSV
   * @param businessId Business ID to export sales for
   * @param startDate Start date for export range
   * @param endDate End date for export range
   * @returns CSV string
   */
  async exportSalesToCsv(businessId: string, startDate?: string, endDate?: string) {
    
    if (typeof businessId !== 'string' || !businessId) return '';
    if (typeof startDate !== 'string' || !startDate) return '';
    if (typeof endDate !== 'string' || !endDate) return '';
    try {
      // Get detailed sales data with cart items and products
      let salesQuery = supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          payment_method,
          status,
          sale_date,
          notes,
          customers(name, phone),
          carts(
            cart_items(
              quantity,
              unit_price,
              subtotal,
              original_subtotal,
              item_discount_type,
              item_discount_value,
              item_discount_amount,
              products(name)
            )
          )
        `)
        .eq('business_id', businessId)
        .eq('status', 'completed');
      
      if (startDate) {
        salesQuery = salesQuery.gte('sale_date', startDate);
      }
      
      if (endDate) {
        salesQuery = salesQuery.lte('sale_date', endDate);
      }
      
      const { data: salesData, error: salesError } = await salesQuery.order('sale_date', { ascending: false });
      
      if (salesError) throw salesError;
      
      // Get sales with discount details for cost breakdown
      let discountQuery = supabase
        .from('sales_with_discount_details')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'completed');
      
      if (startDate) {
        discountQuery = discountQuery.gte('sale_date', startDate);
      }
      
      if (endDate) {
        discountQuery = discountQuery.lte('sale_date', endDate);
      }
      
      const { data: discountData, error: discountError } = await discountQuery;
      
      if (discountError) throw discountError;
      
      // Create a map of sale ID to discount details for quick lookup
      const discountMap = new Map();
      discountData.forEach(sale => {
        discountMap.set(sale.id, sale);
      });
      
      // Create CSV header with comprehensive cost breakdown
      let csv = 'Sale ID,Date,Customer,Customer Phone,Payment Method,Products,Total Items,Original Subtotal,Item Discounts,Cart Discount Type,Cart Discount Value,Cart Discount Amount,Delivery Cost,Final Total,Notes\n';
      
      // Process each sale as a single row
      salesData.forEach(sale => {
        const saleId = sale.id;
        const date = new Date(sale.sale_date).toLocaleDateString();
        const customer = sale.customers?.name || 'Unknown';
        const customerPhone = sale.customers?.phone || '';
        const paymentMethod = sale.payment_method;
        const notes = sale.notes || '';
        
        // Get discount details for this sale
        const discountDetails = discountMap.get(sale.id);
        
        // Build products string with quantities and prices
        let productsString = '';
        let totalItems = 0;
        
        if (sale.carts?.cart_items && sale.carts.cart_items.length > 0) {
          const productStrings = sale.carts.cart_items.map(item => {
            const productName = item.products?.name || 'Unknown Product';
            totalItems += item.quantity;
            return `${productName} (${item.quantity}x$${item.unit_price.toFixed(2)})`;
          });
          productsString = productStrings.join('; ');
        } else {
          productsString = 'No items';
        }
        
        // Extract cost breakdown from discount details
        const originalSubtotal = discountDetails?.items_original_total?.toFixed(2) || '0.00';
        const itemDiscounts = discountDetails?.items_total_discount?.toFixed(2) || '0.00';
        const cartDiscountType = discountDetails?.cart_discount_type || '';
        const cartDiscountValue = discountDetails?.cart_discount_value?.toFixed(2) || '';
        const cartDiscountAmount = discountDetails?.cart_discount_amount?.toFixed(2) || '0.00';
        const deliveryCost = discountDetails?.delivery_cost?.toFixed(2) || '0.00';
        const finalTotal = sale.total_amount.toFixed(2);
        
        // Escape any commas in text fields by wrapping in quotes
        const escapedCustomer = customer.includes(',') ? `"${customer}"` : customer;
        const escapedProducts = productsString.includes(',') ? `"${productsString}"` : productsString;
        const escapedNotes = notes.includes(',') ? `"${notes}"` : notes;
        
        // Add single row for this sale
        csv += `${saleId},${date},${escapedCustomer},${customerPhone},${paymentMethod},${escapedProducts},${totalItems},${originalSubtotal},${itemDiscounts},${cartDiscountType},${cartDiscountValue},${cartDiscountAmount},${deliveryCost},${finalTotal},${escapedNotes}\n`;
      });
      
      return csv;
    } catch (error) {
      console.error('Error generating sales CSV:', error);
      throw error;
    }
  },

  /**
   * Export income statement to CSV
   * @param businessId Business ID to export income statement for
   * @param startDate Start date for export range
   * @param endDate End date for export range
   * @returns CSV string
   */
  async exportIncomeStatementToCsv(businessId: string, startDate: string, endDate: string) {
    
    if (typeof businessId !== 'string' || !businessId) return '';
    if (typeof startDate !== 'string' || !startDate) return '';
    if (typeof endDate !== 'string' || !endDate) return '';
    try {
      // Get sales data with COGS
      const salesData = await salesService.getSalesWithCOGS(businessId, startDate, endDate);
      
      // Get expense data
      const expenseCategories = await reportsService.getExpensesByCategory(businessId, startDate, endDate);
      
      // Calculate totals
      const totalRevenue = salesData.reduce((sum, sale) => sum + sale.revenue, 0);
      const totalCOGS = salesData.reduce((sum, sale) => sum + sale.cogs, 0);
      const grossProfit = totalRevenue - totalCOGS;
      
      // Calculate total expenses
      const totalExpenses = expenseCategories.reduce((sum, category) => sum + category.amount, 0);
      const netIncome = grossProfit - totalExpenses;
      
      // Create CSV content
      let csv = 'INCOME STATEMENT\n';
      csv += `Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}\n\n`;
      
      // Revenue section
      csv += 'REVENUE\n';
      csv += `Total Revenue,${totalRevenue.toFixed(2)}\n\n`;
      
      // COGS section
      csv += 'COST OF GOODS SOLD\n';
      csv += `Total COGS,${totalCOGS.toFixed(2)}\n\n`;
      
      // Gross Profit
      csv += `GROSS PROFIT,${grossProfit.toFixed(2)}\n\n`;
      
      // Expenses section
      csv += 'OPERATING EXPENSES\n';
      expenseCategories.forEach(category => {
        csv += `${category.category},${category.amount.toFixed(2)}\n`;
      });
      csv += `Total Expenses,${totalExpenses.toFixed(2)}\n\n`;
      
      // Net Income
      csv += `NET INCOME,${netIncome.toFixed(2)}\n`;
      
      return csv;
    } catch (error) {
      console.error('Error generating income statement CSV:', error);
      throw error;
    }
  },

  /**
   * Export cash flow statement to CSV
   * @param businessId Business ID to export cash flow for
   * @param month Month (0-11)
   * @param year Year
   * @returns CSV string
   */
  async exportCashFlowToCsv(businessId: string, month: number, year: number) {
    
    if (typeof businessId !== 'string' || !businessId) return '';
    if (typeof month !== 'number' || isNaN(month) || month < 0 || month > 11) return '';
    if (typeof year !== 'number' || isNaN(year)) return '';

    try {
      // Get cash flow data
      const cashFlowData = await reportsService.getCashFlowStatement(businessId, month, year);
      
      // Create CSV content
      let csv = 'CASH FLOW STATEMENT\n';
      csv += `Period: ${new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}\n\n`;
      
      // Operating Activities
      csv += 'OPERATING ACTIVITIES\n';
      csv += `Net Income,${cashFlowData.netIncome.toFixed(2)}\n`;
      csv += `Inventory Changes,${cashFlowData.inventoryChanges.toFixed(2)}\n`;
      csv += `Net Cash from Operations,${cashFlowData.operatingCashFlow.toFixed(2)}\n\n`;
      
      // Investing Activities
      csv += 'INVESTING ACTIVITIES\n';
      csv += `Equipment Purchases,${cashFlowData.equipmentPurchases.toFixed(2)}\n`;
      csv += `Net Cash from Investing,${cashFlowData.investingCashFlow.toFixed(2)}\n\n`;
      
      // Financing Activities
      csv += 'FINANCING ACTIVITIES\n';
      csv += `Owner Contributions,${cashFlowData.ownerContributions.toFixed(2)}\n`;
      csv += `Owner Withdrawals,${cashFlowData.ownerWithdrawals.toFixed(2)}\n`;
      csv += `Net Cash from Financing,${cashFlowData.financingCashFlow.toFixed(2)}\n\n`;
      
      // Net Cash Flow
      csv += `NET CHANGE IN CASH,${cashFlowData.netCashFlow.toFixed(2)}\n`;
      
      return csv;
    } catch (error) {
      console.error('Error generating cash flow CSV:', error);
      throw error;
    }
  },

  /**
   * Export product data to CSV
   * @param businessId Business ID to export products for
   * @returns CSV string
   */
  async exportProductsToCsv(businessId: string) {
    if (typeof businessId !== 'string' || !businessId) return '';

    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        description,
        barcode,
        current_stock,
        min_stock_level,
        cost_per_unit,
        created_at,
        updated_at
      `)
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) throw error;

    let csv = 'ID,Name,Price,Description,Barcode,Current Stock,Min Stock Level,Cost Per Unit,Created At,Updated At\n';

    data.forEach(product => {
      csv += `${product.id},"${product.name}",${product.price},"${product.description || ''}",${product.barcode || ''},${product.current_stock},${product.min_stock_level},${product.cost_per_unit || ''},${product.created_at},${product.updated_at}\n`;
    });

    return csv;
  }
};