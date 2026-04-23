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
  FlatList,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import {
  X,
  Package,
  DollarSign,
  Plus,
  Trash2,
  Calendar,
  Search,
  Minus,
  ChevronRight,
  Layers,
} from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { batchImportService, BatchImportItem, BatchImportCost } from '@/src/services/batchImport';
import { unitService, ProductUnit, Unit } from '@/src/services/units';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { useCurrencyContext } from '@/src/context/CurrencyContext';

interface ImportStockFormProps {
  onComplete: () => void;
  onCancel: () => void;
}

// Stable key for a line item (product + optional unit)
function itemKey(productId: string, unitId?: string): string {
  return unitId ? `${productId}::${unitId}` : productId;
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
  const [itemCostInputs, setItemCostInputs] = useState<Map<string, string>>(new Map());
  const [costAmountInputs, setCostAmountInputs] = useState<Map<number, string>>(new Map());

  // Variant picker state
  const [variantPickerProduct, setVariantPickerProduct] = useState<any>(null);
  const [variantPickerUnits, setVariantPickerUnits] = useState<Array<ProductUnit & { unit: Unit }>>([]);
  const [showVariantPicker, setShowVariantPicker] = useState(false);

  const { isDark } = useTheme();
  const { formatPrice } = useCurrencyContext();
  const { currentBusiness, user } = useAuth();

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

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { filterProducts(); }, [products, searchQuery]);

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
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(
        products.filter(
          p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchQuery)),
        ),
      );
    }
  };

  // Called when user taps a product in the selector list
  const handleProductTap = async (product: any) => {
    if (product.unit_group_id) {
      // Multi-unit: fetch variants then show variant picker
      try {
        const productUnits = await unitService.getProductUnits(product.id);
        if (productUnits.length === 0) {
          // No variants configured yet – fall back to single-unit flow
          addSingleUnitProduct(product);
          return;
        }
        // Fetch unit metadata (conversion factor) for each variant
        const { data: unitsData } = await (supabase => supabase
          .from('units')
          .select('*')
          .in('id', productUnits.map(pu => pu.unit_id))
        )(require('@/src/config/supabase').supabase);

        const unitMap = new Map<string, Unit>((unitsData || []).map((u: Unit) => [u.id, u]));
        const enriched = productUnits
          .map(pu => ({ ...pu, unit: unitMap.get(pu.unit_id)! }))
          .filter(pu => pu.unit);

        setVariantPickerProduct(product);
        setVariantPickerUnits(enriched);
        setShowProductSelector(false);
        setShowVariantPicker(true);
      } catch (e) {
        console.error('Error loading product units:', e);
        addSingleUnitProduct(product);
      }
    } else {
      addSingleUnitProduct(product);
    }
  };

  const addSingleUnitProduct = (product: any) => {
    setSelectedItems(prev => {
      const key = itemKey(product.id);
      const existing = prev.findIndex(i => itemKey(i.product_id, i.unit_id) === key);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, { product_id: product.id, quantity: 1, base_unit_cost_per_item: 0 }];
    });
    setShowProductSelector(false);
  };

  const addVariantProduct = (variantProductUnit: ProductUnit & { unit: Unit }) => {
    if (!variantPickerProduct) return;
    const key = itemKey(variantPickerProduct.id, variantProductUnit.unit_id);
    const alreadyAdded = selectedItems.some(
      i => itemKey(i.product_id, i.unit_id) === key,
    );
    if (alreadyAdded) {
      Alert.alert(
        'Already added',
        `${variantPickerProduct.name} (${variantProductUnit.name || variantProductUnit.unit.name}) is already in the import list.`,
      );
      return;
    }
    setSelectedItems(prev => [
      ...prev,
      {
        product_id: variantPickerProduct.id,
        quantity: 1,
        base_unit_cost_per_item: 0,
        unit_id: variantProductUnit.unit_id,
        unit_label: variantProductUnit.name || variantProductUnit.unit.name,
        conversion_factor: variantProductUnit.unit.conversion_factor_to_base,
      },
    ]);
    setShowVariantPicker(false);
    setVariantPickerProduct(null);
    setVariantPickerUnits([]);
  };

  const updateItemQuantity = (key: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(prev => prev.filter(i => itemKey(i.product_id, i.unit_id) !== key));
    } else {
      setSelectedItems(prev =>
        prev.map(i => (itemKey(i.product_id, i.unit_id) === key ? { ...i, quantity } : i)),
      );
    }
  };

  const updateItemCost = (key: string, cost: number) => {
    setSelectedItems(prev =>
      prev.map(i =>
        itemKey(i.product_id, i.unit_id) === key ? { ...i, base_unit_cost_per_item: cost } : i,
      ),
    );
  };

  const removeItem = (key: string) => {
    setSelectedItems(prev => prev.filter(i => itemKey(i.product_id, i.unit_id) !== key));
    setItemCostInputs(prev => {
      const m = new Map(prev);
      m.delete(key);
      return m;
    });
  };

  const addCost = () => {
    setAdditionalCosts(prev => [
      ...prev,
      { cost_type: '', amount: 0, calculation_type: 'per_total', description: '' },
    ]);
  };

  const updateCost = (index: number, field: keyof BatchImportCost, value: any) => {
    const updated = [...additionalCosts];
    if (field === 'amount') {
      const validated = validateDecimalInput(value.toString());
      setCostAmountInputs(prev => { const m = new Map(prev); m.set(index, validated); return m; });
      updated[index] = { ...updated[index], [field]: parseFloat(validated) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setAdditionalCosts(updated);
  };

  const removeCost = (index: number) => {
    setAdditionalCosts(prev => prev.filter((_, i) => i !== index));
  };

  const getProductById = (productId: string) => products.find(p => p.id === productId);

  const calculateCostSummary = () => {
    if (selectedItems.length === 0) {
      return { totalBaseValue: 0, totalAdditionalCosts: 0, totalBatchCost: 0, itemsWithCosts: [] };
    }
    const itemsWithCosts = batchImportService.calculateItemCosts(selectedItems, additionalCosts);
    const totalBaseValue = selectedItems.reduce(
      (sum, item) => sum + item.quantity * item.base_unit_cost_per_item,
      0,
    );
    const totalAdditionalCosts = itemsWithCosts.reduce(
      (sum, item) => sum + (item.allocated_additional_costs || 0),
      0,
    );
    const totalBatchCost = itemsWithCosts.reduce(
      (sum, item) => sum + (parseFloat(item.total_cost_for_item as any) || 0),
      0,
    );
    return { totalBaseValue, totalAdditionalCosts, totalBatchCost, itemsWithCosts };
  };

  const handleImport = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Please select at least one product');
      return;
    }
    for (const item of selectedItems) {
      if (!item.base_unit_cost_per_item || item.base_unit_cost_per_item <= 0) {
        const product = getProductById(item.product_id);
        const label = item.unit_label ? ` (${item.unit_label})` : '';
        Alert.alert(
          'Error',
          `Please enter a valid base cost for ${product?.name || 'selected product'}${label}`,
        );
        return;
      }
    }
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
      await batchImportService.createBatchImport({
        business_id: currentBusiness.id,
        imported_by: user.id,
        purchase_date: purchaseDate,
        notes: notes.trim() || undefined,
        items: selectedItems,
        costs: additionalCosts,
      });
      Alert.alert('Success', 'Stock import created successfully');
      onComplete();
    } catch (error) {
      console.error('Error creating import:', error);
      Alert.alert('Error', 'Failed to create import');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString();

  const { totalBaseValue, totalAdditionalCosts, totalBatchCost, itemsWithCosts } =
    calculateCostSummary();

  // ── Variant picker modal ──────────────────────────────────────────────────
  const renderVariantPicker = () => (
    <Modal
      visible={showVariantPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowVariantPicker(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Choose Variant
            </Text>
            <Text style={[styles.modalSubtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {variantPickerProduct?.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setShowVariantPicker(false);
              setVariantPickerProduct(null);
              setVariantPickerUnits([]);
              setShowProductSelector(true);
            }}
          >
            <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={variantPickerUnits}
          keyExtractor={item => item.unit_id}
          contentContainerStyle={styles.variantList}
          renderItem={({ item }) => {
            const key = itemKey(variantPickerProduct?.id || '', item.unit_id);
            const alreadyAdded = selectedItems.some(
              i => itemKey(i.product_id, i.unit_id) === key,
            );
            return (
              <TouchableOpacity
                style={[
                  styles.variantItem,
                  {
                    backgroundColor: alreadyAdded
                      ? isDark ? '#1f2937' : '#f0fdf4'
                      : isDark ? '#374151' : '#ffffff',
                    borderColor: alreadyAdded ? '#059669' : isDark ? '#4b5563' : '#e5e7eb',
                  },
                ]}
                onPress={() => !alreadyAdded && addVariantProduct(item)}
                disabled={alreadyAdded}
              >
                <View style={styles.variantItemInfo}>
                  <View style={styles.variantItemRow}>
                    <Layers size={18} color="#2563eb" />
                    <Text style={[styles.variantItemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {item.name || item.unit.name}
                    </Text>
                    {alreadyAdded && (
                      <View style={styles.addedBadge}>
                        <Text style={styles.addedBadgeText}>Added</Text>
                      </View>
                    )}
                  </View>
                  {!item.unit.is_base_unit && (
                    <Text style={[styles.variantConversion, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      1 {item.name || item.unit.name} = {item.unit.conversion_factor_to_base} base units
                    </Text>
                  )}
                  {item.unit.is_base_unit && (
                    <Text style={[styles.variantConversion, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      Base unit (smallest sellable unit)
                    </Text>
                  )}
                </View>
                {!alreadyAdded && <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              No variants configured for this product.
            </Text>
          }
        />
      </View>
    </Modal>
  );

  // ── Product selector modal ────────────────────────────────────────────────
  const renderProductSelector = () => (
    <Modal
      visible={showProductSelector}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowProductSelector(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Select Product
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
            const isMultiUnit = Boolean(item.unit_group_id);
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
                    <View style={styles.productNameRow}>
                      <Text style={[styles.productSelectorName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {item.name}
                      </Text>
                      {isMultiUnit && (
                        <View style={styles.multiUnitBadge}>
                          <Layers size={10} color="#2563eb" />
                          <Text style={styles.multiUnitBadgeText}>Multi-unit</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.productSelectorStock, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Stock: {item.current_stock}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );

  // ── Item row ─────────────────────────────────────────────────────────────
  const renderItem = (item: BatchImportItem) => {
    const product = getProductById(item.product_id);
    if (!product) return null;

    const key = itemKey(item.product_id, item.unit_id);
    const isMultiUnit = Boolean(item.unit_id);
    const displayName = isMultiUnit
      ? `${product.name} (${item.unit_label})`
      : product.name;
    const factor = item.conversion_factor ?? 1;
    const baseEquivalent = item.quantity * factor;

    return (
      <View
        key={key}
        style={[
          styles.selectedItem,
          { borderColor: isDark ? '#374151' : '#e5e7eb' },
        ]}
      >
        {/* Product name + variant */}
        <View style={styles.itemHeader}>
          <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {displayName}
          </Text>
          {isMultiUnit && factor > 1 && (
            <Text style={[styles.itemConversionHint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              1 {item.unit_label} = {factor} base units
            </Text>
          )}
        </View>

        {/* Controls row */}
        <View style={styles.itemControls}>
          {/* Quantity */}
          <View style={styles.quantityBlock}>
            <Text style={[styles.controlLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Qty ({isMultiUnit ? item.unit_label : 'units'})
            </Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: '#dc2626' }]}
                onPress={() => updateItemQuantity(key, item.quantity - 1)}
              >
                <Minus size={14} color="#ffffff" />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.quantityInput,
                  {
                    backgroundColor: isDark ? '#374151' : '#f9fafb',
                    borderColor: isDark ? '#4b5563' : '#d1d5db',
                    color: isDark ? '#f9fafb' : '#111827',
                  },
                ]}
                value={item.quantity.toString()}
                onChangeText={v => updateItemQuantity(key, parseInt(v) || 0)}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: '#2563eb' }]}
                onPress={() => updateItemQuantity(key, item.quantity + 1)}
              >
                <Plus size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>
            {isMultiUnit && factor > 1 && (
              <Text style={[styles.baseEquivText, { color: '#2563eb' }]}>
                = {baseEquivalent} base units
              </Text>
            )}
          </View>

          {/* Cost per unit */}
          <View style={styles.costBlock}>
            <Text style={[styles.controlLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Cost / {isMultiUnit ? item.unit_label : 'unit'}
            </Text>
            <TextInput
              style={[
                styles.costTextInput,
                {
                  backgroundColor: isDark ? '#374151' : '#f9fafb',
                  borderColor: isDark ? '#4b5563' : '#d1d5db',
                  color: isDark ? '#f9fafb' : '#111827',
                },
              ]}
              value={itemCostInputs.get(key) ?? item.base_unit_cost_per_item?.toString() ?? '0'}
              onChangeText={text => {
                const validated = validateDecimalInput(text);
                setItemCostInputs(prev => { const m = new Map(prev); m.set(key, validated); return m; });
                updateItemCost(key, parseFloat(validated) || 0);
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>

          {/* Remove */}
          <TouchableOpacity
            style={[styles.removeButton, { backgroundColor: '#dc2626' }]}
            onPress={() => removeItem(key)}
          >
            <Trash2 size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
            selectedItems.map(item => renderItem(item))
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
            <View key={index} style={[styles.costItem, { borderColor: isDark ? '#374151' : '#e5e7eb' }]}>
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
                onChangeText={v => updateCost(index, 'cost_type', v)}
                placeholder="e.g., Shipping, Tax, Handling"
              />
              <Input
                label="Amount"
                value={costAmountInputs.get(index) ?? cost.amount?.toString() ?? '0'}
                onChangeText={text => updateCost(index, 'amount', text)}
                placeholder="0.00"
                keyboardType="decimal-pad"
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
                        backgroundColor:
                          cost.calculation_type === type
                            ? '#ea580c'
                            : isDark ? '#374151' : '#f3f4f6',
                        borderColor:
                          cost.calculation_type === type
                            ? '#ea580c'
                            : isDark ? '#4b5563' : '#d1d5db',
                      },
                    ]}
                    onPress={() => updateCost(index, 'calculation_type', type)}
                  >
                    <Text
                      style={[
                        styles.calculationButtonText,
                        {
                          color:
                            cost.calculation_type === type
                              ? '#ffffff'
                              : isDark ? '#f9fafb' : '#374151',
                        },
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
                onChangeText={v => updateCost(index, 'description', v)}
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
                  {formatPrice(totalBaseValue)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Additional Costs:
                </Text>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  {formatPrice(totalAdditionalCosts)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  Total Batch Cost:
                </Text>
                <Text style={[styles.totalValue, { color: '#059669' }]}>
                  {formatPrice(totalBatchCost)}
                </Text>
              </View>
            </View>

            <View style={styles.itemCostBreakdown}>
              <Text style={[styles.breakdownTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Cost Breakdown by Item:
              </Text>
              {itemsWithCosts.map(item => {
                const product = getProductById(item.product_id);
                const key = itemKey(item.product_id, item.unit_id);
                const label = item.unit_label ? ` (${item.unit_label})` : '';
                const factor = item.conversion_factor ?? 1;
                return (
                  <View key={key} style={styles.itemCostRow}>
                    <Text style={[styles.itemCostName, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {product?.name}{label} — {item.quantity}×
                      {factor > 1 ? ` (${item.quantity * factor} base)` : ''}:
                    </Text>
                    <Text style={[styles.itemCostValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
                      {formatPrice(item.total_cost_for_item)}
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
        <Button title="Cancel" variant="outline" onPress={onCancel} style={styles.footerButton} />
        <Button
          title="Create Import"
          onPress={handleImport}
          loading={loading}
          style={styles.footerButton}
          disabled={selectedItems.length === 0}
        />
      </View>

      {renderProductSelector()}
      {renderVariantPicker()}

      {/* Date Picker Modal */}
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
              onConfirm={(start: Date) => { setPurchaseDate(start.toISOString()); setShowDatePicker(false); }}
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
  section: { padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginLeft: 8, flex: 1 },
  addProductButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  addCostButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  emptyProducts: { alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 14, textAlign: 'center' },

  // Item row
  selectedItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  itemHeader: { gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemConversionHint: { fontSize: 11 },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  quantityBlock: { flex: 1, gap: 4 },
  costBlock: { flex: 1, gap: 4 },
  controlLabel: { fontSize: 11, fontWeight: '500' },
  quantityControls: { flexDirection: 'row', alignItems: 'center' },
  quantityButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  quantityInput: {
    width: 44, height: 32, borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 4, fontSize: 13, fontWeight: '600',
    textAlign: 'center', marginHorizontal: 6,
  },
  baseEquivText: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  costTextInput: {
    height: 32, borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 8, fontSize: 13, textAlign: 'center',
  },
  removeButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  // Additional costs
  costItem: { marginBottom: 16, padding: 12, borderRadius: 8, borderWidth: 1 },
  costHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  costTitle: { fontSize: 14, fontWeight: '600' },
  removeCostButton: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  calculationTypes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  calculationButton: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, alignItems: 'center',
  },
  calculationButtonText: { fontSize: 12, fontWeight: '500' },

  // Summary
  costSummary: { marginBottom: 16 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  totalRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  totalLabel: { fontSize: 16, fontWeight: 'bold' },
  totalValue: { fontSize: 18, fontWeight: 'bold' },
  itemCostBreakdown: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  breakdownTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  itemCostRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
  },
  itemCostName: { fontSize: 12, flex: 1, marginRight: 8 },
  itemCostValue: { fontSize: 12, fontWeight: '500' },

  footer: { flexDirection: 'row', padding: 16, gap: 12 },
  footerButton: { flex: 1 },

  // Modals
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, marginTop: 2 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 16 },
  searchInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
  productSelectorList: { flex: 1, paddingHorizontal: 16 },
  productSelectorItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderRadius: 8, marginBottom: 8, elevation: 2,
  },
  productSelectorInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  productSelectorImage: { width: 40, height: 40, borderRadius: 4, marginRight: 12 },
  imagePlaceholder: {
    width: 40, height: 40, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  productSelectorDetails: { flex: 1 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  productSelectorName: { fontSize: 14, fontWeight: '600' },
  productSelectorStock: { fontSize: 11, marginTop: 2 },
  multiUnitBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  multiUnitBadgeText: { fontSize: 10, color: '#2563eb', fontWeight: '600' },

  // Variant picker
  variantList: { paddingHorizontal: 16, paddingBottom: 40 },
  variantItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 12, borderWidth: 1.5, marginBottom: 10,
  },
  variantItemInfo: { flex: 1, gap: 4 },
  variantItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  variantItemName: { fontSize: 15, fontWeight: '600' },
  variantConversion: { fontSize: 12 },
  addedBadge: {
    backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  addedBadgeText: { fontSize: 11, color: '#059669', fontWeight: '600' },

  // Date picker
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  datePickerContainer: { width: '100%', maxWidth: 400, padding: 20 },
  datePickerTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
});
