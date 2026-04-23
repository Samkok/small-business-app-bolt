import React, { useState, useEffect, useRef } from 'react';
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
import { X, Package, DollarSign, Plus, Trash2, Calendar, Search, Minus, ChevronRight, Check } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { batchImportService, BatchImportItem, BatchImportCost } from '@/src/services/batchImport';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { supabase } from '@/src/config/supabase';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface EditBatchFormProps {
  batch: any;
  onComplete: () => void;
  onCancel: () => void;
}

interface ProductUnit {
  id: string;
  name: string;
  conversion_factor_to_base: number;
  is_base_unit: boolean;
}

function itemKey(productId: string, unitId?: string): string {
  return unitId ? `${productId}::${unitId}` : productId;
}

export default function EditBatchForm({ batch, onComplete, onCancel }: EditBatchFormProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<BatchImportItem[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<BatchImportCost[]>([]);
  const [notes, setNotes] = useState(batch.notes || '');
  const [purchaseDate, setPurchaseDate] = useState(batch.purchase_date || new Date().toISOString());
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [costAmountInputs, setCostAmountInputs] = useState<Map<string, string>>(new Map());
  const [itemCostInputs, setItemCostInputs] = useState<Map<string, string>>(new Map());
  const [itemQtyInputs, setItemQtyInputs] = useState<Map<string, string>>(new Map());

  // Variant picker state
  const [variantPickerProduct, setVariantPickerProduct] = useState<any>(null);
  const [variantPickerUnits, setVariantPickerUnits] = useState<ProductUnit[]>([]);
  const [showVariantPicker, setShowVariantPicker] = useState(false);

  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();

  const isEditable = batch.status === 'pending';

  const validateDecimalInput = (text: string): string => {
    if (text === '') return '';
    if (text === '.') return '0.';
    const regex = /^\d*\.?\d*$/;
    if (!regex.test(text)) return text.slice(0, -1);
    const parts = text.split('.');
    if (parts.length > 2) return text.slice(0, -1);
    if (parts[0].length > 1 && parts[0].startsWith('0') && parts.length === 1) return text.slice(1);
    return text;
  };

  useEffect(() => {
    loadProductsAndPrePopulate();
  }, [batch]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery]);

  const loadProductsAndPrePopulate = async () => {
    if (!currentBusiness?.id) return;

    try {
      const data = await productService.getProducts(currentBusiness.id);
      setProducts(data);
      setFilteredProducts(data);

      if (batch) {
        // Pre-populate costs
        setAdditionalCosts(batch.import_costs.map((cost: any) => ({
          id: cost.id,
          cost_type: cost.cost_type,
          amount: cost.amount,
          calculation_type: cost.calculation_type,
          description: cost.description,
        })));
        setNotes(batch.notes || '');
        setPurchaseDate(batch.purchase_date || new Date().toISOString());

        // Pre-populate items with unit data
        const rawItems: any[] = batch.inventory_imports || [];
        const unitIds = [...new Set(rawItems.map((i: any) => i.unit_id).filter(Boolean))] as string[];

        const conversionMap = new Map<string, number>();
        const unitLabelMap = new Map<string, string>();

        if (unitIds.length > 0) {
          const { data: units } = await supabase
            .from('units')
            .select('id, name, conversion_factor_to_base')
            .in('id', unitIds);

          (units || []).forEach((u: any) => {
            conversionMap.set(u.id, Number(u.conversion_factor_to_base));
            unitLabelMap.set(u.id, u.name);
          });
        }

        const populated: BatchImportItem[] = rawItems.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          base_unit_cost_per_item: item.base_unit_cost_per_item,
          unit_id: item.unit_id ?? undefined,
          unit_label: item.unit_id ? (unitLabelMap.get(item.unit_id) ?? undefined) : undefined,
          conversion_factor: item.unit_id ? (conversionMap.get(item.unit_id) ?? 1) : undefined,
        }));

        setSelectedItems(populated);

        // Pre-populate input maps from loaded items
        const initialQtyInputs = new Map<string, string>();
        const initialCostInputs = new Map<string, string>();
        populated.forEach(item => {
          const key = itemKey(item.product_id, item.unit_id);
          initialQtyInputs.set(key, String(item.quantity));
          initialCostInputs.set(key, String(item.base_unit_cost_per_item ?? 0));
        });
        setItemQtyInputs(initialQtyInputs);
        setItemCostInputs(initialCostInputs);
      }
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
      const q = searchQuery.toLowerCase();
      setFilteredProducts(
        products.filter(p =>
          p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(searchQuery))
        )
      );
    }
  };

  const handleProductTap = async (product: any) => {
    if (!product.unit_group_id) {
      addSingleUnitProduct(product);
      return;
    }

    // Multi-unit: fetch units for this group
    const { data: units, error } = await supabase
      .from('units')
      .select('id, name, conversion_factor_to_base, is_base_unit')
      .eq('unit_group_id', product.unit_group_id)
      .order('conversion_factor_to_base', { ascending: true });

    if (error || !units?.length) {
      addSingleUnitProduct(product);
      return;
    }

    setVariantPickerProduct(product);
    setVariantPickerUnits(units);
    setShowVariantPicker(true);
    setShowProductSelector(false);
  };

  const addSingleUnitProduct = (product: any) => {
    const key = itemKey(product.id);
    if (selectedItems.some(i => itemKey(i.product_id, i.unit_id) === key)) {
      setShowProductSelector(false);
      return;
    }
    const id = uuidv4();
    setSelectedItems(prev => [
      ...prev,
      { id, product_id: product.id, quantity: 1, base_unit_cost_per_item: 0 },
    ]);
    setItemQtyInputs(prev => { const m = new Map(prev); m.set(key, '1'); return m; });
    setItemCostInputs(prev => { const m = new Map(prev); m.set(key, '0'); return m; });
    setShowProductSelector(false);
  };

  const addVariantProduct = (unit: ProductUnit) => {
    if (!variantPickerProduct) return;
    const key = itemKey(variantPickerProduct.id, unit.id);
    if (selectedItems.some(i => itemKey(i.product_id, i.unit_id) === key)) {
      setShowVariantPicker(false);
      setVariantPickerProduct(null);
      return;
    }
    const id = uuidv4();
    setSelectedItems(prev => [
      ...prev,
      {
        id,
        product_id: variantPickerProduct.id,
        quantity: 1,
        base_unit_cost_per_item: 0,
        unit_id: unit.id,
        unit_label: unit.name,
        conversion_factor: unit.conversion_factor_to_base,
      },
    ]);
    setItemQtyInputs(prev => { const m = new Map(prev); m.set(key, '1'); return m; });
    setItemCostInputs(prev => { const m = new Map(prev); m.set(key, '0'); return m; });
    setShowVariantPicker(false);
    setVariantPickerProduct(null);
  };

  const updateItemQuantity = (key: string, delta: number) => {
    setSelectedItems(prev => {
      return prev
        .map(item => {
          if (itemKey(item.product_id, item.unit_id) !== key) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null as any;
          setItemQtyInputs(m => { const nm = new Map(m); nm.set(key, String(newQty)); return nm; });
          return { ...item, quantity: newQty };
        })
        .filter(Boolean);
    });
  };

  const updateItemQuantityText = (key: string, text: string) => {
    const validated = validateDecimalInput(text);
    setItemQtyInputs(prev => { const m = new Map(prev); m.set(key, validated); return m; });
    const num = parseFloat(validated) || 0;
    setSelectedItems(prev =>
      prev.map(item =>
        itemKey(item.product_id, item.unit_id) === key ? { ...item, quantity: num } : item
      )
    );
  };

  const updateItemCost = (key: string, text: string) => {
    const validated = validateDecimalInput(text);
    setItemCostInputs(prev => { const m = new Map(prev); m.set(key, validated); return m; });
    const num = parseFloat(validated) || 0;
    setSelectedItems(prev =>
      prev.map(item =>
        itemKey(item.product_id, item.unit_id) === key
          ? { ...item, base_unit_cost_per_item: num }
          : item
      )
    );
  };

  const removeItem = (key: string) => {
    setSelectedItems(prev => prev.filter(item => itemKey(item.product_id, item.unit_id) !== key));
    setItemQtyInputs(prev => { const m = new Map(prev); m.delete(key); return m; });
    setItemCostInputs(prev => { const m = new Map(prev); m.delete(key); return m; });
  };

  const addCost = () => {
    setAdditionalCosts(prev => [
      ...prev,
      { id: uuidv4(), cost_type: '', amount: 0, calculation_type: 'per_total', description: '' },
    ]);
  };

  const updateCost = (costId: string, field: keyof BatchImportCost, value: any) => {
    setAdditionalCosts(prev =>
      prev.map(cost => {
        if (cost.id !== costId) return cost;
        if (field === 'amount') {
          const validated = validateDecimalInput(value);
          setCostAmountInputs(m => { const nm = new Map(m); nm.set(costId, validated); return nm; });
          return { ...cost, [field]: parseFloat(validated) || 0 };
        }
        return { ...cost, [field]: value };
      })
    );
  };

  const removeCost = (costId: string) => {
    setAdditionalCosts(prev => prev.filter(c => c.id !== costId));
  };

  const getProductById = (productId: string) => products.find(p => p.id === productId);

  const calculateCostSummary = () => {
    if (selectedItems.length === 0) {
      return { totalBaseValue: 0, totalAdditionalCosts: 0, totalBatchCost: 0, itemsWithCosts: [] };
    }
    const costsWithNumbers = additionalCosts.map(c => ({ ...c, amount: parseFloat(c.amount as any) || 0 }));
    const itemsWithCosts = batchImportService.calculateItemCosts(selectedItems, costsWithNumbers);
    const totalBaseValue = itemsWithCosts.reduce((sum, item) => {
      const factor = item.conversion_factor ?? 1;
      return sum + item.quantity * item.base_unit_cost_per_item * factor;
    }, 0);
    const totalAdditionalCosts = itemsWithCosts.reduce((sum, item) => sum + (item.allocated_additional_costs || 0), 0);
    const totalBatchCost = itemsWithCosts.reduce((sum, item) => sum + (parseFloat(item.total_cost_for_item as any) || 0), 0);
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
    for (const item of selectedItems) {
      if (item.base_unit_cost_per_item < 0) {
        const product = getProductById(item.product_id);
        Alert.alert('Error', `Please enter a valid cost for ${product?.name || 'selected product'}`);
        return;
      }
    }
    for (const cost of additionalCosts) {
      if (!cost.cost_type.trim()) {
        Alert.alert('Error', 'Please enter a cost type for all additional costs');
        return;
      }
      if (isNaN(parseFloat(cost.amount as any)) || parseFloat(cost.amount as any) < 0) {
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
      await batchImportService.updateBatchImport(
        batch.id,
        { business_id: currentBusiness.id, imported_by: user.id, purchase_date: purchaseDate, notes: notes.trim() || undefined },
        selectedItems,
        additionalCosts,
      );
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

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  const { totalBaseValue, totalAdditionalCosts, totalBatchCost, itemsWithCosts } = calculateCostSummary();

  const renderVariantPicker = () => (
    <Modal visible={showVariantPicker} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Variant
            </Text>
            <Text style={[styles.modalSubtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {variantPickerProduct?.name}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setShowVariantPicker(false); setVariantPickerProduct(null); setShowProductSelector(true); }}>
            <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={variantPickerUnits}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: unit }) => {
            const alreadyAdded = variantPickerProduct
              ? selectedItems.some(i => itemKey(i.product_id, i.unit_id) === itemKey(variantPickerProduct.id, unit.id))
              : false;
            return (
              <TouchableOpacity
                style={[
                  styles.variantItem,
                  {
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                    borderColor: alreadyAdded ? '#2563eb' : (isDark ? '#374151' : '#e5e7eb'),
                    opacity: alreadyAdded ? 0.6 : 1,
                  },
                ]}
                onPress={() => !alreadyAdded && addVariantProduct(unit)}
                disabled={alreadyAdded}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.variantName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {unit.name}
                    {unit.is_base_unit && (
                      <Text style={{ color: '#2563eb', fontSize: 11 }}> (base)</Text>
                    )}
                  </Text>
                  <Text style={[styles.variantHint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                    {unit.conversion_factor_to_base === 1
                      ? 'Base unit'
                      : `1 ${unit.name} = ${unit.conversion_factor_to_base} base units`}
                  </Text>
                </View>
                {alreadyAdded ? (
                  <View style={styles.addedBadge}>
                    <Check size={14} color="#2563eb" />
                    <Text style={styles.addedBadgeText}>Added</Text>
                  </View>
                ) : (
                  <Plus size={20} color="#2563eb" />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );

  const renderProductSelector = () => (
    <Modal visible={showProductSelector} animationType="slide" presentationStyle="pageSheet">
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
          keyExtractor={item => item.id}
          style={styles.productSelectorList}
          renderItem={({ item }) => {
            const isMultiUnit = !!item.unit_group_id;
            return (
              <TouchableOpacity
                style={[styles.productSelectorItem, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
                onPress={() => handleProductTap(item)}
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.productSelectorName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {item.name}
                      </Text>
                      {isMultiUnit && (
                        <View style={styles.multiUnitBadge}>
                          <Text style={styles.multiUnitBadgeText}>Multi-unit</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.productSelectorPrice, { color: '#059669' }]}>
                      {formatCurrency(item.price)}
                    </Text>
                    <Text style={[styles.productSelectorStock, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Stock: {item.current_stock}
                    </Text>
                  </View>
                </View>
                {isMultiUnit ? (
                  <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                ) : (
                  <View style={styles.addButton}>
                    <Plus size={20} color="#2563eb" />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
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
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>Edit Batch</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          {/* Batch Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color="#0284c7" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Batch Details
              </Text>
            </View>

            <Input label="Batch ID" value={batch.id} editable={false} style={{ opacity: 0.7 }} />
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

          {/* Products */}
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
              selectedItems.map(item => {
                const product = getProductById(item.product_id);
                if (!product) return null;
                const key = itemKey(item.product_id, item.unit_id);
                const factor = item.conversion_factor ?? 1;
                const baseEquiv = item.quantity * factor;
                const isMultiUnit = !!item.unit_id;

                return (
                  <View
                    key={key}
                    style={[
                      styles.selectedItem,
                      { borderColor: isDark ? '#374151' : '#e5e7eb', backgroundColor: isDark ? '#1f2937' : '#f9fafb' },
                    ]}
                  >
                    {/* Item header */}
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                          {product.name}
                          {isMultiUnit && item.unit_label ? ` — ${item.unit_label}` : ''}
                        </Text>
                        {isMultiUnit && factor > 1 && (
                          <Text style={[styles.itemHint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                            1 {item.unit_label} = {factor} base units
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.removeButton, { opacity: isEditable ? 1 : 0.4 }]}
                        onPress={() => isEditable && removeItem(key)}
                        disabled={!isEditable}
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>

                    {/* Quantity row */}
                    <View style={styles.itemRow}>
                      <Text style={[styles.itemRowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        {isMultiUnit ? `Qty (${item.unit_label ?? 'units'}):` : 'Quantity:'}
                      </Text>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={[styles.qtyButton, { backgroundColor: '#dc2626', opacity: isEditable ? 1 : 0.4 }]}
                          onPress={() => isEditable && updateItemQuantity(key, -1)}
                          disabled={!isEditable}
                        >
                          <Minus size={14} color="#ffffff" />
                        </TouchableOpacity>
                        <TextInput
                          style={[
                            styles.qtyInput,
                            {
                              backgroundColor: isDark ? '#374151' : '#ffffff',
                              borderColor: isDark ? '#4b5563' : '#d1d5db',
                              color: isDark ? '#f9fafb' : '#111827',
                              opacity: isEditable ? 1 : 0.7,
                            },
                          ]}
                          value={itemQtyInputs.get(key) ?? String(item.quantity)}
                          onChangeText={text => isEditable && updateItemQuantityText(key, text)}
                          keyboardType="decimal-pad"
                          editable={isEditable}
                        />
                        <TouchableOpacity
                          style={[styles.qtyButton, { backgroundColor: '#2563eb', opacity: isEditable ? 1 : 0.4 }]}
                          onPress={() => isEditable && updateItemQuantity(key, 1)}
                          disabled={!isEditable}
                        >
                          <Plus size={14} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                      {isMultiUnit && (
                        <Text style={[styles.baseEquivText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                          = {baseEquiv} base
                        </Text>
                      )}
                    </View>

                    {/* Cost row */}
                    <View style={styles.itemRow}>
                      <Text style={[styles.itemRowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        {isMultiUnit ? `Cost / ${item.unit_label ?? 'unit'}:` : 'Cost / unit:'}
                      </Text>
                      <TextInput
                        style={[
                          styles.costInput,
                          {
                            backgroundColor: isDark ? '#374151' : '#ffffff',
                            borderColor: isDark ? '#4b5563' : '#d1d5db',
                            color: isDark ? '#f9fafb' : '#111827',
                            opacity: isEditable ? 1 : 0.7,
                          },
                        ]}
                        value={itemCostInputs.get(key) ?? String(item.base_unit_cost_per_item ?? 0)}
                        onChangeText={text => isEditable && updateItemCost(key, text)}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        editable={isEditable}
                      />
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
              additionalCosts.map(cost => (
                <View key={cost.id} style={[styles.costItem, { borderColor: isDark ? '#374151' : '#e5e7eb' }]}>
                  <View style={styles.costHeader}>
                    <Text style={[styles.costTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {cost.cost_type || 'New Cost'}
                    </Text>
                    {isEditable && (
                      <TouchableOpacity
                        style={[styles.removeCostButton, { backgroundColor: '#dc2626' }]}
                        onPress={() => removeCost(cost.id)}
                      >
                        <Trash2 size={14} color="#ffffff" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Input
                    label="Cost Type"
                    value={cost.cost_type}
                    onChangeText={v => updateCost(cost.id, 'cost_type', v)}
                    placeholder="e.g., Shipping, Tax, Handling"
                    editable={isEditable}
                    style={{ opacity: isEditable ? 1 : 0.7 }}
                  />
                  <Input
                    label="Amount"
                    value={costAmountInputs.get(cost.id) ?? String(cost.amount ?? '')}
                    onChangeText={v => updateCost(cost.id, 'amount', v)}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    editable={isEditable}
                    style={{ opacity: isEditable ? 1 : 0.7 }}
                  />

                  <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    Calculation Type
                  </Text>
                  <View style={styles.calculationTypes}>
                    {(['per_unit', 'per_total'] as const).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.calculationButton,
                          {
                            backgroundColor: cost.calculation_type === type
                              ? '#ea580c'
                              : (isDark ? '#374151' : '#f3f4f6'),
                            borderColor: cost.calculation_type === type
                              ? '#ea580c'
                              : (isDark ? '#4b5563' : '#d1d5db'),
                            opacity: isEditable ? 1 : 0.7,
                          },
                        ]}
                        onPress={() => isEditable && updateCost(cost.id, 'calculation_type', type)}
                        disabled={!isEditable}
                      >
                        <Text
                          style={[
                            styles.calculationButtonText,
                            { color: cost.calculation_type === type ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') },
                          ]}
                        >
                          {type === 'per_unit' ? 'Per Base Unit' : 'Per Total'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Input
                    label="Description (Optional)"
                    value={cost.description || ''}
                    onChangeText={v => updateCost(cost.id, 'description', v)}
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
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Total Base Value:</Text>
                  <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#374151' }]}>{formatCurrency(totalBaseValue)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Total Additional Costs:</Text>
                  <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#374151' }]}>{formatCurrency(totalAdditionalCosts)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>Total Batch Cost:</Text>
                  <Text style={[styles.totalValue, { color: '#059669' }]}>{formatCurrency(totalBatchCost)}</Text>
                </View>
              </View>

              <View style={styles.itemCostBreakdown}>
                <Text style={[styles.breakdownTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Cost Breakdown by Item:
                </Text>
                {itemsWithCosts.map(item => {
                  const product = getProductById(item.product_id);
                  const factor = item.conversion_factor ?? 1;
                  const baseEquiv = item.quantity * factor;
                  return (
                    <View key={itemKey(item.product_id, item.unit_id)} style={styles.itemCostRow}>
                      <Text style={[styles.itemCostName, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        {product?.name}
                        {item.unit_label ? ` (${item.unit_label})` : ''}
                        {' '}({item.quantity}×{factor > 1 ? ` = ${baseEquiv} base` : ''}):
                      </Text>
                      <Text style={[styles.itemCostValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                        {formatCurrency(item.total_cost_for_item)}
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
        <Button title="Cancel" variant="outline" onPress={onCancel} style={styles.footerButton} />
        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={loading}
          style={styles.footerButton}
          disabled={!isEditable}
        />
      </View>

      {renderProductSelector()}
      {renderVariantPicker()}

      <Modal
        visible={showDatePicker}
        transparent
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
              onConfirm={start => handleDateConfirm(start)}
              onCancel={() => setShowDatePicker(false)}
            />
          </Card>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  closeButton: { padding: 8 },
  content: { flex: 1, paddingHorizontal: 16 },
  form: { padding: 20 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginLeft: 8, flex: 1 },
  addProductButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addCostButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyProducts: { alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  selectedItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemHint: { fontSize: 11, marginTop: 2 },
  removeButton: { padding: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemRowLabel: { fontSize: 12, width: 100 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  qtyInput: {
    width: 56,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    fontSize: 13,
    textAlign: 'center',
  },
  baseEquivText: { fontSize: 11 },
  costInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  costItem: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  costHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  costTitle: { fontSize: 14, fontWeight: '600' },
  removeCostButton: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  calculationTypes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  calculationButton: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  calculationButtonText: { fontSize: 12, fontWeight: '500' },
  costSummary: { marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  totalRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  totalLabel: { fontSize: 16, fontWeight: 'bold' },
  totalValue: { fontSize: 18, fontWeight: 'bold' },
  itemCostBreakdown: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  breakdownTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  itemCostRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemCostName: { fontSize: 12, flex: 1, paddingRight: 8 },
  itemCostValue: { fontSize: 12, fontWeight: '500' },
  footer: { flexDirection: 'row', padding: 16, gap: 12 },
  footerButton: { flex: 1 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 13, marginTop: 2 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 16 },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
  productSelectorList: { flex: 1, paddingHorizontal: 16 },
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
  productSelectorInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  productSelectorImage: { width: 40, height: 40, borderRadius: 4, marginRight: 12 },
  imagePlaceholder: { width: 40, height: 40, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productSelectorDetails: { flex: 1 },
  productSelectorName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  productSelectorPrice: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  productSelectorStock: { fontSize: 11 },
  multiUnitBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  multiUnitBadgeText: { fontSize: 10, color: '#1d4ed8', fontWeight: '600' },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  variantName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  variantHint: { fontSize: 12 },
  addedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addedBadgeText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerContainer: { width: '100%', maxWidth: 400, padding: 20 },
  datePickerTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
});
