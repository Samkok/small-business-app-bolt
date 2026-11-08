import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { useTranslation } from '@/src/locales';
import { Button } from '@/src/components/ui/Button';
import { X, DollarSign, TrendingDown, Truck, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';

interface VoidSaleModalProps {
  visible: boolean;
  sale: any;
  onConfirm: (options: {
    reason: string;
    includeDeliveryCost: boolean;
    lossAmount?: number;
    lossPercentage?: number;
    lossType?: 'fixed' | 'percentage';
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}

type VoidReasonKey = 'enteredByMistake' | 'customerCancelled' | 'duplicateSale' | 'wrongItems' | 'other';

// The label is what gets stored on the voided sale (onConfirm takes a plain
// string), so it stays in English whatever language the screen is shown in.
const VOID_REASONS: { key: VoidReasonKey; label: string }[] = [
  { key: 'enteredByMistake', label: 'Entered by mistake' },
  { key: 'customerCancelled', label: 'Customer cancelled' },
  { key: 'duplicateSale', label: 'Duplicate sale' },
  { key: 'wrongItems', label: 'Wrong items' },
  { key: 'other', label: 'Other' },
];

type LossType = 'none' | 'fixed' | 'percentage';

const LOSS_TYPES: { key: LossType; i18n: string }[] = [
  { key: 'none', i18n: 'sales.noLoss' },
  { key: 'fixed', i18n: 'sales.lossFixedAmount' },
  { key: 'percentage', i18n: 'sales.lossPercentage' },
];

export default function VoidSaleModal({
  visible,
  sale,
  onConfirm,
  onCancel,
  loading = false,
}: VoidSaleModalProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { formatPrice } = useCurrencyContext();
  const fmt = (amount: number) => formatPrice(amount, sale?.currency_id);
  const [reasonKey, setReasonKey] = useState<VoidReasonKey | null>(null);
  const [notes, setNotes] = useState('');
  const [keepOpen, setKeepOpen] = useState(false);
  const [includeDeliveryCost, setIncludeDeliveryCost] = useState(true);
  const [lossType, setLossType] = useState<LossType>('none');
  const [lossAmount, setLossAmount] = useState('');
  const [lossPercentage, setLossPercentage] = useState('');

  const colors = {
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#d1d5db' : '#6b7280',
    muted: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    input: isDark ? '#374151' : '#f3f4f6',
    panel: isDark ? '#374151' : '#f3f4f6',
  };

  const deliveryCost = sale?.carts?.delivery_cost || 0;
  const hasDeliveryCost = deliveryCost > 0;
  const originalAmount = sale?.total_amount || 0;

  // Calculate adjusted amount
  const calculatedAmounts = useMemo(() => {
    let adjusted = originalAmount;
    let deliveryAdjustment = 0;
    let lossAdjustment = 0;

    // Delivery cost adjustment: total_amount already has delivery cost subtracted,
    // so when excluding delivery from the void, add it back to get the product-only amount
    if (!includeDeliveryCost && hasDeliveryCost) {
      deliveryAdjustment = deliveryCost;
      adjusted += deliveryCost;
    }

    // Loss adjustment
    if (lossType === 'fixed' && lossAmount) {
      const amount = parseFloat(lossAmount);
      if (!isNaN(amount)) {
        lossAdjustment = amount;
        adjusted -= amount;
      }
    } else if (lossType === 'percentage' && lossPercentage) {
      const percentage = parseFloat(lossPercentage);
      if (!isNaN(percentage)) {
        lossAdjustment = (originalAmount * percentage) / 100;
        adjusted -= lossAdjustment;
      }
    }

    // Ensure non-negative
    adjusted = Math.max(0, adjusted);

    return {
      adjusted,
      deliveryAdjustment,
      lossAdjustment,
    };
  }, [originalAmount, includeDeliveryCost, hasDeliveryCost, deliveryCost, lossType, lossAmount, lossPercentage]);

  const handleConfirm = useCallback(() => {
    // The button is disabled without a reason; this only guards a stale press
    if (!reasonKey) return;

    // Validate loss amount/percentage
    if (lossType === 'fixed' && lossAmount) {
      const amount = parseFloat(lossAmount);
      if (isNaN(amount) || amount < 0) {
        Alert.alert('Error', 'Please enter a valid loss amount');
        return;
      }
      if (amount > originalAmount) {
        Alert.alert('Error', 'Loss amount cannot exceed the total sale amount');
        return;
      }
    } else if (lossType === 'percentage' && lossPercentage) {
      const percentage = parseFloat(lossPercentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        Alert.alert('Error', 'Please enter a valid loss percentage (0-100)');
        return;
      }
    }

    const reasonLabel = VOID_REASONS.find(r => r.key === reasonKey)?.label || 'Other';
    const trimmedNotes = notes.trim();

    const options: any = {
      reason: trimmedNotes ? `${reasonLabel}: ${trimmedNotes}` : reasonLabel,
      includeDeliveryCost,
    };

    if (lossType === 'fixed' && lossAmount) {
      options.lossAmount = parseFloat(lossAmount);
      options.lossType = 'fixed';
    } else if (lossType === 'percentage' && lossPercentage) {
      options.lossPercentage = parseFloat(lossPercentage);
      options.lossType = 'percentage';
    }

    onConfirm(options);
  }, [reasonKey, notes, includeDeliveryCost, lossType, lossAmount, lossPercentage, originalAmount, onConfirm]);

  const resetForm = useCallback(() => {
    setReasonKey(null);
    setNotes('');
    setKeepOpen(false);
    setIncludeDeliveryCost(true);
    setLossType('none');
    setLossAmount('');
    setLossPercentage('');
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [resetForm, onCancel]);

  // Closing the disclosure means "take the whole amount": put everything back to default
  const toggleKeep = useCallback(() => {
    if (keepOpen) {
      setIncludeDeliveryCost(true);
      setLossType('none');
      setLossAmount('');
      setLossPercentage('');
    }
    setKeepOpen(open => !open);
  }, [keepOpen]);

  const keptSomething = calculatedAmounts.lossAdjustment > 0 || calculatedAmounts.deliveryAdjustment > 0;
  const keepSummary = keptSomething ? fmt(calculatedAmounts.adjusted) : t('sales.noLoss');

  const summaryParts = [
    t('sales.saleNumber', { number: sale?.id?.slice(-8) }),
    fmt(originalAmount),
    sale?.customers?.name,
  ].filter(Boolean);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.modalOverlay}>
        <View style={[styles.modal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('sales.voidSale')}
            </Text>
            <TouchableOpacity onPress={handleCancel} disabled={loading}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* (a) One-line sale summary */}
            <View style={[styles.saleInfo, { backgroundColor: colors.panel }]}>
              <Text style={[styles.saleInfoText, { color: colors.subtext }]} numberOfLines={1}>
                {summaryParts.join(' · ')}
              </Text>
            </View>

            {/* (b) Reason chips */}
            <Text style={[styles.label, { color: colors.muted }]}>{t('sales.voidReasonLabel')}</Text>
            <View style={styles.chipRow}>
              {VOID_REASONS.map(r => {
                const active = r.key === reasonKey;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.chip, { backgroundColor: active ? '#2563eb' : colors.input, borderColor: active ? '#2563eb' : colors.border }]}
                    onPress={() => setReasonKey(r.key)}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{t(`sales.voidReasons.${r.key}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!reasonKey && (
              <Text style={[styles.hint, { color: colors.muted }]}>{t('sales.chooseReasonHint')}</Text>
            )}

            {/* (c) Optional note */}
            <Text style={[styles.label, { color: colors.muted }]}>{t('sales.additionalNotesOptional')}</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('sales.notePlaceholder')}
              placeholderTextColor={colors.muted}
              multiline
              editable={!loading}
            />

            {/* (d) Keep part of the money: collapsed by default, holds delivery + loss + breakdown */}
            <TouchableOpacity
              style={[styles.disclosureRow, { borderColor: colors.border }]}
              onPress={toggleKeep}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ expanded: keepOpen }}
            >
              <TrendingDown size={16} color={keptSomething ? '#dc2626' : colors.muted} />
              <Text style={[styles.disclosureLabel, { color: colors.text }]}>{t('sales.keepPartOfMoney')}</Text>
              <Text style={[styles.disclosureValue, { color: keptSomething ? '#dc2626' : colors.muted }]}>{keepSummary}</Text>
              {keepOpen
                ? <ChevronUp size={18} color={colors.muted} />
                : <ChevronDown size={18} color={colors.muted} />}
            </TouchableOpacity>

            {keepOpen && (
              <View style={styles.disclosureBody}>
                {hasDeliveryCost && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Truck size={16} color="#2563eb" />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        {t('sales.deliveryCost')}
                      </Text>
                    </View>
                    <View style={styles.switchRow}>
                      <Text style={[styles.switchLabel, { color: colors.subtext }]}>
                        Include delivery cost ({fmt(deliveryCost)})
                      </Text>
                      <Switch
                        value={includeDeliveryCost}
                        onValueChange={setIncludeDeliveryCost}
                        trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                        thumbColor={includeDeliveryCost ? '#2563eb' : '#f3f4f6'}
                        disabled={loading}
                      />
                    </View>
                    {!includeDeliveryCost && (
                      <View style={[styles.infoBox, { backgroundColor: isDark ? '#374151' : '#fef3c7' }]}>
                        <AlertTriangle size={16} color="#f59e0b" />
                        <Text style={[styles.infoText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
                          Delivery cost will not be voided
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.chipRow}>
                  {LOSS_TYPES.map(opt => {
                    const active = lossType === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.chip, { backgroundColor: active ? '#2563eb' : colors.input, borderColor: active ? '#2563eb' : colors.border }]}
                        onPress={() => setLossType(opt.key)}
                        disabled={loading}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{t(opt.i18n)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {lossType === 'fixed' && (
                  <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.input }]}>
                    <DollarSign size={16} color={colors.muted} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Enter loss amount"
                      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                      value={lossAmount}
                      onChangeText={setLossAmount}
                      keyboardType="decimal-pad"
                      editable={!loading}
                    />
                  </View>
                )}

                {lossType === 'percentage' && (
                  <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.input }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Enter percentage (0-100)"
                      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                      value={lossPercentage}
                      onChangeText={setLossPercentage}
                      keyboardType="decimal-pad"
                      editable={!loading}
                    />
                    <Text style={[styles.percentSymbol, { color: colors.muted }]}>
                      %
                    </Text>
                  </View>
                )}

                {/* Amount Breakdown */}
                <View style={[styles.breakdown, { backgroundColor: colors.panel }]}>
                  <Text style={[styles.breakdownTitle, { color: colors.text }]}>
                    Amount Breakdown
                  </Text>

                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.muted }]}>
                      Original Amount:
                    </Text>
                    <Text style={[styles.breakdownValue, { color: colors.text }]}>
                      {fmt(originalAmount)}
                    </Text>
                  </View>

                  {calculatedAmounts.deliveryAdjustment > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: '#059669' }]}>
                        Delivery excluded:
                      </Text>
                      <Text style={[styles.breakdownValue, { color: '#059669' }]}>
                        +{fmt(calculatedAmounts.deliveryAdjustment)}
                      </Text>
                    </View>
                  )}

                  {calculatedAmounts.lossAdjustment > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: '#dc2626' }]}>
                        Loss adjustment:
                      </Text>
                      <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>
                        -{fmt(calculatedAmounts.lossAdjustment)}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.breakdownDivider, { backgroundColor: isDark ? '#4b5563' : '#d1d5db' }]} />

                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownTotalLabel, { color: colors.text }]}>
                      Final void amount:
                    </Text>
                    <Text style={[styles.breakdownTotalValue, { color: '#2563eb' }]}>
                      {fmt(calculatedAmounts.adjusted)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={handleCancel}
              style={styles.actionButton}
              disabled={loading}
            />
            <Button
              title="Confirm Void"
              variant="danger"
              onPress={handleConfirm}
              style={styles.actionButton}
              loading={loading}
              disabled={loading || !reasonKey}
            />
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    maxHeight: 500,
  },
  saleInfo: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  saleInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  hint: {
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
  notesInput: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  disclosureLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  disclosureValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  disclosureBody: {
    paddingTop: 12,
    gap: 12,
  },
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  percentSymbol: {
    fontSize: 14,
    fontWeight: '500',
  },
  breakdown: {
    padding: 16,
    borderRadius: 8,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 12,
  },
  breakdownTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
