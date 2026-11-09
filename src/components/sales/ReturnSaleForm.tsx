import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { useAuth } from '@/src/context/AuthContext';
import { useTranslation } from '@/src/locales';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { X, ShoppingCart, DollarSign, Minus, Plus, Info, TriangleAlert as AlertTriangle, TrendingDown, Percent } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import { calculateReturnRefund, getReturnedQuantities } from '@/src/utils/saleMoney';

interface ReturnItem {
  productId: string;
  productName: string;
  originalQuantity: number;
  returnQuantity: number;
  unitPrice: number;
  maxReturnQuantity: number;
  lossAmount: number;
  lossPercentage: number;
  lossType: 'none' | 'fixed' | 'percentage';
}

interface ReturnSaleFormProps {
  sale: any;
  onComplete: () => void;
  onCancel: () => void;
}

type ReturnReasonKey = 'changedMind' | 'damaged' | 'wrongItem' | 'expired' | 'other';

// The label is what gets stored in the return record (salesService takes a plain
// string), so it stays in English whatever language the screen is shown in.
const RETURN_REASONS: { key: ReturnReasonKey; label: string }[] = [
  { key: 'changedMind', label: 'Changed mind' },
  { key: 'damaged', label: 'Damaged' },
  { key: 'wrongItem', label: 'Wrong item' },
  { key: 'expired', label: 'Expired' },
  { key: 'other', label: 'Other' },
];

const LOSS_TYPES: { key: ReturnItem['lossType']; i18n: string }[] = [
  { key: 'none', i18n: 'sales.noLoss' },
  { key: 'fixed', i18n: 'sales.lossFixedAmount' },
  { key: 'percentage', i18n: 'sales.lossPercentage' },
];

