import { supabase } from '../config/supabase';
import { reportsService } from './reports';

export const exportService = {
  /**
   * Export sales data to CSV
   * @param businessId Business ID to export sales for
   * @param startDate Start date for export range
   * @param endDate End date for export range
   * @returns CSV string
   */
  async exportSalesToCsv(
    businessId: string,
    startDate?: string,
    endDate?: string,
    status?: string,
    paymentMethod?: string
  ) {
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
          created_by_name,
          customers(name, phone),
          carts(
            created_by_name,
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
        .eq('business_id', businessId);

      if (status) {
        salesQuery = salesQuery.eq('status', status);
      }

      if (paymentMethod) {
        salesQuery = salesQuery.eq('payment_method', paymentMethod);
      }

      if (startDate) {
        salesQuery = salesQuery.gte('sale_date', startDate);
      }

      if (endDate) {
        const endDateValue = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
        salesQuery = salesQuery.lte('sale_date', endDateValue);
      }

      const { data: salesData, error: salesError } = await salesQuery.order('sale_date', { ascending: false });

      if (salesError) throw salesError;

      // Get sales with discount details for cost breakdown
      let discountQuery = supabase
        .from('sales_with_discount_details')
        .select('*')
        .eq('business_id', businessId);

      if (status) {
        discountQuery = discountQuery.eq('status', status);
      }

      if (paymentMethod) {
        discountQuery = discountQuery.eq('payment_method', paymentMethod);
      }

      if (startDate) {
        discountQuery = discountQuery.gte('sale_date', startDate);
      }

      if (endDate) {
        const endDateValue = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
        discountQuery = discountQuery.lte('sale_date', endDateValue);
      }
      
      const { data: discountData, error: discountError } = await discountQuery;
      
      if (discountError) throw discountError;
      
      // Create a map of sale ID to discount details for quick lookup
      const discountMap = new Map();
      discountData.forEach(sale => {
        discountMap.set(sale.id, sale);
      });
      
      // Create CSV header with comprehensive cost breakdown
      let csv = 'Sale ID,Date,Customer,Customer Phone,Payment Method,Created By,Products,Total Items,Original Subtotal,Item Discounts,Cart Discount Type,Cart Discount Value,Cart Discount Amount,Delivery Cost,Final Total,Notes\n';

      // Process each sale as a single row
      salesData.forEach(sale => {
        const saleId = sale.id;
        const date = new Date(sale.sale_date).toLocaleDateString();
        const customer = sale.customers?.name || 'Unknown';
        const customerPhone = sale.customers?.phone || '';
        const paymentMethod = sale.payment_method;
        const createdBy = sale.created_by_name || sale.carts?.created_by_name || 'Unknown';
        const notes = sale.notes || '';
        
        // Get discount details for this sale
        const discountDetails = discountMap.get(sale.id);
        
        // Build products string with quantities and prices
        let productsString = '';
        let totalItems = 0;
        
        if (sale.carts?.cart_items && sale.carts.cart_items.length > 0) {
          const productStrings = sale.carts.cart_items.map(item => {
            const productName = item.products?.name || 'Unknown Product';
            totalItems += item.quantity ?? 0;
            const unitPrice = item.unit_price != null ? Number(item.unit_price).toFixed(2) : '0.00';
            return `${productName} (${item.quantity ?? 0}x$${unitPrice})`;
          });
          productsString = productStrings.join('; ');
        } else {
          productsString = 'No items';
        }

        // Extract cost breakdown from discount details
        const originalSubtotal = discountDetails?.items_original_total != null ? Number(discountDetails.items_original_total).toFixed(2) : '0.00';
        const itemDiscounts = discountDetails?.items_total_discount != null ? Number(discountDetails.items_total_discount).toFixed(2) : '0.00';
        const cartDiscountType = discountDetails?.cart_discount_type || '';
        const cartDiscountValue = discountDetails?.cart_discount_value != null ? Number(discountDetails.cart_discount_value).toFixed(2) : '';
        const cartDiscountAmount = discountDetails?.cart_discount_amount != null ? Number(discountDetails.cart_discount_amount).toFixed(2) : '0.00';
        const deliveryCost = discountDetails?.delivery_cost != null ? Number(discountDetails.delivery_cost).toFixed(2) : '0.00';
        const finalTotal = sale.total_amount != null ? Number(sale.total_amount).toFixed(2) : '0.00';
        
        // Escape any commas in text fields by wrapping in quotes
        const escapedCustomer = customer.includes(',') ? `"${customer}"` : customer;
        const escapedCreatedBy = createdBy.includes(',') ? `"${createdBy}"` : createdBy;
        const escapedProducts = productsString.includes(',') ? `"${productsString}"` : productsString;
        const escapedNotes = notes.includes(',') ? `"${notes}"` : notes;
        // Always quote phone to preserve leading zeros in spreadsheet apps
        const escapedPhone = customerPhone ? `"${customerPhone}"` : '';

        // Add single row for this sale
        csv += `${saleId},${date},${escapedCustomer},${escapedPhone},${paymentMethod},${escapedCreatedBy},${escapedProducts},${totalItems},${originalSubtotal},${itemDiscounts},${cartDiscountType},${cartDiscountValue},${cartDiscountAmount},${deliveryCost},${finalTotal},${escapedNotes}\n`;
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
  async exportIncomeStatementToCsv(businessId: string, startDate: string, endDate: string, currencyId?: string) {
    if (typeof businessId !== 'string' || !businessId) return '';
    if (typeof startDate !== 'string' || !startDate) return '';
    if (typeof endDate !== 'string' || !endDate) return '';
    
    try {
      const statement = await reportsService.getIncomeStatement(businessId, startDate, endDate, currencyId);
      if (!statement) return '';
      const fmt = (v: number) => (Number(v) || 0).toFixed(2);

      let csv = 'INCOME STATEMENT\n';
      csv += `Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}\n\n`;

      csv += 'REVENUE\n';
      csv += `Gross Sales,${fmt(statement.revenue.gross)}\n`;
      csv += `Less: Returns,${fmt(statement.revenue.refunds)}\n`;
      csv += `Total Revenue,${fmt(statement.revenue.total)}\n\n`;

      csv += 'COST OF GOODS SOLD\n';
      csv += `Total COGS,${fmt(statement.cogs.total)}\n`;
      if (statement.inventory.writeOffs > 0) {
        csv += `Inventory Write-offs (${statement.inventory.writeOffUnits} units),${fmt(statement.inventory.writeOffs)}\n`;
      }
      if (statement.inventory.found > 0) {
        csv += `Less: Found Stock (${statement.inventory.foundUnits} units),${fmt(-statement.inventory.found)}\n`;
      }
      csv += '\n';

      csv += `GROSS PROFIT,${fmt(statement.grossProfit)}\n`;
      csv += `Gross Margin %,${fmt(statement.grossMargin)}\n\n`;

      csv += 'OPERATING EXPENSES\n';
      statement.expenses.categories.forEach(category => {
        csv += `${category.category},${fmt(category.total)}\n`;
      });
      csv += `Delivery Fees,${fmt(statement.expenses.deliveryFees)}\n`;
      csv += `Total Expenses,${fmt(statement.expenses.total)}\n\n`;

      csv += `NET INCOME,${fmt(statement.netIncome)}\n`;
      csv += `Net Margin %,${fmt(statement.netMargin)}\n`;
      if (statement.refundDeductionsRetained > 0) {
        csv += `\nMemo: deductions kept from refunds (included in revenue),${fmt(statement.refundDeductionsRetained)}\n`;
      }

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
  async exportCashFlowToCsv(businessId: string, month: number, year: number, currencyId?: string) {
    if (typeof businessId !== 'string' || !businessId) return '';
    if (typeof month !== 'number' || isNaN(month) || month < 0 || month > 11) return '';
    if (typeof year !== 'number' || isNaN(year)) return '';

    try {
      // Get cash flow data
      const cashFlowData = await reportsService.getCashFlowStatement(businessId, month, year, currencyId);
      
      // Create CSV content
      let csv = 'CASH FLOW STATEMENT\n';
      csv += `Period: ${new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}\n\n`;
      
      const fmt = (v: number | undefined) => (v != null ? Number(v).toFixed(2) : '0.00');

      csv += 'OPERATING ACTIVITIES\n';
      csv += `Net Income,${fmt(cashFlowData.netIncome)}\n`;
      csv += `Add back: Cost of Goods Sold,${fmt(cashFlowData.cogsAddBack)}\n`;
      if (cashFlowData.writeOffAddBack > 0) {
        csv += `Add back: Inventory Write-offs,${fmt(cashFlowData.writeOffAddBack)}\n`;
      } else if (cashFlowData.writeOffAddBack < 0) {
        csv += `Less: Found Stock,${fmt(cashFlowData.writeOffAddBack)}\n`;
      }
      csv += `Less: Inventory Purchases,${fmt(-cashFlowData.inventoryPurchases)}\n`;
      if (cashFlowData.equipmentPurchases > 0) {
        csv += `Add back: Capital Items in Expenses,${fmt(cashFlowData.equipmentPurchases)}\n`;
      }
      csv += `Net Cash from Operations,${fmt(cashFlowData.operatingCashFlow)}\n\n`;

      csv += 'INVESTING ACTIVITIES\n';
      csv += `Equipment Purchases,${fmt(-cashFlowData.equipmentPurchases)}\n`;
      csv += `Net Cash from Investing,${fmt(cashFlowData.investingCashFlow)}\n\n`;

      // Net Cash Flow
      csv += `NET CHANGE IN CASH,${fmt(cashFlowData.netCashFlow)}\n`;
      
      return csv;
    } catch (error) {
      console.error('Error generating cash flow CSV:', error);
      throw error;
    }
  },

  /** Inventory spend for a period: totals, per-bucket series and top products, in the reporting currency. */
  async exportInventorySpendToCsv(businessId: string, startDate: string, endDate: string, currencyId?: string) {
    if (typeof businessId !== 'string' || !businessId) return '';
    if (!startDate || !endDate) return '';
    try {
      const spend = await reportsService.getInventorySpend(businessId, new Date(startDate), new Date(endDate), currencyId);
      const fmt = (v: number) => (Number(v) || 0).toFixed(2);
      const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

      let csv = 'INVENTORY SPEND\n';
      csv += `Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}\n\n`;
      csv += `Total Spent,${fmt(spend.total)}\n`;
      csv += `Base Cost,${fmt(spend.baseCost)}\n`;
      csv += `Added Costs (shipping etc.),${fmt(spend.addedCosts)}\n`;
      csv += `Units Received,${spend.units}\n`;
      csv += `Imports,${spend.imports}\n`;
      csv += `Batches,${spend.batches}\n`;
      csv += `Written Off (units),${spend.writeOffUnits}\n`;
      csv += `Written Off (at cost),${fmt(spend.writeOffs)}\n`;
      if (spend.foundUnits > 0) {
        csv += `Found Stock (units),${spend.foundUnits}\n`;
        csv += `Found Stock (at cost),${fmt(spend.found)}\n`;
      }
      csv += '\n';

      csv += 'BY PERIOD\n';
      csv += 'Date,Amount\n';
      spend.series.forEach(s => { csv += `${s.date},${fmt(s.amount)}\n`; });
      csv += '\nTOP PRODUCTS\n';
      csv += 'Product,Units,Spend,Avg Landed Cost,Imports\n';
      spend.topProducts.forEach(p => { csv += `${q(p.name)},${p.quantity},${fmt(p.spend)},${fmt(p.avgUnitCost)},${p.imports}\n`; });
      return csv;
    } catch (error) {
      console.error('Error generating inventory spend CSV:', error);
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