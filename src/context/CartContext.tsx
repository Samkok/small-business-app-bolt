import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import { cartService } from '@/src/services/carts';
import { productService } from '@/src/services/products';
import { salesService } from '@/src/services/sales';
import { subscriptionService } from '@/src/services/subscriptionService';
import { dataCleanupRegistry } from '@/src/utils/dataCleanupRegistry';
import { offlineSaleQueue } from '@/src/lib/offlineSaleQueue';
import { isNetworkError } from '@/src/lib/network';
import { retryWithBackoff } from '@/src/lib/network';

// Types
export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  original_subtotal: number;
  item_discount_type?: 'percentage' | 'fixed';
  item_discount_value?: number;
  item_discount_amount?: number;
  item_discount_scope?: 'per_unit' | 'total';
  subtotal: number;
}

export interface Cart {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  status: 'active' | 'completed' | 'abandoned';
  total_amount: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  delivery_cost?: number;
  notes?: string;
  business_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  items: CartItem[];
}

interface CartSummary {
  itemsOriginalTotal: number;
  itemsTotalDiscount: number;
  itemsSubtotalAfterDiscount: number;
  cartDiscountAmount: number;
  deliveryCost: number;
  finalTotal: number;
}

interface CartContextType {
  carts: Cart[];
  loading: boolean;
  createCart: (customerData: { id: string; name: string; phone?: string }) => Promise<Cart>;
  getCart: (cartId: string) => Cart | undefined;
  updateCart: (cartId: string, updates: Partial<Omit<Cart, 'id' | 'items'>>) => Promise<Cart>;
  deleteCart: (cartId: string) => Promise<void>;
  addItemToCart: (cartId: string, product: any, quantity?: number) => Promise<CartItem>;
  updateCartItem: (cartId: string, itemId: string, updates: Partial<Omit<CartItem, 'id'>>) => Promise<CartItem>;
  removeCartItem: (cartId: string, itemId: string) => Promise<void>;
  applyItemDiscount: (cartId: string, itemId: string, discountType: 'percentage' | 'fixed', discountValue: number, discountScope?: 'per_unit' | 'total') => Promise<CartItem>;
  removeItemDiscount: (cartId: string, itemId: string) => Promise<CartItem>;
  getCartSummary: (cartId: string) => CartSummary;
  completeSale: (cartId: string, paymentMethod: string, saleDate?: string, customNotes?: string) => Promise<{ success: boolean; saleId?: string; error?: string; offline?: boolean }>;
  refreshCarts: () => Promise<Cart[]>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentBusiness, user } = useAuth();
  const { isConnected, setPendingSalesCount } = useNetwork();
  const cartsCache = useRef<Map<string, { cart: Cart; timestamp: number }>>(new Map());
  const CACHE_TTL = 5000;

  // Cleanup function for when business changes
  const clearCarts = useCallback(() => {
    console.log('[CartContext] Clearing carts data');
    setCarts([]);
    cartsCache.current.clear();
  }, []);

  // Register cleanup callback with cleanup registry
  useEffect(() => {
    dataCleanupRegistry.register('cart-context', clearCarts);

    return () => {
      dataCleanupRegistry.unregister('cart-context');
    };
  }, [clearCarts]);

  // Load carts from database on mount and when business changes
  useEffect(() => {
    console.log('CartContext: Initial');
    if (currentBusiness?.id) {
      // Clear previous business data first
      clearCarts();
      refreshCarts();
      console.log('CartContext: Initial refreshCarts called with currentBusiness ID:', currentBusiness.id);
    } else {
      console.log('CartContext: Waiting for currentBusiness ID before refreshing carts');
      // Set empty carts when currentBusiness is not available
      setCarts([]);
      setLoading(false);
    }
  }, [currentBusiness?.id, clearCarts]);

  // Helper functions - defined first as they have no dependencies
  const calculateCartDiscount = useCallback((subtotalAmount: number, discountType?: 'percentage' | 'fixed', discountValue?: number): number => {
    if (!discountType || !discountValue) {
      return 0;
    }
    
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = subtotalAmount * (discountValue / 100);
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, subtotalAmount);
    }
    
    return Math.max(0, discountAmount);
  }, []);

  const calculateItemSubtotal = useCallback((
    quantity: number,
    unitPrice: number,
    discountType?: 'percentage' | 'fixed',
    discountValue?: number,
    discountScope?: 'per_unit' | 'total'
  ): { subtotal: number; discountAmount: number } => {
    const originalSubtotal = quantity * unitPrice;

    if (!discountType || !discountValue) {
      return { subtotal: originalSubtotal, discountAmount: 0 };
    }

    const scope = discountScope || 'total';
    let discountAmount = 0;

    if (discountType === 'percentage') {
      if (scope === 'per_unit') {
        discountAmount = unitPrice * (discountValue / 100) * quantity;
      } else {
        discountAmount = originalSubtotal * (discountValue / 100);
      }
    } else if (discountType === 'fixed') {
      if (scope === 'per_unit') {
        discountAmount = Math.min(discountValue, unitPrice) * quantity;
      } else {
        discountAmount = Math.min(discountValue, originalSubtotal);
      }
    }

    return {
      subtotal: Math.max(0, originalSubtotal - discountAmount),
      discountAmount
    };
  }, []);

  // Helper function to calculate cart summary for a specific cart object
  const getCartSummaryForCart = useCallback((cart: Cart): CartSummary => {
    // Calculate item totals
    const itemsOriginalTotal = cart.items.reduce((sum, item) => sum + item.original_subtotal, 0);
    const itemsTotalDiscount = cart.items.reduce((sum, item) => sum + (item.item_discount_amount || 0), 0);
    const itemsSubtotalAfterDiscount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Calculate cart-level discount
    const cartDiscountAmount = calculateCartDiscount(
      itemsSubtotalAfterDiscount,
      cart.discount_type,
      cart.discount_value
    );
    
    // Calculate final total
    const deliveryCost = cart.delivery_cost || 0;
    const finalTotal = Math.max(0, itemsSubtotalAfterDiscount - cartDiscountAmount - deliveryCost);
    
    return {
      itemsOriginalTotal,
      itemsTotalDiscount,
      itemsSubtotalAfterDiscount,
      cartDiscountAmount,
      deliveryCost,
      finalTotal
    };
  }, [calculateCartDiscount]);

  const refreshCarts = useCallback(async (skipCache: boolean = false): Promise<Cart[]> => {
    if (!currentBusiness?.id) return [];

    const cacheKey = `business_${currentBusiness.id}`;
    const cached = cartsCache.current.get(cacheKey);
    const now = Date.now();

    if (!skipCache && cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log('CartContext: Using cached carts');
      return cached.cart ? [cached.cart] : [];
    }

    try {
      console.log('CartContext: refreshCarts started for currentBusiness ID:', currentBusiness.id);
      setLoading(true);

      const serverCarts = await cartService.getActiveCarts(currentBusiness.id);

      const transformedCarts: Cart[] = serverCarts.map(serverCart => ({
        id: serverCart.id,
        customer_id: serverCart.customer_id,
        customer_name: serverCart.customers?.name || 'Unknown Customer',
        customer_phone: serverCart.customers?.phone,
        status: serverCart.status as 'active' | 'completed' | 'abandoned',
        total_amount: serverCart.total_amount,
        discount_type: serverCart.discount_type as 'percentage' | 'fixed' | undefined,
        discount_value: serverCart.discount_value,
        delivery_cost: serverCart.delivery_cost,
        notes: serverCart.notes,
        business_id: serverCart.business_id,
        created_by: serverCart.created_by,
        created_at: serverCart.created_at,
        updated_at: serverCart.updated_at,
        items: serverCart.cart_items?.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name || 'Unknown Product',
          quantity: item.quantity,
          unit_price: item.unit_price,
          original_subtotal: item.original_subtotal || (item.quantity * item.unit_price),
          item_discount_type: item.item_discount_type as 'percentage' | 'fixed' | undefined,
          item_discount_value: item.item_discount_value,
          item_discount_amount: item.item_discount_amount || 0,
          item_discount_scope: item.item_discount_scope as 'per_unit' | 'total' | undefined,
          subtotal: item.subtotal
        })) || []
      }));

      transformedCarts.forEach(cart => {
        cartsCache.current.set(`cart_${cart.id}`, { cart, timestamp: now });
      });

      setCarts(transformedCarts);
      return transformedCarts;
    } catch (error) {
      console.error('Error refreshing carts:', error);
      return [];
    } finally {
      console.log('CartContext: refreshCarts completed');
      setLoading(false);
    }
  }, [currentBusiness?.id, CACHE_TTL]);

  const createCart = useCallback(async (customerData: { id: string; name: string; phone?: string }): Promise<Cart> => {
    if (!currentBusiness || !currentBusiness.id) {
      console.error('CartContext: Cannot create cart - No business currentBusiness found');
      throw new Error('No business currentBusiness found. Please try again later.');
    }

    try {
      // Create cart directly in database
      const serverCart = await cartService.createCart({
        customer_id: customerData.id,
        business_id: currentBusiness.id,
        created_by: user.id,
        status: 'active',
        total_amount: 0
      });

      // Transform to local cart format
      const newCart: Cart = {
        id: serverCart.id,
        customer_id: serverCart.customer_id,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        status: serverCart.status as 'active' | 'completed' | 'abandoned',
        total_amount: serverCart.total_amount,
        discount_type: serverCart.discount_type as 'percentage' | 'fixed' | undefined,
        discount_value: serverCart.discount_value,
        delivery_cost: serverCart.delivery_cost,
        notes: serverCart.notes,
        business_id: serverCart.business_id,
        created_by: serverCart.created_by,
        created_at: serverCart.created_at,
        updated_at: serverCart.updated_at,
        items: []
      };

      // Update local state
      setCarts(prevCarts => [...prevCarts, newCart]);
      
      return newCart;
    } catch (error) {
      console.error('Error creating cart:', error);
      throw error;
    }
  }, [currentBusiness]);

  const getCart = useCallback((cartId: string): Cart | undefined => {
    return carts.find(cart => cart.id === cartId);
  }, [carts]);

  const updateCart = useCallback(async (cartId: string, updates: Partial<Omit<Cart, 'id' | 'items'>>): Promise<Cart> => {
    try {
      if (updates.delivery_cost !== undefined) {
        const deliveryCost = parseFloat(updates.delivery_cost as any);
        updates.delivery_cost = isNaN(deliveryCost) ? 0 : deliveryCost;
      }

      setCarts(prevCarts => prevCarts.map(cart => {
        if (cart.id === cartId) {
          const updatedCart = {
            ...cart,
            ...updates,
            updated_at: new Date().toISOString()
          };
          cartsCache.current.set(`cart_${cartId}`, {
            cart: updatedCart,
            timestamp: Date.now()
          });
          return updatedCart;
        }
        return cart;
      }));

      await cartService.updateCart(cartId, {
        status: updates.status,
        total_amount: updates.total_amount,
        discount_type: updates.discount_type,
        discount_value: updates.discount_value,
        delivery_cost: updates.delivery_cost,
        notes: updates.notes
      });

      const updatedCart = carts.find(cart => cart.id === cartId);
      if (!updatedCart) {
        throw new Error('Cart not found after update');
      }

      return { ...updatedCart, ...updates };
    } catch (error) {
      console.error('Error updating cart:', error);
      throw error;
    }
  }, [carts]);

  const deleteCart = useCallback(async (cartId: string): Promise<void> => {
    try {
      // Delete cart from database
      await cartService.deleteCart(cartId);

      // Update local state
      setCarts(prevCarts => prevCarts.filter(c => c.id !== cartId));
    } catch (error) {
      console.error('Error deleting cart:', error);
      throw error;
    }
  }, []);

  const addItemToCart = useCallback(async (cartId: string, product: any, quantity: number = 1): Promise<CartItem> => {
    try {
      await cartService.addItemToCart({
        cart_id: cartId,
        product_id: product.id,
        quantity: quantity,
        unit_price: product.price,
        cost_per_unit: product.cost_per_unit || 0,
        subtotal: quantity * product.price,
        original_subtotal: quantity * product.price,
        unit_id: product.unit_id || undefined,
        currency_id: product.currency_id || undefined
      });

      const updatedCarts = await refreshCarts(true);

      const updatedCart = updatedCarts.find(cart => cart.id === cartId);
      if (!updatedCart) {
        throw new Error('Cart not found after adding item');
      }

      const addedItem = updatedCart.items.find(item => item.product_id === product.id);
      if (!addedItem) {
        throw new Error('Item not found after adding to cart');
      }

      return addedItem;
    } catch (error) {
      console.error('Error adding item to cart:', error);
      throw error;
    }
  }, [refreshCarts]);

  const updateCartItem = useCallback(async (cartId: string, itemId: string, updates: Partial<Omit<CartItem, 'id'>>): Promise<CartItem> => {
    try {
      await cartService.updateCartItem(itemId, {
        quantity: updates.quantity,
        unit_price: updates.unit_price,
        subtotal: updates.subtotal,
        original_subtotal: updates.original_subtotal,
        item_discount_type: updates.item_discount_type,
        item_discount_value: updates.item_discount_value,
        item_discount_amount: updates.item_discount_amount
      });

      await refreshCarts(true);

      const updatedCart = carts.find(cart => cart.id === cartId);
      if (!updatedCart) {
        throw new Error('Cart not found after updating item');
      }

      const updatedItem = updatedCart.items.find(item => item.id === itemId);
      if (!updatedItem) {
        throw new Error('Item not found after updating');
      }

      return updatedItem;
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }, [refreshCarts, carts]);

  const removeCartItem = useCallback(async (cartId: string, itemId: string): Promise<void> => {
    try {
      await cartService.removeCartItem(itemId);
      await refreshCarts(true);
    } catch (error) {
      console.error('Error removing cart item:', error);
      throw error;
    }
  }, [refreshCarts]);

  const applyItemDiscount = useCallback(async (cartId: string, itemId: string, discountType: 'percentage' | 'fixed', discountValue: number, discountScope: 'per_unit' | 'total' = 'total'): Promise<CartItem> => {
    try {
      await cartService.applyItemDiscount(itemId, discountType, discountValue, discountScope);
      await refreshCarts(true);

      const updatedCart = carts.find(cart => cart.id === cartId);
      if (!updatedCart) {
        throw new Error('Cart not found after applying discount');
      }

      const updatedItem = updatedCart.items.find(item => item.id === itemId);
      if (!updatedItem) {
        throw new Error('Item not found after applying discount');
      }

      return updatedItem;
    } catch (error) {
      console.error('Error applying item discount:', error);
      throw error;
    }
  }, [refreshCarts, carts]);

  const removeItemDiscount = useCallback(async (cartId: string, itemId: string): Promise<CartItem> => {
    try {
      await cartService.removeItemDiscount(itemId);
      await refreshCarts(true);

      const updatedCart = carts.find(cart => cart.id === cartId);
      if (!updatedCart) {
        throw new Error('Cart not found after removing discount');
      }

      const updatedItem = updatedCart.items.find(item => item.id === itemId);
      if (!updatedItem) {
        throw new Error('Item not found after removing discount');
      }

      return updatedItem;
    } catch (error) {
      console.error('Error removing item discount:', error);
      throw error;
    }
  }, [refreshCarts, carts]);

  const getCartSummary = useCallback((cartId: string): CartSummary => {
    const cart = carts.find(cart => cart.id === cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    // Calculate item totals
    const itemsOriginalTotal = cart.items.reduce((sum, item) => sum + item.original_subtotal, 0);
    const itemsTotalDiscount = cart.items.reduce((sum, item) => sum + (item.item_discount_amount || 0), 0);
    const itemsSubtotalAfterDiscount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Calculate cart-level discount
    const cartDiscountAmount = calculateCartDiscount(
      itemsSubtotalAfterDiscount,
      cart.discount_type,
      cart.discount_value
    );
    
    // Calculate final total
    const deliveryCost = cart.delivery_cost || 0;
    const finalTotal = Math.max(0, itemsSubtotalAfterDiscount - cartDiscountAmount - deliveryCost);
    
    return {
      itemsOriginalTotal,
      itemsTotalDiscount,
      itemsSubtotalAfterDiscount,
      cartDiscountAmount,
      deliveryCost,
      finalTotal
    };
  }, [carts, calculateCartDiscount]);

  const completeSale = useCallback(async (
    cartId: string,
    paymentMethod: string,
    saleDate?: string,
    customNotes?: string
  ): Promise<{ success: boolean; saleId?: string; error?: string; offline?: boolean }> => {
    if (!currentBusiness?.id) {
      return { success: false, error: 'No business currentBusiness found' };
    }

    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const cart = carts.find(c => c.id === cartId);
    if (!cart) {
      return { success: false, error: 'Cart not found' };
    }

    // If offline, queue the sale immediately
    if (!isConnected) {
      console.log('[CartContext] Offline - queuing sale for later sync');
      await offlineSaleQueue.add({
        cartItems: cart.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_per_unit: (item as any).cost_per_unit || 0,
          subtotal: item.subtotal,
          original_subtotal: item.original_subtotal,
          item_discount_type: item.item_discount_type,
          item_discount_value: item.item_discount_value,
          item_discount_amount: item.item_discount_amount,
          item_discount_scope: item.item_discount_scope,
          unit_id: (item as any).unit_id || null,
          currency_id: (item as any).currency_id || null,
        })),
        customerId: cart.customer_id,
        customerName: cart.customer_name,
        paymentMethod: paymentMethod as any,
        saleDate: saleDate || new Date().toISOString(),
        totalAmount: cart.total_amount,
        businessId: currentBusiness.id,
        createdBy: user.id,
        deliveryCost: cart.delivery_cost,
        notes: customNotes || cart.notes,
        discountType: cart.discount_type,
        discountValue: cart.discount_value,
        cartId,
      });

      setCarts(prevCarts => prevCarts.filter(c => c.id !== cartId));
      const count = await offlineSaleQueue.getCount();
      setPendingSalesCount(count);

      return { success: true, offline: true };
    }

    try {
      console.log('[CartContext] Validating feature access for sale completion');
      const hasAccess = await subscriptionService.validateFeatureAccessForCriticalOperation(user.id, currentBusiness.id);

      if (!hasAccess) {
        console.log('[CartContext] Access denied - limit reached or subscription expired');
        return {
          success: false,
          error: 'You\'ve reached the free limit. Please upgrade to continue.'
        };
      }

      console.log('[CartContext] Access validated, completing sale');
      const sale = await retryWithBackoff(
        () => salesService.completeSale({
          cart_id: cartId,
          customer_id: cart.customer_id || '',
          payment_method: paymentMethod as any,
          notes: customNotes || cart.notes,
          sale_date: saleDate,
          business_id: currentBusiness.id,
          created_by: user.id
        }),
        'completeSale'
      );

      setCarts(prevCarts => prevCarts.filter(c => c.id !== cartId));

      return { success: true, saleId: sale.id };
    } catch (error: any) {
      console.error('Error completing sale:', error);

      // If it failed due to network, queue it
      if (isNetworkError(error)) {
        console.log('[CartContext] Network error during sale - queuing for later sync');
        await offlineSaleQueue.add({
          cartItems: cart.items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_per_unit: (item as any).cost_per_unit || 0,
            subtotal: item.subtotal,
            original_subtotal: item.original_subtotal,
            item_discount_type: item.item_discount_type,
            item_discount_value: item.item_discount_value,
            item_discount_amount: item.item_discount_amount,
            item_discount_scope: item.item_discount_scope,
            unit_id: (item as any).unit_id || null,
            currency_id: (item as any).currency_id || null,
          })),
          customerId: cart.customer_id,
          customerName: cart.customer_name,
          paymentMethod: paymentMethod as any,
          saleDate: saleDate || new Date().toISOString(),
          totalAmount: cart.total_amount,
          businessId: currentBusiness.id,
          createdBy: user.id,
          deliveryCost: cart.delivery_cost,
          notes: customNotes || cart.notes,
          discountType: cart.discount_type,
          discountValue: cart.discount_value,
          cartId,
        });

        setCarts(prevCarts => prevCarts.filter(c => c.id !== cartId));
        const count = await offlineSaleQueue.getCount();
        setPendingSalesCount(count);

        return { success: true, offline: true };
      }

      return { success: false, error: error?.message || 'Failed to complete sale' };
    }
  }, [currentBusiness, carts, user, isConnected, setPendingSalesCount]);

  const value = {
    carts,
    loading,
    createCart,
    getCart,
    updateCart,
    deleteCart,
    addItemToCart,
    updateCartItem,
    removeCartItem,
    applyItemDiscount,
    removeItemDiscount,
    getCartSummary,
    completeSale,
    refreshCarts
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}