import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { cartService } from './carts';
import { productService } from './products';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type SaleAction = Database['public']['Tables']['sale_actions']['Row'];
type SaleActionInsert = Database['public']['Tables']['sale_actions']['Insert'];

export const salesService = {
  async completeSale(saleData: Omit<SaleInsert, 'total_amount'>) {
    // Calculate total amount from cart
    const totalAmount = await cartService.calculateCartTotal(saleData.cart_id);

    // Create sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({ ...saleData, total_amount: totalAmount })
      .select()
      .single();

    if (saleError) throw saleError;

    // Update cart status to completed
    await cartService.updateCart(saleData.cart_id, { status: 'completed' });

    // Update product stock levels
    const cart = await cartService.getCart(saleData.cart_id);
    for (const item of cart.cart_items) {
      const product = await productService.getProduct(item.product_id);
      const newStock = Math.max(0, product.current_stock - item.quantity);
      await productService.updateStock(item.product_id, newStock);
    }

    return sale;
  },

  async getSales(businessId: string, limit?: number) {
    let query = supabase
      .from('sales')
      .select(`
        *,
        customers(name, phone),
        carts(
          total_amount,
          cart_items(
            quantity,
            unit_price,
            subtotal,
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

  async getSale(saleId: string) {
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

  async voidSale(saleId: string, reason: string, performedBy: string) {
    return this.performSaleAction(saleId, 'void', reason, performedBy);
  },

  async refundSale(saleId: string, amount: number, reason: string, performedBy: string) {
    return this.performSaleAction(saleId, 'refund', reason, performedBy, amount);
  },

  async returnItems(saleId: string, returnedItems: { productId: string; quantity: number }[], reason: string, performedBy: string) {
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
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customers(name),
        carts(
          cart_items(
            quantity,
            unit_price,
            subtotal,
            products(name, price)
          )
        )
      `)
      .eq('business_id', businessId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .eq('status', 'completed')
      .order('sale_date');

    if (error) throw error;
    return data;
  }
};