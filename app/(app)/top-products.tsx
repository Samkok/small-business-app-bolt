import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonLoader, SkeletonCard } from '@/src/components/ui/SkeletonLoader';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { ArrowLeft, Package, ShoppingCart, DollarSign, Calendar, Search, X, TrendingUp, TrendingDown } from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';
import { useDebounce } from '@/src/hooks/useDebounce';

interface TopProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  barcode?: string;
  current_stock: number;
  min_stock_level: number;
  cost_per_unit: number;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
}

export default function TopProductsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<TopProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadTopProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, debouncedSearchQuery]);

  const loadTopProducts = async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Get all top products for this month (no limit)
      const data = await reportsService.getTopProducts(currentBusiness.id, 100);
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Error loading top products:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTopProducts(true);
  };

  const filterProducts = () => {
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
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleProductPress = (product: TopProduct) => {
    router.push(`/inventory/product-details?productId=${product.id}`);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getStockStatus = (product: TopProduct) => {
    if (product.current_stock === 0) return { status: 'out', color: '#dc2626', label: 'Out of Stock' };
    if (product.current_stock <= product.min_stock_level) return { status: 'low', color: '#ea580c', label: 'Low Stock' };
    return { status: 'good', color: '#059669', label: 'In Stock' };
  };

  const ProductCard = ({ product, index }: { product: TopProduct; index: number }) => {
    const stockStatus = getStockStatus(product);
    const profitMargin = product.revenue > 0 ? ((product.profit / product.revenue) * 100) : 0;
    
    return (
      <TouchableOpacity onPress={() => handleProductPress(product)}>
        <Card style={styles.productCard}>
          <View style={styles.productHeader}>
            <View style={styles.rankContainer}>
              <Text style={[styles.rank, { color: '#2563eb' }]}>
                #{index + 1}
              </Text>
            </View>
            
            <View style={styles.productImageContainer}>
              {product.image_url ? (
                <OptimizedImage 
                  source={{ uri: product.image_url }} 
                  style={styles.productImage} 
                  resizeMode="contain" 
                  alt={product.name}
                />
              ) : (
                <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}>
                  <Package size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
                </View>
              )}
            </View>
            
            <View style={styles.productInfo}>
              <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={[styles.productPrice, { color: '#059669' }]}>
                {formatCurrency(product.price)}
              </Text>
              {product.description && (
                <Text style={[styles.productDescription, { color: isDark ? '#d1d5db' : '#6b7280' }]} numberOfLines={1}>
                  {product.description}
                </Text>
              )}
              <View style={styles.stockStatusContainer}>
                <View style={[styles.stockStatusBadge, { backgroundColor: stockStatus.color + '20' }]}>
                  <Text style={[styles.stockStatusText, { color: stockStatus.color }]}>
                    {stockStatus.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.productMetrics}>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <ShoppingCart size={16} color="#8b5cf6" />
                </View>
                <View style={styles.metricContent}>
                  <Text style={[styles.metricValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {product.quantity}
                  </Text>
                  <Text style={[styles.metricLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Units Sold
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <DollarSign size={16} color="#059669" />
                </View>
                <View style={styles.metricContent}>
                  <Text style={[styles.metricValue, { color: '#059669' }]}>
                    {formatCurrency(product.revenue)}
                  </Text>
                  <Text style={[styles.metricLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Revenue
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <TrendingUp size={16} color={product.profit >= 0 ? '#059669' : '#dc2626'} />
                </View>
                <View style={styles.metricContent}>
                  <Text style={[styles.metricValue, { color: product.profit >= 0 ? '#059669' : '#dc2626' }]}>
                    {formatCurrency(product.profit)}
                  </Text>
                  <Text style={[styles.metricLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Profit
                  </Text>
                </View>
              </View>
              
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <Package size={16} color="#ea580c" />
                </View>
                <View style={styles.metricContent}>
                  <Text style={[styles.metricValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {profitMargin.toFixed(1)}%
                  </Text>
                  <Text style={[styles.metricLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Margin
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          {product.barcode && (
            <View style={styles.barcodeSection}>
              <Text style={[styles.barcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                Barcode: {product.barcode}
              </Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  const SkeletonProductCard = () => (
    <SkeletonCard style={styles.productCard}>
      <View style={styles.productHeader}>
        <SkeletonLoader height={32} width={32} borderRadius={16} />
        <SkeletonLoader height={80} width={80} borderRadius={8} style={{ marginHorizontal: 12 }} />
        <View style={styles.productInfo}>
          <SkeletonLoader height={16} width="80%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={14} width="60%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={12} width="70%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={20} width={80} borderRadius={10} />
        </View>
      </View>
      <View style={styles.productMetrics}>
        {[1, 2, 3, 4].map((index) => (
          <View key={index} style={styles.metricItem}>
            <SkeletonLoader height={16} width={16} borderRadius={8} />
            <View style={styles.metricContent}>
              <SkeletonLoader height={16} width={40} style={{ marginBottom: 2 }} />
              <SkeletonLoader height={12} width={50} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonCard>
  );

  if (loading) {
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
            Top Products
          </Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          <SkeletonCard style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <SkeletonLoader height={20} width={20} borderRadius={10} />
              <SkeletonLoader height={16} width="60%" />
            </View>
            <SkeletonLoader height={14} width="80%" />
          </SkeletonCard>

          <View style={styles.productsList}>
            {[1, 2, 3, 4, 5].map((index) => (
              <SkeletonProductCard key={index} />
            ))}
          </View>
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
          Top Products
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
      >
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Calendar size={20} color="#2563eb" />
            <Text style={[styles.summaryTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              This Month's Top Performers
            </Text>
          </View>
          <Text style={[styles.summaryText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {searchQuery ? `${filteredProducts.length} of ${products.length} products` : `${products.length} products sold this month`}
          </Text>
        </Card>

        {/* Search Section */}
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
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Products List */}
        <View style={styles.productsList}>
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))
          ) : (
            <Card style={styles.emptyState}>
              <Package size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {searchQuery ? 'No products found' : 'No Product Sales'}
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {searchQuery 
                  ? `No products match "${searchQuery}"`
                  : 'No products have been sold this month yet'
                }
              </Text>
              {searchQuery && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={handleClearSearch}
                >
                  <Text style={styles.clearSearchText}>Clear Search</Text>
                </TouchableOpacity>
              )}
            </Card>
          )}
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  summaryText: {
    fontSize: 14,
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
  },
  productCard: {
    padding: 16,
    marginBottom: 12,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rank: {
    fontSize: 14,
    fontWeight: 'bold',
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
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  stockStatusContainer: {
    alignItems: 'flex-start',
  },
  stockStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  productMetrics: {
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#8b5cf620',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  metricContent: {
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
  },
  barcodeSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  barcode: {
    fontSize: 11,
    fontFamily: 'monospace',
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
  clearSearchButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#2563eb20',
    borderRadius: 8,
  },
  clearSearchText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
});