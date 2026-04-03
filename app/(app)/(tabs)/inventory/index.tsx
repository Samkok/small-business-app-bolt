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
  Platform,
  Easing
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { TabButton } from '@/src/components/ui/TabButton';
import { SkeletonProductCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { ProductCard } from '@/src/components/products/ProductCard';
import { BatchHistoryCard } from '@/src/components/inventory/BatchHistoryCard';
import ProductForm from '@/src/components/products/ProductForm';
import ImportStockForm from '@/src/components/inventory/ImportStockForm';
import EditImportForm from '@/src/components/inventory/EditImportForm';
import EditBatchForm from '@/src/components/inventory/EditBatchForm';
import BarcodeScanner from '@/src/components/inventory/BarcodeScanner';
import { Package, Plus, Search, ChartBar as BarChart3, TriangleAlert as AlertTriangle, Barcode, History, TrendingUp, Archive, ArrowUp, X, Trash2, SquareCheck as CheckSquare, Square, Filter, Calendar, ArrowDown, ShoppingCart, Clock, CalendarDays, Sparkles } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { batchImportService } from '@/src/services/batchImport';
import { productTransactionService } from '@/src/services/productTransactions';
import { supabase } from '@/src/config/supabase';
import { InstantCheckoutModal } from '@/src/components/checkout/InstantCheckoutModal';
import { InstantCheckoutWidget } from '@/src/components/checkout/InstantCheckoutWidget';

const PRODUCTS_PER_PAGE = 5;

export default function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<'products' | 'history'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [batchHistory, setBatchHistory] = useState<any[]>([]);
  const [filteredBatchHistory, setFilteredBatchHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showEditImportForm, setShowEditImportForm] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedImport, setSelectedImport] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isBatchSearching, setIsBatchSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [deletingImport, setDeletingImport] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [showEditBatchForm, setShowEditBatchForm] = useState(false);
  const [selectedBatchForEdit, setSelectedBatchForEdit] = useState<any>(null);
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

  // Archived products states
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProducts, setArchivedProducts] = useState<any[]>([]);
  const [filteredArchivedProducts, setFilteredArchivedProducts] = useState<any[]>([]);
  const [totalArchivedProducts, setTotalArchivedProducts] = useState(0);
  const [unarchivingProduct, setUnarchivingProduct] = useState<string | null>(null);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const historyFlatListRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setIsSearching(false);
      setSearchResults([]);
      if (showArchived) {
        setFilteredArchivedProducts(archivedProducts);
      } else {
        setFilteredProducts(products);
      }
    } else {
      handleSearch();
    }
  }, [searchQuery, products, archivedProducts, showArchived]);

  useEffect(() => {
    filterBatchHistory();
  }, [batchHistory, batchSearchQuery, sortOrder]);

  const loadData = async (isRefresh = false) => {
    if (!currentBusiness?.id) return;

    if (!isRefresh) {
      setLoading(true);
    }

    try {
      const [batchData, totalCount, lowStockProducts, archivedCount] = await Promise.all([
        batchImportService.getBatchImports(currentBusiness.id),
        productService.getProductsCount(currentBusiness.id),
        productService.getLowStockProducts(currentBusiness.id),
        productService.getArchivedProductsCount(currentBusiness.id)
      ]);

      setBatchHistory(batchData);
      setFilteredBatchHistory(batchData);
      setTotalProducts(totalCount);
      setLowStockCount(lowStockProducts.length);
      setTotalArchivedProducts(archivedCount);

      // Reset pagination and load first page of products
      if (isRefresh) {
        setCurrentPage(0);
        setHasMoreProducts(true);
        if (showArchived) {
          await loadArchivedProducts(0, true);
        } else {
          await loadProducts(0, true);
        }
      } else {
        if (showArchived) {
          await loadArchivedProducts(0, false);
        } else {
          await loadProducts(0, false);
        }
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

  const loadArchivedProducts = async (page: number, reset: boolean = false) => {
    if (!currentBusiness?.id) return;

    try {
      const offset = page * PRODUCTS_PER_PAGE;
      const productsData = await productService.getArchivedProducts(currentBusiness.id, PRODUCTS_PER_PAGE, offset);

      if (reset) {
        setArchivedProducts(productsData);
        setFilteredArchivedProducts(productsData);
      } else {
        setArchivedProducts(prevProducts => {
          const combined = [...prevProducts, ...productsData];
          const uniqueById = Array.from(
            new Map(combined.map(item => [item.id, item])).values()
          );
          return uniqueById;
        });

        if (!isSearching) {
          setFilteredArchivedProducts(prevFiltered => {
            const combined = [...prevFiltered, ...productsData];
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
      console.error('Error loading archived products:', error);
      Alert.alert(t('common.error'), 'Failed to load archived products');
    }
  };

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMoreProducts || isSearching) return;

    setLoadingMore(true);
    try {
      if (showArchived) {
        await loadArchivedProducts(currentPage + 1);
      } else {
        await loadProducts(currentPage + 1);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [currentPage, hasMoreProducts, loadingMore, currentBusiness?.id, isSearching, showArchived]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    setBatchSearchQuery('');
    setSelectedBatches(new Set());
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

  const handleEditBatch = (batch: any) => {
    setSelectedBatchForEdit(batch);
    setShowEditBatchForm(true);
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

  const handleDeleteProduct = async (product: any) => {
    if (!currentBusiness?.id) return;

    try {
      setDeletingProduct(product.id);
      const transactionCheck = await productTransactionService.checkProductTransactions(product.id);

      const summary = productTransactionService.getTransactionSummary(transactionCheck);

      const message = transactionCheck.hasTransactions
        ? t('inventory.archiveProductMessage', { summary })
        : t('inventory.deleteProductPermanentlyMessage');

      Alert.alert(
        transactionCheck.hasTransactions ? t('inventory.archiveProductTitle') : t('inventory.deleteProductPermanentlyTitle'),
        message,
        [
          { text: t('actions.cancel'), style: 'cancel', onPress: () => setDeletingProduct(null) },
          {
            text: transactionCheck.hasTransactions ? t('actions.archive') : t('actions.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('User not authenticated');

                const result = await productService.deleteProduct(product.id, user.id);

                const successMessage = result.type === 'archived'
                  ? t('inventory.productArchivedSuccess')
                  : t('inventory.productDeletedSuccess');

                Alert.alert(t('common.success'), successMessage);

                // Refresh product list
                await loadData(true);
              } catch (error) {
                console.error('Error deleting product:', error);
                Alert.alert(t('common.error'), t('inventory.deleteProductError'));
              } finally {
                setDeletingProduct(null);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error checking product transactions:', error);
      Alert.alert('Error', 'Failed to check product status');
      setDeletingProduct(null);
    }
  };

  const handleMarkAsArrived = async (importRecord: any) => {
    if (importRecord.status === 'completed') {
      Alert.alert(t('inventory.alreadyArrived'), t('inventory.alreadyArrivedMessage'));
      return;
    }

    Alert.alert(
      t('inventory.markBatchArrived'),
      t('inventory.markBatchArrivedMessage'),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        { 
          text: t('actions.confirm'), 
          onPress: async () => {
            try {
              setMarkingAsArrived(importRecord.id);
              await batchImportService.markBatchAsArrived(importRecord.id);
              Alert.alert(t('common.success'), t('inventory.batchArrivedSuccess'));
              loadData();
            } catch (error) {
              console.error('Error marking batch as arrived:', error);
              Alert.alert(t('common.error'), t('inventory.batchArrivedError'));
            } finally {
              setMarkingAsArrived(null);
            }
          }
        },
      ]
    );
  };

  const handleViewBatchDetails = (batch: any) => {
    router.push(`/inventory/batch-details?batchId=${batch.id}`);
  };

  const handleDeleteBatch = async (batch: any) => {
    Alert.alert(
      t('inventory.deleteBatch'),
      `${t('inventory.deleteBatchMessage')} ${batch.status === 'completed' ? t('inventory.deleteBatchStockWarning') : ''}`,
      [
        { text: t('actions.cancel'), style: 'cancel' },
        { 
          text: t('actions.delete'), 
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingImport(batch.id);
              await batchImportService.deleteBatchImport(batch.id);
              Alert.alert(t('common.success'), t('inventory.batchDeleteSuccess'));
              loadData();
            } catch (error) {
              console.error('Error deleting batch:', error);
              Alert.alert(t('common.error'), t('inventory.batchDeleteError'));
            } finally {
              setDeletingImport(null);
            }
          }
        },
      ]
    );
  };

  const handleToggleSelectBatch = (batchId: string) => {
    const newSelected = new Set(selectedBatches);
    if (newSelected.has(batchId)) {
      newSelected.delete(batchId);
    } else {
      newSelected.add(batchId);
    }
    setSelectedBatches(newSelected);
  };

  const handleToggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (!isMultiSelectMode) {
      setSelectedBatches(new Set());
    }
  };

  const handleSelectAllBatches = () => {
    if (selectedBatches.size === filteredBatchHistory.length) {
      // Deselect all
      setSelectedBatches(new Set());
    } else {
      // Select all
      const allBatchIds = filteredBatchHistory.map(item => item.id);
      setSelectedBatches(new Set(allBatchIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBatches.size === 0) {
      Alert.alert(t('inventory.noBatchesSelected'), t('inventory.selectBatchMessage'));
      return;
    }

    Alert.alert(
      t('inventory.deleteSelectedBatches'),
      t('inventory.deleteMultipleBatchesMessage', { count: selectedBatches.size }),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('actions.delete'),
          style: 'destructive',
          onPress: async () => {
            setBulkDeleteLoading(true);
            try {
              const batchIds = Array.from(selectedBatches);
              let successCount = 0;
              let errorCount = 0;

              // Process deletions sequentially to avoid race conditions
              for (const batchId of batchIds) {
                try {
                  await batchImportService.deleteBatchImport(batchId);
                  successCount++;
                } catch (error) {
                  console.error(`Error deleting batch ${batchId}:`, error);
                  errorCount++;
                }
              }

              if (errorCount === 0) {
                Alert.alert(t('common.success'), t('inventory.batchesDeletedSuccess', { count: successCount }));
              } else {
                Alert.alert(
                  t('inventory.partialSuccess'),
                  t('inventory.partialDeleteMessage', { successCount, errorCount })
                );
              }

              // Reset selection and refresh data
              setSelectedBatches(new Set());
              setIsMultiSelectMode(false);
              loadData();
            } catch (error) {
              console.error('Error in bulk delete operation:', error);
              Alert.alert(t('common.error'), t('inventory.bulkDeleteError'));
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
      const results = showArchived
        ? await productService.searchArchivedProducts(currentBusiness.id, searchQuery)
        : await productService.searchProducts(currentBusiness.id, searchQuery);

      setSearchResults(results);

      if (showArchived) {
        setFilteredArchivedProducts(results);
      } else {
        setFilteredProducts(results);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'Failed to search products');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    if (showArchived) {
      setFilteredArchivedProducts(archivedProducts);
    } else {
      setFilteredProducts(products);
    }
  };

  const handleToggleArchiveFilter = async () => {
    const newShowArchived = !showArchived;
    setShowArchived(newShowArchived);
    setSearchQuery('');
    setIsSearching(false);
    setCurrentPage(0);
    setHasMoreProducts(true);

    if (newShowArchived) {
      if (archivedProducts.length === 0) {
        await loadArchivedProducts(0, true);
      }
    }
  };

  const handleShowActive = async () => {
    if (showArchived) {
      setShowArchived(false);
      setSearchQuery('');
      setIsSearching(false);
      setCurrentPage(0);
      setHasMoreProducts(true);
    }
  };

  const handleShowArchived = async () => {
    if (!showArchived) {
      setShowArchived(true);
      setSearchQuery('');
      setIsSearching(false);
      setCurrentPage(0);
      setHasMoreProducts(true);

      if (archivedProducts.length === 0) {
        await loadArchivedProducts(0, true);
      }
    }
  };

  const handleUnarchiveProduct = async (product: any) => {
    if (!currentBusiness?.id) return;

    Alert.alert(
      t('inventory.unarchiveProduct'),
      t('inventory.unarchiveProductMessage', { name: product.name }),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('actions.unarchive'),
          onPress: async () => {
            try {
              setUnarchivingProduct(product.id);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('User not authenticated');

              await productService.unarchiveProduct(product.id, user.id);

              Alert.alert(t('common.success'), t('inventory.unarchiveSuccess'));

              await loadData(true);
            } catch (error) {
              console.error('Error unarchiving product:', error);
              Alert.alert(t('common.error'), t('inventory.unarchiveError'));
            } finally {
              setUnarchivingProduct(null);
            }
          },
        },
      ]
    );
  };

  const handleBatchSearch = () => {
    filterBatchHistory();
  };

  const handleClearBatchSearch = () => {
    setBatchSearchQuery('');
    setIsBatchSearching(false);
    setFilteredBatchHistory(batchHistory);
  };

  const filterBatchHistory = () => {
    if (!batchHistory.length) return;
    
    let filtered = [...batchHistory];
    
    // Apply search filter if query exists
    if (batchSearchQuery.trim()) {
      setIsBatchSearching(true);
      filtered = filtered.filter(batch => {
        const batchId = batch.id.toLowerCase();
        const notes = batch.notes?.toLowerCase() || '';
        const query = batchSearchQuery.toLowerCase();
        
        // Search in batch properties
        const batchMatch = batchId.includes(query) || notes.includes(query);
        
        // Search in product names within the batch
        const productMatch = batch.inventory_imports.some(importItem => {
          const productName = importItem.products?.name?.toLowerCase() || '';
          const productBarcode = importItem.products?.barcode?.toLowerCase() || '';
          return productName.includes(query) || productBarcode.includes(query);
        });
        
        return (
          batchMatch || productMatch ||
          batch.total_batch_cost.toString().includes(query)
        );
      });
    } else {
      setIsBatchSearching(false);
    }
    
    // Apply sort order
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    setFilteredBatchHistory(filtered);
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


  const renderProductItem = ({ item }: { item: any }) => (
    <ProductCard
      product={item}
      onEdit={handleEditProduct}
      onViewDetails={handleViewDetails}
      onDelete={handleDeleteProduct}
      onUnarchive={handleUnarchiveProduct}
      isArchived={showArchived}
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
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: !showArchived ? '#2563eb' : (isDark ? '#374151' : '#f3f4f6'),
                borderColor: !showArchived ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
              }
            ]}
            onPress={handleShowActive}
          >
            <Package size={16} color={!showArchived ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />
            <Text style={[
              styles.filterButtonText,
              { color: !showArchived ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
            ]}>
              {t('inventory.active')} ({totalProducts})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: showArchived ? '#2563eb' : (isDark ? '#374151' : '#f3f4f6'),
                borderColor: showArchived ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
              }
            ]}
            onPress={handleShowArchived}
          >
            <Archive size={16} color={showArchived ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />
            <Text style={[
              styles.filterButtonText,
              { color: showArchived ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
            ]}>
              {t('inventory.archived')} ({totalArchivedProducts})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}>
            <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
              placeholder={`${t('actions.search')} ${showArchived ? t('inventory.archived').toLowerCase() + ' ' : ''}${t('inventory.products').toLowerCase()}...`}
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
          {!showArchived && (
            <TouchableOpacity
              style={[styles.barcodeButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
              onPress={() => setShowBarcodeScanner(true)}
            >
              <Barcode size={20} color="#2563eb" />
            </TouchableOpacity>
          )}
        </View>

        {!showArchived && (
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
              <TouchableOpacity
                style={[styles.insightButton, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}
                onPress={() => router.push('/inventory/product-insight')}
                activeOpacity={0.75}
              >
                <Animated.View style={{ opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }] }}>
                  <Sparkles size={14} color="#2563eb" />
                </Animated.View>
                <Text style={styles.insightButtonText}>Insight</Text>
              </TouchableOpacity>
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
                      {t('inventory.lowStock')}
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
        )}

        {isSearching && (
          <View style={styles.searchResultsHeader}>
            <Text style={[styles.searchResultsText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {searchResults.length === 0
                ? t('empty.noProductsForQuery', { query: searchQuery })
                : t('search.foundResults', { count: searchResults.length })}
            </Text>
            {searchResults.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Text style={styles.clearSearchText}>{t('actions.clear')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={showArchived ? filteredArchivedProducts : filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2563eb']}
              tintColor="#2563eb"
              title={t('actions.refresh')}
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

            const currentProducts = showArchived ? filteredArchivedProducts : filteredProducts;
            if (!hasMoreProducts && currentProducts.length > 0 && !isSearching) {
              return (
                <View style={styles.endOfList}>
                  <Text style={[styles.endOfListText, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                    You've reached the end of {showArchived ? 'archived products' : 'your products'}
                  </Text>
                </View>
              );
            }

            return null;
          }}
          ListEmptyComponent={() => (
            <Card style={styles.emptyState}>
              {showArchived ? <Archive size={48} color={isDark ? '#6b7280' : '#9ca3af'} /> : <Package size={48} color={isDark ? '#6b7280' : '#9ca3af'} />}
              <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {isSearching ? t('empty.noProductsFound') : (showArchived ? t('empty.noArchivedProducts') : t('empty.noProducts'))}
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {isSearching
                  ? t('empty.noProductsSearchMessage', { query: searchQuery, type: showArchived ? t('inventory.archived').toLowerCase() + ' ' : '' })
                  : (showArchived ? t('empty.archivedProductsMessage') : t('empty.addFirstProduct'))}
              </Text>
              {isSearching ? (
                <Button
                  title={t('actions.clearSearch')}
                  onPress={handleClearSearch}
                  style={styles.emptyButton}
                />
              ) : !showArchived ? (
                <Button
                  title={t('inventory.addProduct')}
                  onPress={() => setShowProductForm(true)}
                  style={styles.emptyButton}
                />
              ) : null}
            </Card>
          )}
          contentContainerStyle={(showArchived ? filteredArchivedProducts : filteredProducts).length === 0 ? styles.emptyContainer : styles.productsList}
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
      <View style={styles.batchCardContainer}>
        {isMultiSelectMode && (
          <TouchableOpacity
            style={styles.selectCheckbox}
            onPress={() => handleToggleSelectBatch(item.id)}
          >
            {selectedBatches.has(item.id) ? (
              <CheckSquare size={24} color="#2563eb" />
            ) : (
              <Square size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
            )}
          </TouchableOpacity>
        )}
        <View style={[styles.batchCardWrapper, isMultiSelectMode && styles.batchCardWithCheckbox]}>
          <BatchHistoryCard 
            batch={item}
            onEdit={handleEditBatch}
            onDelete={handleDeleteBatch}
            onMarkAsArrived={handleMarkAsArrived}
            onViewDetails={handleViewBatchDetails}
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
            title={t('inventory.importStock')}
            onPress={() => setShowImportForm(true)}
            style={styles.importButton}
          />
        </Card>

        {/* Search and Filter Bar for Import History */}
        <View style={styles.batchSearchContainer}>
          <View style={[styles.searchInputContainer, { backgroundColor: isDark ? '#374151' : '#ffffff', flex: 1 }]}>
            <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
              placeholder={t('inventory.searchBatches')}
              placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
              value={batchSearchQuery}
              onChangeText={setBatchSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleBatchSearch}
            />
            {batchSearchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearBatchSearch}>
                <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={[styles.sortButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
            onPress={toggleSortOrder}
          >
            {sortOrder === 'newest' ? (
              <ArrowDown size={20} color="#2563eb" />
            ) : (
              <ArrowUp size={20} color="#2563eb" />
            )}
          </TouchableOpacity>
        </View>

        {isBatchSearching && (
          <View style={styles.searchResultsHeader}>
            <Text style={[styles.searchResultsText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {filteredBatchHistory.length === 0 
                ? t('empty.noBatchesForQuery', { query: batchSearchQuery })
                : t('search.foundBatches', { count: filteredBatchHistory.length })}
            </Text>
            <TouchableOpacity onPress={handleClearBatchSearch}>
              <Text style={styles.clearSearchText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {filteredBatchHistory.length > 0 && (
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
                {isMultiSelectMode ? t('actions.cancelSelection') : t('actions.selectMultiple')}
              </Text>
            </TouchableOpacity>

            {isMultiSelectMode && (
              <View style={styles.bulkActionButtons}>
                <TouchableOpacity 
                  style={[
                    styles.bulkActionButton, 
                    { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
                  ]}
                  onPress={handleSelectAllBatches}
                >
                  <Text style={{ color: isDark ? '#f9fafb' : '#374151' }}>
                    {selectedBatches.size === filteredBatchHistory.length ? t('actions.deselectAll') : t('actions.selectAll')}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.bulkActionButton, 
                    { 
                      backgroundColor: selectedBatches.size > 0 ? '#dc2626' : (isDark ? '#4b5563' : '#e5e7eb'),
                      opacity: selectedBatches.size > 0 ? 1 : 0.5
                    }
                  ]}
                  onPress={handleBulkDelete}
                  disabled={selectedBatches.size === 0 || bulkDeleteLoading}
                >
                  {bulkDeleteLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#ffffff" />
                      <Text style={{ color: '#ffffff', marginLeft: 4 }}>
                        {t('actions.delete')} ({selectedBatches.size})
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
          {isBatchSearching ? t('empty.noMatchingBatches') : t('empty.noImportHistory')}
        </Text>
        <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {isBatchSearching
            ? t('empty.noBatchesSearchMessage', { query: batchSearchQuery })
            : t('empty.importBatchesMessage')
          }
        </Text>
        {isBatchSearching ? (
          <Button
            title={t('actions.clearSearch')}
            onPress={handleClearBatchSearch}
            style={styles.emptyButton}
          />
        ) : (
          <Button
            title={t('inventory.createNewImport')}
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
          data={filteredBatchHistory}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHistoryHeader}
          ListEmptyComponent={renderHistoryEmpty}
          contentContainerStyle={filteredBatchHistory.length === 0 ? styles.emptyContainer : styles.historyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2563eb']}
              tintColor="#2563eb"
              title={t('actions.refresh')}
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
          title={t('inventory.products')}
          icon={<Package size={18} color={activeTab === 'products' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'products'}
          onPress={() => setActiveTab('products')}
          isDark={isDark}
        />
        <TabButton
          title={t('inventory.importHistory')}
          icon={<Archive size={18} color={activeTab === 'history' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'history'}
          onPress={() => setActiveTab('history')}
          isDark={isDark}
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

      {activeTab === 'products' && (
        <View style={styles.fab}>
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => setShowProductForm(true)}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

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

      <Modal
        visible={showEditBatchForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <EditBatchForm
          batch={selectedBatchForEdit}
          onComplete={handleRefresh}
          onCancel={() => setShowEditBatchForm(false)}
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

      {/* Loading overlay for deleting product */}
      {deletingProduct && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Processing..." />
        </View>
      )}

      {/* Loading overlay for unarchiving product */}
      {unarchivingProduct && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Unarchiving product..." />
        </View>
      )}

      <InstantCheckoutModal />
      <InstantCheckoutWidget />
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContent: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  batchSearchContainer: {
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
  insightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  insightButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
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
  batchCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectCheckbox: {
    marginRight: 12,
  },
  batchCardWrapper: {
    flex: 1,
  },
  batchCardWithCheckbox: {
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