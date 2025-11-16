import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/config/supabase';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonProductDetails } from '@/src/components/ui/SkeletonLoader';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import { ArrowLeft, Package, DollarSign, TrendingUp, ChartBar as BarChart3, History, ShoppingCart, Calendar, Info, Trash2, ArchiveRestore, Archive } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { inventoryService } from '@/src/services/inventory';
import { reportsService } from '@/src/services/reports';
import { productTransactionService } from '@/src/services/productTransactions';

export default function ProductDetailsScreen() {
  const [product, setProduct] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { productId } = params;
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  useEffect(() => {
    if (productId) {
      loadProductDetails();
    }
  }, [productId]);

  const loadProductDetails = async (isRefresh = false) => {
    if (!productId || !currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Load product details
      const productData = await productService.getProduct(productId as string);
      setProduct(productData);
      
      // Load import history for this product
      const importData = await inventoryService.getImportsByProductId(productId as string);
      setImportHistory(importData);
      
      // Get financial summary for this product
      // Default to last 6 months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
      
      const summaryData = await reportsService.getProductFinancialSummary(
        productId as string,
        currentBusiness.id,
        startDate,
        endDate
      );
      setFinancialSummary(summaryData);
    } catch (error) {
      console.error('Error loading product details:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProductDetails(true);
  }, [productId, currentBusiness?.id]);

  const handleImportStock = useCallback(() => {
    router.push(`/inventory/import-form?productId=${productId}`);
  }, [productId, router]);

  const handleUnarchiveProduct = useCallback(async () => {
    if (!product || !currentBusiness?.id) return;

    Alert.alert(
      'Unarchive Product',
      `Are you sure you want to unarchive "${product.name}"? It will be restored to your active products list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unarchive',
          onPress: async () => {
            try {
              setUnarchiving(true);
              const { user } = (await supabase.auth.getUser()).data;
              if (!user) throw new Error('User not authenticated');

              await productService.unarchiveProduct(product.id, user.id);

              Alert.alert('Success', 'Product unarchived successfully. You can now find it in your active products list.');
              router.back();
            } catch (error) {
              console.error('Error unarchiving product:', error);
              Alert.alert('Error', 'Failed to unarchive product. Please try again.');
            } finally {
              setUnarchiving(false);
            }
          },
        },
      ]
    );
  }, [product, currentBusiness, router]);

  const handleDeleteProduct = useCallback(async () => {
    if (!product || !currentBusiness?.id) return;

    try {
      setDeleting(true);
      const transactionCheck = await productTransactionService.checkProductTransactions(product.id);

      const summary = productTransactionService.getTransactionSummary(transactionCheck);

      const message = transactionCheck.hasTransactions
        ? `This product has transaction history (${summary}) and will be archived instead of permanently deleted.\n\nArchived products are hidden from normal views but preserved for reporting. Continue?`
        : 'This product has no transaction history and will be permanently deleted. This action cannot be undone. Continue?';

      Alert.alert(
        transactionCheck.hasTransactions ? 'Archive Product?' : 'Delete Product Permanently?',
        message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setDeleting(false) },
          {
            text: transactionCheck.hasTransactions ? 'Archive' : 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const { user } = (await supabase.auth.getUser()).data;
                if (!user) throw new Error('User not authenticated');

                const result = await productService.deleteProduct(product.id, user.id);

                const successMessage = result.type === 'archived'
                  ? 'Product archived successfully. It has been hidden from the product list but remains in your records.'
                  : 'Product deleted permanently.';

                Alert.alert('Success', successMessage);
                router.back();
              } catch (error) {
                console.error('Error deleting product:', error);
                Alert.alert('Error', 'Failed to delete product. Please try again.');
              } finally {
                setDeleting(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error checking product transactions:', error);
      Alert.alert('Error', 'Failed to check product status. Please try again.');
      setDeleting(false);
    }
  }, [product, currentBusiness, router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount || 0).toFixed(2)}`;
  };

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
            Product Details
          </Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonProductDetails />
        </ScrollView>
      </View>
    );
  }

  if (!product) {
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
            Product Not Found
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            The product you're looking for doesn't exist or has been deleted.
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
          Product Details
        </Text>
        <TouchableOpacity
          style={styles.deleteHeaderButton}
          onPress={handleDeleteProduct}
          disabled={deleting}
        >
          <Trash2 size={24} color="#dc2626" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
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
        {/* Product Overview Card */}
        <Card style={styles.productCard}>
          <View style={styles.productHeader}>
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
                  <Package size={32} color={isDark ? '#9ca3af' : '#6b7280'} />
                </View>
              )}
            </View>
            
            <View style={styles.productInfo}>
              <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {product.name}
              </Text>
              
              <Text style={[styles.productPrice, { color: '#059669' }]}>
                ${product.price.toFixed(2)}
              </Text>
              
              {product.description && (
                <Text style={[styles.productDescription, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {product.description}
                </Text>
              )}
              
              {product.barcode && (
                <Text style={[styles.productBarcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                  Barcode: {product.barcode}
                </Text>
              )}

              {product.is_archived && (
                <View style={[styles.archivedBadge, { backgroundColor: '#6b7280' }]}>
                  <Archive size={14} color="#ffffff" />
                  <Text style={styles.archivedText}>Archived Product</Text>
                </View>
              )}
            </View>
          </View>

          {product.is_archived && product.archived_at && (
            <View style={[styles.archiveInfo, { backgroundColor: isDark ? '#374151' : '#f3f4f6', borderColor: isDark ? '#4b5563' : '#e5e7eb' }]}>
              <Text style={[styles.archiveInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Archived on {formatDate(product.archived_at)}
              </Text>
            </View>
          )}
          
          <View style={styles.stockInfo}>
            <View style={styles.stockItem}>
              <Text style={[styles.stockLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Current Stock
              </Text>
              <Text style={[styles.stockValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {product.current_stock}
              </Text>
            </View>
            
            <View style={styles.stockItem}>
              <Text style={[styles.stockLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Min Stock Level
              </Text>
              <Text style={[styles.stockValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {product.min_stock_level}
              </Text>
            </View>
            
            <View style={styles.stockItem}>
              <Text style={[styles.stockLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Cost Per Unit
              </Text>
              <Text style={[styles.stockValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${product.cost_per_unit?.toFixed(2) || '0.00'}
              </Text>
            </View>
          </View>
          
          {!product.is_archived && (
            <Button
              title="Import Stock"
              onPress={handleImportStock}
              style={styles.importButton}
            />
          )}

          {product.is_archived && (
            <Button
              title="Unarchive Product"
              onPress={handleUnarchiveProduct}
              style={styles.importButton}
            />
          )}
        </Card>

        {/* Financial Summary Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={20} color="#2563eb" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Financial Summary
            </Text>
          </View>
          
          <View style={styles.financialGrid}>
            <View style={styles.financialItem}>
              <View style={[styles.financialIcon, { backgroundColor: '#2563eb20' }]}>
                <ShoppingCart size={20} color="#2563eb" />
              </View>
              <Text style={[styles.financialValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {financialSummary?.quantitySold || 0}
              </Text>
              <Text style={[styles.financialLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Units Sold
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <View style={[styles.financialIcon, { backgroundColor: '#05966920' }]}>
                <DollarSign size={20} color="#059669" />
              </View>
              <Text style={[styles.financialValue, { color: '#059669' }]}>
                ${financialSummary?.totalRevenue?.toFixed(2) || '0.00'}
              </Text>
              <Text style={[styles.financialLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Revenue
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <View style={[styles.financialIcon, { backgroundColor: '#dc262620' }]}>
                <DollarSign size={20} color="#dc2626" />
              </View>
              <Text style={[styles.financialValue, { color: '#dc2626' }]}>
                ${financialSummary?.totalCOGS?.toFixed(2) || '0.00'}
              </Text>
              <Text style={[styles.financialLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total COGS
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <View style={[styles.financialIcon, { backgroundColor: '#8b5cf620' }]}>
                <TrendingUp size={20} color="#8b5cf6" />
              </View>
              <Text style={[styles.financialValue, { color: financialSummary?.totalProfit >= 0 ? '#059669' : '#dc2626' }]}>
                ${financialSummary?.totalProfit?.toFixed(2) || '0.00'}
              </Text>
              <Text style={[styles.financialLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Profit
              </Text>
            </View>
          </View>
          
          <View style={styles.profitMargin}>
            <Text style={[styles.profitMarginLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Profit Margin:
            </Text>
            <Text style={[
              styles.profitMarginValue, 
              { 
                color: (financialSummary?.profitMargin || 0) >= 0 ? '#059669' : '#dc2626' 
              }
            ]}>
              {financialSummary?.profitMargin?.toFixed(2) || 0}%
            </Text>
          </View>
          
          <Text style={[styles.periodNote, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
            Data shown for the last 6 months
          </Text>
        </Card>

        {/* Import History */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <History size={20} color="#ea580c" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Import History
            </Text>
          </View>
          
          {importHistory.length > 0 ? (
            importHistory.map((importItem, index) => (
              <View key={importItem.id} style={[
                styles.importItem,
                index < importHistory.length - 1 && styles.importItemBorder
              ]}>
                <View style={styles.importHeader}>
                  <View style={styles.importDate}>
                    <Calendar size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
                    <Text style={[styles.importDateText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {formatDate(importItem.purchase_date)}
                    </Text>
                  </View>
                  
                  <View style={[
                    styles.statusBadge, 
                    { 
                      backgroundColor: importItem.status === 'completed' 
                        ? '#059669' + '20' 
                        : '#f59e0b' + '20' 
                    }
                  ]}>
                    <Text style={[
                      styles.statusText, 
                      { 
                        color: importItem.status === 'completed' 
                          ? '#059669' 
                          : '#f59e0b' 
                      }
                    ]}>
                      {importItem.status === 'completed' ? 'Completed' : 'Pending'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.importDetails}>
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Quantity:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {importItem.quantity}
                    </Text>
                  </View>
                  
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Base Cost:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {formatCurrency(importItem.base_unit_cost_per_item)}
                    </Text>
                  </View>
                  
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Final Cost:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {formatCurrency(importItem.final_unit_cost_per_item)}
                    </Text>
                  </View>
                  
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Total Cost:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: '#059669' }]}>
                      {formatCurrency(importItem.total_cost_for_item)}
                    </Text>
                  </View>
                </View>
                
                {importItem.notes && (
                  <Text style={[styles.importNotes, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Note: {importItem.notes}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Info size={24} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                No import history found for this product
              </Text>
            </View>
          )}
        </Card>

        {/* Cost Calculation Explanation */}

      </ScrollView>

      {deleting && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Processing..." />
        </View>
      )}

      {unarchiving && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Unarchiving product..." />
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
    width: 40,
  },
  deleteHeaderButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  productCard: {
    padding: 16,
    marginBottom: 16,
  },
  productHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  productImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  productBarcode: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  stockItem: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  importButton: {
    marginTop: 8,
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  financialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  financialItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  financialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  financialValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  financialLabel: {
    fontSize: 12,
  },
  profitMargin: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  profitMarginLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  profitMarginValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  periodNote: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  importItem: {
    marginBottom: 16,
  },
  importItemBorder: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  importHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  importDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  importDateText: {
    fontSize: 12,
    marginLeft: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  importDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  importDetail: {
    width: '50%',
    marginBottom: 8,
  },
  importDetailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  importDetailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  importNotes: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  formulaContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  formulaTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formula: {
    fontSize: 14,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  formulaDivider: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginVertical: 4,
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
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  archivedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  archiveInfo: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  archiveInfoText: {
    fontSize: 14,
    textAlign: 'center',
  },
});