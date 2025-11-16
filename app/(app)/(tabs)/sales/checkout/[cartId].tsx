import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { ArrowLeft, CreditCard, DollarSign, Check, FileText, Calendar } from 'lucide-react-native';

export default function CheckoutScreen() {
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'other'>('cash');
  const [notes, setNotes] = useState('');
  const [saleDate, setSaleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const router = useRouter();
  const { cartId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { getCart, getCartSummary, completeSale } = useCart();

  // Get cart and summary
  const cart = getCart(cartId as string);
  const cartSummary = cart ? getCartSummary(cartId as string) : null;

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: '💵' },
    { value: 'card', label: 'Card', icon: '💳' },
    { value: 'transfer', label: 'Transfer', icon: '🏦' },
    { value: 'other', label: 'Other', icon: '💰' },
  ];

  const handleCompleteSale = useCallback(async () => {
    if (!currentBusiness?.id || !cartId || !cart) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (cart.items.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    setProcessing(true);
    try {
      // Generate automatic remark if sale date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(saleDate);
      selectedDate.setHours(0, 0, 0, 0);

      let finalNotes = notes;
      if (selectedDate < today) {
        const addedDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const remarkText = `Added from ${addedDate}`;
        finalNotes = notes ? `${notes}\n${remarkText}` : remarkText;
      }

      const result = await completeSale(cartId as string, paymentMethod, saleDate.toISOString(), finalNotes);
      
      if (result.success) {
        Alert.alert(
          'Sale Completed',
          'The sale has been successfully completed!',
          [
            { 
              text: 'OK', 
              onPress: () => router.replace('/sales')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to complete sale');
      }
    } catch (error) {
      console.error('Error completing sale:', error);
      Alert.alert('Error', 'Failed to complete sale');
    } finally {
      setProcessing(false);
    }
  }, [currentBusiness?.id, cartId, cart, paymentMethod, saleDate, notes, completeSale, router]);

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
          Checkout
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <Card style={styles.summaryCard}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Order Summary
          </Text>
          
          <View style={styles.customerRow}>
            <Text style={[styles.customerLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Customer:
            </Text>
            <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {cart.customer_name}
            </Text>
          </View>
          
          <View style={styles.itemsContainer}>
            {cart.items?.map((item) => (
              <View key={item.id} style={styles.summaryItem}>
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemQuantity, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {item.quantity}x
                  </Text>
                  <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {item.product_name}
                  </Text>
                </View>
                <View style={styles.itemPricing}>
                  {item.original_subtotal > item.subtotal && (
                    <Text style={[styles.originalPrice, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                      ${item.original_subtotal.toFixed(2)}
                    </Text>
                  )}
                  <Text style={[styles.itemSubtotal, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    ${item.subtotal.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Items Subtotal:
            </Text>
            <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              ${cartSummary?.itemsOriginalTotal.toFixed(2)}
            </Text>
          </View>
          
          {cartSummary?.itemsTotalDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Item Discounts:
              </Text>
              <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                -${cartSummary.itemsTotalDiscount.toFixed(2)}
              </Text>
            </View>
          )}
          
          {cartSummary?.cartDiscountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Cart Discount:
              </Text>
              <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                -${cartSummary.cartDiscountAmount.toFixed(2)}
              </Text>
            </View>
          )}
          
          {cartSummary?.deliveryCost > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Delivery Cost:
              </Text>
              <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${cartSummary.deliveryCost.toFixed(2)}
              </Text>
            </View>
          )}
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Total:
            </Text>
            <Text style={[styles.totalValue, { color: '#059669' }]}>
              ${cartSummary?.finalTotal.toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Sale Date */}
        <Card style={styles.dateCard}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color="#8b5cf6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827', marginBottom: 0 }]}>
              Sale Date
            </Text>
          </View>

          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <Input
              label="Sale Date"
              value={saleDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              editable={false}
              placeholder="Select sale date"
            />
          </TouchableOpacity>

          {saleDate.toDateString() !== new Date().toDateString() && (
            <View style={styles.dateWarning}>
              <Text style={[styles.dateWarningText, { color: '#d97706' }]}>
                ⚠️ This sale will be recorded for {saleDate.toLocaleDateString()}
              </Text>
            </View>
          )}
        </Card>

        {/* Payment Method */}
        <Card style={styles.paymentCard}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Payment Method
          </Text>
          
          <View style={styles.paymentGrid}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.paymentMethod,
                  {
                    backgroundColor: paymentMethod === method.value 
                      ? '#2563eb' 
                      : (isDark ? '#374151' : '#f3f4f6'),
                    borderColor: paymentMethod === method.value 
                      ? '#2563eb' 
                      : (isDark ? '#4b5563' : '#d1d5db'),
                  }
                ]}
                onPress={() => setPaymentMethod(method.value as any)}
              >
                <Text style={styles.paymentIcon}>{method.icon}</Text>
                <Text style={[
                  styles.paymentLabel,
                  { color: paymentMethod === method.value ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }
                ]}>
                  {method.label}
                </Text>
                {paymentMethod === method.value && (
                  <View style={styles.selectedIndicator}>
                    <Check size={16} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Additional Notes */}
        <Card style={styles.notesCard}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Additional Notes
          </Text>
          
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes about this sale"
            multiline
            numberOfLines={3}
          />
        </Card>
      </ScrollView>

      {/* Complete Sale Button */}
      <View style={styles.footer}>
        <Button
          title={`Complete Sale - $${cartSummary?.finalTotal.toFixed(2)}`}
          onPress={handleCompleteSale}
          loading={processing}
          style={styles.completeButton}
        />
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.datePickerContainer}>
            <Text style={[styles.datePickerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Sale Date
            </Text>

            <DateRangePicker
              startDate={saleDate}
              endDate={saleDate}
              onConfirm={(start) => {
                setSaleDate(start);
                setShowDatePicker(false);
              }}
              onCancel={() => setShowDatePicker(false)}
            />
          </Card>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customerLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemsContainer: {
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    marginRight: 8,
    minWidth: 30,
  },
  itemName: {
    fontSize: 14,
    flex: 1,
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
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
  discountAmount: {
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
  paymentCard: {
    padding: 16,
    marginBottom: 16,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  paymentMethod: {
    width: '48%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  paymentIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesCard: {
    padding: 16,
    marginBottom: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  completeButton: {
    backgroundColor: '#059669',
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
  dateCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dateWarning: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
  },
  dateWarningText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerContainer: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
});