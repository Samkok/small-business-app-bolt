import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { productService } from './products';
import { customerService } from './customers';
import { cartService } from './carts';
import { salesService } from './sales';
import { subscriptionService } from './subscriptionService';
import { logger, ValidationError, DatabaseError } from '../lib';
import { InstantCheckoutSession, InstantCheckoutItem } from '../context/InstantCheckoutContext';

type Sale = Database['public']['Tables']['sales']['Row'];
type Cart = Database['public']['Tables']['carts']['Insert'];
type CartItem = Database['public']['Tables']['cart_items']['Insert'];

export interface InstantCheckoutValidation {
  isValid: boolean;
  errors: string[];
}

export interface CompleteInstantCheckoutParams {
  session: InstantCheckoutSession;
  businessId: string;
  userId: string;
  guestCustomerId: string;
}

export interface SaveToDraftCartParams {
  session: InstantCheckoutSession;
  businessId: string;
  userId: string;
  guestCustomerId: string;
}

export const instantCheckoutService = {
  validateCheckoutSession(session: InstantCheckoutSession): InstantCheckoutValidation {
    const errors: string[] = [];

    if (!session.items || session.items.length === 0) {
      errors.push('Add products to checkout');
    }

    if (!session.payment_method) {
      errors.push('Please select payment method');
    }

    if (session.sale_date && session.sale_date > new Date()) {
      errors.push('Sale date cannot be in future');
    }

    for (const item of session.items) {
      if (item.quantity > item.available_stock) {
        errors.push(`${item.product_name} has only ${item.available_stock} in stock`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  async checkStockAvailability(items: InstantCheckoutItem[]): Promise<{ available: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const item of items) {
      try {
        const product = await productService.getProduct(item.product_id);

        if (product.current_stock < item.quantity) {
          errors.push(`${item.product_name} has only ${product.current_stock} in stock`);
        }
      } catch (error) {
        errors.push(`Failed to check stock for ${item.product_name}`);
      }
    }

    return {
      available: errors.length === 0,
      errors,
    };
  },

  async completeInstantCheckout(params: CompleteInstantCheckoutParams): Promise<{ success: boolean; saleId?: string; error?: string }> {
    const { session, businessId, userId, guestCustomerId } = params;

    const validation = this.validateCheckoutSession(session);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    const stockCheck = await this.checkStockAvailability(session.items);
    if (!stockCheck.available) {
      return {
        success: false,
        error: stockCheck.errors.join(', '),
      };
    }

    console.log('[InstantCheckout] Validating feature access for instant checkout');
    const hasAccess = await subscriptionService.validateFeatureAccessForCriticalOperation(userId, businessId);
    if (!hasAccess) {
      console.log('[InstantCheckout] Access denied - limit reached or subscription expired');
      return {
        success: false,
        error: 'You\'ve reached the free limit. Please upgrade to continue.'
      };
    }

    try {
      const customerId = session.customer_id || guestCustomerId;

      const tempCart: Cart = {
        customer_id: customerId,
        status: 'active',
        total_amount: 0,
        discount_type: session.cart_discount_type,
        discount_value: session.cart_discount_value,
        delivery_cost: session.delivery_cost,
        notes: session.notes,
        business_id: businessId,
        created_by: userId,
      };

      const { data: cartData, error: cartError } = await supabase
        .from('carts')
        .insert(tempCart)
        .select()
        .single();

      if (cartError || !cartData) {
        logger.error('Failed to create temporary cart for instant checkout', cartError);
        return {
          success: false,
          error: 'Failed to process checkout',
        };
      }

      for (const item of session.items) {
        const cartItem: CartItem = {
          cart_id: cartData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_type: item.item_discount_type,
          discount_value: item.item_discount_value,
          subtotal: item.subtotal,
          original_subtotal: item.original_subtotal,
          item_discount_amount: item.item_discount_amount,
        };

        const { error: itemError } = await supabase
          .from('cart_items')
          .insert(cartItem);

        if (itemError) {
          logger.error('Failed to create cart item for instant checkout', itemError);
          await supabase.from('carts').delete().eq('id', cartData.id);
          return {
            success: false,
            error: 'Failed to process checkout',
          };
        }
      }

      const sale = await salesService.completeSale({
        cart_id: cartData.id,
        customer_id: customerId,
        payment_method: session.payment_method!,
        status: 'completed',
        sale_date: session.sale_date.toISOString(),
        notes: session.notes,
        business_id: businessId,
        created_by: userId,
        delivery_cost: session.delivery_cost,
      });

      logger.info('Instant checkout completed successfully', { saleId: sale.id });

      return {
        success: true,
        saleId: sale.id,
      };
    } catch (error) {
      logger.error('Failed to complete instant checkout', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete checkout';

      if (errorMessage === 'SUBSCRIPTION_LIMIT_REACHED') {
        return {
          success: false,
          error: 'SUBSCRIPTION_LIMIT_REACHED',
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  async saveToDraftCart(params: SaveToDraftCartParams): Promise<{ success: boolean; cartId?: string; error?: string }> {
    const { session, businessId, userId, guestCustomerId } = params;

    if (!session.items || session.items.length === 0) {
      return {
        success: false,
        error: 'No items to save',
      };
    }

    try {
      const customerId = session.customer_id || guestCustomerId;

      const draftCart: Cart = {
        customer_id: customerId,
        status: 'active',
        total_amount: 0,
        discount_type: session.cart_discount_type,
        discount_value: session.cart_discount_value,
        delivery_cost: session.delivery_cost,
        notes: session.notes ? `[Auto-saved from instant checkout] ${session.notes}` : '[Auto-saved from instant checkout]',
        business_id: businessId,
        created_by: userId,
      };

      const { data: cartData, error: cartError } = await supabase
        .from('carts')
        .insert(draftCart)
        .select()
        .single();

      if (cartError || !cartData) {
        logger.error('Failed to create draft cart', cartError);
        return {
          success: false,
          error: 'Failed to save draft cart',
        };
      }

      for (const item of session.items) {
        const cartItem: CartItem = {
          cart_id: cartData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_type: item.item_discount_type,
          discount_value: item.item_discount_value,
          subtotal: item.subtotal,
          original_subtotal: item.original_subtotal,
          item_discount_amount: item.item_discount_amount,
        };

        const { error: itemError } = await supabase
          .from('cart_items')
          .insert(cartItem);

        if (itemError) {
          logger.error('Failed to create cart item for draft cart', itemError);
          await supabase.from('carts').delete().eq('id', cartData.id);
          return {
            success: false,
            error: 'Failed to save draft cart',
          };
        }
      }

      await cartService.updateCart(cartData.id, {
        total_amount: session.items.reduce((sum, item) => sum + item.subtotal, 0),
      });

      logger.info('Draft cart saved successfully', { cartId: cartData.id });

      return {
        success: true,
        cartId: cartData.id,
      };
    } catch (error) {
      logger.error('Failed to save draft cart', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save draft cart',
      };
    }
  },
};
