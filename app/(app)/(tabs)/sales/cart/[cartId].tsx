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
import { ArrowLeft, ShoppingCart, Plus, Minus, Percent, DollarSign, MapPin, Truck, Trash2, Check } from 'lucide-react-native';
import { useDebouncedCallback } from '@/src/hooks/useDebouncedCallback';

export default function CartScreen() {
  const [showDiscountModal, setShowDiscountModal] = useState<string | null>(null);
  const [showCartDiscountModal, setShowCartDiscountModal] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState('');
  const [notes, setNotes] = useState('');
  const [updatingDelivery, setUpdatingDelivery] = useState(false);
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isDeliveryCostFocused, setIsDeliveryCostFocused] = useState(false);
  const [pendingItemUpdates, setPendingItemUpdates] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Refs to track previous values and prevent unnecessary updates
  const deliveryCostUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevDeliveryCostRef = useRef<string>('');
  const prevNotesRef = useRef<string>('');
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const itemUpdateQueueRef = useRef<Map<string, { quantity?: number; timestamp: number }>>(new Map());
  
  const router = useRouter();
  const { cartId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { 
    getCart, 
    updateCart, 
    updateCartItem, 
    removeCartItem, 
    applyItemDiscount, 
    removeItemDiscount, 
    getCartSummary 
  } = useCart();

  // Get cart and summary
  const cart = getCart(cartId as string);
  const cartSummary = cart ? getCartSummary(cartId as string) : null;

  // Initialize local state from cart only once or when cart ID changes
  useEffect(() => {
    if (cart) {
      const cartDeliveryCost = cart.delivery_cost?.toString() || '';
      const cartNotes = cart.notes || '';

      // Only update if the cart values are different from our local state
      // and we're not currently focused on the input
      if (!isDeliveryCostFocused && prevDeliveryCostRef.current !== cartDeliveryCost) {
        setDeliveryCost(cartDeliveryCost);
        prevDeliveryCostRef.current = cartDeliveryCost;
      }

      if (prevNotesRef.current !== cartNotes) {
        setNotes(cartNotes);
        prevNotesRef.current = cartNotes;
      }
    }
  }, [cart?.id]); // Only re-run when cart ID changes

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (deliveryCostUpdateTimeoutRef.current) {
        clearTimeout(deliveryCostUpdateTimeoutRef.current);
      }
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, []);

  // Update cart total_amount when cartSummary changes
  // Use ref to prevent infinite loops
  const prevTotalRef = useRef<number | null>(null);

  useEffect(() => {
    if (cart && cartSummary) {
      const newTotal = cartSummary.finalTotal;

      // Only update if the total has actually changed
      if (prevTotalRef.current !== newTotal && cart.total_amount !== newTotal) {
        prevTotalRef.current = newTotal;
        updateCart(cart.id, { total_amount: newTotal }).catch(error => {
          console.error('Error updating cart total amount:', error);
        });
      }
    }
  }, [cartSummary?.finalTotal]); // Only watch the final total

  const processItemUpdate = useCallback(async (itemId: string, newQuantity: number) => {
    if (!cart) return;

    setPendingItemUpdates(prev => {
      const newSet = new Set(prev);
      newSet.add(itemId);
      return newSet;
    });

    try {
      if (newQuantity === 0) {
        await removeCartItem(cart.id, itemId);
      } else {
        await updateCartItem(cart.id, itemId, { quantity: newQuantity });
      }

      itemUpdateQueueRef.current.delete(itemId);
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    } finally {
      setPendingItemUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [cart, updateCartItem, removeCartItem]);

  const debouncedItemUpdate = useDebouncedCallback(processItemUpdate, 600);

  const handleQuantityChange = useCallback((itemId: string, change: number) => {
    if (!cart) return;

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + change);

    itemUpdateQueueRef.current.set(itemId, {
      quantity: newQuantity,
      timestamp: Date.now()
    });

    debouncedItemUpdate(itemId, newQuantity);
  }, [cart, debouncedItemUpdate]);

  const handleItemDiscount = useCallback(async (itemId: string, discountType: 'percentage' | 'fixed', discountValue: number) => {
    if (!cart) return;
    
    setUpdating(itemId);
    try {
      await applyItemDiscount(cart.id, itemId, discountType, discountValue);
      setShowDiscountModal(null);
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
    } catch (error) {
      console.error('Error removing discount:', error);
      Alert.alert('Error', 'Failed to remove discount');
    } finally {
      setUpdating(null);
    }
  }, [cart, removeItemDiscount]);

  const handleCartDiscount = useCallback(async (discountType: 'percentage' | 'fixed', discountValue: number) => {
    if (!cart) return;
    
    try {
      await updateCart(cart.id, {
        discount_type: discountType,
        discount_value: discountValue
      });
      setShowCartDiscountModal(false);
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

  const saveDeliveryCost = useCallback(async (value: string) => {
    if (!cart) return;

    setUpdatingDelivery(true);
    try {
      const deliveryAmount = parseFloat(value) || 0;
      prevDeliveryCostRef.current = value;
      await updateCart(cart.id, {
        delivery_cost: deliveryAmount
      });
    } catch (error) {
      console.error('Error updating delivery cost:', error);
      Alert.alert('Error', 'Failed to update delivery cost');
    } finally {
      setUpdatingDelivery(false);
    }
  }, [cart, updateCart]);

  const debouncedSaveDeliveryCost = useDebouncedCallback(saveDeliveryCost, 1000);

  const handleDeliveryCostChange = useCallback((value: string) => {
    setDeliveryCost(value);
    debouncedSaveDeliveryCost(value);
  }, [debouncedSaveDeliveryCost]);

  const handleDeliveryCostBlur = useCallback(() => {
    setIsDeliveryCostFocused(false);

    // Clear any pending timeout to trigger immediate update
    if (deliveryCostUpdateTimeoutRef.current) {
      clearTimeout(deliveryCostUpdateTimeoutRef.current);
      deliveryCostUpdateTimeoutRef.current = null;
    }

    // Format the delivery cost to show two decimal places
    if (deliveryCost) {
      const numValue = parseFloat(deliveryCost);
      const formattedValue = isNaN(numValue) ? '0.00' : numValue.toFixed(2);
      setDeliveryCost(formattedValue);
      prevDeliveryCostRef.current = formattedValue;

      // Update the cart with the formatted value
      if (cart) {
        const deliveryAmount = isNaN(numValue) ? 0 : numValue;
        setUpdatingDelivery(true);
        updateCart(cart.id, {
          delivery_cost: deliveryAmount
        }).catch(error => {
          console.error('Error updating delivery cost on blur:', error);
        }).finally(() => {
          setUpdatingDelivery(false);
        });
      }
    }
  }, [deliveryCost, cart, updateCart]);

  const saveNotesDebounced = useCallback(async (value: string) => {
    if (!cart) return;

    const trimmedNotes = value.trim() || undefined;

    if (prevNotesRef.current === (trimmedNotes || '')) {
      return;
    }

    prevNotesRef.current = trimmedNotes || '';
    setUpdatingNotes(true);
    setSaveStatus('saving');

    try {
      await updateCart(cart.id, {
        notes: trimmedNotes
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error updating notes:', error);
      setSaveStatus('idle');
    } finally {
      setUpdatingNotes(false);
    }
  }, [cart, updateCart]);

  const debouncedSaveNotes = useDebouncedCallback(saveNotesDebounced, 2000);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    debouncedSaveNotes(value);
  }, [debouncedSaveNotes]);

  const handleSaveNotes = useCallback(async () => {
    if (!cart) return;

    const trimmedNotes = notes.trim() || undefined;

    if (prevNotesRef.current === (trimmedNotes || '')) {
      return;
    }

    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
      notesTimeoutRef.current = null;
    }

    await saveNotesDebounced(notes);
  }, [cart, notes, saveNotesDebounced]);

  const handleCheckout = useCallback(() => {
    if (!cart) return;
    
    // Save notes before checkout if they've changed
    if (notes !== cart.notes) {
      handleSaveNotes();
    }
    
    router.push(`/sales/checkout/${cartId}`);
  }, [cart, notes, cartId, router, handleSaveNotes]);

  const DiscountModal = ({ itemId, onApply, onCancel }: {
    itemId: string;
    onApply: (type: 'percentage' | 'fixed', value: number) => void;
    onCancel: () => void;
  }) => {
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState('');

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
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Shopping Cart
        </Text>
        <View style={styles.headerRight} />
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
            const isPending = pendingItemUpdates.has(item.id);
            const queuedUpdate = itemUpdateQueueRef.current.get(item.id);
            const displayQuantity = queuedUpdate?.quantity ?? item.quantity;

            return (
              <View key={item.id} style={styles.cartItem}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameRow}>
                    <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {item.product_name}
                    </Text>
                    {isPending && (
                      <View style={styles.syncBadge}>
                        <Text style={styles.syncBadgeText}>Syncing...</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.itemPrice, { color: '#059669' }]}>
                    ${item.unit_price.toFixed(2)} each
                  </Text>
                  {item.item_discount_type && (
                    <View style={styles.itemDiscountInfo}>
                      <Text style={[styles.itemDiscountText, { color: '#dc2626' }]}>
                        {item.item_discount_type === 'percentage'
                          ? `${item.item_discount_value}% off`
                          : `$${item.item_discount_value} off`
                        }
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveItemDiscount(item.id)}
                        style={styles.removeDiscountButton}
                      >
                        <Trash2 size={12} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.itemControls}>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={[styles.quantityButton, { backgroundColor: '#dc2626' }]}
                      onPress={() => handleQuantityChange(item.id, -1)}
                      disabled={updating === item.id}
                    >
                      <Minus size={16} color="#ffffff" />
                    </TouchableOpacity>

                    <Text style={[styles.quantityText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {displayQuantity}
                    </Text>

                    <TouchableOpacity
                      style={[styles.quantityButton, { backgroundColor: '#2563eb' }]}
                      onPress={() => handleQuantityChange(item.id, 1)}
                      disabled={updating === item.id}
                    >
                      <Plus size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.discountButton}
                    onPress={() => setShowDiscountModal(item.id)}
                  >
                    <Percent size={14} color="#8b5cf6" />
                  </TouchableOpacity>
                </View>

                <View style={styles.itemTotal}>
                  {item.original_subtotal > item.subtotal && (
                    <Text style={[styles.originalPrice, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                      ${item.original_subtotal.toFixed(2)}
                    </Text>
                  )}
                  <Text style={[styles.itemSubtotal, { color: '#059669' }]}>
                    ${item.subtotal.toFixed(2)}
                  </Text>
                </View>
              </View>
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
                    : `$${cart.discount_value?.toFixed(2)}`
                  }
                </Text>
              </View>
              {cartSummary?.cartDiscountAmount > 0 && (
                <View style={styles.discountInfo}>
                  <Text style={[styles.discountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Discount Amount:
                  </Text>
                  <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                    -${cartSummary.cartDiscountAmount.toFixed(2)}
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
                onFocus={() => setIsDeliveryCostFocused(true)}
                onBlur={handleDeliveryCostBlur}
              />
              {updatingDelivery && (
                <View style={styles.updatingIndicator} />
              )}
            </View>
          </View>

          <View style={styles.notesContainer}>
            <View style={styles.notesHeader}>
              <Text style={[styles.deliveryLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                Notes
              </Text>
              {saveStatus === 'saving' && (
                <Text style={[styles.saveStatusText, { color: '#9ca3af' }]}>Saving...</Text>
              )}
              {saveStatus === 'saved' && (
                <View style={styles.savedIndicator}>
                  <Check size={14} color="#059669" />
                  <Text style={[styles.saveStatusText, { color: '#059669' }]}>Saved</Text>
                </View>
              )}
            </View>
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
              onBlur={handleSaveNotes}
            />
          </View>
        </Card>

        {/* Order Summary */}
        {cartSummary && (
          <Card style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Order Summary
            </Text>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Items Subtotal:
              </Text>
              <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${cartSummary.itemsOriginalTotal.toFixed(2)}
              </Text>
            </View>
            
            {cartSummary.itemsTotalDiscount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Item Discounts:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -${cartSummary.itemsTotalDiscount.toFixed(2)}
                </Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Subtotal after Item Discounts:
              </Text>
              <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${cartSummary.itemsSubtotalAfterDiscount.toFixed(2)}
              </Text>
            </View>
            
            {cartSummary.cartDiscountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Cart Discount:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -${cartSummary.cartDiscountAmount.toFixed(2)}
                </Text>
              </View>
            )}
            
            {cartSummary.deliveryCost > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Delivery Cost:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -${cartSummary.deliveryCost.toFixed(2)}
                </Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Total:
              </Text>
              <Text style={[styles.totalValue, { color: '#059669' }]}>
                ${cartSummary.finalTotal.toFixed(2)}
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Checkout Button */}
      <View style={styles.footer}>
        <Button
          title={`Checkout $${cartSummary?.finalTotal.toFixed(2) || '0.00'}`}
          onPress={handleCheckout}
          style={styles.checkoutButton}
          disabled={!cart || cart.items.length === 0}
        />
      </View>

      {/* Item Discount Modal */}
      {showDiscountModal && (
        <DiscountModal
          itemId={showDiscountModal}
          onApply={(type, value) => handleItemDiscount(showDiscountModal, type, value)}
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
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  syncBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  syncBadgeText: {
    fontSize: 9,
    color: '#2563eb',
    fontWeight: '500',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 12,
    marginBottom: 2,
  },
  itemDiscountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDiscountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  removeDiscountButton: {
    marginLeft: 6,
    padding: 2,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    width: 30,
    textAlign: 'center',
  },
  discountButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf620',
  },
  itemTotal: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: 'bold',
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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