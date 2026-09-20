import React, { useState, useCallback, useRef } from 'react';
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
import { useSubscription } from '@/src/context/SubscriptionContext';
import { useNetwork } from '@/src/context/NetworkContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import SingleDatePicker from '@/src/components/ui/SingleDatePicker';
import { UpgradePrompt } from '@/src/components/subscription/UpgradePrompt';
import { ArrowLeft, CreditCard, DollarSign, Check, FileText, Calendar, WifiOff } from 'lucide-react-native';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { useCurrency } from '@/src/hooks/useCurrency';
import { SaleMarginCard } from '@/src/components/sales/SaleMarginCard';
import { computeSaleMargin } from '@/src/utils/saleMargin';
import { PostSaleActionModal } from '@/src/components/sales/PostSaleActionModal';
import { ReceiptInput } from '@/src/utils/receipt';
import { receiptDraftStore } from '@/src/utils/receiptDraft';
import { useTranslation } from 'react-i18next';
import { PaymentStatusSelector } from '@/src/components/sales/PaymentStatusSelector';
import { PaymentStatus } from '@/src/utils/paymentStatus';

export default function CheckoutScreen() {
  const [processing, setProcessing] = useState(false);
  // Set once the success prompt is answered, so nothing else renders while we navigate away
  const [leaving, setLeaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'other'>('transfer');
  // PAID or COD has no default on purpose: it must be chosen for every sale
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [paymentStatusMissing, setPaymentStatusMissing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [notes, setNotes] = useState('');
  const [saleDate, setSaleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ saleId: string; offline: boolean; amount: number; customerName: string } | null>(null);
  const [displayCurrencyId, setDisplayCurrencyId] = useState<string | undefined>(undefined);

  const router = useRouter();
  const { t } = useTranslation();
  const { cartId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { getCart, getCartSummary, completeSale } = useCart();
  const { salesCountData, showPaywall, businessDisableReason } = useSubscription();
  const { currencies, defaultCurrency, convertBetween, formatPrice } = useCurrency(currentBusiness?.id);
  const { isConnected } = useNetwork();

  const displayAmount = (amount: number) => {
    if (!displayCurrencyId || displayCurrencyId === defaultCurrency?.id) {
      return formatPrice(amount);
    }
    const converted = convertBetween(amount, defaultCurrency?.id, displayCurrencyId);
    return formatPrice(converted, displayCurrencyId);
  };

  // Get cart and summary
  const cart = getCart(cartId as string);
  const cartSummary = cart ? getCartSummary(cartId as string) : null;
  const saleMargin = cart && cartSummary
    ? computeSaleMargin({
        itemsOriginalTotal: cartSummary.itemsOriginalTotal,
        itemsSubtotalAfterDiscount: cartSummary.itemsSubtotalAfterDiscount,
        cartDiscountAmount: cartSummary.cartDiscountAmount,
        deliveryCost: cartSummary.deliveryCost,
        lines: cart.items.map(item => ({ quantity: item.quantity, cost: item.cost_per_unit ?? 0 })),
      })
    : null;

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

    if (businessDisableReason === 'owner_disabled') {
      Alert.alert('Business Disabled', 'This business has been disabled. Sales cannot be created until it is re-enabled.');
      return;
    }

    if (cart.items.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    if (!paymentStatus) {
      setPaymentStatusMissing(true);
      scrollRef.current?.scrollToEnd({ animated: true });
      Alert.alert('PAID or COD?', 'Choose whether this sale is already paid or cash on delivery.');
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

      // Snapshot what a receipt needs now: the cart is gone once the sale completes.
      // Used only for a sale saved offline, which has no server record to print from yet.
      const summaryNow = getCartSummary(cartId as string);
      const receiptDraft: ReceiptInput | null = cart
        ? {
            business: {
              name: currentBusiness?.business_name || '',
              logoUrl: (currentBusiness as any)?.business_image_url ?? null,
              phone: (currentBusiness as any)?.receipt_phone ?? null,
              address: (currentBusiness as any)?.receipt_address ?? null,
              pageName: (currentBusiness as any)?.receipt_page_name ?? null,
              footer: (currentBusiness as any)?.receipt_footer ?? null,
            },
            provisional: true,
            date: saleDate,
            status: 'completed',
            customerName: cart.customer_name,
            customerPhone: cart.customer_phone ?? null,
            paymentMethod,
            paymentStatus,
            notes: finalNotes || null,
            lines: cart.items.map(item => ({
              name: item.product_name,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              itemDiscountAmount: item.item_discount_amount ?? 0,
              itemDiscountType: item.item_discount_type ?? null,
              itemDiscountValue: item.item_discount_value ?? null,
              itemDiscountScope: item.item_discount_scope ?? null,
            })),
            orderDiscountAmount: summaryNow.cartDiscountAmount,
            orderDiscountType: cart.discount_type ?? null,
            orderDiscountValue: cart.discount_value ?? null,
            deliveryCost: summaryNow.deliveryCost,
            deliveryCharge: cart.delivery_charge ?? 0,
          }
        : null;
      const customerNameNow = cart?.customer_name || 'Customer';

      const result = await completeSale(cartId as string, paymentMethod, saleDate.toISOString(), finalNotes, paymentStatus);

      if (result.success) {
        const isOfflineSale = !!(result as any).offline;
        if (isOfflineSale && receiptDraft) receiptDraftStore.set(receiptDraft);
        setCompletedSale({
          saleId: (result as any).saleId || '',
          offline: isOfflineSale,
          amount: summaryNow.finalTotal,
          customerName: customerNameNow,
        });
      } else {
        if (result.error?.includes('free limit') || result.error?.includes('upgrade')) {
          setShowUpgradePrompt(true);
        } else {
          Alert.alert('Error', result.error || 'Failed to complete sale');
        }
      }
    } catch (error) {
      console.error('Error completing sale:', error);
      Alert.alert('Error', 'Failed to complete sale');
    } finally {
      setProcessing(false);
    }
  }, [currentBusiness, cartId, cart, paymentMethod, paymentStatus, saleDate, notes, completeSale, getCartSummary]);

  // After the prompt: land on the Sales list first so Back from the next screen goes
  // there, not to this checkout (its cart no longer exists).
  // The cart screen is also still underneath this one in the stack, and its cart is gone too,
  // so go back TO the Sales list (dropping both) rather than replacing only this screen:
  // otherwise Back from Sales lands on "Cart Not Found".
  const leaveTo = useCallback((next?: string) => {
    setLeaving(true);
    setCompletedSale(null);
    try {
      router.dismissTo('/sales');
    } catch {
      router.replace('/sales');
    }
    if (next) setTimeout(() => router.push(next as any), 80);
  }, [router]);

  const handleUpgradeFromPrompt = useCallback(() => {
    setShowUpgradePrompt(false);
    showPaywall();
  }, [showPaywall]);

  // Built before the early return below: completing the sale removes the cart from memory,
  // and the success prompt (receipt, view sale, new sale) must still show at that moment.
  const postSaleModal = completedSale ? (
    <PostSaleActionModal
      visible
      saleId={completedSale.saleId}
      saleAmount={completedSale.amount}
      customerName={completedSale.customerName}
      offline={completedSale.offline}
      onDismiss={() => leaveTo()}
      onNewSale={() => leaveTo()}
      onViewSale={() => leaveTo(completedSale.saleId ? `/(app)/(tabs)/sales/details/${completedSale.saleId}` : undefined)}
      onReceipt={
        completedSale.saleId
          ? () => leaveTo(`/(app)/(tabs)/sales/receipt?saleId=${completedSale.saleId}`)
          : completedSale.offline && receiptDraftStore.get()
            ? () => leaveTo('/(app)/(tabs)/sales/receipt?draft=1')
            : undefined
      }
    />
  ) : null;

  // The sale just went through: the cart is gone by design, so show the prompt, not an error
  // (also while the sale is still being saved, so "Cart Not Found" never flashes in between)
  if ((completedSale || processing || leaving) && (!cart || !cartSummary)) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb', justifyContent: 'center' }]}>
        {!completedSale && !leaving && <LoadingSpinner />}
        {postSaleModal}
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
          Checkout
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {!isConnected && (
          <View style={styles.offlineNotice}>
            <WifiOff size={16} color="#92400E" />
            <Text style={styles.offlineNoticeText}>
              You are offline. Sale will be saved locally and synced when you reconnect.
            </Text>
          </View>
        )}
        {/* Order Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827', marginBottom: 0 }]}>
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
                      {displayAmount(item.original_subtotal)}
                    </Text>
                  )}
                  <Text style={[styles.itemSubtotal, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {displayAmount(item.subtotal)}
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
              {displayAmount(cartSummary?.itemsOriginalTotal)}
            </Text>
          </View>

          {cartSummary?.itemsTotalDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Item Discounts:
              </Text>
              <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                -{displayAmount(cartSummary.itemsTotalDiscount)}
              </Text>
            </View>
          )}

          {cartSummary?.cartDiscountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Cart Discount:
              </Text>
              <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                -{displayAmount(cartSummary.cartDiscountAmount)}
              </Text>
            </View>
          )}

          {cartSummary?.deliveryCost > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('delivery.shopPaysRow')}:
              </Text>
              <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
                -{displayAmount(cartSummary.deliveryCost)}
              </Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Total:
            </Text>
            <Text style={[styles.totalValue, { color: '#059669' }]}>
              {displayAmount(cartSummary?.finalTotal)}
            </Text>
          </View>

          {(cart?.delivery_charge ?? 0) > 0 && (
            <>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {t('delivery.customerPaysRow')}:
                </Text>
                <Text style={[styles.summaryValue, { color: '#2563eb' }]}>
                  +{displayAmount(cart?.delivery_charge ?? 0)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#f9fafb' : '#111827', fontWeight: '700' }]}>
                  {t('delivery.customerTotal')}:
                </Text>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827', fontWeight: '700' }]}>
                  {displayAmount((cartSummary?.finalTotal ?? 0) + (cart?.delivery_charge ?? 0))}
                </Text>
              </View>
            </>
          )}
        </Card>

        {saleMargin && <SaleMarginCard margin={saleMargin} formatAmount={displayAmount} />}

        {/* Sale Date */}
        <Card style={styles.dateCard}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color="#8b5cf6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827', marginBottom: 0 }]}>
              Sale Date
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <View pointerEvents="none">
              <Input
                label="Sale Date"
                value={saleDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                editable={false}
                placeholder="Select sale date"
              />
            </View>
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

        {/* PAID or COD: required, no default */}
        <Card style={styles.paymentCard}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Paid or Cash on Delivery
          </Text>
          <PaymentStatusSelector
            value={paymentStatus}
            onChange={(v) => { setPaymentStatus(v); setPaymentStatusMissing(false); }}
            showError={paymentStatusMissing}
            disabled={processing}
          />
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
          title={`Complete Sale - ${displayAmount(cartSummary?.finalTotal ?? 0)}`}
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

            <SingleDatePicker
              selectedDate={saleDate}
              maxDate={new Date()}
              onConfirm={(date) => {
                setSaleDate(date);
                setShowDatePicker(false);
              }}
              onCancel={() => setShowDatePicker(false)}
            />
          </Card>
        </View>
      </Modal>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        onUpgrade={handleUpgradeFromPrompt}
        salesCount={salesCountData.salesCount}
        message="You've reached the free limit. Upgrade to continue creating sales."
      />

      {postSaleModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
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
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
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