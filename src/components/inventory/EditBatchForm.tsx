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
  Modal,
  TextInput,
  FlatList
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import { X, Package, DollarSign, Plus, Trash2, Calendar, Search, Minus, ShoppingCart } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { batchImportService, BatchImportItem, BatchImportCost } from '@/src/services/batchImport';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { v4 as uuidv4 } from 'uuid';

interface EditBatchFormProps {
  batch: any; // The batch object to edit
  onComplete: () => void;
  onCancel: () => void;
}

export default function EditBatchForm({ batch, onComplete, onCancel }: EditBatchFormProps) {
  const [products, setProducts] = useState<any[]>([]); // All available products
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<BatchImportItem[]>([]); // Products in this batch
  const [additionalCosts, setAdditionalCosts] = useState<BatchImportCost[]>([]);
  const [notes, setNotes] = useState(batch.notes || '');
  const [purchaseDate, setPurchaseDate] = useState(batch.purchase_date || new Date().toISOString());
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();

  const isEditable = batch.status === 'pending';

  const validateDecimalInput = (text: string): string => {
    if (text === '') return '';
    if (text === '.') return '0.';
    const regex = /^\d*\.?\d*$/;
    if (regex.test(text)) {
      const parts = text.split('.');
      if (parts.length > 2) return text.slice(0, -1);
      return text;
    }
    return text.slice(0, -1);
  };

  useEffect(() => {
    loadProducts();
    // Pre-populate selected items and costs from the batch prop
    if (batch) {
      setSelectedItems(batch.inventory_imports.map((item: any) => ({
        id: item.id, // Keep existing ID for updates
        product_id: item.product_id,
        quantity: item.quantity,
        base_unit_cost_per_item: item.base_unit_cost_per_item
      })));
      setAdditionalCosts(batch.import_costs.map((cost: any) => ({
        id: cost.id, // Keep existing ID for updates
        cost_type: cost.cost_type,
        amount: cost.amount,
        calculation_type: cost.calculation_type,
        description: cost.description
      })));
      setNotes(batch.notes || '');
      setPurchaseDate(batch.purchase_date || new Date().toISOString());
    }
  }, [batch]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery]);

  const loadProducts = async () => {
    if (!currentBusiness?.id) return;
    
    try {
      const data = await productService.getProducts(currentBusiness.id);
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const filterProducts = () => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchQuery))
      );
      setFilteredProducts(filtered);
    }
  };

  const addProduct = (product: any) => {
    const existingIndex = selectedItems.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Update quantity if product already selected
      const updated = [...selectedItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 1
      };
      setSelectedItems(updated);
    } else {
      // Add new product with a new UUID
      setSelectedItems([...selectedItems, {
        id: uuidv4(), // Assign a new ID for new items
        product_id: product.id,
        quantity: 1,
        base_unit_cost_per_item: 0
      }]);
    }
    
    setShowProductSelector(false);
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(selectedItems.filter(item => item.id !== itemId));
    } else {
      setSelectedItems(selectedItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      ));
    }
  };

  const updateItemCost = (itemId: string, cost: number) => {
    setSelectedItems(selectedItems.map(item =>
      item.id === itemId ? { ...item, base_unit_cost_per_item: cost } : item
    ));
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== itemId));
  };

  const addCost = () => {
    setAdditionalCosts([...additionalCosts, {
      id: uuidv4(), // Assign a new ID for new costs
      cost_type: '',
      amount: 0,
      calculation_type: 'per_total',
      description: ''
    }]);
  };

  const updateCost = (costId: string, field: keyof BatchImportCost, value: any) => {
    const updated = additionalCosts.map(cost => {
      if (cost.id === costId) {
        if (field === 'amount') {
          const validatedValue = validateDecimalInput(value);
          return { ...cost, [field]: validatedValue };
        }
        return { ...cost, [field]: value };
      }
      return cost;
    });
    setAdditionalCosts(updated);
  };

  const removeCost = (costId: string) => {
    setAdditionalCosts(additionalCosts.filter(cost => cost.id !== costId));
  };

  const getProductById = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const calculateCostSummary = () => {
    if (selectedItems.length === 0) {
      return { totalBaseValue: 0, totalAdditionalCosts: 0, totalBatchCost: 0, itemsWithCosts: [] };
    }

    // Convert string amounts to numbers for calculation
    const costsWithNumbers = additionalCosts.map(cost => ({
      ...cost,
      amount: parseFloat(cost.amount as any) || 0
    }));
    
    const itemsWithCosts = batchImportService.calculateItemCosts(selectedItems, costsWithNumbers);
    const totalBaseValue = selectedItems.reduce((sum, item) => sum + (item.quantity * item.base_unit_cost_per_item), 0);
    const totalAdditionalCosts = itemsWithCosts.reduce((sum, item) => sum + (item.allocated_additional_costs || 0), 0);
    const totalBatchCost = itemsWithCosts.reduce((sum, item) => {
      const cost = parseFloat(item.total_cost_for_item as any) || 0; // Ensure it's a number
      return sum + cost;
    }, 0);

    return { totalBaseValue, totalAdditionalCosts, totalBatchCost, itemsWithCosts };
  };

  const handleSave = async () => {
    if (!isEditable) {
      Alert.alert('Error', 'This batch cannot be edited because its status is not pending.');
      return;
    }

    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please select at least one product');
      return;
    }

    // Validate that all items have costs
    for (const item of selectedItems) {
      if (item.base_unit_cost_per_item === null || item.base_unit_cost_per_item < 0) {
        const product = getProductById(item.product_id);
        Alert.alert('Error', `Please enter a valid base cost for ${product?.name || 'selected product'}`);
        return;
      }
    }

    // Validate additional costs
    for (const cost of additionalCosts) {
      if (!cost.cost_type.trim()) {
        Alert.alert('Error', 'Please enter a cost type for all additional costs');
        return;
      }
      const amount = parseFloat(cost.amount as any);
      if (isNaN(amount) || amount < 0) {
        Alert.alert('Error', 'Please enter valid amounts for all additional costs');
        return;
      }
    }

    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business found');
      return;
    }

    setLoading(true);
    try {
      const batchData = {
        business_id: currentBusiness.id,
        imported_by: user.id,
        purchase_date: purchaseDate,
        notes: notes.trim() || undefined,
      };

      console.log("Batch Data: ", batchData);
      console.log("Items: ", selectedItems);

      await batchImportService.updateBatchImport(batch.id, batchData, selectedItems, additionalCosts);
      Alert.alert('Success', 'Batch updated successfully');
      onComplete();
    } catch (error: any) {
      console.error('Error updating batch:', error);
      Alert.alert('Error', error.message || 'Failed to update batch');
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

  const { totalBaseValue, totalAdditionalCosts, totalBatchCost, itemsWithCosts } = calculateCostSummary();

  const renderProductSelector = () => (
    <Modal
      visible={showProductSelector}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Select Products
          </Text>
          <TouchableOpacity onPress={() => setShowProductSelector(false)}>
            <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}>
            <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
              placeholder="Search products..."
              placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.productSelectorItem, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
              onPress={() => addProduct(item)}
            >
              <View style={styles.productSelectorInfo}>
                {item.image_url ? (
                  <OptimizedImage 
                    source={{ uri: item.image_url }} 
                    style={styles.productSelectorImage} 
                    resizeMode="contain" 
                    alt={item.name}
                  />
                ) : (
                  <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}>
                    <Package size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                  </View>
                )}
                
                <View style={styles.productSelectorDetails}>
                  <Text style={[styles.productSelectorName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.productSelectorPrice, { color: '#059669' }]}>
                    ${item.price.toFixed(2)}
                  </Text>
                  <Text style={[styles.productSelectorStock, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Stock: {item.current_stock}
                  </Text>
                </View>
              </View>
              
              <View style={styles.addButton}>
                <Plus size={20} color="#2563eb" />
              </View>
            </TouchableOpacity>
          )}
          style={styles.productSelectorList}
        />
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Edit Batch
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Batch Details
              </Text>
            </View>
            
            <Input
              label="Batch ID"
              value={batch.id}
              editable={false}
              style={{ opacity: 0.7 }}
            />

            <Input
              label="Status"
              value={batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
              editable={false}
              style={{ opacity: 0.7 }}
            />
            
            <TouchableOpacity onPress={() => isEditable && setShowDatePicker(true)} disabled={!isEditable}>
              <Input
                label="Purchase Date"
                value={formatDate(purchaseDate)}
                editable={false}
                placeholder="Tap to set purchase date"
                style={{ opacity: isEditable ? 1 : 0.7 }}
              />
            </TouchableOpacity>
          </View>

          {/* Selected Products */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Package size={20} color="#2563eb" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Products in Batch ({selectedItems.length})
              </Text>
              {isEditable && (
                <TouchableOpacity
                  style={[styles.addProductButton, { backgroundColor: '#2563eb' }]}
                  onPress={() => setShowProductSelector(true)}
                >
                  <Plus size={16} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
            
            {selectedItems.length === 0 ? (
              <View style={styles.emptyProducts}>
                <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  No products selected. Tap the + button to add products.
                </Text>
              </View>
            ) : (
              selectedItems.map((item) => {
                const product = getProductById(item.product_id);
                if (!product) return null;
                
                return (
                  <View key={item.id} style={styles.selectedItem}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {product.name}
                      </Text>
                      <Text style={[styles.itemPrice, { color: '#059669' }]}>
                        ${product.price.toFixed(2)}
                      </Text>
                    </View>
                    
                    <View style={styles.itemControls}>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={[styles.quantityButton, { backgroundColor: '#dc2626', opacity: isEditable ? 1 : 0.5 }]}
                          onPress={() => isEditable && updateItemQuantity(item.id, item.quantity - 1)}
                          disabled={!isEditable}
                        >
                          <Minus size={16} color="#ffffff" />
                        </TouchableOpacity>
                        
                        <Text style={[styles.quantityText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                          {item.quantity}
                        </Text>
                        
                        <TouchableOpacity
                          style={[styles.quantityButton, { backgroundColor: '#2563eb', opacity: isEditable ? 1 : 0.5 }]}
                          onPress={() => isEditable && updateItemQuantity(item.id, item.quantity + 1)}
                          disabled={!isEditable}
                        >
                          <Plus size={16} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.costInput}>
                        <Text style={[styles.costLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                          Unit Cost:
                        </Text>
                        <TextInput
                          style={[styles.costTextInput, {
                            backgroundColor: isDark ? '#374151' : '#f9fafb',
                            borderColor: isDark ? '#4b5563' : '#d1d5db',
                            color: isDark ? '#f9fafb' : '#111827',
                            opacity: isEditable ? 1 : 0.7
                          }]}
                          value={item.base_unit_cost_per_item?.toString() || '0'}
                          onChangeText={(text) => {
                            const validatedText = validateDecimalInput(text);
                            updateItemCost(item.id, parseFloat(validatedText) || 0);
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          editable={isEditable}
                        />
                      </View>
                      
                      <TouchableOpacity
                        style={[styles.removeButton, { backgroundColor: '#dc2626', opacity: isEditable ? 1 : 0.5 }]}
                        onPress={() => isEditable && removeItem(item.id)}
                        disabled={!isEditable}
                      >
                        <Trash2 size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Additional Costs */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={20} color="#ea580c" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Additional Costs ({additionalCosts.length})
              </Text>
              {isEditable && (
                <TouchableOpacity
                  style={[styles.addCostButton, { backgroundColor: '#ea580c' }]}
                  onPress={addCost}
                >
                  <Plus size={16} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
            
            {additionalCosts.length === 0 ? (
              <View style={styles.emptyProducts}>
                <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  No additional costs. Tap the + button to add costs.
                </Text>
              </View>
            ) : (
              additionalCosts.map((cost) => (
                <View key={cost.id} style={styles.costItem}>
                  <View style={styles.costHeader}>
                    <Text style={[styles.costTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      Cost: {cost.cost_type || 'New Cost'}
                    </Text>
                    {isEditable && (
                      <TouchableOpacity
                        style={[styles.removeCostButton, { backgroundColor: '#dc2626' }]}
                        onPress={() => isEditable && removeCost(cost.id)}
                        disabled={!isEditable}
                      >
                        <Trash2 size={14} color="#ffffff" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <Input
                    label="Cost Type"
                    value={cost.cost_type}
                    onChangeText={(value) => updateCost(cost.id, 'cost_type', value)}
                    placeholder="e.g., Shipping, Tax, Handling"
                    editable={isEditable}
                    style={{ opacity: isEditable ? 1 : 0.7 }}
                  />
                  
                  <Input
                    label="Amount"
                    value={cost.amount?.toString() || ''}
                    onChangeText={(value) => {
                      updateCost(cost.id, 'amount', value);
                    }}
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
                            ? '#ea580c' 
                            : (isDark ? '#374151' : '#f3f4f6'),
                          borderColor: cost.calculation_type === 'per_unit' 
                            ? '#ea580c' 
                            : (isDark ? '#4b5563' : '#d1d5db'),
                          opacity: isEditable ? 1 : 0.7
                        }
                      ]}
                      onPress={() => isEditable && updateCost(cost.id, 'calculation_type', 'per_unit')}
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
                            ? '#ea580c' 
                            : (isDark ? '#374151' : '#f3f4f6'),
                          borderColor: cost.calculation_type === 'per_total' 
                            ? '#ea580c' 
                            : (isDark ? '#4b5563' : '#d1d5db'),
                          opacity: isEditable ? 1 : 0.7
                        }
                      ]}
                      onPress={() => isEditable && updateCost(cost.id, 'calculation_type', 'per_total')}
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
                    onChangeText={(value) => updateCost(cost.id, 'description', value)}
                    placeholder="Additional details"
                    editable={isEditable}
                    style={{ opacity: isEditable ? 1 : 0.7 }}
                  />
                </View>
              ))
            )}
          </Card>

          {/* Cost Summary */}
          {selectedItems.length > 0 && (
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Cost Summary
              </Text>
              
              <View style={styles.costSummary}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Total Base Value:
                  </Text>
                  <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    ${totalBaseValue.toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Total Additional Costs:
                  </Text>
                  <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    ${totalAdditionalCosts.toFixed(2)}
                  </Text>
                </View>
                
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    Total Batch Cost:
                  </Text>
                  <Text style={[styles.totalValue, { color: '#059669' }]}>
                    ${totalBatchCost.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Individual Item Costs */}
              <View style={styles.itemCostBreakdown}>
                <Text style={[styles.breakdownTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Cost Breakdown by Item:
                </Text>
                {itemsWithCosts.map((item) => {
                  const product = getProductById(item.product_id);
                  return (
                    <View key={item.id} style={styles.itemCostRow}>
                      <Text style={[styles.itemCostName, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        {product?.name} ({item.quantity}x):
                      </Text>
                      <Text style={[styles.itemCostValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                        ${item.total_cost_for_item.toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          )}

          {/* Notes */}
          <Card style={styles.section}>
            <Input
              label="Import Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes about this import"
              multiline
              numberOfLines={3}
              editable={isEditable}
              style={{ opacity: isEditable ? 1 : 0.7 }}
            />
          </Card>
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
          title="Save Changes"
          onPress={handleSave}
          loading={loading}
          style={styles.footerButton}
          disabled={!isEditable}
        />
      </View>

      {/* Product Selector Modal */}
      {renderProductSelector()}

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
  addProductButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCostButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyProducts: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 12,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
    width: 30,
    textAlign: 'center',
  },
  costInput: {
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  costTextInput: {
    width: 60,
    height: 32,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
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
    marginBottom: 16,
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
  itemCostBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemCostName: {
    fontSize: 12,
  },
  itemCostValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  productSelectorList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productSelectorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productSelectorImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productSelectorDetails: {
    flex: 1,
  },
  productSelectorName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  productSelectorPrice: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  productSelectorStock: {
    fontSize: 11,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb20',
    alignItems: 'center',
    justifyContent: 'center',
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