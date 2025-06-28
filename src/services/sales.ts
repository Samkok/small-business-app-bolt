import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { cartService } from './carts';
import { productService } from './products';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type SaleAction = Database['public']['Tables']['sale_actions']['Row'];
type SaleActionInsert = Database['public']['Tables']['sale_actions']['Insert'];

export const salesService = {
  async completeSale(saleData: Omit<SaleInsert, 'total_amount' | 'subtotal_before_discount' | 'sale_discount_amount'>) {
    // Get cart summary with discount details
    const cartSummary = await cartService.getCartSummary(saleData.cart_id);
    const cart = await cartService.getCart(saleData.cart_id);

    // Create sale record with discount information
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        ...saleData,
        total_amount: cartSummary.finalTotal,
        subtotal_before_discount: cartSummary.itemsOriginalTotal,
        sale_discount_type: cart.discount_type,
        sale_discount_value: cart.discount_value,
        sale_discount_amount: cartSummary.cartDiscountAmount
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Update cart status to completed
    await cartService.updateCart(saleData.cart_id, { status: 'completed' });

    // Update product stock levels
    for (const item of cart.cart_items) {
      const product = await productService.getProduct(item.product_id);
      const newStock = Math.max(0, product.current_stock - item.quantity);
      await productService.updateStock(item.product_id, newStock);
    }

    return sale;
  },

  async getSalesCount(
    businessId: string, 
    startDate?: string, 
    endDate?: string,
    status?: string,
    paymentMethod?: string
  ) {
    if (typeof businessId !== 'string' || !businessId) return;
    let query = supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    if (startDate) {
      query = query.gte('sale_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('sale_date', endDate);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }
    
    const { count, error } = await query;
    
    if (error) throw error;
    return count || 0;
  },

  async getSalesPaginated(
    businessId: string,
    startDate: string,
    endDate: string,
    offset: number = 0,
    limit: number = 10,
    status?: string,
    paymentMethod?: string
  ) {
    if (typeof businessId !== 'string' || !businessId) return;
    if (typeof startDate !== 'string' || !startDate) return;
    if (typeof endDate !== 'string' || !endDate) return;
    let query = supabase
      .from('sales')
      .select(`
        *,
        customers(name, phone),
        carts(
          total_amount,
          discount_type,
          discount_value,
          delivery_cost,
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
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }
    
    query = query.range(offset, offset + limit - 1);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async getSales(businessId: string, limit?: number) {
    if (typeof businessId !== 'string' || !businessId) return;
    let query = supabase
      .from('sales')
      .select(`
        *,
        customers(name, phone),
        carts(
          total_amount,
          discount_type,
          discount_value,
          delivery_cost,
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
      .order('sale_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getSalesWithDiscountDetails(businessId: string, limit?: number) {
    if (typeof businessId !== 'string' || !businessId) return;
    let query = supabase
      .from('sales_with_discount_details')
      .select('*')
      .eq('business_id', businessId)
      .order('sale_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getSale(saleId: string) {
    if (typeof saleId !== 'string' || !saleId) return;
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customers(*),
        carts(
          *,
          cart_items(
            *,
            products(*)
          )
        ),
        sale_actions(
          *,
          profiles!sale_actions_performed_by_fkey(full_name)
        )
      `)
      .eq('id', saleId)
      .single();

    if (error) throw error;
    return data;
  },

  async getSaleWithDiscountBreakdown(saleId: string) {
    if (typeof saleId !== 'string' || !saleId) return;
    const { data, error } = await supabase
      .from('sales_with_discount_details')
      .select('*')
      .eq('id', saleId)
      .single();

    if (error) throw error;
    return data;
  },

  async voidSale(saleId: string, reason: string, performedBy: string) {
    if (typeof saleId !== 'string' || !saleId) return;
    if (typeof reason !== 'string' || !reason) return;
    if (typeof performedBy !== 'string' || !performedBy) return;
    return this.performSaleAction(saleId, 'void', reason, performedBy);
  },

  async refundSale(saleId: string, amount: number, reason: string, performedBy: string) {
    if (typeof saleId !== 'string' || !saleId) return;
    if (typeof amount !== 'number' || !amount) return;
    if (typeof reason !== 'string' || !reason) return;
    if (typeof performedBy !== 'string' || !performedBy) return;
    return this.performSaleAction(saleId, 'refund', reason, performedBy, amount);
  },

  async returnItems(saleId: string, returnedItems: { productId: string; quantity: number }[], reason: string, performedBy: string) {
    if (typeof saleId !== 'string' || !saleId) return;
    if (typeof reason !== 'string' || !reason) return;
    if (typeof performedBy !== 'string' || !performedBy) return;
    
    const sale = await this.getSale(saleId);
    let returnAmount = 0;

    // Calculate return amount and restore inventory
    for (const returnItem of returnedItems) {
      const cartItem = sale.carts.cart_items.find(item => item.product_id === returnItem.productId);
      if (cartItem) {
        const itemReturnAmount = (cartItem.subtotal / cartItem.quantity) * returnItem.quantity;
        returnAmount += itemReturnAmount;

        // Restore inventory
        const product = await productService.getProduct(returnItem.productId);
        await productService.updateStock(returnItem.productId, product.current_stock + returnItem.quantity);
      }
    }

    return this.performSaleAction(saleId, 'return', reason, performedBy, returnAmount);
  },

  async performSaleAction(saleId: string, actionType: 'void' | 'refund' | 'return', reason: string, performedBy: string, amount?: number) {
    if (typeof saleId !== 'string' || !saleId) return;
    if (typeof reason !== 'string' || !reason) return;
    if (typeof performedBy !== 'string' || !performedBy) return;
    
    // Create sale action record
    const actionData: SaleActionInsert = {
      sale_id: saleId,
      action_type: actionType,
      reason,
      performed_by: performedBy,
      amount
    };

    const { data: action, error: actionError } = await supabase
      .from('sale_actions')
      .insert(actionData)
      .select()
      .single();

    if (actionError) throw actionError;

    // Update sale status
    let newStatus: string;
    switch (actionType) {
      case 'void':
        newStatus = 'voided';
        break;
      case 'refund':
        newStatus = 'refunded';
        break;
      case 'return':
        newStatus = 'partially_returned';
        break;
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update({ status: newStatus })
      .eq('id', saleId);

    if (updateError) throw updateError;

    return action;
  },

  async getSalesReport(businessId: string, startDate: string, endDate: string) {
    if (typeof businessId !== 'string' || !businessId) return;
    if (typeof startDate !== 'string' || !startDate) return;
    if (typeof endDate !== 'string' || !endDate) return;
    const { data, error } = await supabase
      .from('sales_with_discount_details')
      .select('*')
      .eq('business_id', businessId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .eq('status', 'completed')
      .order('sale_date');

    if (error) throw error;
    return data;
  },

  async getSalesWithCOGS(businessId: string, startDate: string, endDate: string) {
    
    if (typeof businessId !== 'string' || !businessId) return;
    if (typeof startDate !== 'string' || !startDate) return;
    if (typeof endDate !== 'string' || !endDate) return;
    
    // Get sales with cart items and product costs
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        sale_date,
        status,
        carts(
          cart_items(
            quantity,
            unit_price,
            subtotal,
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

    if (error) throw error;

    // Calculate COGS and profit for each sale
    return data.map(sale => {
      let totalCOGS = 0;
      let totalRevenue = parseFloat(sale.total_amount);

      // Calculate COGS from cart items
      if (sale.carts?.cart_items) {
        sale.carts.cart_items.forEach(item => {
          const costPerUnit = parseFloat(item.products?.cost_per_unit) || 0;
          totalCOGS += item.quantity * costPerUnit;
        });
      }

      return {
        id: sale.id,
        date: sale.sale_date,
        revenue: totalRevenue,
        cogs: totalCOGS,
        profit: totalRevenue - totalCOGS,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue) * 100 : 0
      };
    });
  },

  async getDiscountAnalytics(businessId: string, startDate: string, endDate: string) {
    if (typeof businessId !== 'string' || !businessId) return;
    if (typeof startDate !== 'string' || !startDate) return;
    if (typeof endDate !== 'string' || !endDate) return;
    const { data, error } = await supabase
      .from('sales_with_discount_details')
      .select(`
        items_original_total,
        items_total_discount,
        cart_discount_amount,
        total_amount,
        sale_date
      `)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (error) throw error;

    const analytics = data.reduce((acc, sale) => {
      acc.totalOriginalAmount += sale.items_original_total || 0;
      acc.totalItemDiscounts += sale.items_total_discount || 0;
      acc.totalCartDiscounts += sale.cart_discount_amount || 0;
      acc.totalFinalAmount += sale.total_amount || 0;
      acc.salesCount += 1;
      return acc;
    }, {
      totalOriginalAmount: 0,
      totalItemDiscounts: 0,
      totalCartDiscounts: 0,
      totalFinalAmount: 0,
      salesCount: 0
    });

    analytics.totalDiscounts = analytics.totalItemDiscounts + analytics.totalCartDiscounts;
    analytics.averageDiscountPerSale = analytics.salesCount > 0 ? analytics.totalDiscounts / analytics.salesCount : 0;
    analytics.discountPercentage = analytics.totalOriginalAmount > 0 ? (analytics.totalDiscounts / analytics.totalOriginalAmount) * 100 : 0;

    return analytics;
  }
};