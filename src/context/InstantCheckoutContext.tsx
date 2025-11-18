import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { customerService } from '@/src/services/customers';
import { Database } from '../types/database';

type Customer = Database['public']['Tables']['customers']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export interface InstantCheckoutItem {
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  original_subtotal: number;
  item_discount_type?: 'percentage' | 'fixed';
  item_discount_value?: number;
  item_discount_amount?: number;
  subtotal: number;
  available_stock: number;
}

export interface InstantCheckoutSession {
  items: InstantCheckoutItem[];
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method?: 'cash' | 'card' | 'transfer' | 'other';
  sale_date: Date;
  cart_discount_type?: 'percentage' | 'fixed';
  cart_discount_value?: number;
  delivery_cost?: number;
  notes?: string;
}

export interface InstantCheckoutSummary {
  itemsOriginalTotal: number;
  itemsTotalDiscount: number;
  itemsSubtotalAfterDiscount: number;
  cartDiscountAmount: number;
  deliveryCost: number;
  finalTotal: number;
}

interface InstantCheckoutContextType {
  session: InstantCheckoutSession | null;
  isModalOpen: boolean;
  guestCustomer: Customer | null;
  loading: boolean;
  addProduct: (product: Product, quantity?: number) => void;
  removeProduct: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  applyItemDiscount: (productId: string, discountType: 'percentage' | 'fixed', discountValue: number) => void;
  removeItemDiscount: (productId: string) => void;
  setCustomer: (customerId: string | undefined, customerName?: string, customerPhone?: string) => void;
  setPaymentMethod: (method: 'cash' | 'card' | 'transfer' | 'other') => void;
  setSaleDate: (date: Date) => void;
  applyCartDiscount: (discountType: 'percentage' | 'fixed', discountValue: number) => void;
  removeCartDiscount: () => void;
  setDeliveryCost: (cost: number) => void;
  setNotes: (notes: string) => void;
  getSessionSummary: () => InstantCheckoutSummary;
  clearSession: () => void;
  openModal: () => void;
  closeModal: () => void;
  getItemCount: () => number;
}

const InstantCheckoutContext = createContext<InstantCheckoutContextType | undefined>(undefined);

const AUTO_SAVE_TIMEOUT = 3 * 60 * 1000;

