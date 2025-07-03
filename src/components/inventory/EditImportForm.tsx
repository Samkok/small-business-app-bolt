import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { X, Package, DollarSign, Plus, Trash2, Calendar, CheckCircle, Clock, TruckDelivery } from 'lucide-react-native';
import { inventoryService } from '@/src/services/inventory';
import DateRangePicker from '@/src/components/sales/DateRangePicker';

interface EditImportFormProps {
  importRecord: any;
  onComplete: () => void;
  onCancel: () => void;
}

export default function EditImportForm({ importRecord, onComplete, onCancel }: EditImportFormProps) {
  const [quantity, setQuantity] = useState('');
  const [baseUnitCost, setBaseUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [additionalCosts, setAdditionalCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState('Unknown Product');
  const [productBarcode, setProductBarcode] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'purchase' | 'arrival'>('purchase');
  const [markingAsArrived, setMarkingAsArrived] = useState(false);
  
  const { isDark } = useTheme();

  useEffect(() => {
    if (importRecord) {
      setQuantity(importRecord.quantity?.toString() || '');
      setBaseUnitCost(importRecord.base_unit_cost?.toString() || '');
      setNotes(importRecord.notes || '');
      setAdditionalCosts(importRecord.import_costs || []);
      setStatus(importRecord.status || 'pending');
      
      // Set purchase date
      if (importRecord.purchase_date) {
        setPurchaseDate(new Date(importRecord.purchase_date));
      }
      
      // Set arrival date if available
      if (importRecord.arrival_date) {
        setArrivalDate(new Date(importRecord.arrival_date));
      }
      
      // Safely access product information
      if (importRecord.products) {
        setProductName(importRecord.products.name || 'Unknown Product');
        setProductBarcode(importRecord.products.barcode || '');
      }
    }
  }, [importRecord]);

  const addCost = () => {
    setAdditionalCosts([...additionalCosts, {
      cost_type: '',
      amount: '',
      calculation_type: 'per_total',
      description: ''
    }]);
  };

  const updateCost = (index: number, field: string, value: string) => {
    const updated = [...additionalCosts];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalCosts(updated);
  };

  const removeCost = (index: number) => {
    setAdditionalCosts(additionalCosts.filter((_, i) => i !== index));
  };

  const calculateFinalCost = () => {
    const qty = parseInt(quantity) || 0;
    const baseCost = parseFloat(baseUnitCost) || 0;
    
    let totalAdditionalCost = 0;
    additionalCosts.forEach(cost => {
      const amount = parseFloat(cost.amount) || 0;
      if (cost.calculation_type === 'per_unit') {
        totalAdditionalCost += amount * qty;
      } else {
        totalAdditionalCost += amount;
      }
    });

    const finalUnitCost = baseCost + (totalAdditionalCost / qty);
    const totalCost = finalUnitCost * qty;

    return { finalUnitCost: isNaN(finalUnitCost) ? 0 : finalUnitCost, totalCost: isNaN(totalCost) ? 0 : totalCost };
  };

  const handleUpdate = async () => {
    if (!quantity || !baseUnitCost) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const qtyValue = parseInt(quantity);
    const baseCostValue = parseFloat(baseUnitCost);

    if (isNaN(qtyValue) || qtyValue <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (isNaN(baseCostValue) || baseCostValue < 0) {
      Alert.alert('Error', 'Please enter a valid base cost');
      return;
    }

    // Validate additional costs
    for (const cost of additionalCosts) {
      if (!cost.cost_type.trim()) {
        Alert.alert('Error', 'Please enter a cost type for all additional costs');
        return;
      }
      const amount = parseFloat(cost.amount);
      if (isNaN(amount) || amount < 0) {
        Alert.alert('Error', 'Please enter valid amounts for all additional costs');
        return;
      }
    }

    setLoading(true);
    try {
      const { finalUnitCost, totalCost } = calculateFinalCost();

      const importData = {
        quantity: qtyValue,
        base_unit_cost: baseCostValue,
        final_unit_cost: finalUnitCost,
        total_cost: totalCost,
        notes: notes.trim() || null,
        purchase_date: purchaseDate.toISOString(),
      };

      const costs = additionalCosts.map(cost => ({
        cost_type: cost.cost_type.trim(),
        amount: parseFloat(cost.amount),
        calculation_type: cost.calculation_type,
        description: cost.description?.trim() || null,
      }));

      await inventoryService.updateImport(importRecord.id, importData, costs);
      Alert.alert('Success', 'Import record updated successfully');
      onComplete();
    } catch (error) {
      console.error('Error updating import:', error);
      Alert.alert('Error', 'Failed to update import record');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsArrived = async () => {
    if (!importRecord.id) return;
    
    setMarkingAsArrived(true);
    try {
      const now = new Date();
      await inventoryService.markImportAsArrived(importRecord.id, now.toISOString());
      setArrivalDate(now);
      setStatus('completed');
      Alert.alert('Success', 'Import marked as arrived successfully');
    } catch (error) {
      console.error('Error marking import as arrived:', error);
      Alert.alert('Error', 'Failed to mark import as arrived');
    } finally {
      setMarkingAsArrived(false);
    }
  };

  const handleOpenDatePicker = (type: 'purchase' | 'arrival') => {
    setDatePickerType(type);
    setShowDatePicker(true);
  };

  const handleDateConfirm = (start: Date, end: Date) => {
    if (datePickerType === 'purchase') {
      setPurchaseDate(start);
    } else {
      setArrivalDate(start);
    }
    setShowDatePicker(false);
  };

  const { finalUnitCost, totalCost } = calculateFinalCost();
  const isCompleted = status === 'completed';

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Edit Import Record
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Package size={20} color="#2563eb" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Product Information
              </Text>
            </View>
            
            <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#374151' }]}>
              {productName}
            </Text>
            {productBarcode && (
              <Text style={[styles.barcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                Barcode: {productBarcode}
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Import Dates
              </Text>
            </View>
            
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={[styles.dateLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  Purchase Date:
                </Text>
                <TouchableOpacity 
                  style={[styles.dateButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={() => handleOpenDatePicker('purchase')}
                  disabled={isCompleted}
                >
                  <Calendar size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <Text style={[styles.dateButtonText, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    {purchaseDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.dateField}>
                <Text style={[styles.dateLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  Arrival Date:
                </Text>
                {arrivalDate ? (
                  <View style={[styles.dateButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                    <TruckDelivery size={16} color="#059669" />
                    <Text style={[styles.dateButtonText, { color: isDark ? '#f9fafb' : '#374151' }]}>
                      {arrivalDate.toLocaleDateString()}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.dateButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                    <Clock size={16} color="#f59e0b" />
                    <Text style={[styles.dateButtonText, { color: isDark ? '#f9fafb' : '#374151' }]}>
                      Pending Arrival
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.statusContainer}>
              <Text style={[styles.statusLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                Status:
              </Text>
              <View style={[
                styles.statusBadge, 
                { 
                  backgroundColor: isCompleted ? '#05966920' : '#f59e0b20',
                  borderColor: isCompleted ? '#059669' : '#f59e0b',
                }
              ]}>
                {isCompleted ? (
                  <CheckCircle size={16} color="#059669" />
                ) : (
                  <Clock size={16} color="#f59e0b" />
                )}
                <Text style={[
                  styles.statusText, 
                  { color: isCompleted ? '#059669' : '#f59e0b' }
                ]}>
                  {isCompleted ? 'Completed' : 'Pending Arrival'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={20} color="#059669" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Import Details
              </Text>
            </View>
            
            <Input
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Enter quantity"
              keyboardType="number-pad"
              required
              editable={!isCompleted}
            />
            
            <Input
              label="Base Unit Cost"
              value={baseUnitCost}
              onChangeText={setBaseUnitCost}
              placeholder="0.00"
              keyboardType="decimal-pad"
              required
              editable={!isCompleted}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Plus size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Additional Costs
              </Text>
              {!isCompleted && (
                <TouchableOpacity
                  style={[styles.addCostButton, { backgroundColor: '#8b5cf6' }]}
                  onPress={addCost}
                >
                  <Plus size={16} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
            
            {additionalCosts.map((cost, index) => (
              <View key={index} style={styles.costItem}>
                <View style={styles.costHeader}>
                  <Text style={[styles.costTitle, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    Cost #{index + 1}
                  </Text>
                  {!isCompleted && (
                    <TouchableOpacity
                      style={[styles.removeCostButton, { backgroundColor: '#dc2626' }]}
                      onPress={() => removeCost(index)}
                    >
                      <Trash2 size={14} color="#ffffff" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <Input
                  label="Cost Type"
                  value={cost.cost_type}
                  onChangeText={(value) => updateCost(index, 'cost_type', value)}
                  placeholder="e.g., Shipping, Tax, Handling"
                  editable={!isCompleted}
                />
                
                <Input
                  label="Amount"
                  value={cost.amount?.toString() || ''}
                  onChangeText={(value) => updateCost(index, 'amount', value)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  editable={!isCompleted}
                />
                
                <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  Calculation Type
                </Text>
                <View style={styles.calculationTypes}>
                  <TouchableOpacity
                    style={[
                      styles.calculationButton,
                      {
                        backgroundColor: cost.calculation_type === 'per_unit' 
                          ? '#8b5cf6' 
                          : (isDark ? '#374151' : '#f3f4f6'),
                        borderColor: cost.calculation_type === 'per_unit' 
                          ? '#8b5cf6' 
                          : (isDark ? '#4b5563' : '#d1d5db'),
                      }
                    ]}
                    onPress={() => !isCompleted && updateCost(index, 'calculation_type', 'per_unit')}
                    disabled={isCompleted}
                  >
                    <Text style={[
                      styles.calculationButtonText,
                      { 
                        color: cost.calculation_type === 'per_unit' 
                          ? '#ffffff' 
                          : (isDark ? '#f9fafb' : '#374151') 
                      }
                    ]}>
                      Per Unit
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.calculationButton,
                      {
                        backgroundColor: cost.calculation_type === 'per_total' 
                          ? '#8b5cf6' 
                          : (isDark ? '#374151' : '#f3f4f6'),
                        borderColor: cost.calculation_type === 'per_total' 
                          ? '#8b5cf6' 
                          : (isDark ? '#4b5563' : '#d1d5db'),
                      }
                    ]}
                    onPress={() => !isCompleted && updateCost(index, 'calculation_type', 'per_total')}
                    disabled={isCompleted}
                  >
                    <Text style={[
                      styles.calculationButtonText,
                      { 
                        color: cost.calculation_type === 'per_total' 
                          ? '#ffffff' 
                          : (isDark ? '#f9fafb' : '#374151') 
                      }
                    ]}>
                      Per Total
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <Input
                  label="Description (Optional)"
                  value={cost.description || ''}
                  onChangeText={(value) => updateCost(index, 'description', value)}
                  placeholder="Additional details"
                  editable={!isCompleted}
                />
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Cost Summary
            </Text>
            
            <View style={styles.costSummary}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Base Unit Cost:
                </Text>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  ${parseFloat(baseUnitCost) || 0}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Final Unit Cost:
                </Text>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  ${finalUnitCost.toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  Total Cost:
                </Text>
                <Text style={[styles.totalValue, { color: '#059669' }]}>
                  ${totalCost.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <Input
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes about this import"
            multiline
            numberOfLines={3}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onCancel}
          style={styles.footerButton}
        />
        
        {!isCompleted ? (
          <>
            <Button
              title="Update Import"
              onPress={handleUpdate}
              loading={loading}
              style={[styles.footerButton, { flex: 2 }]}
            />
            <Button
              title="Mark as Arrived"
              onPress={handleMarkAsArrived}
              loading={markingAsArrived}
              style={[styles.footerButton, { backgroundColor: '#059669' }]}
            />
          </>
        ) : (
          <Button
            title="Update Notes"
            onPress={handleUpdate}
            loading={loading}
            style={styles.footerButton}
          />
        )}
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <Card style={styles.datePickerContainer}>
            <Text style={[styles.datePickerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {datePickerType === 'purchase' ? 'Select Purchase Date' : 'Select Arrival Date'}
            </Text>
            
            <DateRangePicker
              startDate={datePickerType === 'purchase' ? purchaseDate : (arrivalDate || new Date())}
              endDate={datePickerType === 'purchase' ? purchaseDate : (arrivalDate || new Date())}
              onConfirm={handleDateConfirm}
              onCancel={() => setShowDatePicker(false)}
            />
          </Card>
        </TouchableOpacity>
      </Modal>
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
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  addCostButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  barcode: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateButtonText: {
    fontSize: 14,
    marginLeft: 8,
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  costItem: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  costHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  costTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeCostButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculationTypes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  calculationButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  calculationButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  costSummary: {
    marginTop: 12,
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
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  footerButton: {
    flex: 1,
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