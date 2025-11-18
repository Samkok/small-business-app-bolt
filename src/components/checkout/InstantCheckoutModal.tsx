import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  FlatList,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useInstantCheckout } from '@/src/context/InstantCheckoutContext';
import { instantCheckoutService } from '@/src/services/instantCheckout';
import { useRouter } from 'expo-router';
import { X, CreditCard, Plus, Percent, DollarSign, Truck, Tag, Check, Barcode } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import Input from '@/src/components/ui/Input';
import { Button } from '../ui/Button';
import { InstantCheckoutProductList } from './InstantCheckoutProductList';
import { InstantCheckoutCustomerSelector } from './InstantCheckoutCustomerSelector';
import { InstantCheckoutSummary } from './InstantCheckoutSummary';
import BarcodeScanner from '../inventory/BarcodeScanner';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Other' },
] as const;

export function InstantCheckoutModal() {
  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();
  const {
    session,
    isModalOpen,
    guestCustomer,
    updateQuantity,
    removeProduct,
    setCustomer,
    setPaymentMethod,
    getSessionSummary,
    clearSession,
    closeModal,
    addProduct,
    applyItemDiscount,
    removeItemDiscount,
    applyCartDiscount,
    removeCartDiscount,
    setDeliveryCost,
  } = useInstantCheckout();

  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showItemDiscountModal, setShowItemDiscountModal] = useState(false);
  const [showCartDiscountModal, setShowCartDiscountModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedItemForDiscount, setSelectedItemForDiscount] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  useEffect(() => {
    if (session?.delivery_cost) {
      setDeliveryFee(session.delivery_cost.toString());
    }
  }, [session?.delivery_cost]);

  useEffect(() => {
    if (showProductSelector && currentBusiness?.id) {
      loadProducts();
    }
  }, [showProductSelector, currentBusiness?.id]);

  const loadProducts = async () => {
    if (!currentBusiness?.id) return;

    setLoadingProducts(true);
    try {
      const productsData = await productService.getInStockProducts(currentBusiness.id);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddProduct = (product: any) => {
    addProduct(product, 1);
    setShowProductSelector(false);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const product = products.find(p => p.barcode === barcode);

      if (product) {
        if (product.current_stock <= 0) {
          Alert.alert('Out of Stock', `${product.name} is currently out of stock.`);
          return;
        }

        addProduct(product, 1);
        setShowBarcodeScanner(false);
        Alert.alert('Success', `Added ${product.name} to checkout`);
      } else {
        Alert.alert('Not Found', 'Product with this barcode was not found.');
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert('Error', 'Failed to process barcode scan');
    }
  };

  const handleApplyItemDiscount = () => {
    if (!selectedItemForDiscount || !discountValue) {
      Alert.alert('Error', 'Please enter discount value');
      return;
    }

    const value = parseFloat(discountValue);
    if (isNaN(value) || value < 0) {
      Alert.alert('Error', 'Please enter a valid discount value');
      return;
    }

    applyItemDiscount(selectedItemForDiscount, discountType, value);
    setShowItemDiscountModal(false);
    setSelectedItemForDiscount(null);
    setDiscountValue('');
  };

  const handleApplyCartDiscount = () => {
    if (!discountValue) {
      Alert.alert('Error', 'Please enter discount value');
      return;
    }

    const value = parseFloat(discountValue);
    if (isNaN(value) || value < 0) {
      Alert.alert('Error', 'Please enter a valid discount value');
      return;
    }

    applyCartDiscount(discountType, value);
    setShowCartDiscountModal(false);
    setDiscountValue('');
  };

  const handleApplyDeliveryFee = () => {
    if (!deliveryFee) {
      setDeliveryCost(0);
      setShowDeliveryModal(false);
      return;
    }

    const fee = parseFloat(deliveryFee);
    if (isNaN(fee) || fee < 0) {
      Alert.alert('Error', 'Please enter a valid delivery fee');
      return;
    }

    setDeliveryCost(fee);
    setShowDeliveryModal(false);
  };

  const handleClose = () => {
    if (session && session.items.length > 0) {
      Alert.alert(
        'Close Checkout?',
        'Do you want to save this as a draft cart or discard?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              clearSession();
              closeModal();
            },
          },
          {
            text: 'Save as Draft',
            onPress: handleSaveToDraft,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } else {
      closeModal();
    }
  };

  const handleCompleteSale = async () => {
    if (!session || !currentBusiness?.id || !user?.id || !guestCustomer?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (!session.payment_method) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    const validation = instantCheckoutService.validateCheckoutSession(session);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }

    setCompleting(true);
    try {
      const result = await instantCheckoutService.completeInstantCheckout({
        session,
        businessId: currentBusiness.id,
        userId: user.id,
        guestCustomerId: guestCustomer.id,
      });

      if (result.success) {
        Alert.alert('Success', 'Sale completed successfully!', [
          {
            text: 'View Sale',
            onPress: () => {
              clearSession();
              closeModal();
              if (result.saleId) {
                router.push(`/(app)/(tabs)/sales/details/${result.saleId}`);
              }
            },
          },
          {
            text: 'New Sale',
            onPress: () => {
              clearSession();
              closeModal();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to complete sale');
      }
    } catch (error) {
      console.error('Failed to complete sale:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setCompleting(false);
    }
  };

  const handleSaveToDraft = async () => {
    if (!session || !currentBusiness?.id || !user?.id || !guestCustomer?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setSaving(true);
    try {
      const result = await instantCheckoutService.saveToDraftCart({
        session,
        businessId: currentBusiness.id,
        userId: user.id,
        guestCustomerId: guestCustomer.id,
      });

      if (result.success) {
        Alert.alert('Success', 'Draft cart saved!', [
          {
            text: 'View Cart',
            onPress: () => {
              clearSession();
              closeModal();
              if (result.cartId) {
                router.push(`/(app)/(tabs)/sales/cart/${result.cartId}`);
              }
            },
          },
          {
            text: 'OK',
            onPress: () => {
              clearSession();
              closeModal();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to save draft cart');
      }
    } catch (error) {
      console.error('Failed to save draft cart:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const summary = getSessionSummary();

  if (!isModalOpen) return null;

  return (
    <Modal
      visible={isModalOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}>
        <View style={[styles.header, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
          <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Quick Checkout
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Products
              </Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: '#2563eb' }]}
                onPress={() => setShowProductSelector(true)}
              >
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Add Product</Text>
              </TouchableOpacity>
            </View>
            <InstantCheckoutProductList
              items={session?.items || []}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeProduct}
              onApplyDiscount={(productId) => {
                setSelectedItemForDiscount(productId);
                setDiscountType('percentage');
                setDiscountValue('');
                setShowItemDiscountModal(true);
              }}
              onRemoveDiscount={removeItemDiscount}
            />
          </View>

          {/* Discount and Delivery Actions */}
          <View style={styles.section}>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }]}
                onPress={() => {
                  setDiscountType('percentage');
                  setDiscountValue('');
                  setShowCartDiscountModal(true);
                }}
              >
                <Tag size={20} color="#10b981" />
                <Text style={[styles.actionButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {session?.cart_discount_value ? 'Edit Discount' : 'Add Discount'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }]}
                onPress={() => {
                  setDeliveryFee(session?.delivery_cost?.toString() || '');
                  setShowDeliveryModal(true);
                }}
              >
                <Truck size={20} color="#f59e0b" />
                <Text style={[styles.actionButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {session?.delivery_cost ? 'Edit Delivery' : 'Add Delivery'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {guestCustomer && (
            <View style={styles.section}>
              <InstantCheckoutCustomerSelector
                selectedCustomerId={session?.customer_id}
                guestCustomerId={guestCustomer.id}
                onSelectCustomer={setCustomer}
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Payment Method
            </Text>
            <View style={styles.paymentMethods}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentMethod,
                    {
                      backgroundColor: isDark ? '#1f2937' : '#ffffff',
                      borderColor:
                        session?.payment_method === method.value
                          ? '#2563eb'
                          : isDark
                          ? '#374151'
                          : '#e5e7eb',
                      borderWidth: session?.payment_method === method.value ? 2 : 1,
                    },
                  ]}
                  onPress={() => setPaymentMethod(method.value)}
                >
                  <CreditCard
                    size={20}
                    color={
                      session?.payment_method === method.value
                        ? '#2563eb'
                        : isDark
                        ? '#d1d5db'
                        : '#6b7280'
                    }
                  />
                  <Text
                    style={[
                      styles.paymentMethodText,
                      { color: isDark ? '#f9fafb' : '#111827' },
                    ]}
                  >
                    {method.label}
                  </Text>
                  {session?.payment_method === method.value && (
                    <Check size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <InstantCheckoutSummary summary={summary} />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              borderTopColor: isDark ? '#374151' : '#e5e7eb',
            },
          ]}
        >
          <Button
            title="Save as Draft"
            onPress={handleSaveToDraft}
            variant="secondary"
            loading={saving}
            style={styles.footerButton}
          />
          <Button
            title="Complete Sale"
            onPress={handleCompleteSale}
            loading={completing}
            disabled={!session?.items || session.items.length === 0}
            style={styles.footerButton}
          />
        </View>
      </View>

      {/* Product Selector Modal */}
      <Modal
        visible={showProductSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProductSelector(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Product
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowBarcodeScanner(true)}
                style={styles.headerButton}
              >
                <Barcode size={24} color={isDark ? '#f9fafb' : '#111827'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowProductSelector(false)}>
                <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={[styles.searchInput, { backgroundColor: isDark ? '#1f2937' : '#f3f4f6', color: isDark ? '#f9fafb' : '#111827' }]}
            placeholder="Search products..."
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <FlatList
            data={products.filter(p =>
              p.name.toLowerCase().includes(searchQuery.toLowerCase())
            )}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.productItem, { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }]}
                onPress={() => handleAddProduct(item)}
              >
                <View style={styles.productItemInfo}>
                  <Text style={[styles.productItemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.productItemPrice, { color: '#059669' }]}>
                    ${item.price.toFixed(2)}
                  </Text>
                  <Text style={[styles.productItemStock, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                    Stock: {item.current_stock}
                  </Text>
                </View>
                <Plus size={24} color="#2563eb" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                {loadingProducts ? 'Loading products...' : 'No products available'}
              </Text>
            }
          />
        </View>
      </Modal>

      {/* Item Discount Modal */}
      <Modal
        visible={showItemDiscountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowItemDiscountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.discountModal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Apply Item Discount
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
                <Percent size={16} color={discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827')} />
                <Text style={[styles.discountTypeText, { color: discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }]}>
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
                <DollarSign size={16} color={discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827')} />
                <Text style={[styles.discountTypeText, { color: discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }]}>
                  Fixed Amount
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label={discountType === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder={discountType === 'percentage' ? 'Enter percentage' : 'Enter amount'}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowItemDiscountModal(false)}
                style={styles.modalButton}
              />
              <Button
                title="Apply"
                onPress={handleApplyItemDiscount}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Cart Discount Modal */}
      <Modal
        visible={showCartDiscountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCartDiscountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.discountModal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <View style={styles.discountModalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Apply Order Discount
              </Text>
              {session?.cart_discount_value && (
                <TouchableOpacity onPress={() => {
                  removeCartDiscount();
                  setShowCartDiscountModal(false);
                }}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

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
                <Percent size={16} color={discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827')} />
                <Text style={[styles.discountTypeText, { color: discountType === 'percentage' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }]}>
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
                <DollarSign size={16} color={discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827')} />
                <Text style={[styles.discountTypeText, { color: discountType === 'fixed' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }]}>
                  Fixed Amount
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label={discountType === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
              placeholder={discountType === 'percentage' ? 'Enter percentage' : 'Enter amount'}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowCartDiscountModal(false)}
                style={styles.modalButton}
              />
              <Button
                title="Apply"
                onPress={handleApplyCartDiscount}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delivery Fee Modal */}
      <Modal
        visible={showDeliveryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeliveryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.discountModal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <View style={styles.discountModalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Delivery Fee
              </Text>
              {session?.delivery_cost && session.delivery_cost > 0 && (
                <TouchableOpacity onPress={() => {
                  setDeliveryCost(0);
                  setDeliveryFee('');
                  setShowDeliveryModal(false);
                }}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <Input
              label="Delivery Fee ($)"
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              keyboardType="decimal-pad"
              placeholder="Enter delivery fee"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowDeliveryModal(false)}
                style={styles.modalButton}
              />
              <Button
                title="Apply"
                onPress={handleApplyDeliveryFee}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <BarcodeScanner
          onBarcodeScan={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
        />
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  searchInput: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  productItemInfo: {
    flex: 1,
  },
  productItemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  productItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  productItemStock: {
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    padding: 32,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  discountModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  discountTypeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  discountTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  discountTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
  },
  removeText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
