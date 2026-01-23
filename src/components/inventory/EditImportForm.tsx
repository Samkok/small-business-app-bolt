import React, { useState, useEffect } from 'react';
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
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { X, Package, DollarSign, Plus, Trash2, Calendar, CircleCheck as CheckCircle, Clock } from 'lucide-react-native';
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
  const [purchaseDate, setPurchaseDate] = useState('');
  const [arrivalDate, setArrivalDate] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isMarkingAsArrived, setIsMarkingAsArrived] = useState(false);
  const [costAmountInputs, setCostAmountInputs] = useState<Map<number, string>>(new Map());

  const { isDark } = useTheme();

  const validateDecimalInput = (text: string): string => {
    if (text === '') return '';
    if (text === '.') return '0.';

    const regex = /^\d*\.?\d*$/;
    if (!regex.test(text)) {
      return text.slice(0, -1);
    }

    const parts = text.split('.');
    if (parts.length > 2) return text.slice(0, -1);

    // Remove leading zeros unless followed by a decimal point
    if (parts[0].length > 1 && parts[0].startsWith('0') && parts.length === 1) {
      return text.slice(1);
    }

    return text;
  };

  useEffect(() => {
    if (importRecord) {
      setQuantity(importRecord.quantity?.toString() || '');
      setBaseUnitCost(importRecord.base_unit_cost?.toString() || '');
      setNotes(importRecord.notes || '');
      setAdditionalCosts(importRecord.import_costs || []);
      setPurchaseDate(importRecord.purchase_date || importRecord.created_at || '');
      setArrivalDate(importRecord.arrival_date || undefined);
      setStatus(importRecord.status || 'pending');
      
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
    if (field === 'amount') {
      const validatedValue = validateDecimalInput(value);
      // Store the string representation separately
      setCostAmountInputs(prev => {
        const newMap = new Map(prev);
        newMap.set(index, validatedValue);
        return newMap;
      });
      // Store the numeric value for calculations
      updated[index] = { ...updated[index], [field]: parseFloat(validatedValue) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
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

    const finalUnitCost = baseCost + (qty > 0 ? (totalAdditionalCost / qty) : 0);
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

    setIsMarkingAsArrived(true);
    try {
      await inventoryService.markImportAsArrived(importRecord.id, arrivalDate);
      Alert.alert('Success', 'Import marked as arrived successfully');
      onComplete();
    } catch (error) {
      console.error('Error marking import as arrived:', error);
      Alert.alert('Error', 'Failed to mark import as arrived');
    } finally {
      setIsMarkingAsArrived(false);
    }
  };

  const handleDateConfirm = (start: Date) => {
    setArrivalDate(start.toISOString());
    setShowDatePicker(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const { finalUnitCost, totalCost } = calculateFinalCost();

  const isEditable = status === 'pending';

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
            
            <Input
              label="Purchase Date"
              value={formatDate(purchaseDate)}
              editable={false}
              style={{ opacity: 0.8 }}
            />
            
            <View style={styles.statusRow}>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: status === 'completed' ? '#059669' : '#f59e0b' }
              ]}>
                {status === 'completed' ? (
                  <CheckCircle size={16} color="#ffffff" />
                ) : (
                  <Clock size={16} color="#ffffff" />
                )}
                <Text style={styles.statusText}>
                  {status === 'completed' ? 'Completed' : 'Pending'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              disabled={!isEditable}
              onPress={() => setShowDatePicker(true)}
              style={{ opacity: isEditable ? 1 : 0.7 }}
            >
              <Input
                label="Arrival Date"
                value={formatDate(arrivalDate)}
                editable={false}
                placeholder={isEditable ? "Tap to set arrival date" : "Not arrived yet"}
              />
            </TouchableOpacity>
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
              editable={isEditable}
              style={{ opacity: isEditable ? 1 : 0.7 }}
            />
            
            <Input
              label="Base Unit Cost"
              value={baseUnitCost}
              onChangeText={(text) => {
                const validatedText = validateDecimalInput(text);
                setBaseUnitCost(validatedText);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              required
              editable={isEditable}
              style={{ opacity: isEditable ? 1 : 0.7 }}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Plus size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Additional Costs
              </Text>
              {isEditable && (
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
                  <Text style={[styles.costTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Cost #{index + 1}
                  </Text>
                  {isEditable && (
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
                  editable={isEditable}
                  style={{ opacity: isEditable ? 1 : 0.7 }}
                />
                
                <Input
                  label="Amount"
                  value={costAmountInputs.get(index) || cost.amount?.toString() || ''}
                  onChangeText={(text) => updateCost(index, 'amount', text)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  editable={isEditable}
                  style={{ opacity: isEditable ? 1 : 0.7 }}
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
                        opacity: isEditable ? 1 : 0.7
                      }
                    ]}
                    onPress={() => isEditable && updateCost(index, 'calculation_type', 'per_unit')}
                    disabled={!isEditable}
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
                        opacity: isEditable ? 1 : 0.7
                      }
                    ]}
                    onPress={() => isEditable && updateCost(index, 'calculation_type', 'per_total')}
                    disabled={!isEditable}
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
                  editable={isEditable}
                  style={{ opacity: isEditable ? 1 : 0.7 }}
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
        
        {status === 'pending' && arrivalDate ? (
          <Button
            title="Mark as Arrived"
            onPress={handleMarkAsArrived}
            loading={isMarkingAsArrived}
            style={[styles.footerButton, { backgroundColor: '#059669' }]}
          />
        ) : (
          <Button
            title="Update Import"
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
        <View style={styles.modalOverlay}>
          <Card style={styles.datePickerContainer}>
            <Text style={[styles.datePickerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Arrival Date
            </Text>
            
            <DateRangePicker
              startDate={arrivalDate ? new Date(arrivalDate) : new Date()}
              endDate={arrivalDate ? new Date(arrivalDate) : new Date()}
              onConfirm={(start) => handleDateConfirm(start)}
              onCancel={() => setShowDatePicker(false)}
            />
          </Card>
        </View>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
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