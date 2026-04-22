import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, ShoppingCart, Plus, Minus, Percent, DollarSign, MapPin, Truck, Trash2, Check, Save } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { CartItem } from '@/src/components/sales/CartItem';
import { productService } from '@/src/services/products';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { useCurrency } from '@/src/hooks/useCurrency';

export default function CartScreen() {
  const { t } = useTranslation();
  const [showDiscountModal, setShowDiscountModal] = useState<string | null>(null);
  const [showCartDiscountModal, setShowCartDiscountModal] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [productStockMap, setProductStockMap] = useState<Map<string, number>>(new Map());
  const [loadingStock, setLoadingStock] = useState(false);

  // Track initial state and local changes
  const [initialState, setInitialState] = useState<{
    items: Map<string, number>;
    deliveryCost: string;
    notes: string;
    cartDiscount: { type?: 'percentage' | 'fixed'; value?: number };
    itemDiscounts: Map<string, { type: 'percentage' | 'fixed'; value: number }>;
  }>({
    items: new Map(),
    deliveryCost: '',
    notes: '',
    cartDiscount: {},
    itemDiscounts: new Map()
  });

  const [localItemQuantities, setLocalItemQuantities] = useState<Map<string, number>>(new Map());
  const [localItemDiscounts, setLocalItemDiscounts] = useState<Map<string, { type: 'percentage' | 'fixed'; value: number }>>(new Map());
  const [displayCurrencyId, setDisplayCurrencyId] = useState<string | undefined>(undefined);

  const router = useRouter();
  const { cartId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { formatPrice, getSymbol, currencies, defaultCurrency, convertBetween } = useCurrency(currentBusiness?.id);

  const displayAmount = (amount: number) => {
    if (!displayCurrencyId || displayCurrencyId === defaultCurrency?.id) {
      return formatPrice(amount);
    }
    const converted = convertBetween(amount, defaultCurrency?.id, displayCurrencyId);
    return formatPrice(converted, displayCurrencyId);
  };
  const {
    getCart,
    updateCart,
    updateCartItem,
    removeCartItem,
    applyItemDiscount,
    removeItemDiscount,
    getCartSummary
  } = useCart();

  // Get cart
  const cart = getCart(cartId as string);

  // Memoized stock lookup map for O(1) access
  const stockLookup = useMemo(() => {
    return productStockMap;
  }, [productStockMap]);

  // Load product stock data
  useEffect(() => {
    const loadStockData = async () => {
      if (!cart || !currentBusiness?.id) return;

      setLoadingStock(true);
      try {
        const productIds = cart.items.map(item => item.product_id);

        if (productIds.length === 0) {
          setLoadingStock(false);
          return;
        }

        const products = await productService.getProducts(currentBusiness.id);

        const stockMap = new Map<string, number>();
        products.forEach(product => {
          if (productIds.includes(product.id)) {
            stockMap.set(product.id, product.current_stock || 0);
          }
        });

        setProductStockMap(stockMap);
      } catch (error) {
        console.error('Error loading stock data:', error);
      } finally {
        setLoadingStock(false);
      }
    };

    loadStockData();
  }, [cart?.id, currentBusiness?.id]);

  // Initialize local state from cart
  useEffect(() => {
    if (cart) {
      const itemQuantities = new Map<string, number>();
      const itemDiscounts = new Map<string, { type: 'percentage' | 'fixed'; value: number }>();

      cart.items.forEach(item => {
        itemQuantities.set(item.id, item.quantity);
        if (item.item_discount_type && item.item_discount_value) {
          itemDiscounts.set(item.id, {
            type: item.item_discount_type,
            value: item.item_discount_value
          });
        }
      });

      const cartDeliveryCost = cart.delivery_cost?.toString() || '';
      const cartNotes = cart.notes || '';

      setLocalItemQuantities(itemQuantities);
      setLocalItemDiscounts(itemDiscounts);
      setDeliveryCost(cartDeliveryCost);
      setNotes(cartNotes);

      setInitialState({
        items: new Map(itemQuantities),
        deliveryCost: cartDeliveryCost,
        notes: cartNotes,
        cartDiscount: {
          type: cart.discount_type,
          value: cart.discount_value
        },
        itemDiscounts: new Map(itemDiscounts)
      });
    }
  }, [cart?.id]);

  // Helper function to check if there are any pending changes
  const getPendingChanges = useCallback(() => {
    const changes: any = {};
    let hasChanges = false;

    if (!cart) return { hasChanges, changes };

    // Check item quantity changes
    const itemChanges: Array<{ itemId: string; quantity: number }> = [];
    localItemQuantities.forEach((quantity, itemId) => {
      const initial = initialState.items.get(itemId) || 0;
      if (quantity !== initial) {
        itemChanges.push({ itemId, quantity });
        hasChanges = true;
      }
    });

    // Check delivery cost changes
    if (deliveryCost !== initialState.deliveryCost) {
      changes.deliveryCost = deliveryCost;
      hasChanges = true;
    }

    // Check notes changes
    if (notes.trim() !== initialState.notes.trim()) {
      changes.notes = notes.trim() || undefined;
      hasChanges = true;
    }

    // Check cart discount changes
    const currentCartDiscount = cart.discount_type && cart.discount_value
      ? { type: cart.discount_type, value: cart.discount_value }
      : {};
    if (JSON.stringify(currentCartDiscount) !== JSON.stringify(initialState.cartDiscount)) {
      changes.cartDiscount = currentCartDiscount;
      hasChanges = true;
    }

    // Check item discount changes
    const discountChanges: Array<{ itemId: string; type: 'percentage' | 'fixed'; value: number } | { itemId: string; remove: true }> = [];
    localItemDiscounts.forEach((discount, itemId) => {
      const initial = initialState.itemDiscounts.get(itemId);
      if (!initial || JSON.stringify(discount) !== JSON.stringify(initial)) {
        discountChanges.push({ itemId, ...discount });
        hasChanges = true;
      }
    });

    if (itemChanges.length > 0) changes.itemChanges = itemChanges;
    if (discountChanges.length > 0) changes.discountChanges = discountChanges;

    return { hasChanges, changes };
  }, [cart, localItemQuantities, deliveryCost, notes, initialState, localItemDiscounts]);

  // Calculate local cart summary using local state values
  const getLocalCartSummary = useCallback(() => {
    if (!cart) return null;

    // Calculate item totals using local quantities
    let itemsOriginalTotal = 0;
    let itemsTotalDiscount = 0;
    let itemsSubtotalAfterDiscount = 0;

    cart.items.forEach(item => {
      const quantity = localItemQuantities.get(item.id) ?? item.quantity;
      const originalSubtotal = quantity * item.unit_price;
      itemsOriginalTotal += originalSubtotal;

      // Calculate item discount with scope support
      let itemDiscountAmount = 0;
      if (item.item_discount_type && item.item_discount_value) {
        const discountScope = item.item_discount_scope || 'total';

        if (item.item_discount_type === 'percentage') {
          if (discountScope === 'per_unit') {
            itemDiscountAmount = (item.unit_price * (item.item_discount_value / 100)) * quantity;
          } else {
            itemDiscountAmount = originalSubtotal * (item.item_discount_value / 100);
          }
        } else if (item.item_discount_type === 'fixed') {
          if (discountScope === 'per_unit') {
            itemDiscountAmount = Math.min(item.item_discount_value, item.unit_price) * quantity;
          } else {
            itemDiscountAmount = Math.min(item.item_discount_value, originalSubtotal);
          }
        }
      }

      itemsTotalDiscount += itemDiscountAmount;
      itemsSubtotalAfterDiscount += (originalSubtotal - itemDiscountAmount);
    });

    // Calculate cart-level discount
    let cartDiscountAmount = 0;
    if (cart.discount_type && cart.discount_value) {
      if (cart.discount_type === 'percentage') {
        cartDiscountAmount = itemsSubtotalAfterDiscount * (cart.discount_value / 100);
      } else {
        cartDiscountAmount = Math.min(cart.discount_value, itemsSubtotalAfterDiscount);
      }
    }

    // Calculate final total using local delivery cost
    const localDeliveryCostValue = parseFloat(deliveryCost) || 0;
    const finalTotal = Math.max(0, itemsSubtotalAfterDiscount - cartDiscountAmount - localDeliveryCostValue);

    return {
      itemsOriginalTotal,
      itemsTotalDiscount,
      itemsSubtotalAfterDiscount,
      cartDiscountAmount,
      deliveryCost: localDeliveryCostValue,
      finalTotal
    };
  }, [cart, localItemQuantities, deliveryCost]);

  const cartSummary = getLocalCartSummary();

  const savePendingChanges = useCallback(async () => {
    if (!cart || isSaving) return;

    const { hasChanges, changes } = getPendingChanges();
    if (!hasChanges) return;

    setIsSaving(true);

    try {
      // Save item quantity changes
      if (changes.itemChanges) {
        await Promise.all(
          changes.itemChanges.map(async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
            if (quantity === 0) {
              await removeCartItem(cart.id, itemId);
            } else {
              await updateCartItem(cart.id, itemId, { quantity });
            }
          })
        );
      }

      // Save cart-level changes (delivery cost, notes, discounts)
      const cartUpdates: any = {};
      if (changes.deliveryCost !== undefined) {
        const deliveryAmount = parseFloat(changes.deliveryCost) || 0;
        cartUpdates.delivery_cost = deliveryAmount;
      }
      if (changes.notes !== undefined) {
        cartUpdates.notes = changes.notes;
      }

      if (Object.keys(cartUpdates).length > 0) {
        await updateCart(cart.id, cartUpdates);
      }

      // Update initial state to reflect saved state
      const newItemQuantities = new Map(localItemQuantities);
      setInitialState({
        items: new Map(newItemQuantities),
        deliveryCost,
        notes,
        cartDiscount: changes.cartDiscount || initialState.cartDiscount,
        itemDiscounts: new Map(localItemDiscounts)
      });
    } catch (error) {
      console.error('Error saving changes:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [cart, isSaving, getPendingChanges, localItemQuantities, deliveryCost, notes, localItemDiscounts, initialState, updateCart, updateCartItem, removeCartItem]);

  const handleQuantityChange = useCallback((itemId: string, newQuantity: number) => {
    setLocalItemQuantities(prev => {
      const updated = new Map(prev);
      updated.set(itemId, newQuantity);
      return updated;
    });
  }, []);

  const handleItemDiscount = useCallback(async (itemId: string, discountType: 'percentage' | 'fixed', discountValue: number, discountScope: 'per_unit' | 'total' = 'total') => {
    if (!cart) return;

    // Close modal immediately to prevent flashing during cart refresh
    setShowDiscountModal(null);
    setUpdating(itemId);

    try {
      await applyItemDiscount(cart.id, itemId, discountType, discountValue, discountScope);
      setLocalItemDiscounts(prev => {
        const updated = new Map(prev);
        updated.set(itemId, { type: discountType, value: discountValue });
        return updated;
      });
    } catch (error) {
      console.error('Error applying discount:', error);
      Alert.alert('Error', 'Failed to apply discount');
    } finally {
      setUpdating(null);
    }
  }, [cart, applyItemDiscount]);

  const handleRemoveItemDiscount = useCallback(async (itemId: string) => {
    if (!cart) return;

    setUpdating(itemId);
    try {
      await removeItemDiscount(cart.id, itemId);
      setLocalItemDiscounts(prev => {
        const updated = new Map(prev);
        updated.delete(itemId);
        return updated;
      });
    } catch (error) {
      console.error('Error removing discount:', error);
      Alert.alert('Error', 'Failed to remove discount');
    } finally {
      setUpdating(null);
    }
  }, [cart, removeItemDiscount]);

  const handleCartDiscount = useCallback(async (discountType: 'percentage' | 'fixed', discountValue: number) => {
    if (!cart) return;

    // Close modal immediately to prevent flashing during cart refresh
    setShowCartDiscountModal(false);

    try {
      await updateCart(cart.id, {
        discount_type: discountType,
        discount_value: discountValue
      });
    } catch (error) {
      console.error('Error applying cart discount:', error);
      Alert.alert('Error', 'Failed to apply cart discount');
    }
  }, [cart, updateCart]);

  const handleRemoveCartDiscount = useCallback(async () => {
    if (!cart) return;
    
    try {
      await updateCart(cart.id, {
        discount_type: undefined,
        discount_value: undefined
      });
    } catch (error) {
      console.error('Error removing cart discount:', error);
      Alert.alert('Error', 'Failed to remove cart discount');
    }
  }, [cart, updateCart]);

  const handleDeliveryCostChange = useCallback((value: string) => {
    setDeliveryCost(value);
  }, []);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
  }, []);

  const handleCheckout = useCallback(async () => {
    if (!cart) return;

    const { hasChanges } = getPendingChanges();

    if (hasChanges) {
      try {
        await savePendingChanges();
        router.push(`/sales/checkout/${cartId}`);
      } catch (error) {
        // Error already handled in savePendingChanges
      }
    } else {
      router.push(`/sales/checkout/${cartId}`);
    }
  }, [cart, cartId, router, getPendingChanges, savePendingChanges]);

  const handleBack = useCallback(async () => {
    const { hasChanges } = getPendingChanges();

    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save before going back?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back()
          },
          {
            text: 'Save',
            onPress: async () => {
              try {
                await savePendingChanges();
                router.back();
              } catch (error) {
                // Error already handled in savePendingChanges
              }
            }
          }
        ]
      );
    } else {
      router.back();
    }
  }, [router, getPendingChanges, savePendingChanges]);

  const DiscountModal = ({ itemId, onApply, onCancel }: {
    itemId: string;
    onApply: (type: 'percentage' | 'fixed', value: number, scope: 'per_unit' | 'total') => void;
    onCancel: () => void;
  }) => {
    const item = cart?.items.find(i => i.id === itemId);

    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
      item?.item_discount_type || 'percentage'
    );
    const [discountValue, setDiscountValue] = useState(
      item?.item_discount_value ? item.item_discount_value.toString() : ''
    );
    const [discountScope, setDiscountScope] = useState<'per_unit' | 'total'>(
      item?.item_discount_scope || 'total'
    );

    // Initialize state only once when modal opens
    const itemIdRef = useRef(itemId);
    const hasInitialized = useRef(false);

    useEffect(() => {
      // Reset when opening modal for a different item
      if (itemIdRef.current !== itemId) {
        itemIdRef.current = itemId;
        hasInitialized.current = false;
      }

      // Initialize state once
      if (!hasInitialized.current && item) {
        hasInitialized.current = true;
        setDiscountType(item.item_discount_type || 'percentage');
        setDiscountValue(item.item_discount_value ? item.item_discount_value.toString() : '');
        setDiscountScope(item.item_discount_scope || 'total');
      }
    }, [itemId, item]);

    const handleApply = () => {
      const value = parseFloat(discountValue);
      if (isNaN(value) || value <= 0) {
        Alert.alert('Error', 'Please enter a valid discount value');
        return;
      }
      if (discountType === 'percentage' && value > 100) {
        Alert.alert('Error', 'Percentage discount cannot exceed 100%');
        return;
      }
      onApply(discountType, value, discountScope);
    };

    return (
      <View style={styles.modalOverlay}>
        <Card style={styles.discountModal}>
          <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Apply Discount
          </Text>

          <View style={styles.discountTypeButtons}>
            <TouchableOpacity
              style={[
                styles.discountTypeButton,
                {
                  backgroundColor: discountType === 'percentage' ? '#2563eb' : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: discountType === 'percentage' ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
                }
              ]}
              onPress={() => setDiscountType('percentage')}
            >
              <Percent size={16} color={discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />
              <Text style={[
                styles.discountTypeText,
                { color: discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
              ]}>
                Percentage
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.discountTypeButton,
                {
                  backgroundColor: discountType === 'fixed' ? '#2563eb' : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: discountType === 'fixed' ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
                }
              ]}
              onPress={() => setDiscountType('fixed')}
            >
              <DollarSign size={16} color={discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />
              <Text style={[
                styles.discountTypeText,
                { color: discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
              ]}>
                Fixed Amount
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.discountScopeSection}>
            <Text style={[styles.discountScopeLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t('sales.discountScope')}
            </Text>
            <View style={styles.discountScopeButtons}>
              <TouchableOpacity
                style={[styles.discountScopeButton, {
                  backgroundColor: discountScope === 'per_unit' ? '#10b981' : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: discountScope === 'per_unit' ? '#10b981' : (isDark ? '#4b5563' : '#d1d5db'),
                }]}
                onPress={() => setDiscountScope('per_unit')}
              >
                {discountScope === 'per_unit' && (
                  <Check size={14} color="#ffffff" style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.discountScopeButtonText, { color: discountScope === 'per_unit' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }]}>
                  {t('sales.perUnit')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.discountScopeButton, {
                  backgroundColor: discountScope === 'total' ? '#10b981' : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: discountScope === 'total' ? '#10b981' : (isDark ? '#4b5563' : '#d1d5db'),
                }]}
                onPress={() => setDiscountScope('total')}
              >
                {discountScope === 'total' && (
                  <Check size={14} color="#ffffff" style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.discountScopeButtonText, { color: discountScope === 'total' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }]}>
                  {t('sales.toTotal')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.discountScopeDescription, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {discountScope === 'per_unit' ? t('sales.perUnitDescription') : t('sales.toTotalDescription')}
            </Text>
          </View>

          <Input
            label={`Discount ${discountType === 'percentage' ? 'Percentage' : 'Amount'}`}
            value={discountValue}
            onChangeText={setDiscountValue}
            placeholder={discountType === 'percentage' ? '10' : '5.00'}
            keyboardType="decimal-pad"
          />

          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={onCancel}
              style={styles.modalButton}
            />
            <Button
              title="Apply"
              onPress={handleApply}
              style={styles.modalButton}
            />
          </View>
        </Card>
      </View>
    );
  }

  const CartDiscountModal = ({ onApply, onCancel }: {
    onApply: (type: 'percentage' | 'fixed', value: number) => void;
    onCancel: () => void;
  }) => {
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
      cart?.discount_type || 'percentage'
    );
    const [discountValue, setDiscountValue] = useState(
      cart?.discount_value ? cart.discount_value.toString() : ''
    );

    const handleApply = () => {
      const value = parseFloat(discountValue);
      if (isNaN(value) || value <= 0) {
        Alert.alert('Error', 'Please enter a valid discount value');
        return;
      }
      if (discountType === 'percentage' && value > 100) {
        Alert.alert('Error', 'Percentage discount cannot exceed 100%');
        return;
      }
      onApply(discountType, value);
    };

    return (
      <View style={styles.modalOverlay}>
        <Card style={styles.discountModal}>
          <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Cart Discount
          </Text>
          
          <View style={styles.discountTypeButtons}>
            <TouchableOpacity
              style={[
                styles.discountTypeButton,
                {
                  backgroundColor: discountType === 'percentage' ? '#2563eb' : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: discountType === 'percentage' ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
                }
              ]}
              onPress={() => setDiscountType('percentage')}
            >
              <Percent size={16} color={discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />
              <Text style={[
                styles.discountTypeText,
                { color: discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
              ]}>
                Percentage
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.discountTypeButton,
                {
                  backgroundColor: discountType === 'fixed' ? '#2563eb' : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: discountType === 'fixed' ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
                }
              ]}
              onPress={() => setDiscountType('fixed')}
            >
              <DollarSign size={16} color={discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />
              <Text style={[
                styles.discountTypeText,
                { color: discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
              ]}>
                Fixed Amount
              </Text>
            </TouchableOpacity>
          </View>
          
          <Input
            label={`Discount ${discountType === 'percentage' ? 'Percentage' : 'Amount'}`}
            value={discountValue}
            onChangeText={setDiscountValue}
            placeholder={discountType === 'percentage' ? '10' : '5.00'}
            keyboardType="decimal-pad"
          />
          
          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={onCancel}
              style={styles.modalButton}
            />
            <Button
              title="Apply"
              onPress={handleApply}
              style={styles.modalButton}
            />
          </View>
        </Card>
      </View>
    );
  }

  if (!cart || !cartSummary) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Cart Not Found
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            The cart you're looking for doesn't exist or has been deleted.
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Shopping Cart
        </Text>
        <View style={styles.headerRight}>
          {getPendingChanges().hasChanges && (
            <View style={styles.pendingBadge}>
              <Save size={14} color="#ffffff" />
            </View>
          )}
        </View>
      </View>

      {/* Customer Info */}
      <Card style={styles.customerInfo}>
        <Text style={[styles.customerLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Customer:
        </Text>
        <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {cart.customer_name}
        </Text>
      </Card>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <Card style={styles.itemsCard}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.itemsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Items ({cart.items?.length || 0})
            </Text>
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => router.push(`/sales/product-selection?cartId=${cartId}`)}
            >
              <Plus size={16} color="#2563eb" />
              <Text style={styles.addMoreText}>Add More</Text>
            </TouchableOpacity>
          </View>

          {cart.items?.map((item) => {
            const displayQuantity = localItemQuantities.get(item.id) ?? item.quantity;
            const initialQuantity = initialState.items.get(item.id) || 0;
            const availableStock = stockLookup.get(item.product_id) || 0;

            // Calculate subtotal properly based on discount scope
            const originalSubtotal = displayQuantity * item.unit_price;
            let itemDiscountAmount = 0;

            if (item.item_discount_type && item.item_discount_value) {
              const discountScope = item.item_discount_scope || 'total';

              if (item.item_discount_type === 'percentage') {
                if (discountScope === 'per_unit') {
                  itemDiscountAmount = (item.unit_price * (item.item_discount_value / 100)) * displayQuantity;
                } else {
                  itemDiscountAmount = originalSubtotal * (item.item_discount_value / 100);
                }
              } else if (item.item_discount_type === 'fixed') {
                if (discountScope === 'per_unit') {
                  itemDiscountAmount = Math.min(item.item_discount_value, item.unit_price) * displayQuantity;
                } else {
                  itemDiscountAmount = Math.min(item.item_discount_value, originalSubtotal);
                }
              }
            }

            const subtotal = originalSubtotal - itemDiscountAmount;

            return (
              <CartItem
                key={item.id}
                itemId={item.id}
                productId={item.product_id}
                productName={item.product_name}
                unitPrice={item.unit_price}
                quantity={displayQuantity}
                originalSubtotal={originalSubtotal}
                subtotal={subtotal}
                itemDiscountType={item.item_discount_type}
                itemDiscountValue={item.item_discount_value}
                itemDiscountScope={item.item_discount_scope}
                initialQuantity={initialQuantity}
                availableStock={availableStock}
                onQuantityChange={handleQuantityChange}
                onShowDiscount={setShowDiscountModal}
                onRemoveDiscount={handleRemoveItemDiscount}
                isUpdating={updating === item.id}
              />
            );
          })}
        </Card>

        {/* Cart Discount */}
        <Card style={styles.discountCard}>
          <View style={styles.discountHeader}>
            <Text style={[styles.discountTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Cart Discount
            </Text>
            <TouchableOpacity
              style={styles.addDiscountButton}
              onPress={() => setShowCartDiscountModal(true)}
            >
              <Percent size={16} color="#8b5cf6" />
              <Text style={styles.addDiscountText}>
                {cart.discount_type ? 'Edit' : 'Add'} Discount
              </Text>
            </TouchableOpacity>
          </View>

          {cart.discount_type && (
            <View style={styles.appliedDiscount}>
              <View style={styles.discountInfo}>
                <Text style={[styles.discountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {cart.discount_type === 'percentage' ? 'Percentage:' : 'Fixed Amount:'}
                </Text>
                <Text style={[styles.discountValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {cart.discount_type === 'percentage' 
                    ? `${cart.discount_value}%`
                    : formatPrice(cart.discount_value)
                  }
                </Text>
              </View>
              {cartSummary?.cartDiscountAmount > 0 && (
                <View style={styles.discountInfo}>
                  <Text style={[styles.discountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Discount Amount:
                  </Text>
                  <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                    -{formatPrice(cartSummary.cartDiscountAmount)}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeDiscountButton}
                onPress={handleRemoveCartDiscount}
              >
                <Trash2 size={14} color="#dc2626" />
                <Text style={styles.removeDiscountText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Delivery Information */}
        <Card style={styles.deliveryCard}>
          <View style={styles.deliveryHeader}>
            <View style={styles.sectionTitleContainer}>
              <Truck size={20} color="#ea580c" />
              <Text style={[styles.deliveryTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Delivery Information
              </Text>
            </View>
          </View>

          <View style={styles.deliveryCostContainer}>
            <Text style={[styles.deliveryLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
              Delivery Cost
            </Text>
            <View style={[styles.deliveryCostInput, { 
              backgroundColor: isDark ? '#374151' : '#f9fafb',
              borderColor: isDark ? '#4b5563' : '#d1d5db'
            }]}>
              <DollarSign size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <TextInput
                style={[styles.deliveryCostTextInput, { color: isDark ? '#f9fafb' : '#111827' }]}
                value={deliveryCost}
                onChangeText={handleDeliveryCostChange}
                placeholder="0.00"
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.notesContainer}>
            <Text style={[styles.deliveryLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
              Notes
            </Text>
            <TextInput
              style={[styles.notesInput, {
                backgroundColor: isDark ? '#374151' : '#f9fafb',
                borderColor: isDark ? '#4b5563' : '#d1d5db',
                color: isDark ? '#f9fafb' : '#111827'
              }]}
              value={notes}
              onChangeText={handleNotesChange}
              placeholder="Delivery address, special instructions, etc."
              placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </Card>

        {/* Order Summary */}
        {cartSummary && (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Order Summary
              </Text>
              {currencies.length > 1 && (
                <View style={styles.currencyPills}>
                  {currencies.map(c => {
                    const isSelected = (displayCurrencyId ?? defaultCurrency?.id) === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.currencyPill,
                          isSelected
                            ? { backgroundColor: '#2563eb' }
                            : { backgroundColor: isDark ? '#374151' : '#e5e7eb' },
                        ]}
                        onPress={() => setDisplayCurrencyId(c.id)}
                      >
                        <Text style={[styles.currencyPillText, { color: isSelected ? '#fff' : (isDark ? '#d1d5db' : '#374151') }]}>
                          {c.code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Items Subtotal:
              </Text>
              <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {displayAmount(cartSummary.itemsOriginalTotal)}
              </Text>
            </View>

            {cartSummary.itemsTotalDiscount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Item Discounts:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -{displayAmount(cartSummary.itemsTotalDiscount)}
                </Text>
              </View>
            )}

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Subtotal after Item Discounts:
              </Text>
              <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {displayAmount(cartSummary.itemsSubtotalAfterDiscount)}
              </Text>
            </View>

            {cartSummary.cartDiscountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Cart Discount:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -{displayAmount(cartSummary.cartDiscountAmount)}
                </Text>
              </View>
            )}

            {cartSummary.deliveryCost > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Delivery Cost:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -{displayAmount(cartSummary.deliveryCost)}
                </Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Total:
              </Text>
              <Text style={[styles.totalValue, { color: '#059669' }]}>
                {displayAmount(cartSummary.finalTotal)}
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Checkout Button */}
      <View style={styles.footer}>
        <Button
          title={getPendingChanges().hasChanges ? `Save & Checkout ${displayAmount(cartSummary?.finalTotal ?? 0)}` : `Checkout ${displayAmount(cartSummary?.finalTotal ?? 0)}`}
          onPress={handleCheckout}
          loading={isSaving}
          disabled={!cart || cart.items.length === 0 || isSaving}
          style={styles.checkoutButton}
        />
      </View>

      {/* Item Discount Modal */}
      {showDiscountModal && (
        <DiscountModal
          itemId={showDiscountModal}
          onApply={(type, value, scope) => handleItemDiscount(showDiscountModal, type, value, scope)}
          onCancel={() => setShowDiscountModal(null)}
        />
      )}

      {/* Cart Discount Modal */}
      {showCartDiscountModal && (
        <CartDiscountModal
          onApply={handleCartDiscount}
          onCancel={() => setShowCartDiscountModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changedBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ea580c',
    marginLeft: 4,
  },
  changedBadgeText: {
    color: '#ea580c',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
  },
  customerLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  itemsCard: {
    padding: 16,
    marginBottom: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addMoreText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
    marginLeft: 4,
  },
  discountCard: {
    padding: 16,
    marginBottom: 16,
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  discountTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addDiscountButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addDiscountText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
    marginLeft: 4,
  },
  appliedDiscount: {
    backgroundColor: '#8b5cf610',
    borderRadius: 8,
    padding: 12,
  },
  discountInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  discountLabel: {
    fontSize: 14,
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  discountAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeDiscountText: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 4,
  },
  deliveryCard: {
    padding: 16,
    marginBottom: 16,
  },
  deliveryHeader: {
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deliveryCostContainer: {
    marginBottom: 16,
  },
  deliveryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  deliveryCostInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    position: 'relative',
  },
  deliveryCostTextInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  updatingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    position: 'absolute',
    right: 12,
  },
  notesContainer: {
    marginBottom: 8,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saveStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  currencyPills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  currencyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  checkoutButton: {
    backgroundColor: '#059669',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  discountModal: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  discountTypeButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  discountTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  discountTypeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  discountScopeSection: {
    marginBottom: 16,
  },
  discountScopeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  discountScopeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  discountScopeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  discountScopeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  discountScopeDescription: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 120,
  },
});