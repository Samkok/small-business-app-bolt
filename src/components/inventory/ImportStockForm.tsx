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
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { X, Package, DollarSign, Plus, Trash2, Calendar, Search, Minus, ShoppingCart } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { batchImportService, BatchImportItem, BatchImportCost } from '@/src/services/batchImport';
import DateRangePicker from '@/src/components/sales/DateRangePicker';

interface ImportStockFormProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function ImportStockForm({ onComplete, onCancel }: ImportStockFormProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<BatchImportItem[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<BatchImportCost[]>([]);
  const [notes, setNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString());
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  useEffect(() => {
    loadProducts();
  }, []);

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
      // Add new product
      setSelectedItems([...selectedItems, {
        product_id: product.id,
        quantity: 1,
        base_unit_cost_per_item: 0
      }]);
    }
    
    setShowProductSelector(false);
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(selectedItems.filter(item => item.product_id !== productId));
    } else {
      setSelectedItems(selectedItems.map(item =>
        item.product_id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const updateItemCost = (productId: string, cost: number) => {
    setSelectedItems(selectedItems.map(item =>
      item.product_id === productId ? { ...item, base_unit_cost_per_item: cost } : item
    ));
  };

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(item => item.product_id !== productId));
  };

  const addCost = () => {
    setAdditionalCosts([...additionalCosts, {
      cost_type: '',
      amount: 0,
      calculation_type: 'per_total',
      description: ''
    }]);
  };

  const updateCost = (index: number, field: keyof BatchImportCost, value: any) => {
    const updated = [...additionalCosts];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalCosts(updated);
  };

  const removeCost = (index: number) => {
    setAdditionalCosts(additionalCosts.filter((_, i) => i !== index));
  };

  const getProductById = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const calculateCostSummary = () => {
    if (selectedItems.length === 0) {
      return { totalBaseValue: 0, totalAdditionalCosts: 0, totalBatchCost: 0, itemsWithCosts: [] };
    }

    const itemsWithCosts = batchImportService.calculateItemCosts(selectedItems, additionalCosts);
    const totalBaseValue = selectedItems.reduce((sum, item) => sum + (item.quantity * item.base_unit_cost_per_item), 0);
    const totalAdditionalCosts = itemsWithCosts.reduce((sum, item) => sum + (item.allocated_additional_costs || 0), 0);
    const totalBatchCost = itemsWithCosts.reduce((sum, item) => {
      const cost = parseFloat(item.total_cost_for_item) || 0;
      return sum + cost;
    }, 0);

    return { totalBaseValue, totalAdditionalCosts, totalBatchCost, itemsWithCosts };
  };

  const handleImport = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please select at least one product');
      return;
    }

    // Validate that all items have costs
    for (const item of selectedItems) {
      if (!item.base_unit_cost_per_item || item.base_unit_cost_per_item <= 0) {
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
      if (!cost.amount || cost.amount <= 0) {
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
        imported_by: currentBusiness.id,
        purchase_date: purchaseDate,
        notes: notes.trim() || undefined,
        items: selectedItems,
        costs: additionalCosts
      };

      console.log(batchData);

      await batchImportService.createBatchImport(batchData);
      Alert.alert('Success', 'Stock import created successfully');
      onComplete();
    } catch (error) {
      console.error('Error creating import:', error);
      Alert.alert('Error', 'Failed to create import');
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
          Import Stock
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Purchase Date */}
        <Card style={styles.section}>
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
        </Card>

        {/* Selected Products */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Package size={20} color="#2563eb" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Selected Products ({selectedItems.length})
            </Text>
            <TouchableOpacity
              style={[styles.addProductButton, { backgroundColor: '#2563eb' }]}
              onPress={() => setShowProductSelector(true)}
            >
              <Plus size={16} color="#ffffff" />
            </TouchableOpacity>
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
                <View key={item.product_id} style={styles.selectedItem}>
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
                        style={[styles.quantityButton, { backgroundColor: '#dc2626' }]}
                        onPress={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                      >
                        <Minus size={16} color="#ffffff" />
                      </TouchableOpacity>
                      
                      <Text style={[styles.quantityText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {item.quantity}
                      </Text>
                      
                      <TouchableOpacity
                        style={[styles.quantityButton, { backgroundColor: '#2563eb' }]}
                        onPress={() => updateItemQuantity(item.product_id, item.quantity + 1)}
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
                          color: isDark ? '#f9fafb' : '#111827'
                        }]}
                        value={item.base_unit_cost_per_item ?? item.base_unit_cost_per_item.toString()}
                        onChangeText={(value) => updateItemCost(item.product_id, parseFloat(value) || 0)}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: '#dc2626' }]}
                      onPress={() => removeItem(item.product_id)}
                    >
                      <Trash2 size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Additional Costs */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <DollarSign size={20} color="#ea580c" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Additional Costs
            </Text>
            <TouchableOpacity
              style={[styles.addCostButton, { backgroundColor: '#ea580c' }]}
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
                value={cost.amount ?? cost.amount.toString()}
                onChangeText={(value) => updateCost(index, 'amount', parseFloat(value) || 0)}
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
                        ? '#ea580c' 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      borderColor: cost.calculation_type === 'per_unit' 
                        ? '#ea580c' 
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
                        ? '#ea580c' 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      borderColor: cost.calculation_type === 'per_total' 
                        ? '#ea580c' 
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
                value={cost.description || ''}
                onChangeText={(value) => updateCost(index, 'description', value)}
                placeholder="Additional details"
              />
            </View>
          ))}
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
                  Additional Costs:
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
                  <View key={item.product_id} style={styles.itemCostRow}>
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
          disabled={selectedItems.length === 0}
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
  section: {
    padding: 16,
    marginBottom: 16,
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