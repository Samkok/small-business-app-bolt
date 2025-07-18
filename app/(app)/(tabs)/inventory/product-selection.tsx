import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { ArrowLeft, Package, Search, TrendingUp, Barcode } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { useDebounce } from '@/src/hooks/useDebounce';

export default function ProductSelectionScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const router = useRouter();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, debouncedSearchQuery]);

  const loadProducts = async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const data = await productService.getProducts(currentBusiness.id);
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts(true);
  }, []);

  const handleProductSelect = useCallback((productId: string) => {
    router.push(`/inventory/import-form?productId=${productId}`);
  }, [router]);

  const renderProductItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
      onPress={() => handleProductSelect(item.id)}
    >
      <View style={styles.productImageContainer}>
        {item.image_url ? (
          <OptimizedImage 
            source={{ uri: item.image_url }} 
            style={styles.productImage} 
            resizeMode="contain" 
            alt={item.name}
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}>
            <Package size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
          </View>
        )}
      </View>
      
      <View style={styles.productInfo}>
        <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={2}>
          {item.name}
        </Text>
        
        <Text style={[styles.productPrice, { color: '#059669' }]}>
          ${item.price.toFixed(2)}
        </Text>
        
        <Text style={[styles.productStock, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Stock: {item.current_stock}
        </Text>
        
        {item.barcode && (
          <Text style={[styles.productBarcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
            {item.barcode}
          </Text>
        )}
      </View>
      
      <View style={styles.importButton}>
        <TrendingUp size={16} color="#2563eb" />
        <Text style={styles.importButtonText}>Import</Text>
      </View>
    </TouchableOpacity>
  ), [isDark, handleProductSelect]);

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
          Select Product to Import
        </Text>
        <View style={styles.headerRight} />
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
            returnKeyType="search"
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.barcodeButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
        >
          <Barcode size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id}
        style={styles.productsList}
        contentContainerStyle={filteredProducts.length === 0 ? styles.emptyContainer : styles.productsListContent}
        showsVerticalScrollIndicator={false}
        numColumns={1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
            title="Pull to refresh"
            titleColor={isDark ? '#f9fafb' : '#111827'}
          />
        }
        ListEmptyComponent={renderEmptyComponent}
      />
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
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
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
  productsList: {
    flex: 1,
  },
  productsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  productCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productStock: {
    fontSize: 14,
    marginBottom: 2,
  },
  productBarcode: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
  },
  importButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 4,
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
});