export function InstantCheckoutProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<InstantCheckoutSession | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guestCustomer, setGuestCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const { currentBusiness } = useAuth();
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentBusiness?.id) {
      loadGuestCustomer();
    }
  }, [currentBusiness?.id]);

  const loadGuestCustomer = async () => {
    if (!currentBusiness?.id) return;

    try {
      const guest = await customerService.getGuestCustomer(currentBusiness.id);
      setGuestCustomer(guest);
    } catch (error) {
      console.error('Failed to load guest customer:', error);
    }
  };

  const resetAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (session && session.items.length > 0 && isModalOpen) {
      autoSaveTimerRef.current = setTimeout(() => {
      }, AUTO_SAVE_TIMEOUT);
    }
  }, [session, isModalOpen]);

  useEffect(() => {
    resetAutoSaveTimer();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [resetAutoSaveTimer]);

  const calculateItemDiscount = useCallback((
    subtotal: number,
    discountType?: 'percentage' | 'fixed',
    discountValue?: number
  ): number => {
    if (!discountType || !discountValue) return 0;

    if (discountType === 'percentage') {
      return subtotal * (discountValue / 100);
    } else {
      return Math.min(discountValue, subtotal);
    }
  }, []);

  const calculateCartDiscount = useCallback((
    subtotalAmount: number,
    discountType?: 'percentage' | 'fixed',
    discountValue?: number
  ): number => {
    if (!discountType || !discountValue) return 0;

    if (discountType === 'percentage') {
      return subtotalAmount * (discountValue / 100);
    } else {
      return Math.min(discountValue, subtotalAmount);
    }
  }, []);

  const addProduct = useCallback((product: Product, quantity: number = 1) => {
    setSession((prev) => {
      const existingItemIndex = prev?.items.findIndex(item => item.product_id === product.id) ?? -1;

      if (existingItemIndex !== -1 && prev) {
        const updatedItems = [...prev.items];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + quantity;
        const originalSubtotal = product.price * newQuantity;
        const itemDiscountAmount = calculateItemDiscount(
          originalSubtotal,
          existingItem.item_discount_type,
          existingItem.item_discount_value
        );

        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          original_subtotal: originalSubtotal,
          item_discount_amount: itemDiscountAmount,
          subtotal: originalSubtotal - itemDiscountAmount,
        };

        return { ...prev, items: updatedItems };
      } else {
        const originalSubtotal = product.price * quantity;
        const newItem: InstantCheckoutItem = {
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url || undefined,
          quantity,
          unit_price: product.price,
          original_subtotal: originalSubtotal,
          subtotal: originalSubtotal,
          available_stock: product.current_stock || 0,
        };

        return prev
          ? { ...prev, items: [...prev.items, newItem] }
          : {
              items: [newItem],
              sale_date: new Date(),
            };
      }
    });

    resetAutoSaveTimer();
  }, [calculateItemDiscount, resetAutoSaveTimer]);

  const removeProduct = useCallback((productId: string) => {
    setSession((prev) => {
      if (!prev) return null;
      const updatedItems = prev.items.filter(item => item.product_id !== productId);
      return updatedItems.length > 0 ? { ...prev, items: updatedItems } : null;
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeProduct(productId);
      return;
    }

    setSession((prev) => {
      if (!prev) return null;

      const updatedItems = prev.items.map(item => {
        if (item.product_id === productId) {
          const originalSubtotal = item.unit_price * quantity;
          const itemDiscountAmount = calculateItemDiscount(
            originalSubtotal,
            item.item_discount_type,
            item.item_discount_value
          );

          return {
            ...item,
            quantity,
            original_subtotal: originalSubtotal,
            item_discount_amount: itemDiscountAmount,
            subtotal: originalSubtotal - itemDiscountAmount,
          };
        }
        return item;
      });

      return { ...prev, items: updatedItems };
    });

    resetAutoSaveTimer();
  }, [calculateItemDiscount, removeProduct, resetAutoSaveTimer]);

  const applyItemDiscount = useCallback((
    productId: string,
    discountType: 'percentage' | 'fixed',
    discountValue: number
  ) => {
    setSession((prev) => {
      if (!prev) return null;

      const updatedItems = prev.items.map(item => {
        if (item.product_id === productId) {
          const itemDiscountAmount = calculateItemDiscount(
            item.original_subtotal,
            discountType,
            discountValue
          );

          return {
            ...item,
            item_discount_type: discountType,
            item_discount_value: discountValue,
            item_discount_amount: itemDiscountAmount,
            subtotal: item.original_subtotal - itemDiscountAmount,
          };
        }
        return item;
      });

      return { ...prev, items: updatedItems };
    });

    resetAutoSaveTimer();
  }, [calculateItemDiscount, resetAutoSaveTimer]);

  const removeItemDiscount = useCallback((productId: string) => {
    setSession((prev) => {
      if (!prev) return null;

      const updatedItems = prev.items.map(item => {
        if (item.product_id === productId) {
          return {
            ...item,
            item_discount_type: undefined,
            item_discount_value: undefined,
            item_discount_amount: undefined,
            subtotal: item.original_subtotal,
          };
        }
        return item;
      });

      return { ...prev, items: updatedItems };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const setCustomer = useCallback((customerId: string | undefined, customerName?: string, customerPhone?: string) => {
    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
      };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const setPaymentMethod = useCallback((method: 'cash' | 'card' | 'transfer' | 'other') => {
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, payment_method: method };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const setSaleDate = useCallback((date: Date) => {
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, sale_date: date };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const applyCartDiscount = useCallback((discountType: 'percentage' | 'fixed', discountValue: number) => {
    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        cart_discount_type: discountType,
        cart_discount_value: discountValue,
      };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const removeCartDiscount = useCallback(() => {
    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        cart_discount_type: undefined,
        cart_discount_value: undefined,
      };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const setDeliveryCost = useCallback((cost: number) => {
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, delivery_cost: cost };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const setNotes = useCallback((notes: string) => {
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, notes };
    });

    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const getSessionSummary = useCallback((): InstantCheckoutSummary => {
    if (!session) {
      return {
        itemsOriginalTotal: 0,
        itemsTotalDiscount: 0,
        itemsSubtotalAfterDiscount: 0,
        cartDiscountAmount: 0,
        deliveryCost: 0,
        finalTotal: 0,
      };
    }

    const itemsOriginalTotal = session.items.reduce((sum, item) => sum + item.original_subtotal, 0);
    const itemsTotalDiscount = session.items.reduce((sum, item) => sum + (item.item_discount_amount || 0), 0);
    const itemsSubtotalAfterDiscount = itemsOriginalTotal - itemsTotalDiscount;
    const cartDiscountAmount = calculateCartDiscount(
      itemsSubtotalAfterDiscount,
      session.cart_discount_type,
      session.cart_discount_value
    );
    const deliveryCost = session.delivery_cost || 0;
    const finalTotal = itemsSubtotalAfterDiscount - cartDiscountAmount + deliveryCost;

    return {
      itemsOriginalTotal,
      itemsTotalDiscount,
      itemsSubtotalAfterDiscount,
      cartDiscountAmount,
      deliveryCost,
      finalTotal,
    };
  }, [session, calculateCartDiscount]);

  const clearSession = useCallback(() => {
    setSession(null);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    resetAutoSaveTimer();
  }, [resetAutoSaveTimer]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  }, []);

  const getItemCount = useCallback(() => {
    return session?.items.length || 0;
  }, [session]);

  const value: InstantCheckoutContextType = {
    session,
    isModalOpen,
    guestCustomer,
    loading,
    addProduct,
    removeProduct,
    updateQuantity,
    applyItemDiscount,
    removeItemDiscount,
    setCustomer,
    setPaymentMethod,
    setSaleDate,
    applyCartDiscount,
    removeCartDiscount,
    setDeliveryCost,
    setNotes,
    getSessionSummary,
    clearSession,
    openModal,
    closeModal,
    getItemCount,
  };

  return (
    <InstantCheckoutContext.Provider value={value}>
      {children}
    </InstantCheckoutContext.Provider>
  );
}

export function useInstantCheckout() {
  const context = useContext(InstantCheckoutContext);
  if (context === undefined) {
    throw new Error('useInstantCheckout must be used within an InstantCheckoutProvider');
  }
  return context;
}
