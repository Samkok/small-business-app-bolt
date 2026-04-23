import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  Modal,
  Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, Package, Search, Plus, Minus, Barcode, Save } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { useDebounce } from '@/src/hooks/useDebounce';
import BarcodeScanner from '@/src/components/inventory/BarcodeScanner';
import { useCurrency } from '@/src/hooks/useCurrency';
import { unitService, Unit, ProductUnit } from '@/src/services/units';
import { formatCurrency } from '@/src/utils/formatCurrency';

export default function ProductSelectionScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [initialProducts, setInitialProducts] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [unitGroupsMap, setUnitGroupsMap] = useState<Record<string, Unit[]>>({});
  const [unitPricesMap, setUnitPricesMap] = useState<Record<string, ProductUnit[]>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});
  const [showUnitPicker, setShowUnitPicker] = useState<string | null>(null);

  const router = useRouter();
  const { cartId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { getCart, addItemToCart, updateCartItem, refreshCarts } = useCart();
  const { formatPrice, getSymbol } = useCurrency(currentBusiness?.id);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, debouncedSearchQuery]);

  const loadData = useCallback(async () => {
    if (!currentBusiness?.id || !cartId) return;

    try {
      const productsData = await productService.getInStockProducts(currentBusiness.id);
      setProducts(productsData);
      setFilteredProducts(productsData);

      const ugMap: Record<string, Unit[]> = {};
      const upMap: Record<string, ProductUnit[]> = {};
      for (const product of productsData) {
        if (product.unit_group_id) {
          try {
            const units = await unitService.getUnits(product.unit_group_id);
            ugMap[product.id] = units;
            const prices = await unitService.getProductUnits(product.id);
            upMap[product.id] = prices;
          } catch (e) {
            console.error('Error loading units for product:', product.id, e);
          }
        }
      }
      setUnitGroupsMap(ugMap);
      setUnitPricesMap(upMap);

      const cart = getCart(cartId as string);
      if (cart) {
        // Initialize selected products from existing cart items
        const selected: Record<string, number> = {};
        cart.items.forEach((item) => {
          selected[item.product_id] = item.quantity;
        });
        setSelectedProducts(selected);
        setInitialProducts(selected);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id, cartId, getCart]);

  const filterProducts = useCallback(() => {
    if (debouncedSearchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const q = debouncedSearchQuery.toLowerCase();
      const filtered = products.filter(product => {
        if (product.name.toLowerCase().includes(q)) return true;
        if (product.barcode && product.barcode.toLowerCase().includes(q)) return true;
        if (product.description && product.description.toLowerCase().includes(q)) return true;
        // Check unit-specific barcodes
        const unitPrices = unitPricesMap[product.id];
        if (unitPrices) {
          return unitPrices.some(up => up.barcode && up.barcode.toLowerCase().includes(q));
        }
        return false;
      });
      setFilteredProducts(filtered);
    }
  }, [products, debouncedSearchQuery, unitPricesMap]);

  const savePendingChanges = useCallback(async () => {
    if (!cartId || isSaving) return;

    setIsSaving(true);

    try {
      let cart = getCart(cartId as string);
      if (!cart) throw new Error('Cart not found');

      // Find all changes
      const changedProducts = Object.keys(selectedProducts).filter(
        productId => selectedProducts[productId] !== (initialProducts[productId] || 0)
      );

      // Separate changes into updates and new additions
      const updates: Array<{ itemId: string; quantity: number }> = [];
      const additions: Array<{ product: any; quantity: number }> = [];
      const removals: string[] = [];

      for (const productId of changedProducts) {
        const quantity = selectedProducts[productId];
        const product = products.find(p => p.id === productId);
        if (!product) continue;

        const existingItem = cart.items.find(item => item.product_id === productId);

        if (quantity === 0 && existingItem) {
          removals.push(existingItem.id);
        } else if (existingItem) {
          updates.push({ itemId: existingItem.id, quantity });
        } else if (quantity > 0) {
          additions.push({ product, quantity });
        }
      }

      // Process removals first
      for (const itemId of removals) {
        await updateCartItem(cartId as string, itemId, { quantity: 0 });
      }

      // Then process updates
      for (const { itemId, quantity } of updates) {
        await updateCartItem(cartId as string, itemId, { quantity });
      }

      for (const { product, quantity } of additions) {
        const unitId = selectedUnits[product.id];
        const productWithUnit = unitId ? { ...product, unit_id: unitId } : product;
        await addItemToCart(cartId as string, productWithUnit, quantity);
        // Refresh cart after each addition to get updated state
        await refreshCarts();
        cart = getCart(cartId as string);
      }

      // Final refresh to ensure we have the latest state
      await refreshCarts();

      // Update initial products to reflect saved state
      setInitialProducts({ ...selectedProducts });
    } catch (error) {
      console.error('Error saving changes:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [cartId, selectedProducts, initialProducts, products, getCart, updateCartItem, addItemToCart, refreshCarts, isSaving]);

  const handleQuantityChange = useCallback((productId: string, change: number) => {
    const currentQuantity = selectedProducts[productId] || 0;
    const newQuantity = Math.max(0, currentQuantity + change);

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const unitId = selectedUnits[productId];
    const units = unitGroupsMap[productId];
    const selectedUnit = unitId ? units?.find(u => u.id === unitId) : null;
    const conversionFactor = selectedUnit?.conversion_factor_to_base || 1;
    const maxUnits = Math.floor(product.current_stock / conversionFactor);

    if (newQuantity > maxUnits) {
      Alert.alert('Stock Limit', `Only ${maxUnits} ${selectedUnit?.name || 'items'} available in stock.`);
      return;
    }

    setSelectedProducts(prev => ({
      ...prev,
      [productId]: newQuantity
    }));
  }, [selectedProducts, products, selectedUnits, unitGroupsMap]);

  const barcodeBusyRef = useRef(false);
  const handleBarcodeScanned = async (barcode: string) => {
    if (barcodeBusyRef.current) return;
    barcodeBusyRef.current = true;
    setTimeout(() => { barcodeBusyRef.current = false; }, 1500);

    setShowBarcodeScanner(false);
    setSearchQuery(barcode);

    // If the barcode exactly matches a unit-specific barcode, auto-select that unit
    for (const product of products) {
      const unitPrices = unitPricesMap[product.id];
      if (unitPrices) {
        const matchedUnit = unitPrices.find(up => up.barcode === barcode);
        if (matchedUnit) {
          setSelectedUnits(prev => ({ ...prev, [product.id]: matchedUnit.unit_id }));
          break;
        }
      }
    }
  };

  const getTotalItems = useCallback(() => {
    return Object.values(selectedProducts).reduce((sum, quantity) => sum + quantity, 0);
  }, [selectedProducts]);

  const getPendingChangesCount = useCallback(() => {
    return Object.keys(selectedProducts).filter(
      productId => selectedProducts[productId] !== (initialProducts[productId] || 0)
    ).length;
  }, [selectedProducts, initialProducts]);

  const handleContinueToCart = useCallback(async () => {
    const pendingCount = getPendingChangesCount();

    if (pendingCount > 0) {
      try {
        await savePendingChanges();
        router.push(`/sales/cart/${cartId}`);
      } catch (error) {
        // Error already handled in savePendingChanges
      }
    } else {
      router.push(`/sales/cart/${cartId}`);
    }
  }, [router, cartId, getPendingChangesCount, savePendingChanges]);

  const handleBack = useCallback(async () => {
    const pendingCount = getPendingChangesCount();

    if (pendingCount > 0) {
      Alert.alert(
        'Unsaved Changes',
        `You have ${pendingCount} unsaved ${pendingCount === 1 ? 'change' : 'changes'}. Do you want to save before going back?`,
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back()
          },
          {
            text: 'Save',
            onPress: async () => {
              try {
                await savePendingChanges();
                router.back();
              } catch (error) {
                // Error already handled in savePendingChanges
              }
            }
          }
        ]
      );
    } else {
      router.back();
    }
  }, [router, getPendingChangesCount, savePendingChanges]);

  const getDisplayPrice = useCallback((product: any) => {
    const unitId = selectedUnits[product.id];
    if (unitId) {
      const prices = unitPricesMap[product.id];
      const unitPrice = prices?.find(p => p.unit_id === unitId);
      if (unitPrice) return unitPrice.price;
    }
    return product.price;
  }, [selectedUnits, unitPricesMap]);

  const getDisplayUnitName = useCallback((productId: string) => {
    const unitId = selectedUnits[productId];
    if (unitId) {
      const units = unitGroupsMap[productId];
      const unit = units?.find(u => u.id === unitId);
      return unit?.name || '';
    }
    return '';
  }, [selectedUnits, unitGroupsMap]);

  const renderProductItem = useCallback(({ item }: { item: any }) => {
    const quantity = selectedProducts[item.id] || 0;
    const initialQuantity = initialProducts[item.id] || 0;
    const hasChanges = quantity !== initialQuantity;
    const isOutOfStock = item.current_stock <= 0;

    const units = unitGroupsMap[item.id];
    const hasUnits = units && units.length > 0;
    const unitId = selectedUnits[item.id];
    const selectedUnit = unitId ? units?.find((u: Unit) => u.id === unitId) : null;
    const conversionFactor = selectedUnit?.conversion_factor_to_base || 1;
    const maxUnits = Math.floor(item.current_stock / conversionFactor);
    const isMaxStock = quantity >= maxUnits;
    const displayPrice = getDisplayPrice(item);
    const unitName = getDisplayUnitName(item.id);

    return (
      <Card style={styles.productCard}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.productImage}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.productImagePlaceholder, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
            <Package size={28} color={isDark ? '#6b7280' : '#9ca3af'} />
          </View>
        )}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={2}>
              {item.name}
            </Text>
            {hasChanges && (
              <View style={styles.changedBadge}>
                <Text style={styles.changedBadgeText}>{'\u2022'}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.productPrice, { color: '#059669' }]}>
            {formatPrice(displayPrice, item.currency_id)}{unitName ? ` / ${unitName}` : ''}
          </Text>
          <Text style={[
            styles.productStock,
            {
              color: isOutOfStock
                ? '#dc2626'
                : (item.current_stock <= item.min_stock_level ? '#ea580c' : (isDark ? '#d1d5db' : '#6b7280'))
            }
          ]}>
            Stock: {item.current_stock}
          </Text>
          {hasUnits && (
            <TouchableOpacity
              style={[styles.unitPickerButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
              onPress={() => setShowUnitPicker(item.id)}
            >
              <Text style={[styles.unitPickerText, { color: '#2563eb' }]}>
                {selectedUnit ? selectedUnit.name : 'Select Unit'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.productActions}>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[
                styles.quantityButton,
                {
                  backgroundColor: quantity > 0 ? '#dc2626' : (isDark ? '#4b5563' : '#e5e7eb'),
                  opacity: quantity === 0 ? 0.5 : 1
                }
              ]}
              onPress={() => handleQuantityChange(item.id, -1)}
              disabled={quantity === 0}
            >
              <Minus size={16} color={quantity > 0 ? '#ffffff' : (isDark ? '#9ca3af' : '#6b7280')} />
            </TouchableOpacity>

            <Text style={[styles.quantityText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {quantity}
            </Text>

            <TouchableOpacity
              style={[
                styles.quantityButton,
                {
                  backgroundColor: '#2563eb',
                  opacity: isOutOfStock || isMaxStock ? 0.5 : 1
                }
              ]}
              onPress={() => handleQuantityChange(item.id, 1)}
              disabled={isOutOfStock || isMaxStock}
            >
              <Plus size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  }, [selectedProducts, initialProducts, isDark, handleQuantityChange, unitGroupsMap, selectedUnits, getDisplayPrice, getDisplayUnitName, formatPrice]);

  const renderEmptyComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <Package size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {searchQuery ? 'No products found' : 'No products available'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {searchQuery 
          ? `No products match "${searchQuery}"`
          : 'Add products to your inventory first'
        }
      </Text>
    </Card>
  ), [searchQuery, isDark]);

  if (loading) {
    return <LoadingSpinner text="Loading products..." />;
  }

  const cart = getCart(cartId as string);
  if (!cart) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Cart Not Found
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            The cart you're looking for doesn't exist or has been deleted.
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Select Products
        </Text>
        <View style={styles.headerRight}>
          {getPendingChangesCount() > 0 && (
            <View style={styles.pendingBadge}>
              <Save size={14} color="#ffffff" />
              <Text style={styles.pendingBadgeText}>{getPendingChangesCount()}</Text>
            </View>
          )}
          {getTotalItems() > 0 && getPendingChangesCount() === 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{getTotalItems()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Customer Info */}
      <Card style={styles.customerInfo}>
        <Text style={[styles.customerLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Customer:
        </Text>
        <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {cart.customer_name}
        </Text>
      </Card>

      {/* Search */}
      <View style={styles.searchSection}>
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
          
          <TouchableOpacity 
            style={[styles.barcodeButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
            onPress={() => setShowBarcodeScanner(true)}
          >
            <Barcode size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id}
        style={styles.productsList}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={filteredProducts.length === 0 ? styles.emptyContainer : undefined}
      />

      {/* Continue Button */}
      {getTotalItems() > 0 && (
        <View style={styles.footer}>
          <Button
            title={getPendingChangesCount() > 0 ? `Save & Continue (${getTotalItems()} items)` : `Continue to Cart (${getTotalItems()} items)`}
            onPress={handleContinueToCart}
            loading={isSaving}
            disabled={isSaving}
            style={styles.continueButton}
          />
        </View>
      )}

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <BarcodeScanner
          onBarcodeScan={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
        />
      </Modal>

      {showUnitPicker && (
        <View style={styles.modalOverlay}>
          <Card style={styles.unitPickerModal}>
            <Text style={[styles.unitPickerModalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Unit
            </Text>
            {unitGroupsMap[showUnitPicker]?.map((unit) => {
              const prices = unitPricesMap[showUnitPicker];
              const unitPrice = prices?.find(p => p.unit_id === unit.id);
              const product = products.find(p => p.id === showUnitPicker);
              const price = unitPrice?.price || product?.price || 0;
              const isSelected = selectedUnits[showUnitPicker] === unit.id;

              return (
                <TouchableOpacity
                  key={unit.id}
                  style={[
                    styles.unitOption,
                    {
                      backgroundColor: isSelected ? '#2563eb20' : 'transparent',
                      borderColor: isSelected ? '#2563eb' : (isDark ? '#4b5563' : '#e5e7eb'),
                    }
                  ]}
                  onPress={() => {
                    setSelectedUnits(prev => ({ ...prev, [showUnitPicker!]: unit.id }));
                    setShowUnitPicker(null);
                  }}
                >
                  <View>
                    <Text style={[styles.unitOptionName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {unit.name}
                    </Text>
                    <Text style={[styles.unitOptionDetail, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      {unit.is_base_unit ? 'Base unit' : `= ${unit.conversion_factor_to_base} base units`}
                    </Text>
                  </View>
                  <Text style={[styles.unitOptionPrice, { color: '#059669' }]}>
                    {formatPrice(price, product?.currency_id)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.unitOption, { borderColor: isDark ? '#4b5563' : '#e5e7eb' }]}
              onPress={() => {
                setSelectedUnits(prev => {
                  const next = { ...prev };
                  delete next[showUnitPicker!];
                  return next;
                });
                setShowUnitPicker(null);
              }}
            >
              <Text style={[styles.unitOptionName, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Default (base price)
              </Text>
            </TouchableOpacity>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setShowUnitPicker(null)}
              style={{ marginTop: 12 }}
            />
          </Card>
        </View>
      )}
    </View>
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
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 44,
    alignItems: 'center',
  },
  cartBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingBadge: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  pendingBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  changedBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ea580c',
    marginLeft: 4,
  },
  changedBadgeText: {
    color: '#ea580c',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
  },
  customerLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  barcodeButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  productsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    padding: 0,
    marginBottom: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  productImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  productStock: {
    fontSize: 12,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  syncIndicator: {
    marginLeft: 8,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueButton: {
    backgroundColor: '#2563eb',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 120,
  },
  unitPickerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  unitPickerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  unitPickerModal: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
  },
  unitPickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  unitOptionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  unitOptionDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  unitOptionPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
});