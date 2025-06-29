import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonProductCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { ProductCard } from '@/src/components/products/ProductCard';
import ProductForm from '@/src/components/products/ProductForm';
import ImportForm from '@/src/components/inventory/ImportForm';
import { ArrowLeft, Package, DollarSign, Plus, Trash2, Calendar, CreditCard as Edit, TrendingUp, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { inventoryService } from '@/src/services/inventory';

export default function LowStockScreen() {
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'out' | 'critical' | 'low'>('all');
  
  const router = useRouter();
  const { isDark } = useTheme();
  const { profile } = useAuth();

  useEffect(() => {
    loadLowStockProducts();
  }, []);

  useEffect(() => {
    filterProductsByStatus();
  }, [lowStockProducts, selectedFilter]);

  const loadLowStockProducts = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      
      const data = await productService.getLowStockProducts(profile.id);
      setLowStockProducts(data);
    } catch (error) {
      console.error('Error loading low stock products:', error);
      Alert.alert('Error', 'Failed to load low stock products');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const getStockStatus = (product: any) => {
    const stockRatio = product.current_stock / Math.max(product.min_stock_level, 1);
    if (product.current_stock === 0) return { status: 'out', color: '#dc2626', label: 'Out of Stock' };
    if (stockRatio <= 0.5) return { status: 'critical', color: '#ea580c', label: 'Critical' };
    return { status: 'low', color: '#f59e0b', label: 'Low Stock' };
  };

  const filterProductsByStatus = useCallback(() => {
    if (selectedFilter === 'all') {
      setDisplayedProducts(lowStockProducts);
      return;
    }

    const filtered = lowStockProducts.filter(product => {
      const status = getStockStatus(product).status;
      return status === selectedFilter;
    });

    setDisplayedProducts(filtered);
  }, [lowStockProducts, selectedFilter]);

  const getStockCounts = () => {
    const outOfStock = lowStockProducts.filter(p => p.current_stock === 0).length;
    const critical = lowStockProducts.filter(p => {
      const ratio = p.current_stock / Math.max(p.min_stock_level, 1);
      return p.current_stock > 0 && ratio <= 0.5;
    }).length;
    const low = lowStockProducts.filter(p => {
      const ratio = p.current_stock / Math.max(p.min_stock_level, 1);
      return ratio > 0.5 && ratio <= 1;
    }).length;

    return { outOfStock, critical, low };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLowStockProducts(true);
  };

  const handleProductSave = () => {
    setShowProductForm(false);
    setSelectedProduct(null);
    loadLowStockProducts();
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setShowProductForm(true);
  };

  const handleImportStock = (product: any) => {
    setSelectedProduct(product);
    setShowImportForm(true);
  };

  const handleImportComplete = () => {
    setShowImportForm(false);
    setSelectedProduct(null);
    loadLowStockProducts();
  };

  const handleFilterPress = (filter: 'out' | 'critical' | 'low') => {
    // Toggle filter: if already selected, clear it; otherwise, set it
    setSelectedFilter(selectedFilter === filter ? 'all' : filter);
  };

  const { outOfStock, critical, low } = getStockCounts();

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
            Low Stock Alert
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <Calendar size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <SkeletonCard style={styles.alertBanner}>
            <View style={styles.alertContent}>
              <SkeletonLoader height={32} width={32} borderRadius={16} />
              <View style={styles.alertText}>
                <SkeletonLoader height={18} width="60%" style={{ marginBottom: 4 }} />
                <SkeletonLoader height={14} width="80%" />
              </View>
            </View>
          </SkeletonCard>

          <View style={styles.summaryGrid}>
            {[1, 2, 3].map((index) => (
              <SkeletonCard key={index} style={styles.summaryCard}>
                <View style={styles.summaryContent}>
                  <SkeletonLoader height={36} width={36} borderRadius={8} style={{ marginRight: 12 }} />
                  <View style={styles.summaryText}>
                    <SkeletonLoader height={18} width="40%" style={{ marginBottom: 4 }} />
                    <SkeletonLoader height={12} width="60%" />
                  </View>
                </View>
              </SkeletonCard>
            ))}
          </View>

          <SkeletonCard style={styles.actionsCard}>
            <SkeletonLoader height={16} width="40%" style={{ marginBottom: 12 }} />
            <View style={styles.actionsGrid}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonLoader height={56} width={56} borderRadius={16} style={{ marginBottom: 8 }} />
                <SkeletonLoader height={14} width="60%" />
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonLoader height={56} width={56} borderRadius={16} style={{ marginBottom: 8 }} />
                <SkeletonLoader height={14} width="60%" />
              </View>
            </View>
          </SkeletonCard>

          <SkeletonLoader height={18} width="70%" style={{ marginBottom: 16 }} />
          <SkeletonList itemComponent={SkeletonProductCard} itemCount={3} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Low Stock Alert
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Calendar size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Alert Banner */}
        <Card style={styles.alertBanner}>
          <View style={styles.alertContent}>
            <AlertTriangle size={32} color="#ea580c" />
            <View style={styles.alertText}>
              <Text style={[styles.alertTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Stock Alert
              </Text>
              <Text style={[styles.alertSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {selectedFilter === 'all' 
                  ? `${lowStockProducts.length} products need attention` 
                  : `Showing ${displayedProducts.length} ${selectedFilter === 'out' ? 'out of stock' : selectedFilter === 'critical' ? 'critical' : 'low stock'} products`}
              </Text>
            </View>
          </View>
        </Card>

        {/* Stock Status Summary */}
        <View style={styles.summaryGrid}>
          <TouchableOpacity 
            style={styles.summaryCardWrapper}
            onPress={() => handleFilterPress('out')}
            activeOpacity={0.7}
          >
            <Card style={[
              styles.summaryCard, 
              selectedFilter === 'out' && { borderColor: '#dc2626', borderWidth: 2 }
            ]}>
              <View style={styles.summaryContent}>
                <View style={[styles.summaryIcon, { backgroundColor: '#dc262620' }]}>
                  <AlertTriangle size={20} color="#dc2626" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
                    {outOfStock}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Out of Stock
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.summaryCardWrapper}
            onPress={() => handleFilterPress('critical')}
            activeOpacity={0.7}
          >
            <Card style={[
              styles.summaryCard, 
              selectedFilter === 'critical' && { borderColor: '#ea580c', borderWidth: 2 }
            ]}>
              <View style={styles.summaryContent}>
                <View style={[styles.summaryIcon, { backgroundColor: '#ea580c20' }]}>
                  <Package size={20} color="#ea580c" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={[styles.summaryValue, { color: '#ea580c' }]}>
                    {critical}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Critical
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.summaryCardWrapper}
            onPress={() => handleFilterPress('low')}
            activeOpacity={0.7}
          >
            <Card style={[
              styles.summaryCard, 
              selectedFilter === 'low' && { borderColor: '#f59e0b', borderWidth: 2 }
            ]}>
              <View style={styles.summaryContent}>
                <View style={[styles.summaryIcon, { backgroundColor: '#f59e0b20' }]}>
                  <TrendingUp size={20} color="#f59e0b" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
                    {low}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Low Stock
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Text style={[styles.actionsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Quick Actions
          </Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#2563eb20' }]}
              onPress={() => setShowImportForm(true)}
            >
              <TrendingUp size={24} color="#2563eb" />
              <Text style={[styles.actionText, { color: '#2563eb' }]}>
                Import Stock
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#05966920' }]}
              onPress={() => setShowProductForm(true)}
            >
              <Plus size={24} color="#059669" />
              <Text style={[styles.actionText, { color: '#059669' }]}>
                Add Product
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Products List */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Products Requiring Attention
            </Text>
            {selectedFilter !== 'all' && (
              <TouchableOpacity 
                style={styles.clearFilterButton}
                onPress={() => setSelectedFilter('all')}
              >
                <Text style={styles.clearFilterText}>Clear Filter</Text>
              </TouchableOpacity>
            )}
          </View>

          {displayedProducts.length > 0 ? (
            displayedProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              return (
                <View key={product.id} style={styles.productWrapper}>
                  <View style={[styles.stockStatusBadge, { backgroundColor: stockStatus.color + '20' }]}>
                    <AlertTriangle size={16} color={stockStatus.color} />
                    <Text style={[styles.stockStatusText, { color: stockStatus.color }]}>
                      {stockStatus.label}
                    </Text>
                  </View>
                  <ProductCard
                    product={product}
                    onEdit={handleEditProduct}
                    onImportStock={handleImportStock}
                  />
                </View>
              );
            })
          ) : (
            <Card style={styles.emptyState}>
              <Package size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {selectedFilter !== 'all' 
                  ? `No ${selectedFilter === 'out' ? 'out of stock' : selectedFilter === 'critical' ? 'critical' : 'low stock'} products found` 
                  : 'All Products Well Stocked!'}
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {selectedFilter !== 'all'
                  ? 'Try selecting a different filter'
                  : 'Great job! All your products have sufficient stock levels.'}
              </Text>
              <Button
                title="View All Products"
                onPress={() => router.back()}
                style={styles.emptyButton}
              />
            </Card>
          )}
        </View>

        {/* Stock Management Tips */}
        <Card style={styles.tipsCard}>
          <Text style={[styles.tipsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            💡 Stock Management Tips
          </Text>
          <View style={styles.tipsList}>
            <Text style={[styles.tipItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • Set appropriate minimum stock levels for each product
            </Text>
            <Text style={[styles.tipItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • Review and adjust stock levels based on sales patterns
            </Text>
            <Text style={[styles.tipItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • Import stock regularly to avoid stockouts
            </Text>
            <Text style={[styles.tipItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • Monitor fast-moving products more closely
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Modals */}
      <Modal
        visible={showProductForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ProductForm
          product={selectedProduct}
          onSave={handleProductSave}
          onCancel={() => {
            setShowProductForm(false);
            setSelectedProduct(null);
          }}
        />
      </Modal>

      <Modal
        visible={showImportForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ImportForm
          productId={selectedProduct?.id}
          onComplete={handleImportComplete}
          onCancel={() => {
            setShowImportForm(false);
            setSelectedProduct(null);
          }}
        />
      </Modal>
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
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  alertBanner: {
    padding: 16,
    marginBottom: 16,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertText: {
    marginLeft: 16,
    flex: 1,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  summaryCardWrapper: {
    flex: 1,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryText: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  actionsCard: {
    padding: 16,
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  productsSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearFilterButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#2563eb20',
    borderRadius: 4,
  },
  clearFilterText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  productWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  stockStatusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  stockStatusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
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
    marginBottom: 20,
  },
  emptyButton: {
    marginTop: 16,
  },
  tipsCard: {
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 13,
    lineHeight: 18,
  },
});