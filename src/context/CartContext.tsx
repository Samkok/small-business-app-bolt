import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { cartService } from '@/src/services/carts';
import { productService } from '@/src/services/products';
import { salesService } from '@/src/services/sales';

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
  synced: boolean;
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
  applyItemDiscount: (cartId: string, itemId: string, discountType: 'percentage' | 'fixed', discountValue: number) => Promise<CartItem>;
  removeItemDiscount: (cartId: string, itemId: string) => Promise<CartItem>;
  getCartSummary: (cartId: string) => CartSummary;
  syncCart: (cartId: string) => Promise<boolean>;
  completeSale: (cartId: string, paymentMethod: string) => Promise<{ success: boolean; saleId?: string; error?: string }>;
  refreshCarts: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'local_carts';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  // Load carts from AsyncStorage on mount
  useEffect(() => {
    loadCarts();
  }, []);

  // Load carts from AsyncStorage
  const loadCarts = async () => {
    try {
      setLoading(true);
      const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCarts) {
        const parsedCarts = JSON.parse(storedCarts) as Cart[];
        // Only load carts for the current business
        if (profile?.id) {
          const filteredCarts = parsedCarts.filter(cart => 
            cart.business_id === profile.id && cart.status === 'active'
          );
          setCarts(filteredCarts);
        } else {
          setCarts([]);
        }
      }
    } catch (error) {
      console.error('Error loading carts from storage:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save carts to AsyncStorage whenever they change
  useEffect(() => {
    if (carts.length > 0) {
      saveCarts();
    }
  }, [carts]);

  const saveCarts = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(carts));
    } catch (error) {
      console.error('Error saving carts to storage:', error);
    }
  };

  const syncCart = useCallback(async (cartId: string): Promise<boolean> => {
    if (!profile?.id) {
      throw new Error('No business profile found');
    }

    // Get the latest cart data from AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (!storedCarts) {
      throw new Error('No carts found in storage');
    }
    
    const allCarts = JSON.parse(storedCarts) as Cart[];
    const cartIndex = allCarts.findIndex(c => c.id === cartId);
    
    if (cartIndex === -1) {
      throw new Error('Cart not found in storage');
    }

    const cart = allCarts[cartIndex];
    
    try {
      let serverCartId = cart.id;
      
      // If the cart is not synced, create it on the server
      if (!cart.synced) {
        try {
          // Create cart on server
          const serverCart = await cartService.createCart({
            id: cart.id, // Use the same UUID
            customer_id: cart.customer_id,
            business_id: cart.business_id,
            created_by: cart.created_by,
            status: cart.status,
            total_amount: cart.total_amount,
            discount_type: cart.discount_type,
            discount_value: cart.discount_value,
            delivery_cost: cart.delivery_cost,
            notes: cart.notes,
            created_at: cart.created_at,
            updated_at: cart.updated_at
          });
          
          serverCartId = serverCart.id;
        } catch (error) {
          console.error('Error creating cart on server:', error);
          throw error;
        }
      }
      
      // Sync all cart items
      for (const item of cart.items) {
        try {
          // Check if item exists on server (for synced carts)
          if (cart.synced) {
            try {
              // Try to update the item if it exists
              await cartService.updateCartItem(item.id, {
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal,
                original_subtotal: item.original_subtotal,
                item_discount_type: item.item_discount_type,
                item_discount_value: item.item_discount_value,
                item_discount_amount: item.item_discount_amount
              });
            } catch (error) {
              // If item doesn't exist, create it
              await cartService.addItemToCart({
                id: item.id, // Use the same UUID
                cart_id: serverCartId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal,
                original_subtotal: item.original_subtotal,
                item_discount_type: item.item_discount_type,
                item_discount_value: item.item_discount_value,
                item_discount_amount: item.item_discount_amount
              });
            }
          } else {
            // For new carts, just add all items
            await cartService.addItemToCart({
              id: item.id, // Use the same UUID
              cart_id: serverCartId,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
              original_subtotal: item.original_subtotal,
              item_discount_type: item.item_discount_type,
              item_discount_value: item.item_discount_value,
              item_discount_amount: item.item_discount_amount
            });
          }
        } catch (error) {
          console.error(`Error syncing cart item ${item.id}:`, error);
          throw error;
        }
      }
      
      // Update cart on server with latest values
      try {
        await cartService.updateCart(serverCartId, {
          status: cart.status,
          total_amount: cart.total_amount,
          discount_type: cart.discount_type,
          discount_value: cart.discount_value,
          delivery_cost: cart.delivery_cost,
          notes: cart.notes
        });
      } catch (error) {
        console.error('Error updating cart on server:', error);
        throw error;
      }
      
      // Mark cart as synced in AsyncStorage
      allCarts[cartIndex] = {
        ...cart,
        synced: true
      };
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
      
      // Update state if needed
      setCarts(prevCarts => {
        const stateCartIndex = prevCarts.findIndex(c => c.id === cartId);
        if (stateCartIndex !== -1) {
          const newCarts = [...prevCarts];
          newCarts[stateCartIndex] = {
            ...newCarts[stateCartIndex],
            synced: true
          };
          return newCarts;
        }
        return prevCarts;
      });
      
      return true;
    } catch (error) {
      console.error('Error syncing cart:', error);
      return false;
    }
  }, [profile]);

  const refreshCarts = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      setLoading(true);
      
      // Get the current carts from storage to ensure we're working with the latest data
      const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
      let localCarts: Cart[] = [];
      if (storedCarts) {
        localCarts = JSON.parse(storedCarts) as Cart[];
        localCarts = localCarts.filter(cart => 
          cart.business_id === profile.id && cart.status === 'active'
        );
      }
      
      // Try to sync any unsynced local carts
      for (const cart of localCarts) {
        if (!cart.synced) {
          try {
            await syncCart(cart.id);
          } catch (error) {
            console.error(`Error syncing cart ${cart.id}:`, error);
            // Continue with other carts even if one fails
          }
        }
      }
      
      // Get active carts from the server
      const serverCarts = await cartService.getActiveCarts(profile.id);
      
      // Reload local carts after sync attempts
      const refreshedStoredCarts = await AsyncStorage.getItem(STORAGE_KEY);
      if (refreshedStoredCarts) {
        localCarts = JSON.parse(refreshedStoredCarts) as Cart[];
        localCarts = localCarts.filter(cart => 
          cart.business_id === profile.id && cart.status === 'active'
        );
      }
      
      // Merge server carts with local carts
      const mergedCarts: Cart[] = [...localCarts];
      
      for (const serverCart of serverCarts) {
        const localCartIndex = localCarts.findIndex(c => c.id === serverCart.id);
        
        if (localCartIndex === -1) {
          // Server cart doesn't exist locally, add it
          const newCart: Cart = {
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
              subtotal: item.subtotal
            })) || [],
            synced: true
          };
          
          mergedCarts.push(newCart);
        } else {
          // If the cart exists locally but is synced, update with server data
          const localCart = localCarts[localCartIndex];
          if (localCart.synced) {
            mergedCarts[localCartIndex] = {
              ...localCart,
              status: serverCart.status as 'active' | 'completed' | 'abandoned',
              total_amount: serverCart.total_amount,
              discount_type: serverCart.discount_type as 'percentage' | 'fixed' | undefined,
              discount_value: serverCart.discount_value,
              delivery_cost: serverCart.delivery_cost,
              notes: serverCart.notes,
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
                subtotal: item.subtotal
              })) || [],
              synced: true
            };
          }
        }
      }
      
      // Save merged carts to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedCarts));
      
      // Update state
      setCarts(mergedCarts);
    } catch (error) {
      console.error('Error refreshing carts:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, syncCart]);

  const createCart = useCallback(async (customerData: { id: string; name: string; phone?: string }): Promise<Cart> => {
    if (!profile?.id) {
      throw new Error('No business profile found');
    }

    const now = new Date().toISOString();
    const newCart: Cart = {
      id: uuidv4(),
      customer_id: customerData.id,
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      status: 'active',
      total_amount: 0,
      business_id: profile.id,
      created_by: profile.id,
      created_at: now,
      updated_at: now,
      items: [],
      synced: false
    };

    // Update state
    setCarts(prevCarts => [...prevCarts, newCart]);
    
    // Save to AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    let allCarts: Cart[] = [];
    if (storedCarts) {
      allCarts = JSON.parse(storedCarts);
    }
    allCarts.push(newCart);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
    
    return newCart;
  }, [profile]);

  const getCart = useCallback((cartId: string): Cart | undefined => {
    return carts.find(cart => cart.id === cartId);
  }, [carts]);

  const updateCart = useCallback(async (cartId: string, updates: Partial<Omit<Cart, 'id' | 'items'>>): Promise<Cart> => {
    const cartIndex = carts.findIndex(cart => cart.id === cartId);
    if (cartIndex === -1) {
      throw new Error('Cart not found');
    }

    const updatedCart = {
      ...carts[cartIndex],
      ...updates,
      updated_at: new Date().toISOString(),
      synced: false
    };

    // Update state
    const newCarts = [...carts];
    newCarts[cartIndex] = updatedCart;
    setCarts(newCarts);
    
    // Update in AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCarts) {
      const allCarts = JSON.parse(storedCarts) as Cart[];
      const storedCartIndex = allCarts.findIndex(c => c.id === cartId);
      if (storedCartIndex !== -1) {
        allCarts[storedCartIndex] = updatedCart;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
      }
    }

    return updatedCart;
  }, [carts]);

  const deleteCart = useCallback(async (cartId: string): Promise<void> => {
    // Get the cart from state
    const cart = carts.find(c => c.id === cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    // If the cart was synced with the server, delete it there too
    if (cart.synced) {
      try {
        await cartService.deleteCart(cartId);
      } catch (error) {
        console.error('Error deleting cart from server:', error);
        // Continue with local deletion even if server deletion fails
      }
    }

    // Update state
    setCarts(prevCarts => prevCarts.filter(c => c.id !== cartId));
    
    // Update in AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCarts) {
      const allCarts = JSON.parse(storedCarts) as Cart[];
      const updatedCarts = allCarts.filter(c => c.id !== cartId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCarts));
    }
  }, [carts]);

  const calculateItemSubtotal = useCallback((quantity: number, unitPrice: number, discountType?: 'percentage' | 'fixed', discountValue?: number): { subtotal: number; discountAmount: number } => {
    const originalSubtotal = quantity * unitPrice;
    
    if (!discountType || !discountValue) {
      return { subtotal: originalSubtotal, discountAmount: 0 };
    }

    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = originalSubtotal * (discountValue / 100);
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, originalSubtotal);
    }

    return { 
      subtotal: Math.max(0, originalSubtotal - discountAmount),
      discountAmount
    };
  }, []);

  const addItemToCart = useCallback(async (cartId: string, product: any, quantity: number = 1): Promise<CartItem> => {
    const cartIndex = carts.findIndex(cart => cart.id === cartId);
    if (cartIndex === -1) {
      throw new Error('Cart not found');
    }

    const cart = carts[cartIndex];
    
    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => item.product_id === product.id);
    
    if (existingItemIndex !== -1) {
      // Update existing item
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      const { subtotal, discountAmount } = calculateItemSubtotal(
        newQuantity,
        existingItem.unit_price,
        existingItem.item_discount_type,
        existingItem.item_discount_value
      );
      
      const updatedItem: CartItem = {
        ...existingItem,
        quantity: newQuantity,
        original_subtotal: newQuantity * existingItem.unit_price,
        item_discount_amount: discountAmount,
        subtotal
      };
      
      const updatedItems = [...cart.items];
      updatedItems[existingItemIndex] = updatedItem;
      
      const updatedCart = {
        ...cart,
        items: updatedItems,
        updated_at: new Date().toISOString(),
        synced: false
      };
      
      // Update state
      const newCarts = [...carts];
      newCarts[cartIndex] = updatedCart;
      setCarts(newCarts);
      
      // Update in AsyncStorage
      const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCarts) {
        const allCarts = JSON.parse(storedCarts) as Cart[];
        const storedCartIndex = allCarts.findIndex(c => c.id === cartId);
        if (storedCartIndex !== -1) {
          allCarts[storedCartIndex] = updatedCart;
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
        }
      }
      
      return updatedItem;
    } else {
      // Add new item
      const originalSubtotal = quantity * product.price;
      
      const newItem: CartItem = {
        id: uuidv4(),
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: product.price,
        original_subtotal: originalSubtotal,
        subtotal: originalSubtotal
      };
      
      const updatedCart = {
        ...cart,
        items: [...cart.items, newItem],
        updated_at: new Date().toISOString(),
        synced: false
      };
      
      // Update state
      const newCarts = [...carts];
      newCarts[cartIndex] = updatedCart;
      setCarts(newCarts);
      
      // Update in AsyncStorage
      const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCarts) {
        const allCarts = JSON.parse(storedCarts) as Cart[];
        const storedCartIndex = allCarts.findIndex(c => c.id === cartId);
        if (storedCartIndex !== -1) {
          allCarts[storedCartIndex] = updatedCart;
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
        }
      }
      
      return newItem;
    }
  }, [carts, calculateItemSubtotal]);

  const updateCartItem = useCallback(async (cartId: string, itemId: string, updates: Partial<Omit<CartItem, 'id'>>): Promise<CartItem> => {
    const cartIndex = carts.findIndex(cart => cart.id === cartId);
    if (cartIndex === -1) {
      throw new Error('Cart not found');
    }

    const cart = carts[cartIndex];
    const itemIndex = cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Cart item not found');
    }

    const currentItem = cart.items[itemIndex];
    const updatedItem = { ...currentItem, ...updates };
    
    // Recalculate subtotal if quantity or unit_price changed
    if (updates.quantity !== undefined || updates.unit_price !== undefined) {
      const quantity = updates.quantity ?? currentItem.quantity;
      const unitPrice = updates.unit_price ?? currentItem.unit_price;
      
      updatedItem.original_subtotal = quantity * unitPrice;
      
      const { subtotal, discountAmount } = calculateItemSubtotal(
        quantity,
        unitPrice,
        updatedItem.item_discount_type,
        updatedItem.item_discount_value
      );
      
      updatedItem.subtotal = subtotal;
      updatedItem.item_discount_amount = discountAmount;
    }
    
    const updatedItems = [...cart.items];
    updatedItems[itemIndex] = updatedItem;
    
    const updatedCart = {
      ...cart,
      items: updatedItems,
      updated_at: new Date().toISOString(),
      synced: false
    };
    
    // Update state
    const newCarts = [...carts];
    newCarts[cartIndex] = updatedCart;
    setCarts(newCarts);
    
    // Update in AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCarts) {
      const allCarts = JSON.parse(storedCarts) as Cart[];
      const storedCartIndex = allCarts.findIndex(c => c.id === cartId);
      if (storedCartIndex !== -1) {
        allCarts[storedCartIndex] = updatedCart;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
      }
    }
    
    return updatedItem;
  }, [carts, calculateItemSubtotal]);

  const removeCartItem = useCallback(async (cartId: string, itemId: string): Promise<void> => {
    const cartIndex = carts.findIndex(cart => cart.id === cartId);
    if (cartIndex === -1) {
      throw new Error('Cart not found');
    }

    const cart = carts[cartIndex];
    const updatedItems = cart.items.filter(item => item.id !== itemId);
    
    const updatedCart = {
      ...cart,
      items: updatedItems,
      updated_at: new Date().toISOString(),
      synced: false
    };
    
    // Update state
    const newCarts = [...carts];
    newCarts[cartIndex] = updatedCart;
    setCarts(newCarts);
    
    // Update in AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCarts) {
      const allCarts = JSON.parse(storedCarts) as Cart[];
      const storedCartIndex = allCarts.findIndex(c => c.id === cartId);
      if (storedCartIndex !== -1) {
        allCarts[storedCartIndex] = updatedCart;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
      }
    }
  }, [carts]);

  const applyItemDiscount = useCallback(async (cartId: string, itemId: string, discountType: 'percentage' | 'fixed', discountValue: number): Promise<CartItem> => {
    const cartIndex = carts.findIndex(cart => cart.id === cartId);
    if (cartIndex === -1) {
      throw new Error('Cart not found');
    }

    const cart = carts[cartIndex];
    const itemIndex = cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Cart item not found');
    }

    const item = cart.items[itemIndex];
    
    const { subtotal, discountAmount } = calculateItemSubtotal(
      item.quantity,
      item.unit_price,
      discountType,
      discountValue
    );
    
    const updatedItem: CartItem = {
      ...item,
      item_discount_type: discountType,
      item_discount_value: discountValue,
      item_discount_amount: discountAmount,
      subtotal
    };
    
    const updatedItems = [...cart.items];
    updatedItems[itemIndex] = updatedItem;
    
    const updatedCart = {
      ...cart,
      items: updatedItems,
      updated_at: new Date().toISOString(),
      synced: false
    };
    
    // Update state
    const newCarts = [...carts];
    newCarts[cartIndex] = updatedCart;
    setCarts(newCarts);
    
    // Update in AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCarts) {
      const allCarts = JSON.parse(storedCarts) as Cart[];
      const storedCartIndex = allCarts.findIndex(c => c.id === cartId);
      if (storedCartIndex !== -1) {
        allCarts[storedCartIndex] = updatedCart;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
      }
    }
    
    return updatedItem;
  }, [carts, calculateItemSubtotal]);

  const removeItemDiscount = useCallback(async (cartId: string, itemId: string): Promise<CartItem> => {
    const cartIndex = carts.findIndex(cart => cart.id === cartId);
    if (cartIndex === -1) {
      throw new Error('Cart not found');
    }

    const cart = carts[cartIndex];
    const itemIndex = cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Cart item not found');
    }

    const item = cart.items[itemIndex];
    
    const updatedItem: CartItem = {
      ...item,
      item_discount_type: undefined,
      item_discount_value: undefined,
      item_discount_amount: 0,
      subtotal: item.original_subtotal
    };
    
    const updatedItems = [...cart.items];
    updatedItems[itemIndex] = updatedItem;
    
    const updatedCart = {
      ...cart,
      items: updatedItems,
      updated_at: new Date().toISOString(),
      synced: false
    };
    
    // Update state
    const newCarts = [...carts];
    newCarts[cartIndex] = updatedCart;
    setCarts(newCarts);
    
    // Update in AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedCarts) {
      const allCarts = JSON.parse(storedCarts) as Cart[];
      const storedCartIndex = allCarts.findIndex(c => c.id === cartId);
      if (storedCartIndex !== -1) {
        allCarts[storedCartIndex] = updatedCart;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allCarts));
      }
    }
    
    return updatedItem;
  }, [carts]);

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

  const completeSale = useCallback(async (cartId: string, paymentMethod: string): Promise<{ success: boolean; saleId?: string; error?: string }> => {
    if (!profile?.id) {
      return { success: false, error: 'No business profile found' };
    }

    // Get the latest cart data from AsyncStorage
    const storedCarts = await AsyncStorage.getItem(STORAGE_KEY);
    if (!storedCarts) {
      return { success: false, error: 'No carts found in storage' };
    }
    
    const allCarts = JSON.parse(storedCarts) as Cart[];
    const cartIndex = allCarts.findIndex(c => c.id === cartId);
    
    if (cartIndex === -1) {
      return { success: false, error: 'Cart not found in storage' };
    }

    const cart = allCarts[cartIndex];
    
    try {
      // First sync the cart to ensure it's up-to-date on the server
      const syncSuccess = await syncCart(cartId);
      if (!syncSuccess) {
        return { success: false, error: 'Failed to sync cart with server' };
      }
      
      // Complete the sale on the server
      const sale = await salesService.completeSale({
        cart_id: cartId,
        customer_id: cart.customer_id,
        payment_method: paymentMethod as any,
        notes: cart.notes,
        business_id: profile.id,
        created_by: profile.id
      });
      
      // Update product stock levels
      for (const item of cart.items) {
        try {
          const product = await productService.getProduct(item.product_id);
          const newStock = Math.max(0, product.current_stock - item.quantity);
          await productService.updateStock(item.product_id, newStock);
        } catch (error) {
          console.error('Error updating product stock:', error);
          // Continue even if stock update fails
        }
      }
      
      // Remove the cart from local storage
      const updatedCarts = allCarts.filter(c => c.id !== cartId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCarts));
      
      // Update state
      setCarts(prevCarts => prevCarts.filter(c => c.id !== cartId));
      
      return { success: true, saleId: sale.id };
    } catch (error) {
      console.error('Error completing sale:', error);
      return { success: false, error: 'Failed to complete sale' };
    }
  }, [profile, syncCart]);

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
    syncCart,
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