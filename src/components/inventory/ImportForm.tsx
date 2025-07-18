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
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { X, Package, DollarSign, Plus, Trash2, Calendar } from 'lucide-react-native';
import { inventoryService } from '@/src/services/inventory';
import { productService } from '@/src/services/products';
import DateRangePicker from '@/src/components/sales/DateRangePicker';

interface ImportFormProps {
  productId?: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ImportForm({ productId, onComplete, onCancel }: ImportFormProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(productId || '');
  const [quantity, setQuantity] = useState('');
  const [baseUnitCost, setBaseUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [additionalCosts, setAdditionalCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { isDark } = useTheme();
  const { profile } = useAuth();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    if (!profile?.id) return;
    
    try {
      const data = await productService.getProducts(profile.id);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    }
  };

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

    const finalUnitCost = baseCost + (qty > 0 ? (totalAdditionalCost / qty) : 0);
    const totalCost = finalUnitCost * qty;

    return { finalUnitCost: isNaN(finalUnitCost) ? 0 : finalUnitCost, totalCost: isNaN(totalCost) ? 0 : totalCost };
  };

  const handleImport = async () => {
    if (!selectedProductId || !quantity || !baseUnitCost) {
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

    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
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
        product_id: selectedProductId,
        quantity: qtyValue,
        base_unit_cost: baseCostValue,
        final_unit_cost: finalUnitCost,
        total_cost: totalCost,
        notes: notes.trim() || null,
        business_id: profile.id,
        imported_by: profile.id,
        purchase_date: purchaseDate,
        status: 'pending' as const
      };

      const costs = additionalCosts.map(cost => ({
        cost_type: cost.cost_type.trim(),
        amount: parseFloat(cost.amount),
        calculation_type: cost.calculation_type,
        description: cost.description?.trim() || null,
      }));

      await inventoryService.createImport(importData, costs);
      Alert.alert('Success', 'Stock import created successfully');
      onComplete();
    } catch (error) {
      console.error('Error importing stock:', error);
      Alert.alert('Error', 'Failed to import stock');
    } finally {
      setLoading(false);
    }
  };

  const handleDateConfirm = (start: Date) => {
    setPurchaseDate(start.toISOString());
    setShowDatePicker(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const { finalUnitCost, totalCost } = calculateFinalCost();

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Import Stock
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
                Product Selection
              </Text>
            </View>
            
            <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
              Select Product *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productList}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productButton,
                    {
                      backgroundColor: selectedProductId === product.id 
                        ? '#2563eb' 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      borderColor: selectedProductId === product.id 
                        ? '#2563eb' 
                        : (isDark ? '#4b5563' : '#d1d5db'),
                    }
                  ]}
                  onPress={() => setSelectedProductId(product.id)}
                >
                  <Text style={[
                    styles.productButtonText,
                    { 
                      color: selectedProductId === product.id 
                        ? '#ffffff' 
                        : (isDark ? '#f9fafb' : '#374151') 
                    }
                  ]} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={[
                    styles.productStock,
                    { 
                      color: selectedProductId === product.id 
                        ? '#ffffff' 
                        : (isDark ? '#d1d5db' : '#6b7280') 
                    }
                  ]}>
                    Stock: {product.current_stock}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Purchase Date
              </Text>
            </View>
            
            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <Input
                label="Purchase Date"
                value={formatDate(purchaseDate)}
                editable={false}
                placeholder="Tap to set purchase date"
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
              placeholder="Enter quantity to import"
              keyboardType="number-pad"
              required
            />
            
            <Input
              label="Base Unit Cost"
              value={baseUnitCost}
              onChangeText={setBaseUnitCost}
              placeholder="0.00"
              keyboardType="decimal-pad"
              required
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Plus size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Additional Costs
              </Text>
              <TouchableOpacity
                style={[styles.addCostButton, { backgroundColor: '#8b5cf6' }]}
                onPress={addCost}
              >
                <Plus size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            {additionalCosts.map((cost, index) => (
              <View key={index} style={styles.costItem}>
                <View style={styles.costHeader}>
                  <Text style={[styles.costTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Cost #{index + 1}
                  </Text>
                  <TouchableOpacity
                    style={[styles.removeCostButton, { backgroundColor: '#dc2626' }]}
                    onPress={() => removeCost(index)}
                  >
                    <Trash2 size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                
                <Input
                  label="Cost Type"
                  value={cost.cost_type}
                  onChangeText={(value) => updateCost(index, 'cost_type', value)}
                  placeholder="e.g., Shipping, Tax, Handling"
                />
                
                <Input
                  label="Amount"
                  value={cost.amount}
                  onChangeText={(value) => updateCost(index, 'amount', value)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
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
                    onPress={() => updateCost(index, 'calculation_type', 'per_unit')}
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
                    onPress={() => updateCost(index, 'calculation_type', 'per_total')}
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
                  value={cost.description}
                  onChangeText={(value) => updateCost(index, 'description', value)}
                  placeholder="Additional details"
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
        <Button
          title="Create Import"
          onPress={handleImport}
          loading={loading}
          style={styles.footerButton}
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
              Select Purchase Date
            </Text>
            
            <DateRangePicker
              startDate={purchaseDate ? new Date(purchaseDate) : new Date()}
              endDate={purchaseDate ? new Date(purchaseDate) : new Date()}
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  productList: {
    marginBottom: 8,
  },
  productButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  productButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  productStock: {
    fontSize: 12,
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