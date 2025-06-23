import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Animated,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonProductCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { ProductCard } from '@/src/components/products/ProductCard';
import { ImportHistoryCard } from '@/src/components/inventory/ImportHistoryCard';
import ProductForm from '@/src/components/products/ProductForm';
import ImportForm from '@/src/components/inventory/ImportForm';
import EditImportForm from '@/src/components/inventory/EditImportForm';
import ImportCSVModal from '@/src/components/inventory/ImportCSVModal';
import BarcodeScanner from '@/src/components/inventory/BarcodeScanner';
import { Package, Plus, Search, ChartBar as BarChart3, TriangleAlert as AlertTriangle, Camera, History, TrendingUp, Archive, ArrowUp, X, FileUp } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { inventoryService } from '@/src/services/inventory';

const PRODUCTS_PER_PAGE = 5;

export default function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<'products' | 'import' | 'history'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showEditImportForm, setShowEditImportForm] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showImportCSVModal, setShowImportCSVModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedImport, setSelectedImport] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setIsSearching(false);
      setSearchResults([]);
      setFilteredProducts(products);
    } else {
      handleSearch();
    }
  }, [searchQuery, products]);

  const loadData = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const [historyData, totalCount, lowStockProducts] = await Promise.all([
        inventoryService.getImportHistory(profile.id),
        productService.getProductsCount(profile.id),
        productService.getLowStockProducts(profile.id)
      ]);
      
      setImportHistory(historyData);
      setTotalProducts(totalCount);
      setLowStockCount(lowStockProducts.length);
      
      // Reset pagination and load first page of products
      if (isRefresh) {
        setCurrentPage(0);
        setHasMoreProducts(true);
        await loadProducts(0, true);
      } else {
        await loadProducts(0, false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('common.error'), 'Failed to load inventory data');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const loadProducts = async (page: number, reset: boolean = false) => {
    if (!profile?.id) return;
    
    try {
      const offset = page * PRODUCTS_PER_PAGE;
      const productsData = await productService.getProducts(profile.id, PRODUCTS_PER_PAGE, offset);
      
      if (reset) {
        setProducts(productsData);
        setFilteredProducts(productsData);
      } else {
        const newProducts = [...(page === 0 ? [] : products), ...productsData];
        setProducts(newProducts);
        setFilteredProducts(newProducts);
      }
      
      setHasMoreProducts(productsData.length === PRODUCTS_PER_PAGE);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert(t('common.error'), 'Failed to load products');
    }
  };

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMoreProducts || isSearching) return;
    
    setLoadingMore(true);
    try {
      await loadProducts(currentPage + 1);
    } finally {
      setLoadingMore(false);
    }
  }, [currentPage, hasMoreProducts, loadingMore, profile?.id, isSearching]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    await loadData(true);
  };

  const handleProductSave = (product: any) => {
    setShowProductForm(false);
    setSelectedProduct(null);
    // Refresh the current page to show updated product
    loadProducts(0, true);
    // Update total count
    if (!selectedProduct) {
      setTotalProducts(prev => prev + 1);
    }
  };

  const handleImportComplete = () => {
    setShowImportForm(false);
    setSelectedProduct(null);
    loadData();
  };

  const handleEditImportComplete = () => {
    setShowEditImportForm(false);
    setSelectedImport(null);
    loadData();
  };

  const handleCSVImportComplete = () => {
    setShowImportCSVModal(false);
    loadData();
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setShowProductForm(true);
  };

  const handleImportStock = (product: any) => {
    setSelectedProduct(product);
    setShowImportForm(true);
  };

  const handleEditImport = (importRecord: any) => {
    setSelectedImport(importRecord);
    setShowEditImportForm(true);
  };

  const handleDeleteImport = (importRecord: any) => {
    Alert.alert(
      'Delete Import Record',
      `Are you sure you want to delete this import record? This will also adjust the product stock.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await inventoryService.deleteImport(importRecord.id);
              Alert.alert('Success', 'Import record deleted successfully');
              loadData();
            } catch (error) {
              console.error('Error deleting import:', error);
              Alert.alert('Error', 'Failed to delete import record');
            }
          }
        },
      ]
    );
  };

  const handleLowStockPress = () => {
    router.push('/(app)/(tabs)/inventory/low-stock');
  };

  const handleSearch = async () => {
    if (!profile?.id || searchQuery.trim() === '') return;
    
    setIsSearching(true);
    try {
      const results = await productService.searchProducts(profile.id, searchQuery);
      setSearchResults(results);
      setFilteredProducts(results);
    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'Failed to search products');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    setFilteredProducts(products);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setShowBarcodeScanner(false);
    
    if (!profile?.id || !barcode) return;
    
    try {
      const product = await productService.searchByBarcode(barcode, profile.id);
      
      if (product) {
        setSearchQuery(barcode);
        setIsSearching(true);
        setSearchResults([product]);
        setFilteredProducts([product]);
      } else {
        Alert.alert(
          'Barcode Not Found', 
          `No product found with barcode ${barcode}. Would you like to add a new product with this barcode?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Add Product', 
              onPress: () => {
                setSelectedProduct({ barcode });
                setShowProductForm(true);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error searching by barcode:', error);
      Alert.alert('Error', 'Failed to search by barcode');
    }
  };

  const scrollToTop = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowBackToTop(offsetY > 200);
      }
    }
  );

  const TabButton = ({ 
    title, 
    icon,
    isActive, 
    onPress 
  }: { 
    title: string; 
    icon: React.ReactNode;
    isActive: boolean; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        {
          backgroundColor: isActive 
            ? '#2563eb' 
            : (isDark ? '#374151' : '#f3f4f6'),
          borderColor: isActive ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
        }
      ]}
      onPress={onPress}
    >
      <View style={styles.tabButtonContent}>
        <View style={[styles.tabIcon, { opacity: isActive ? 1 : 0.7 }]}>
          {icon}
        </View>
        <Text style={[
          styles.tabButtonText,
          { color: isActive ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
        ]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item }: { item: any }) => (
    <ProductCard
      product={item}
      onEdit={handleEditProduct}
      onImportStock={handleImportStock}
    />
  );

  const renderProductsTab = () => {
    if (loading) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.summaryCards}>
            <SkeletonCard style={styles.summaryCard}>
              <View style={styles.summaryContent}>
                <SkeletonLoader height={24} width={24} borderRadius={12} />
                <View style={styles.summaryText}>
                  <SkeletonLoader height={20} width="60%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="80%" />
                </View>
              </View>
            </SkeletonCard>
            <SkeletonCard style={styles.summaryCard}>
              <View style={styles.summaryContent}>
                <SkeletonLoader height={24} width={24} borderRadius={12} />
                <View style={styles.summaryText}>
                  <SkeletonLoader height={20} width="60%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="80%" />
                </View>
              </View>
            </SkeletonCard>
          </View>
          <SkeletonList itemComponent={SkeletonProductCard} itemCount={5} />
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
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
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.barcodeButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
            onPress={() => setShowBarcodeScanner(true)}
          >
            <Camera size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCards}>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryContent}>
              <Package size={24} color="#2563eb" />
              <View style={styles.summaryText}>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {totalProducts}
                </Text>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Products
                </Text>
              </View>
            </View>
          </Card>
          
          <TouchableOpacity onPress={handleLowStockPress}>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryContent}>
                <AlertTriangle size={24} color="#ea580c" />
                <View style={styles.summaryText}>
                  <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {lowStockCount}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Low Stock
                  </Text>
                </View>
              </View>
              {lowStockCount > 0 && (
                <View style={styles.alertIndicator}>
                  <Text style={styles.alertText}>!</Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        </View>

        {isSearching && (
          <View style={styles.searchResultsHeader}>
            <Text style={[styles.searchResultsText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {searchResults.length === 0 
                ? `No products found for "${searchQuery}"` 
                : `Found ${searchResults.length} product${searchResults.length !== 1 ? 's' : ''}`}
            </Text>
            {searchResults.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Text style={styles.clearSearchText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
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
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.1}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListFooterComponent={() => {
            if (loadingMore) {
              return (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={[styles.loadingMoreText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Loading more products...
                  </Text>
                </View>
              );
            }
            
            if (!hasMoreProducts && filteredProducts.length > 0 && !isSearching) {
              return (
                <View style={styles.endOfList}>
                  <Text style={[styles.endOfListText, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                    You've reached the end of your products
                  </Text>
                </View>
              );
            }
            
            return null;
          }}
          ListEmptyComponent={() => (
            <Card style={styles.emptyState}>
              <Package size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {isSearching ? 'No products found' : 'No products yet'}
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {isSearching 
                  ? `We couldn't find any products matching "${searchQuery}"`
                  : 'Add your first product to start managing inventory'}
              </Text>
              {isSearching ? (
                <Button
                  title="Clear Search"
                  onPress={handleClearSearch}
                  style={styles.emptyButton}
                />
              ) : (
                <Button
                  title="Add Product"
                  onPress={() => setShowProductForm(true)}
                  style={styles.emptyButton}
                />
              )}
            </Card>
          )}
          contentContainerStyle={filteredProducts.length === 0 ? styles.emptyContainer : styles.productsList}
        />
      </View>
    );
  };

  const renderImportTab = () => {
    if (loading) {
      return (
        <ScrollView style={styles.tabContent}>
          <SkeletonCard style={styles.emptyState}>
            <SkeletonLoader height={48} width={48} borderRadius={24} style={{ marginBottom: 16 }} />
            <SkeletonLoader height={18} width="60%" style={{ marginBottom: 8 }} />
            <SkeletonLoader height={14} width="80%" style={{ marginBottom: 20 }} />
            <SkeletonLoader height={40} width={150} borderRadius={8} />
          </SkeletonCard>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={styles.tabContent}
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
        <Card style={styles.importOptionsCard}>
          <Text style={[styles.importOptionsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Import Options
          </Text>
          
          <View style={styles.importOptionsGrid}>
            <TouchableOpacity
              style={[styles.importOption, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
              onPress={() => setShowImportForm(true)}
            >
              <View style={[styles.importOptionIcon, { backgroundColor: '#2563eb20' }]}>
                <TrendingUp size={24} color="#2563eb" />
              </View>
              <Text style={[styles.importOptionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Manual Import
              </Text>
              <Text style={[styles.importOptionSubtext, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Add stock for a single product
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.importOption, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
              onPress={() => setShowImportCSVModal(true)}
            >
              <View style={[styles.importOptionIcon, { backgroundColor: '#05966920' }]}>
                <FileUp size={24} color="#059669" />
              </View>
              <Text style={[styles.importOptionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Bulk Import
              </Text>
              <Text style={[styles.importOptionSubtext, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Import from CSV file
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
        
        <Card style={styles.emptyState}>
          <TrendingUp size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Import Inventory
          </Text>
          <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Add stock to your products with detailed cost tracking
          </Text>
          <View style={styles.importButtonsContainer}>
            <Button
              title="Manual Import"
              onPress={() => setShowImportForm(true)}
              style={styles.importButton}
            />
            <Button
              title="Bulk Import"
              variant="outline"
              onPress={() => setShowImportCSVModal(true)}
              style={styles.importButton}
            />
          </View>
        </Card>
      </ScrollView>
    );
  };

  const renderHistoryTab = () => {
    if (loading) {
      return (
        <ScrollView style={styles.tabContent}>
          <SkeletonList 
            itemComponent={() => (
              <SkeletonCard style={{ padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <SkeletonLoader height={16} width="70%" style={{ marginBottom: 4 }} />
                    <SkeletonLoader height={12} width="40%" />
                  </View>
                  <SkeletonLoader height={32} width={32} borderRadius={8} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <SkeletonLoader height={14} width="30%" />
                  <SkeletonLoader height={14} width="30%" />
                  <SkeletonLoader height={14} width="30%" />
                </View>
              </SkeletonCard>
            )}
            itemCount={5}
          />
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={styles.tabContent}
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
        {importHistory.length > 0 ? (
          <View style={styles.historyList}>
            {importHistory.map((importRecord) => (
              <ImportHistoryCard 
                key={importRecord.id} 
                importRecord={importRecord}
                onEdit={handleEditImport}
              />
            ))}
          </View>
        ) : (
          <Card style={styles.emptyState}>
            <Archive size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              No Import History
            </Text>
            <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Import history will appear here once you start importing inventory
            </Text>
          </Card>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('inventory.title')}
        </Text>
      </View>

      <View style={styles.tabs}>
        <TabButton
          title="Products"
          icon={<Package size={18} color={activeTab === 'products' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'products'}
          onPress={() => setActiveTab('products')}
        />
        <TabButton
          title="Import Stock"
          icon={<TrendingUp size={18} color={activeTab === 'import' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'import'}
          onPress={() => setActiveTab('import')}
        />
        <TabButton
          title="Import History"
          icon={<Archive size={18} color={activeTab === 'history' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'history'}
          onPress={() => setActiveTab('history')}
        />
      </View>

      <View style={styles.content}>
        {activeTab === 'products' && renderProductsTab()}
        {activeTab === 'import' && renderImportTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </View>

      {showBackToTop && (
        <TouchableOpacity 
          style={[styles.backToTopButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
          onPress={scrollToTop}
        >
          <ArrowUp size={20} color="#2563eb" />
        </TouchableOpacity>
      )}

      <View style={styles.fab}>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => setShowProductForm(true)}
        >
          <Plus size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

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

      <Modal
        visible={showEditImportForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <EditImportForm
          importRecord={selectedImport}
          onComplete={handleEditImportComplete}
          onCancel={() => {
            setShowEditImportForm(false);
            setSelectedImport(null);
          }}
        />
      </Modal>

      <Modal
        visible={showImportCSVModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ImportCSVModal
          onComplete={handleCSVImportComplete}
          onClose={() => setShowImportCSVModal(false)}
        />
      </Modal>

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
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContent: {
    flex: 1,
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
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchResultsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  summaryCards: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    position: 'relative',
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    marginLeft: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  alertIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productsList: {
    paddingBottom: 80,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  historyList: {
    paddingBottom: 80,
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
    marginBottom: 20,
  },
  emptyButton: {
    marginTop: 16,
  },
  importButton: {
    marginTop: 16,
  },
  importButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
  },
  endOfList: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  endOfListText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fabButton: {
    backgroundColor: '#2563eb',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backToTopButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  importOptionsCard: {
    padding: 16,
    marginBottom: 16,
  },
  importOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  importOptionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  importOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  importOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  importOptionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  importOptionSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
});