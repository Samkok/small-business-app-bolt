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
    return data;
  },

  async getCart(cartId: string) {
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
    return data;
  },

  async updateCart(cartId: string, updates: CartUpdate) {
    const { data, error } = await supabase
      .from('carts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', cartId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addItemToCart(cartItem: CartItemInsert) {
    // Check if item already exists in cart
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartItem.cart_id)
      .eq('product_id', cartItem.product_id)
      .single();

    if (existingItem) {
      // Update quantity and subtotal
      const newQuantity = existingItem.quantity + cartItem.quantity;
      const newSubtotal = this.calculateItemSubtotal(
        newQuantity,
        cartItem.unit_price,
        cartItem.discount_type,
        cartItem.discount_value
      );

      const { data, error } = await supabase
        .from('cart_items')
        .update({
          quantity: newQuantity,
          subtotal: newSubtotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Add new item
      const subtotal = this.calculateItemSubtotal(
        cartItem.quantity,
        cartItem.unit_price,
        cartItem.discount_type,
        cartItem.discount_value
      );

      const { data, error } = await supabase
        .from('cart_items')
        .insert({ ...cartItem, subtotal })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async updateCartItem(itemId: string, updates: CartItemUpdate) {
    if (updates.quantity !== undefined || updates.unit_price !== undefined || 
        updates.discount_type !== undefined || updates.discount_value !== undefined) {
      // Recalculate subtotal
      const { data: currentItem } = await supabase
        .from('cart_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (currentItem) {
        const quantity = updates.quantity ?? currentItem.quantity;
        const unitPrice = updates.unit_price ?? currentItem.unit_price;
        const discountType = updates.discount_type ?? currentItem.discount_type;
        const discountValue = updates.discount_value ?? currentItem.discount_value;

        updates.subtotal = this.calculateItemSubtotal(quantity, unitPrice, discountType, discountValue);
      }
    }

    const { data, error } = await supabase
      .from('cart_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeCartItem(itemId: string) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  },

  async calculateCartTotal(cartId: string) {
    const { data: items, error } = await supabase
      .from('cart_items')
      .select('subtotal')
      .eq('cart_id', cartId);

    if (error) throw error;

    const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    const { data: cart } = await supabase
      .from('carts')
      .select('discount_type, discount_value, delivery_cost')
      .eq('id', cartId)
      .single();

    if (!cart) return itemsTotal;

    let total = itemsTotal;

    // Apply cart-level discount
    if (cart.discount_type && cart.discount_value) {
      if (cart.discount_type === 'percentage') {
        total = total * (1 - cart.discount_value / 100);
      } else {
        total = total - cart.discount_value;
      }
    }

    // Add delivery cost
    if (cart.delivery_cost) {
      total -= cart.delivery_cost;
    }

    return Math.max(0, total);
  },

  calculateItemSubtotal(quantity: number, unitPrice: number, discountType?: string, discountValue?: number) {
    let subtotal = quantity * unitPrice;

    if (discountType && discountValue) {
      if (discountType === 'percentage') {
        subtotal = subtotal * (1 - discountValue / 100);
      } else {
        subtotal = subtotal - discountValue;
      }
    }

    return Math.max(0, subtotal);
  }
};