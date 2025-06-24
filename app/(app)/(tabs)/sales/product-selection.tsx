import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, Package, Search, ShoppingCart, Plus, Minus } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { useDebounce } from '@/src/hooks/useDebounce';

export default function ProductSelectionScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  
  const router = useRouter();
  const { cartId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const { getCart, addItemToCart, updateCartItem } = useCart();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, debouncedSearchQuery]);

  const loadData = useCallback(async () => {
    if (!profile?.id || !cartId) return;
    
    try {
      // Load products
      const productsData = await productService.getInStockProducts(profile.id);
      setProducts(productsData);
      setFilteredProducts(productsData);
      
      // Get cart to initialize selected products
      const cart = getCart(cartId as string);
      if (cart) {
        // Initialize selected products from existing cart items
        const selected: Record<string, number> = {};
        cart.items.forEach((item) => {
          selected[item.product_id] = item.quantity;
        });
        setSelectedProducts(selected);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, cartId, getCart]);

  const filterProducts = useCallback(() => {
    if (debouncedSearchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.includes(debouncedSearchQuery)) ||
        (product.description && product.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      );
      setFilteredProducts(filtered);
    }
  }, [products, debouncedSearchQuery]);

  const handleQuantityChange = useCallback(async (productId: string, change: number) => {
    if (!cartId) return;
    
    const currentQuantity = selectedProducts[productId] || 0;
    const newQuantity = Math.max(0, currentQuantity + change);
    
    // Update local state immediately for better UX
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: newQuantity
    }));

    // Update cart in real-time
    setAddingToCart(productId);
    try {
      const cart = getCart(cartId as string);
      if (!cart) throw new Error('Cart not found');
      
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Product not found');
      
      // Find if this product is already in the cart
      const existingItem = cart.items.find(item => item.product_id === productId);
      
      if (newQuantity === 0 && existingItem) {
        // Remove item from cart
        await updateCartItem(cartId as string, existingItem.id, { quantity: 0 });
      } else if (existingItem) {
        // Update existing item
        await updateCartItem(cartId as string, existingItem.id, { quantity: newQuantity });
      } else if (newQuantity > 0) {
        // Add new item
        await addItemToCart(cartId as string, product, newQuantity);
      }
    } catch (error) {
      console.error('Error updating cart:', error);
      // Revert the change in local state
      setSelectedProducts(prev => ({
        ...prev,
        [productId]: currentQuantity
      }));
      Alert.alert('Error', 'Failed to update cart');
    } finally {
      setAddingToCart(null);
    }
  }, [cartId, selectedProducts, products, getCart, updateCartItem, addItemToCart]);

  const getTotalItems = useCallback(() => {
    return Object.values(selectedProducts).reduce((sum, quantity) => sum + quantity, 0);
  }, [selectedProducts]);

  const handleContinueToCart = useCallback(() => {
    router.push(`/sales/cart/${cartId}`);
  }, [router, cartId]);

  const renderProductItem = useCallback(({ item }) => {
    const quantity = selectedProducts[item.id] || 0;
    const isUpdating = addingToCart === item.id;
    const isOutOfStock = item.current_stock <= 0;
    const isMaxStock = quantity >= item.current_stock;

    return (
      <Card style={styles.productCard}>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.productPrice, { color: '#059669' }]}>
            ${item.price.toFixed(2)}
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
        </View>
        
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={[
              styles.quantityButton,
              { 
                backgroundColor: quantity > 0 ? '#dc2626' : (isDark ? '#4b5563' : '#e5e7eb'),
                opacity: isUpdating || quantity === 0 ? 0.5 : 1
              }
            ]}
            onPress={() => handleQuantityChange(item.id, -1)}
            disabled={quantity === 0 || isUpdating}
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
                opacity: isUpdating || isOutOfStock || isMaxStock ? 0.5 : 1
              }
            ]}
            onPress={() => handleQuantityChange(item.id, 1)}
            disabled={isOutOfStock || isMaxStock || isUpdating}
          >
            <Plus size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </Card>
    );
  }, [selectedProducts, addingToCart, isDark, handleQuantityChange]);

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
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Select Products
        </Text>
        <View style={styles.headerRight}>
          {getTotalItems() > 0 && (
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
        <View style={[styles.searchContainer, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}>
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
            title={`Continue to Cart (${getTotalItems()} items)`}
            onPress={handleContinueToCart}
            style={styles.continueButton}
          />
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
  productsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    padding: 12,
    marginBottom: 12,
  },
  productInfo: {
    marginBottom: 12,
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
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
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
});