export default function ReturnSaleForm({ sale, onComplete, onCancel }: ReturnSaleFormProps) {
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reasonKey, setReasonKey] = useState<ReturnReasonKey | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [includeDeliveryCost] = useState(false);

  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { formatPrice } = useCurrencyContext();
  const fmt = (amount: number) => formatPrice(amount, sale?.currency_id);
  const { currentBusiness, userProfile } = useAuth();

  const colors = {
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#d1d5db' : '#6b7280',
    muted: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    input: isDark ? '#374151' : '#f3f4f6',
  };

  useEffect(() => {
    if (sale?.carts?.cart_items) {
      // Initialize return items from sale cart items; what was already returned cannot be returned again
      const alreadyReturned = getReturnedQuantities(sale);
      const items: ReturnItem[] = sale.carts.cart_items.map((item: any) => ({
        productId: item.product_id,
        productName: item.products?.name || 'Unknown Product',
        originalQuantity: item.quantity,
        returnQuantity: 0,
        unitPrice: item.unit_price,
        maxReturnQuantity: Math.max(0, item.quantity - (alreadyReturned[item.product_id] || 0)),
        lossAmount: 0,
        lossPercentage: 0,
        lossType: 'none',
      }));
      // A single-line sale almost always means "return that one thing": start at 1
      if (items.length === 1 && items[0].maxReturnQuantity >= 1) {
        items[0].returnQuantity = 1;
      }
      setReturnItems(items);
    }
  }, [sale]);

  const updateReturnQuantity = useCallback((productId: string, quantity: number) => {
    setReturnItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(0, Math.min(quantity, item.maxReturnQuantity));
        // Nothing to return means nothing to keep back; clear a stale deduction
        if (newQuantity === 0) {
          return { ...item, returnQuantity: 0, lossType: 'none', lossAmount: 0, lossPercentage: 0 };
        }
        return { ...item, returnQuantity: newQuantity };
      }
      return item;
    }));
  }, []);

  const handleQuantityChange = useCallback((productId: string, change: number) => {
    const item = returnItems.find(i => i.productId === productId);
    if (!item) return;

    const newQuantity = item.returnQuantity + change;
    updateReturnQuantity(productId, newQuantity);
  }, [returnItems, updateReturnQuantity]);

  const updateItemLoss = useCallback((productId: string, lossType: 'none' | 'fixed' | 'percentage', value?: number) => {
    setReturnItems(prev => prev.map(item => {
      if (item.productId === productId) {
        if (lossType === 'none') {
          return { ...item, lossType: 'none', lossAmount: 0, lossPercentage: 0 };
        } else if (lossType === 'fixed') {
          return { ...item, lossType: 'fixed', lossAmount: value || 0, lossPercentage: 0 };
        } else if (lossType === 'percentage') {
          return { ...item, lossType: 'percentage', lossAmount: 0, lossPercentage: value || 0 };
        }
      }
      return item;
    }));
  }, []);

  // Same rule as salesService.returnItems: refund at the price actually paid,
  // minus any deduction kept back, plus a prorated courier fee when opted in.
  const calculateRefundAmount = useCallback(() => {
    return calculateReturnRefund(
      sale,
      returnItems.map(item => ({
        productId: item.productId,
        quantity: item.returnQuantity,
        lossType: item.lossType,
        lossAmount: item.lossAmount,
        lossPercentage: item.lossPercentage,
      })),
      { includeDeliveryCost }
    ).refund;
  }, [returnItems, includeDeliveryCost, sale]);

  const getTotalReturnItems = useCallback(() => {
    return returnItems.reduce((total, item) => total + item.returnQuantity, 0);
  }, [returnItems]);

  const handleSubmitReturn = useCallback(async () => {
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);

    if (itemsToReturn.length === 0) {
      Alert.alert('Error', 'Please select at least one item to return');
      return;
    }

    // The button is disabled without a reason; this only guards a stale press
    if (!reasonKey) return;

    if (!currentBusiness?.id || !userProfile) {
      Alert.alert('Error', 'No business found');
      return;
    }

    // Validate loss amounts
    for (const item of itemsToReturn) {
      if (item.lossType === 'fixed' && item.lossAmount < 0) {
        Alert.alert('Error', `Invalid loss amount for ${item.productName}`);
        return;
      }
      if (item.lossType === 'percentage' && (item.lossPercentage < 0 || item.lossPercentage > 100)) {
        Alert.alert('Error', `Invalid loss percentage for ${item.productName}. Must be between 0-100`);
        return;
      }
    }

    const reasonLabel = RETURN_REASONS.find(r => r.key === reasonKey)?.label || 'Other';
    const trimmedNotes = notes.trim();
    const reason = trimmedNotes ? `${reasonLabel}: ${trimmedNotes}` : reasonLabel;

    setLoading(true);
    try {
      const returnData = itemsToReturn.map(item => ({
        productId: item.productId,
        quantity: item.returnQuantity,
        lossAmount: item.lossType === 'fixed' ? item.lossAmount : undefined,
        lossPercentage: item.lossType === 'percentage' ? item.lossPercentage : undefined,
        lossType: item.lossType !== 'none' ? item.lossType : undefined,
      }));

      await salesService.returnItems(
        sale.id,
        returnData,
        reason,
        userProfile.user_id,
        { includeDeliveryCost }
      );

      Alert.alert(
        t('sales.returnProcessed'),
        t('sales.returnProcessedMessage', {
          items: t('sales.itemCount', { count: getTotalReturnItems() }),
          amount: fmt(calculateRefundAmount()),
        }),
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (error) {
      console.error('Error processing return:', error);
      Alert.alert('Error', 'Failed to process return');
    } finally {
      setLoading(false);
    }
  }, [returnItems, reasonKey, notes, currentBusiness?.id, sale.id, onComplete, getTotalReturnItems, calculateRefundAmount, includeDeliveryCost, userProfile, t]);

  const canSubmit = getTotalReturnItems() > 0 && reasonKey !== null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('sales.returnItems')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
            {t('sales.returnFromSale', { number: sale.id.slice(-8), total: fmt(sale.total_amount) })}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Return Items Selection */}
        <Card style={styles.itemsCard}>
          <View style={styles.itemsHeader}>
            <ShoppingCart size={20} color="#8b5cf6" />
            <Text style={[styles.itemsTitle, { color: colors.text }]}>
              Select Items to Return
            </Text>
          </View>
          
          <Text style={[styles.itemsSubtitle, { color: colors.subtext }]}>
            Choose the quantity of each item you want to return
          </Text>
          
          {returnItems.map((item) => {
            const selected = item.returnQuantity > 0;
            return (
            <View key={item.productId} style={styles.returnItem}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.text }]}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.itemDetails, { color: colors.subtext }]}>
                    Original: {item.originalQuantity} × {fmt(item.unitPrice)}
                  </Text>
                  <Text style={[styles.itemSubtotal, { color: '#059669' }]}>
                    Subtotal: {fmt(item.originalQuantity * item.unitPrice)}
                  </Text>
                </View>

                <View style={styles.returnControls}>
                <Text style={[styles.returnLabel, { color: colors.subtext }]}>
                  Return Qty:
                </Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      { 
                        backgroundColor: selected ? '#dc2626' : (isDark ? '#4b5563' : '#e5e7eb'),
                        opacity: selected ? 1 : 0.5
                      }
                    ]}
                    onPress={() => handleQuantityChange(item.productId, -1)}
                    disabled={!selected}
                  >
                    <Minus size={16} color={selected ? '#ffffff' : colors.muted} />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={[styles.quantityInput, { 
                      backgroundColor: isDark ? '#374151' : '#f9fafb',
                      borderColor: isDark ? '#4b5563' : '#d1d5db',
                      color: colors.text
                    }]}
                    value={item.returnQuantity.toString()}
                    onChangeText={(value) => {
                      const quantity = parseInt(value) || 0;
                      updateReturnQuantity(item.productId, quantity);
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      { 
                        backgroundColor: '#2563eb',
                        opacity: item.returnQuantity >= item.maxReturnQuantity ? 0.5 : 1
                      }
                    ]}
                    onPress={() => handleQuantityChange(item.productId, 1)}
                    disabled={item.returnQuantity >= item.maxReturnQuantity}
                  >
                    <Plus size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                
                {/* Fixed height so the row does not jump when the refund line appears */}
                <Text style={[styles.returnAmount, { color: '#dc2626' }]}>
                  {selected ? `Refund: ${fmt(item.returnQuantity * item.unitPrice)}` : ' '}
                </Text>
                </View>
              </View>

              {/* Loss adjustment: always rendered so the layout holds; greyed until a quantity is set */}
              <View
                style={[styles.lossAdjustmentSection, {
                  backgroundColor: selected ? (isDark ? '#1f2937' : '#fef3c7') : (isDark ? '#1f2937' : '#f3f4f6'),
                  borderColor: selected ? (isDark ? '#374151' : '#fbbf24') : colors.border,
                  opacity: selected ? 1 : 0.55,
                }]}
                pointerEvents={selected ? 'auto' : 'none'}
              >
                <View style={styles.lossHeader}>
                  <TrendingDown size={16} color={selected ? '#dc2626' : colors.muted} />
                  <Text style={[styles.lossTitle, { color: selected ? (isDark ? '#fbbf24' : '#92400e') : colors.muted }]}>
                    {t('sales.lossAdjustmentOptional')}
                  </Text>
                </View>

                <View style={styles.chipRow}>
                  {LOSS_TYPES.map(opt => {
                    const active = item.lossType === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.chipSmall, {
                          backgroundColor: active ? '#2563eb' : (isDark ? '#374151' : '#ffffff'),
                          borderColor: active ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
                        }]}
                        onPress={() => updateItemLoss(item.productId, opt.key)}
                        disabled={!selected}
                      >
                        <Text style={[styles.chipSmallText, { color: active ? '#ffffff' : colors.text }]}>{t(opt.i18n)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {!selected && (
                  <Text style={[styles.lossHint, { color: colors.muted }]}>{t('sales.lossAdjustmentHint')}</Text>
                )}

                {item.lossType === 'fixed' && (
                  <View style={[styles.lossInputContainer, {
                    backgroundColor: isDark ? '#374151' : '#ffffff',
                    borderColor: isDark ? '#4b5563' : '#d1d5db'
                  }]}>
                    <DollarSign size={14} color={colors.muted} />
                    <TextInput
                      style={[styles.lossInput, { color: colors.text }]}
                      placeholder="Loss amount"
                      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                      value={item.lossAmount > 0 ? item.lossAmount.toString() : ''}
                      onChangeText={(value) => {
                        const amount = parseFloat(value) || 0;
                        updateItemLoss(item.productId, 'fixed', amount);
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

                {item.lossType === 'percentage' && (
                  <View style={[styles.lossInputContainer, {
                    backgroundColor: isDark ? '#374151' : '#ffffff',
                    borderColor: isDark ? '#4b5563' : '#d1d5db'
                  }]}>
                    <Percent size={14} color={colors.muted} />
                    <TextInput
                      style={[styles.lossInput, { color: colors.text }]}
                      placeholder="Loss percentage (0-100)"
                      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                      value={item.lossPercentage > 0 ? item.lossPercentage.toString() : ''}
                      onChangeText={(value) => {
                        const percentage = parseFloat(value) || 0;
                        updateItemLoss(item.productId, 'percentage', percentage);
                      }}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[styles.percentSymbol, { color: colors.muted }]}>
                      %
                    </Text>
                  </View>
                )}

                {item.lossType !== 'none' && (
                  <View style={styles.lossCalculation}>
                    <Text style={[styles.lossCalculationText, { color: isDark ? '#f87171' : '#dc2626' }]}>
                      Loss: -{fmt(
                        item.lossType === 'fixed'
                          ? item.lossAmount
                          : (item.returnQuantity * item.unitPrice * item.lossPercentage) / 100
                      )}
                    </Text>
                    <Text style={[styles.lossCalculationText, { color: '#059669' }]}>
                      Final refund: {fmt(Math.max(0, (
                        item.returnQuantity * item.unitPrice - (
                          item.lossType === 'fixed'
                            ? item.lossAmount
                            : (item.returnQuantity * item.unitPrice * item.lossPercentage) / 100
                        )
                      )))}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            );
          })}
          
          {getTotalReturnItems() > 0 && (
            <View style={styles.returnSummary}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.subtext }]}>
                  Total Items to Return:
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {t('sales.itemCount', { count: getTotalReturnItems() })}
                </Text>
              </View>
              
              <View style={[styles.summaryRow, styles.totalRefundRow]}>
                <Text style={[styles.totalRefundLabel, { color: colors.text }]}>
                  Total Refund Amount:
                </Text>
                <Text style={[styles.totalRefundValue, { color: '#dc2626' }]}>
                  {fmt(calculateRefundAmount())}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Return Reason */}
        <Card style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Info size={20} color="#ea580c" />
            <Text style={[styles.reasonTitle, { color: colors.text }]}>
              {t('sales.returnReasonLabel')}
            </Text>
          </View>

          <View style={styles.chipRow}>
            {RETURN_REASONS.map(r => {
              const active = r.key === reasonKey;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.chip, { backgroundColor: active ? '#2563eb' : colors.input, borderColor: active ? '#2563eb' : colors.border }]}
                  onPress={() => setReasonKey(r.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{t(`sales.returnReasons.${r.key}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!reasonKey && (
            <Text style={[styles.hint, { color: colors.muted }]}>{t('sales.chooseReasonHint')}</Text>
          )}

          <Text style={[styles.label, { color: colors.muted }]}>{t('sales.additionalNotesOptional')}</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('sales.notePlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
          />
        </Card>

        {/* Return Policy Information */}
        <Card style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <AlertTriangle size={20} color="#f59e0b" />
            <Text style={[styles.policyTitle, { color: colors.text }]}>
              Return Policy
            </Text>
          </View>
          
          <View style={styles.policyContent}>
            <Text style={[styles.policyText, { color: colors.subtext }]}>
              • Returned items will be added back to inventory
            </Text>
            <Text style={[styles.policyText, { color: colors.subtext }]}>
              • Sale status will be updated to "Partially Returned"
            </Text>
            <Text style={[styles.policyText, { color: colors.subtext }]}>
              • This action cannot be undone
            </Text>
            <Text style={[styles.policyText, { color: colors.subtext }]}>
              • Customer refund amount will be calculated automatically
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onCancel}
          style={styles.footerButton}
        />
        <Button
          title={`Process Return - ${fmt(calculateRefundAmount())}`}
          onPress={handleSubmitReturn}
          loading={loading}
          style={styles.footerButton}
          disabled={!canSubmit}
        />
      </View>
    </KeyboardAvoidingView>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
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
    alignItems: 'center',
    marginBottom: 8,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  itemsSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  returnItem: {
    flexDirection: 'column',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    marginBottom: 2,
  },
  itemSubtotal: {
    fontSize: 12,
    fontWeight: '500',
  },
  returnControls: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  returnLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    width: 40,
    height: 28,
    borderWidth: 1,
    borderRadius: 4,
    textAlign: 'center',
    fontSize: 14,
    marginHorizontal: 8,
  },
  returnAmount: {
    fontSize: 12,
    fontWeight: '500',
    minHeight: 16,
  },
  lossAdjustmentSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  lossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  lossTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  lossHint: {
    fontSize: 12,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipSmallText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  notesInput: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  lossInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  lossInput: {
    flex: 1,
    fontSize: 13,
    marginLeft: 6,
    paddingVertical: 2,
  },
  percentSymbol: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  lossCalculation: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 114, 128, 0.2)',
    gap: 4,
  },
  lossCalculationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  returnSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRefundRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalRefundLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalRefundValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  reasonCard: {
    padding: 16,
    marginBottom: 16,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  policyCard: {
    padding: 16,
    marginBottom: 20,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  policyContent: {
    gap: 8,
  },
  policyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerButton: {
    flex: 1,
  },
});
