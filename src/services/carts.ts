import { supabase } from '../config/supabase';
import { Database } from '../types/database';

type Cart = Database['public']['Tables']['carts']['Row'];
type CartInsert = Database['public']['Tables']['carts']['Insert'];
type CartUpdate = Database['public']['Tables']['carts']['Update'];
type CartItem = Database['public']['Tables']['cart_items']['Row'];
type CartItemInsert = Database['public']['Tables']['cart_items']['Insert'];
type CartItemUpdate = Database['public']['Tables']['cart_items']['Update'];

export const cartService = {
  async createCart(cart: CartInsert) {
    const { data, error } = await supabase
      .from('carts')
      .insert(cart)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getActiveCarts(businessId: string) {
    if (typeof businessId !== 'string' || !businessId) return;
    const { data, error } = await supabase
      .from('carts')
      .select(`
        *,
        customers(name, phone),
        cart_items(
          *,
          products(name, price)
        )
      `)
      .eq('business_id', businessId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // For each cart, calculate the correct total from cart_details_with_discounts
    const cartsWithCorrectTotals = await Promise.all(
      data.map(async (cart) => {
        try {
          const summary = await this.getCartSummary(cart.id);
          return {
            ...cart,
            total_amount: summary.finalTotal
          };
        } catch (error) {
          console.error(`Error getting cart summary for cart ${cart.id}:`, error);
          return cart;
        }
      })
    );
    
    return cartsWithCorrectTotals;
  },

  async deleteCart(cartId: string) {
    if (typeof cartId !== 'string' || !cartId) return;
    // First delete all cart items
    const { error: itemsError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);

    if (itemsError) throw itemsError;

    // Then delete the cart
    const { error } = await supabase
      .from('carts')
      .delete()
      .eq('id', cartId);

    if (error) throw error;
    return true;
  },

  async getCart(cartId: string) {
    if (typeof cartId !== 'string' || !cartId) return;
    const { data, error } = await supabase
      .from('carts')
      .select(`
        *,
        customers(*),
        cart_items(
          *,
          products(*)
        )
      `)
      .eq('id', cartId)
      .single();

    if (error) throw error;
    
    // Get the correct total from cart_details_with_discounts
    try {
      const summary = await this.getCartSummary(cartId);
      return {
        ...data,
        total_amount: summary.finalTotal
      };
    } catch (summaryError) {
      console.error(`Error getting cart summary for cart ${cartId}:`, summaryError);
      return data;
    }
  },

  async getCartWithDiscountDetails(cartId: string) {
    if (typeof cartId !== 'string' || !cartId) return;
    const { data, error } = await supabase
      .from('cart_details_with_discounts')
      .select('*')
      .eq('cart_id', cartId)
      .single();

    if (error) throw error;
    return data;
  },

  async updateCart(cartId: string, updates: CartUpdate) {
    if (typeof cartId !== 'string' || !cartId) return;
    
    // Ensure delivery_cost is a valid number or null
    if (updates.delivery_cost !== undefined) {
      const deliveryCost = parseFloat(updates.delivery_cost as any);
      updates.delivery_cost = isNaN(deliveryCost) ? 0 : deliveryCost;
    }
    
    const { data, error } = await supabase
      .from('carts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', cartId)
      .select()
      .single();

    if (error) throw error;
    
    // If we're updating the cart, also update the total_amount based on the cart summary
    if (!updates.total_amount) {
      try {
        const summary = await this.getCartSummary(cartId);
        await supabase
          .from('carts')
          .update({ 
            total_amount: summary.finalTotal,
            updated_at: new Date().toISOString() 
          })
          .eq('id', cartId);
          
        // Get the fully updated cart to return
        const { data: updatedCart, error: getError } = await supabase
          .from('carts')
          .select(`
            *,
            customers(*),
            cart_items(
              *,
              products(*)
            )
          `)
          .eq('id', cartId)
          .single();
          
        if (!getError) {
          return {
            ...updatedCart,
            total_amount: summary.finalTotal
          };
        }
      } catch (summaryError) {
        console.error(`Error updating cart total for cart ${cartId}:`, summaryError);
      }
    }
    
    return data;
  },

  async addItemToCart(cartItem: CartItemInsert & {
    item_discount_type?: 'percentage' | 'fixed';
    item_discount_value?: number;
  }) {
    // Check if item already exists in cart
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartItem.cart_id)
      .eq('product_id', cartItem.product_id)
      .single();

    if (existingItem) {
      // Update quantity and recalculate totals
      const newQuantity = existingItem.quantity + cartItem.quantity;
      
      const { data, error } = await supabase
        .from('cart_items')
        .update({
          quantity: newQuantity,
          item_discount_type: cartItem.item_discount_type || existingItem.item_discount_type,
          item_discount_value: cartItem.item_discount_value ?? existingItem.item_discount_value,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) throw error;
      
      // Update cart total
      await this.updateCartTotal(cartItem.cart_id);
      
      return data;
    } else {
      // Add new item
      const { data, error } = await supabase
        .from('cart_items')
        .insert(cartItem)
        .select()
        .single();

      if (error) throw error;
      
      // Update cart total
      await this.updateCartTotal(cartItem.cart_id);
      
      return data;
    }
  },

  async updateCartItem(itemId: string, updates: CartItemUpdate & {
    item_discount_type?: 'percentage' | 'fixed';
    item_discount_value?: number;
  }) {
    // Get the cart_id first
    const { data: item } = await supabase
      .from('cart_items')
      .select('cart_id')
      .eq('id', itemId)
      .single();
      
    if (!item) throw new Error('Cart item not found');
    
    const { data, error } = await supabase
      .from('cart_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    
    // Update cart total
    await this.updateCartTotal(item.cart_id);
    
    return data;
  },

  async removeCartItem(itemId: string) {
    if (typeof itemId !== 'string' || !itemId) return;
    // Get the cart_id first
    const { data: item } = await supabase
      .from('cart_items')
      .select('cart_id')
      .eq('id', itemId)
      .single();
      
    if (!item) throw new Error('Cart item not found');
    
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    
    // Update cart total
    await this.updateCartTotal(item.cart_id);
  },

  async applyItemDiscount(itemId: string, discountType: 'percentage' | 'fixed', discountValue: number) {
    
    if (typeof itemId !== 'string' || !itemId) return;
    // Get the cart_id first
    const { data: item } = await supabase
      .from('cart_items')
      .select('cart_id')
      .eq('id', itemId)
      .single();
      
    if (!item) throw new Error('Cart item not found');
    
    const { data, error } = await supabase
      .from('cart_items')
      .update({
        item_discount_type: discountType,
        item_discount_value: discountValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    
    // Update cart total
    await this.updateCartTotal(item.cart_id);
    
    return data;
  },

  async removeItemDiscount(itemId: string) {
    if (typeof itemId !== 'string' || !itemId) return;
    // Get the cart_id first
    const { data: item } = await supabase
      .from('cart_items')
      .select('cart_id')
      .eq('id', itemId)
      .single();
      
    if (!item) throw new Error('Cart item not found');
    
    const { data, error } = await supabase
      .from('cart_items')
      .update({
        item_discount_type: null,
        item_discount_value: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    
    // Update cart total
    await this.updateCartTotal(item.cart_id);
    
    return data;
  },

  async updateCartTotal(cartId: string) {
    
    if (typeof cartId !== 'string' || !cartId) return;
    try {
      const summary = await this.getCartSummary(cartId);
      await supabase
        .from('carts')
        .update({ 
          total_amount: summary.finalTotal,
          updated_at: new Date().toISOString() 
        })
        .eq('id', cartId);
    } catch (error) {
      console.error(`Error updating cart total for cart ${cartId}:`, error);
      throw error;
    }
  },

  async calculateCartTotal(cartId: string) {
    if (typeof cartId !== 'string' || !cartId) return;
    const cartDetails = await this.getCartWithDiscountDetails(cartId);
    return cartDetails.final_total;
  },

  async getCartSummary(cartId: string) {
    if (typeof cartId !== 'string' || !cartId) return;
    const cartDetails = await this.getCartWithDiscountDetails(cartId);
    
    return {
      itemsOriginalTotal: cartDetails.items_original_total,
      itemsTotalDiscount: cartDetails.items_total_discount,
      itemsSubtotalAfterDiscount: cartDetails.items_subtotal_after_discount,
      cartDiscountAmount: cartDetails.cart_discount_amount,
      deliveryCost: cartDetails.delivery_cost || 0,
      finalTotal: cartDetails.final_total
    };
  },

  // Legacy method for backward compatibility
  calculateItemSubtotal(quantity: number, unitPrice: number, discountType?: string, discountValue?: number) {
    const originalSubtotal = quantity * unitPrice;
    
    if (!discountType || !discountValue) {
      return originalSubtotal;
    }

    let discount = 0;
    if (discountType === 'percentage') {
      discount = originalSubtotal * (discountValue / 100);
    } else if (discountType === 'fixed') {
      discount = Math.min(discountValue, originalSubtotal);
    }

    return Math.max(0, originalSubtotal - discount);
  }
};