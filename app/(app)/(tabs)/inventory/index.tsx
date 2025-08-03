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
import ImportStockForm from '@/src/components/inventory/ImportStockForm';
import EditImportForm from '@/src/components/inventory/EditImportForm';
import BarcodeScanner from '@/src/components/inventory/BarcodeScanner';
import { Package, Plus, Search, ChartBar as BarChart3, TriangleAlert as AlertTriangle, Barcode, History, TrendingUp, Archive, ArrowUp, X, Trash2, SquareCheck as CheckSquare, Square, Filter, Calendar, Import as SortAsc, Dessert as SortDesc, ShoppingCart } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { inventoryService } from '@/src/services/inventory';

const PRODUCTS_PER_PAGE = 5;

export default function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<'products' | 'history'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [filteredImportHistory, setFilteredImportHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showEditImportForm, setShowEditImportForm] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedImport, setSelectedImport] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importSearchQuery, setImportSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isImportSearching, setIsImportSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [deletingImport, setDeletingImport] = useState<string | null>(null);
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [markingAsArrived, setMarkingAsArrived] = useState<string | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const historyFlatListRef = useRef<FlatList>(null);
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

  useEffect(() => {
    filterImportHistory();
  }, [importHistory, importSearchQuery, sortOrder]);

  const loadData = async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const [historyData, totalCount, lowStockProducts] = await Promise.all([
        inventoryService.getImportHistory(currentBusiness.id),
        productService.getProductsCount(currentBusiness.id),
        productService.getLowStockProducts(currentBusiness.id)
      ]);
      
      setImportHistory(historyData);
      setFilteredImportHistory(historyData);
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
    if (!currentBusiness?.id) return;
    
    try {
      const offset = page * PRODUCTS_PER_PAGE;
      const productsData = await productService.getProducts(currentBusiness.id, PRODUCTS_PER_PAGE, offset);
      
      if (reset) {
        setProducts(productsData);
        setFilteredProducts(productsData);
      } else {
        // Use functional update to ensure we're working with the latest state
        setProducts(prevProducts => {
          const combined = [...prevProducts, ...productsData];
          
          // Deduplicate by `id`
          const uniqueById = Array.from(
            new Map(combined.map(item => [item.id, item])).values()
          );
          
          return uniqueById;
        });
        
        // Also update filtered products if not searching
        if (!isSearching) {
          setFilteredProducts(prevFiltered => {
            const combined = [...prevFiltered, ...productsData];
            
            // Deduplicate by `id`
            const uniqueById = Array.from(
              new Map(combined.map(item => [item.id, item])).values()
            );
            
            return uniqueById;
          });
        }
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
  }, [currentPage, hasMoreProducts, loadingMore, currentBusiness?.id, isSearching]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    setImportSearchQuery('');
    setSelectedImports(new Set());
    setIsMultiSelectMode(false);
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

  const handleEditImportComplete = () => {
    setShowEditImportForm(false);
    setSelectedImport(null);
    loadData();
  };

  const handleMultiImportComplete = () => {
    setShowImportForm(false);
    loadData();
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setShowProductForm(true);
  };

  const handleViewDetails = (product: any) => {
    router.push(`/inventory/product-details?productId=${product.id}`);
  };

  const handleMarkAsArrived = async (importRecord: any) => {
    if (importRecord.status === 'completed') {
      Alert.alert('Already Arrived', 'This import has already been marked as arrived.');
      return;
    }

    Alert.alert(
      'Mark as Arrived',
      'Are you sure you want to mark this import as arrived? This will update the product stock and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            try {
              setMarkingAsArrived(importRecord.id);
              await inventoryService.markImportAsArrived(importRecord.id);
              Alert.alert('Success', 'Import marked as arrived successfully');
              loadData();
            } catch (error) {
              console.error('Error marking import as arrived:', error);
              Alert.alert('Error', 'Failed to mark import as arrived');
            } finally {
              setMarkingAsArrived(null);
            }
          }
        },
      ]
    );
  };

  const handleEditImport = (importRecord: any) => {
    setSelectedImport(importRecord);
    setShowEditImportForm(true);
  };

  const handleDeleteImport = async (importRecord: any) => {
    Alert.alert(
      'Delete Import Record',
      `Are you sure you want to delete this import record? ${importRecord.status === 'completed' ? 'This will also adjust the product stock.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingImport(importRecord.id);
              await inventoryService.deleteImport(importRecord.id);
              Alert.alert('Success', 'Import record deleted successfully');
              loadData();
            } catch (error) {
              console.error('Error deleting import:', error);
              Alert.alert('Error', 'Failed to delete import record');
            } finally {
              setDeletingImport(null);
            }
          }
        },
      ]
    );
  };

  const handleToggleSelectImport = (importId: string) => {
    const newSelected = new Set(selectedImports);
    if (newSelected.has(importId)) {
      newSelected.delete(importId);
    } else {
      newSelected.add(importId);
    }
    setSelectedImports(newSelected);
  };

  const handleToggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (!isMultiSelectMode) {
      setSelectedImports(new Set());
    }
  };

  const handleSelectAllImports = () => {
    if (selectedImports.size === filteredImportHistory.length) {
      // Deselect all
      setSelectedImports(new Set());
    } else {
      // Select all
      const allImportIds = filteredImportHistory.map(item => item.id);
      setSelectedImports(new Set(allImportIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedImports.size === 0) {
      Alert.alert('No Imports Selected', 'Please select at least one import record to delete.');
      return;
    }

    Alert.alert(
      'Delete Selected Imports',
      `Are you sure you want to delete ${selectedImports.size} import record(s)? This will adjust product stock levels for completed imports.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBulkDeleteLoading(true);
            try {
              const importIds = Array.from(selectedImports);
              let successCount = 0;
              let errorCount = 0;

              // Process deletions sequentially to avoid race conditions
              for (const importId of importIds) {
                try {
                  await inventoryService.deleteImport(importId);
                  successCount++;
                } catch (error) {
                  console.error(`Error deleting import ${importId}:`, error);
                  errorCount++;
                }
              }

              if (errorCount === 0) {
                Alert.alert('Success', `Successfully deleted ${successCount} import record(s).`);
              } else {
                Alert.alert(
                  'Partial Success',
                  `Successfully deleted ${successCount} import record(s), but failed to delete ${errorCount} record(s).`
                );
              }

              // Reset selection and refresh data
              setSelectedImports(new Set());
              setIsMultiSelectMode(false);
              loadData();
            } catch (error) {
              console.error('Error in bulk delete operation:', error);
              Alert.alert('Error', 'An error occurred during the bulk delete operation.');
            } finally {
              setBulkDeleteLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLowStockPress = () => {
    router.push('/(app)/(tabs)/inventory/low-stock');
  };

  const handleSearch = async () => {
    if (!currentBusiness?.id || searchQuery.trim() === '') return;
    
    setIsSearching(true);
    try {
      const results = await productService.searchProducts(currentBusiness.id, searchQuery);
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

  const handleImportSearch = () => {
    filterImportHistory();
  };

  const handleClearImportSearch = () => {
    setImportSearchQuery('');
    setIsImportSearching(false);
    setFilteredImportHistory(importHistory);
  };

  const filterImportHistory = () => {
    if (!importHistory.length) return;
    
    let filtered = [...importHistory];
    
    // Apply search filter if query exists
    if (importSearchQuery.trim()) {
      setIsImportSearching(true);
      filtered = filtered.filter(item => {
        const productName = item.products?.name?.toLowerCase() || '';
        const productBarcode = item.products?.barcode?.toLowerCase() || '';
        const importId = item.id.toLowerCase();
        const query = importSearchQuery.toLowerCase();
        
        return (
          productName.includes(query) || 
          productBarcode.includes(query) || 
          importId.includes(query) ||
          item.quantity.toString().includes(query) ||
          item.total_cost.toString().includes(query)
        );
      });
    } else {
      setIsImportSearching(false);
    }
    
    // Apply sort order
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    setFilteredImportHistory(filtered);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest');
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setShowBarcodeScanner(false);
    
    // Simply set the search query to the scanned barcode
    setSearchQuery(barcode);
    setIsSearching(true);
  };

  const scrollToTop = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const scrollHistoryToTop = () => {
    if (historyFlatListRef.current) {
      historyFlatListRef.current.scrollToOffset({ offset: 0, animated: true });
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
        <View style={styles.tabIcon}>
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
      onViewDetails={handleViewDetails}
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
            <Barcode size={20} color="#2563eb" />
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

  const renderHistoryTab = () => {
    if (loading) {
      return (
        <View style={styles.tabContent}>
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
        </View>
      );
    }

    const renderHistoryItem = ({ item }: { item: any }) => (
      <View style={styles.importCardContainer}>
        {isMultiSelectMode && (
          <TouchableOpacity
            style={styles.selectCheckbox}
            onPress={() => handleToggleSelectImport(item.id)}
          >
            {selectedImports.has(item.id) ? (
              <CheckSquare size={24} color="#2563eb" />
            ) : (
              <Square size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
            )}
          </TouchableOpacity>
        )}
        <View style={[styles.importCardWrapper, isMultiSelectMode && styles.importCardWithCheckbox]}>
          <ImportHistoryCard 
            importRecord={item}
            onEdit={handleEditImport}
            onDelete={handleDeleteImport}
            onMarkAsArrived={handleMarkAsArrived}
          />
        </View>
      </View>
    );

    const renderHistoryHeader = () => (
      <>
        {/* Import Button */}
        <Card style={styles.importButtonCard}>
          <View style={styles.importButtonHeader}>
            <View style={styles.importButtonTitleContainer}>
              <TrendingUp size={20} color="#2563eb" />
              <Text style={[styles.importButtonTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Import Stock
              </Text>
            </View>
            <Text style={[styles.importButtonSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Add new inventory with detailed cost tracking. Select one or multiple products as needed.
            </Text>
          </View>
          
          <Button
            title="Import Stock"
            onPress={() => setShowImportForm(true)}
            style={styles.importButton}
          />
        </Card>

        {/* Search and Filter Bar for Import History */}
        <View style={styles.importSearchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: isDark ? '#374151' : '#ffffff', flex: 1 }]}>
            <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
              placeholder="Search imports..."
              placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
              value={importSearchQuery}
              onChangeText={setImportSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleImportSearch}
            />
            {importSearchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearImportSearch}>
                <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={[styles.sortButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
            onPress={toggleSortOrder}
          >
            {sortOrder === 'newest' ? (
              <SortDesc size={20} color="#2563eb" />
            ) : (
              <SortAsc size={20} color="#2563eb" />
            )}
          </TouchableOpacity>
        </View>

        {isImportSearching && (
          <View style={styles.searchResultsHeader}>
            <Text style={[styles.searchResultsText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {filteredImportHistory.length === 0 
                ? `No imports found for "${importSearchQuery}"` 
                : `Found ${filteredImportHistory.length} import${filteredImportHistory.length !== 1 ? 's' : ''}`}
            </Text>
            <TouchableOpacity onPress={handleClearImportSearch}>
              <Text style={styles.clearSearchText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {filteredImportHistory.length > 0 && (
          <View style={styles.historyActions}>
            <TouchableOpacity 
              style={[
                styles.multiSelectButton, 
                { backgroundColor: isMultiSelectMode ? '#2563eb' : (isDark ? '#374151' : '#f3f4f6') }
              ]}
              onPress={handleToggleMultiSelectMode}
            >
              <CheckSquare size={16} color={isMultiSelectMode ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />
              <Text style={[
                styles.multiSelectButtonText, 
                { color: isMultiSelectMode ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
              ]}>
                {isMultiSelectMode ? 'Cancel Selection' : 'Select Multiple'}
              </Text>
            </TouchableOpacity>

            {isMultiSelectMode && (
              <View style={styles.bulkActionButtons}>
                <TouchableOpacity 
                  style={[
                    styles.bulkActionButton, 
                    { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
                  ]}
                  onPress={handleSelectAllImports}
                >
                  <Text style={{ color: isDark ? '#f9fafb' : '#374151' }}>
                    {selectedImports.size === filteredImportHistory.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.bulkActionButton, 
                    { 
                      backgroundColor: selectedImports.size > 0 ? '#dc2626' : (isDark ? '#4b5563' : '#e5e7eb'),
                      opacity: selectedImports.size > 0 ? 1 : 0.5
                    }
                  ]}
                  onPress={handleBulkDelete}
                  disabled={selectedImports.size === 0 || bulkDeleteLoading}
                >
                  {bulkDeleteLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#ffffff" />
                      <Text style={{ color: '#ffffff', marginLeft: 4 }}>
                        Delete ({selectedImports.size})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </>
    );

    const renderHistoryEmpty = () => (
      <Card style={styles.emptyState}>
        <Archive size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
        <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {isImportSearching ? 'No matching imports found' : 'No Import History'}
        </Text>
        <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {isImportSearching 
            ? `No imports match your search "${importSearchQuery}"`
            : 'Import history will appear here once you start importing inventory'
          }
        </Text>
        {isImportSearching ? (
          <Button
            title="Clear Search"
            onPress={handleClearImportSearch}
            style={styles.emptyButton}
          />
        ) : (
          <Button
            title="Create New Import"
            onPress={() => setShowImportForm(true)}
            style={styles.emptyButton}
          />
        )}
      </Card>
    );

    return (
      <View style={styles.tabContent}>
        <FlatList
          ref={historyFlatListRef}
          data={filteredImportHistory}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHistoryHeader}
          ListEmptyComponent={renderHistoryEmpty}
          contentContainerStyle={filteredImportHistory.length === 0 ? styles.emptyContainer : styles.historyList}
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
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { 
              useNativeDriver: false,
              listener: (event: any) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                setShowBackToTop(offsetY > 200);
              }
            }
          )}
          scrollEventThrottle={16}
        />
      </View>
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
          title="Import History"
          icon={<Archive size={18} color={activeTab === 'history' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'history'}
          onPress={() => setActiveTab('history')}
        />
      </View>

      <View style={styles.content}>
        {activeTab === 'products' && renderProductsTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </View>

      {showBackToTop && (
        <TouchableOpacity 
          style={[styles.backToTopButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
          onPress={activeTab === 'products' ? scrollToTop : scrollHistoryToTop}
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
        <ImportStockForm
          onComplete={handleMultiImportComplete}
          onCancel={() => setShowImportForm(false)}
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
        visible={showBarcodeScanner}
        animationType="slide"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <BarcodeScanner
          onBarcodeScan={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
        />
      </Modal>

      {/* Loading overlay for deleting import */}
      {deletingImport && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Deleting import record..." />
        </View>
      )}

      {/* Loading overlay for bulk delete */}
      {bulkDeleteLoading && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text={`Deleting ${selectedImports.size} import records...`} />
        </View>
      )}

      {/* Loading overlay for marking as arrived */}
      {markingAsArrived && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Marking import as arrived..." />
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
  importSearchContainer: {
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
  sortButton: {
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
  historyActions: {
    marginBottom: 12,
  },
  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  multiSelectButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  bulkActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  importCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectCheckbox: {
    marginRight: 12,
  },
  importCardWrapper: {
    flex: 1,
  },
  importCardWithCheckbox: {
    flex: 1,
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
  importButtonCard: {
    padding: 16,
    marginBottom: 16,
  },
  importButtonHeader: {
    marginBottom: 16,
  },
  importButtonTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  importButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  importButtonSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  importButton: {
    width: '100%',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});