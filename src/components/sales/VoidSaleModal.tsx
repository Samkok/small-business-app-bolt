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
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { X, DollarSign, TrendingDown, Truck, AlertTriangle } from 'lucide-react-native';

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

export default function VoidSaleModal({
  visible,
  sale,
  onConfirm,
  onCancel,
  loading = false,
}: VoidSaleModalProps) {
  const { isDark } = useTheme();
  const [reason, setReason] = useState('');
  const [includeDeliveryCost, setIncludeDeliveryCost] = useState(true);
  const [lossType, setLossType] = useState<'none' | 'fixed' | 'percentage'>('none');
  const [lossAmount, setLossAmount] = useState('');
  const [lossPercentage, setLossPercentage] = useState('');

  const deliveryCost = sale?.carts?.delivery_cost || 0;
  const hasDeliveryCost = deliveryCost > 0;
  const originalAmount = sale?.total_amount || 0;

  // Calculate adjusted amount
  const calculatedAmounts = useMemo(() => {
    let adjusted = originalAmount;
    let deliveryAdjustment = 0;
    let lossAdjustment = 0;

    // Delivery cost adjustment
    if (!includeDeliveryCost && hasDeliveryCost) {
      deliveryAdjustment = deliveryCost;
      adjusted -= deliveryCost;
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
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for voiding this sale');
      return;
    }

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

    const options: any = {
      reason: reason.trim(),
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
  }, [reason, includeDeliveryCost, lossType, lossAmount, lossPercentage, originalAmount, onConfirm]);

  const resetForm = useCallback(() => {
    setReason('');
    setIncludeDeliveryCost(true);
    setLossType('none');
    setLossAmount('');
    setLossPercentage('');
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [resetForm, onCancel]);

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
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Void Sale
            </Text>
            <TouchableOpacity onPress={handleCancel} disabled={loading}>
              <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Sale Info */}
            <View style={[styles.saleInfo, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
              <Text style={[styles.saleInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Sale #{sale?.id?.slice(-8)} - ${originalAmount.toFixed(2)}
              </Text>
              {sale?.customers && (
                <Text style={[styles.saleInfoSubtext, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Customer: {sale.customers.name}
                </Text>
              )}
            </View>

            {/* Delivery Cost Section */}
            {hasDeliveryCost && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Truck size={18} color="#2563eb" />
                  <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Delivery Cost
                  </Text>
                </View>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: isDark ? '#d1d5db' : '#374151' }]}>
                    Include delivery cost (${deliveryCost.toFixed(2)})
                  </Text>
                  <Switch
                    value={includeDeliveryCost}
                    onValueChange={setIncludeDeliveryCost}
                    trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                    thumbColor={includeDeliveryCost ? '#2563eb' : '#f3f4f6'}
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

            {/* Loss Adjustment Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingDown size={18} color="#dc2626" />
                <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Loss Adjustment
                </Text>
              </View>

              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setLossType('none')}
                  disabled={loading}
                >
                  <View style={[styles.radio, { borderColor: isDark ? '#6b7280' : '#d1d5db' }]}>
                    {lossType === 'none' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: isDark ? '#d1d5db' : '#374151' }]}>
                    No loss adjustment
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setLossType('fixed')}
                  disabled={loading}
                >
                  <View style={[styles.radio, { borderColor: isDark ? '#6b7280' : '#d1d5db' }]}>
                    {lossType === 'fixed' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: isDark ? '#d1d5db' : '#374151' }]}>
                    Fixed amount loss
                  </Text>
                </TouchableOpacity>

                {lossType === 'fixed' && (
                  <View style={styles.inputContainer}>
                    <DollarSign size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#f9fafb' : '#111827' }]}
                      placeholder="Enter loss amount"
                      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                      value={lossAmount}
                      onChangeText={setLossAmount}
                      keyboardType="decimal-pad"
                      editable={!loading}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setLossType('percentage')}
                  disabled={loading}
                >
                  <View style={[styles.radio, { borderColor: isDark ? '#6b7280' : '#d1d5db' }]}>
                    {lossType === 'percentage' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: isDark ? '#d1d5db' : '#374151' }]}>
                    Percentage loss
                  </Text>
                </TouchableOpacity>

                {lossType === 'percentage' && (
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { color: isDark ? '#f9fafb' : '#111827' }]}
                      placeholder="Enter percentage (0-100)"
                      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                      value={lossPercentage}
                      onChangeText={setLossPercentage}
                      keyboardType="decimal-pad"
                      editable={!loading}
                    />
                    <Text style={[styles.percentSymbol, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      %
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Amount Breakdown */}
            <View style={[styles.breakdown, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
              <Text style={[styles.breakdownTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Amount Breakdown
              </Text>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Original Amount:
                </Text>
                <Text style={[styles.breakdownValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  ${originalAmount.toFixed(2)}
                </Text>
              </View>

              {calculatedAmounts.deliveryAdjustment > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: '#dc2626' }]}>
                    Delivery excluded:
                  </Text>
                  <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>
                    -${calculatedAmounts.deliveryAdjustment.toFixed(2)}
                  </Text>
                </View>
              )}

              {calculatedAmounts.lossAdjustment > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: '#dc2626' }]}>
                    Loss adjustment:
                  </Text>
                  <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>
                    -${calculatedAmounts.lossAdjustment.toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={[styles.breakdownDivider, { backgroundColor: isDark ? '#4b5563' : '#d1d5db' }]} />

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownTotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Final void amount:
                </Text>
                <Text style={[styles.breakdownTotalValue, { color: '#2563eb' }]}>
                  ${calculatedAmounts.adjusted.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Reason Input */}
            <View style={styles.section}>
              <Input
                label="Reason for voiding *"
                value={reason}
                onChangeText={setReason}
                placeholder="Enter reason for voiding this sale"
                multiline
                numberOfLines={3}
                required
                editable={!loading}
              />
            </View>
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
              disabled={loading}
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
    marginBottom: 16,
  },
  saleInfoText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  saleInfoSubtext: {
    fontSize: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
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
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  radioLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 28,
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
    marginBottom: 16,
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
