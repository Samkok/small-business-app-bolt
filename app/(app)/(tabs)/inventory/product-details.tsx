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
import { ArrowLeft, Package, DollarSign, TrendingUp, ChartBar as BarChart3, History, ShoppingCart, Calendar, Info, Trash2, Archive } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { inventoryService } from '@/src/services/inventory';
import { reportsService } from '@/src/services/reports';
import { productTransactionService } from '@/src/services/productTransactions';
import { unitService, Unit, ProductUnit } from '@/src/services/units';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { useTranslation } from '@/src/locales';

export default function ProductDetailsScreen() {
  const [product, setProduct] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitPrices, setUnitPrices] = useState<ProductUnit[]>([]);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { productId } = params;
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { formatPrice } = useCurrencyContext();
  const { t } = useTranslation();

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

      // Load unit variants when applicable
      if (productData?.unit_group_id) {
        try {
          const [unitsData, pricesData] = await Promise.all([
            unitService.getUnits(productData.unit_group_id),
            unitService.getProductUnits(productData.id),
          ]);
          setUnits(unitsData);
          setUnitPrices(pricesData);
        } catch {
          setUnits([]);
          setUnitPrices([]);
        }
      } else {
        setUnits([]);
        setUnitPrices([]);
      }
      
      // Load import history for this product
      const importData = await inventoryService.getImportsByProductId(productId as string);
      setImportHistory(importData || []);
      
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
      Alert.alert(t('common.error'), t('errors.loadFailed'));
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

  const handleShowInSales = useCallback(() => {
    router.push(`/inventory/product-sales?productId=${productId}&productName=${encodeURIComponent(product?.name || 'Product')}`);
  }, [productId, product?.name, router]);

  const handleUnarchiveProduct = useCallback(async () => {
    if (!product || !currentBusiness?.id) return;

    Alert.alert(
      t('inventory.unarchiveProduct'),
      t('inventory.unarchiveProductMessage', { name: product.name }),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('actions.unarchive'),
          onPress: async () => {
            try {
              setUnarchiving(true);
              const { user } = (await supabase.auth.getUser()).data;
              if (!user) throw new Error('User not authenticated');

              await productService.unarchiveProduct(product.id, user.id);

              Alert.alert(t('common.success'), t('inventory.unarchiveSuccess'));
              router.back();
            } catch (error) {
              console.error('Error unarchiving product:', error);
              Alert.alert(t('common.error'), t('inventory.unarchiveError'));
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
        ? t('inventory.archiveProductMessage', { summary })
        : t('inventory.deleteProductPermanentlyMessage');

      Alert.alert(
        transactionCheck.hasTransactions ? t('inventory.archiveProductTitle') : t('inventory.deleteProductPermanentlyTitle'),
        message,
        [
          { text: t('actions.cancel'), style: 'cancel', onPress: () => setDeleting(false) },
          {
            text: transactionCheck.hasTransactions ? t('actions.archive') : t('actions.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                const { user } = (await supabase.auth.getUser()).data;
                if (!user) throw new Error('User not authenticated');

                const result = await productService.deleteProduct(product.id, user.id);

                const successMessage = result.type === 'archived'
                  ? t('inventory.productArchivedSuccess')
                  : t('inventory.productDeletedSuccess');

                Alert.alert(t('common.success'), successMessage);
                router.back();
              } catch (error) {
                console.error('Error deleting product:', error);
                Alert.alert(t('common.error'), t('inventory.deleteProductError'));
              } finally {
                setDeleting(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error checking product transactions:', error);
      Alert.alert(t('common.error'), t('errors.checkStatusFailed'));
      setDeleting(false);
    }
  }, [product, currentBusiness, router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return formatPrice(amount || 0, product?.currency_id ?? undefined);
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
            {t('inventory.productDetails')}
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
            {t('errors.productNotFound')}
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('errors.productNotFoundMessage')}
          </Text>
          <Button
            title={t('actions.goBack')}
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
            title={t('actions.refresh')}
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
                {formatPrice(product.price, product.currency_id ?? undefined)}
              </Text>
              
              {product.description && (
                <Text style={[styles.productDescription, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {product.description}
                </Text>
              )}
              
              {product.barcode && (
                <Text style={[styles.productBarcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                  {t('inventory.barcode')}: {product.barcode}
                </Text>
              )}

              {product.is_archived && (
                <View style={[styles.archivedBadge, { backgroundColor: '#6b7280' }]}>
                  <Archive size={14} color="#ffffff" />
                  <Text style={styles.archivedText}>{t('inventory.archivedProduct')}</Text>
                </View>
              )}
            </View>
          </View>

          {product.is_archived && product.archived_at && (
            <View style={[styles.archiveInfo, { backgroundColor: isDark ? '#374151' : '#f3f4f6', borderColor: isDark ? '#4b5563' : '#e5e7eb' }]}>
              <Text style={[styles.archiveInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('inventory.archivedOn', { date: formatDate(product.archived_at) })}
              </Text>
            </View>
          )}
          
          <View style={styles.stockInfo}>
            <View style={styles.stockItem}>
              <Text style={[styles.stockLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('inventory.currentStock')}
              </Text>
              <Text style={[styles.stockValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {product.current_stock}
              </Text>
            </View>
            
            <View style={styles.stockItem}>
              <Text style={[styles.stockLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('inventory.minStockLevel')}
              </Text>
              <Text style={[styles.stockValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {product.min_stock_level}
              </Text>
            </View>
            
            <View style={styles.stockItem}>
              <Text style={[styles.stockLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('inventory.costPerUnit')}
              </Text>
              <Text style={[styles.stockValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {formatPrice(product.cost_per_unit || 0, product.currency_id ?? undefined)}
              </Text>
            </View>
          </View>

          {units.length > 0 && (
            <View style={styles.unitsSection}>
              <Text style={[styles.unitsHeading, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Units
              </Text>
              <View style={[styles.unitsTable, { borderColor: isDark ? '#374151' : '#e5e7eb' }]}>
                <View style={[styles.unitsHeaderRow, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                  <Text style={[styles.unitsHeaderCell, styles.unitCellName, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Unit</Text>
                  <Text style={[styles.unitsHeaderCell, styles.unitCellQty, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Qty</Text>
                  <Text style={[styles.unitsHeaderCell, styles.unitCellPrice, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Price</Text>
                </View>
                {units.map((unit, idx) => {
                  const pu = unitPrices.find(p => p.unit_id === unit.id);
                  const qty = Math.floor(product.current_stock / unit.conversion_factor_to_base);
                  const variantPrice = pu?.price ?? product.price;
                  const variantCurrency = pu?.currency_id ?? product.currency_id ?? undefined;
                  const variantName = pu?.name || unit.name;
                  return (
                    <View
                      key={unit.id}
                      style={[
                        styles.unitRow,
                        idx < units.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#e5e7eb' },
                      ]}
                    >
                      <View style={styles.unitCellName}>
                        <Text style={[styles.unitName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                          {variantName}
                        </Text>
                        {pu?.barcode ? (
                          <Text style={[styles.unitBarcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                            {pu.barcode}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.unitQty, styles.unitCellQty, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {qty}
                      </Text>
                      <Text style={[styles.unitPrice, styles.unitCellPrice, { color: '#059669' }]}>
                        {formatPrice(variantPrice, variantCurrency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {product.is_archived && (
            <Button
              title={t('inventory.unarchiveProduct')}
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
              {t('financials.financialSummary')}
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
                {t('reports.unitsSold')}
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <View style={[styles.financialIcon, { backgroundColor: '#05966920' }]}>
                <DollarSign size={20} color="#059669" />
              </View>
              <Text style={[styles.financialValue, { color: '#059669' }]}>
                {formatPrice(financialSummary?.totalRevenue || 0, product.currency_id ?? undefined)}
              </Text>
              <Text style={[styles.financialLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('financials.totalRevenue')}
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <View style={[styles.financialIcon, { backgroundColor: '#dc262620' }]}>
                <DollarSign size={20} color="#dc2626" />
              </View>
              <Text style={[styles.financialValue, { color: '#dc2626' }]}>
                {formatPrice(financialSummary?.totalCOGS || 0, product.currency_id ?? undefined)}
              </Text>
              <Text style={[styles.financialLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('financials.totalCOGS')}
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <View style={[styles.financialIcon, { backgroundColor: '#8b5cf620' }]}>
                <TrendingUp size={20} color="#8b5cf6" />
              </View>
              <Text style={[styles.financialValue, { color: financialSummary?.totalProfit >= 0 ? '#059669' : '#dc2626' }]}>
                {formatPrice(financialSummary?.totalProfit || 0, product.currency_id ?? undefined)}
              </Text>
              <Text style={[styles.financialLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('financials.totalProfit')}
              </Text>
            </View>
          </View>
          
          <View style={styles.profitMargin}>
            <Text style={[styles.profitMarginLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t('financials.profitMargin')}:
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
            {t('reports.dataLast6Months')}
          </Text>

          <Button
            title={t('inventory.showInSales')}
            onPress={handleShowInSales}
            style={styles.showInSalesButton}
          />
        </Card>

        {/* Import History */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <History size={20} color="#ea580c" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('inventory.importHistory')}
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
                      {importItem.status === 'completed' ? t('status.completed') : t('status.pending')}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.importDetails}>
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {t('inventory.quantity')}:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {importItem.quantity}
                    </Text>
                  </View>
                  
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {t('inventory.baseCost')}:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {formatCurrency(importItem.base_unit_cost_per_item)}
                    </Text>
                  </View>
                  
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {t('inventory.finalCost')}:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {formatCurrency(importItem.final_unit_cost_per_item)}
                    </Text>
                  </View>
                  
                  <View style={styles.importDetail}>
                    <Text style={[styles.importDetailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {t('inventory.totalCost')}:
                    </Text>
                    <Text style={[styles.importDetailValue, { color: '#059669' }]}>
                      {formatCurrency(importItem.total_cost_for_item)}
                    </Text>
                  </View>
                </View>
                
                {importItem.notes && (
                  <Text style={[styles.importNotes, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {t('common.note')}: {importItem.notes}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Info size={24} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('empty.noImportHistory')}
              </Text>
            </View>
          )}
        </Card>

        {/* Cost Calculation Explanation */}

      </ScrollView>

      {deleting && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text={t('common.processing')} />
        </View>
      )}

      {unarchiving && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text={t('inventory.unarchivingProduct')} />
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
  showInSalesButton: {
    marginTop: 16,
  },
  unitsSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  unitsHeading: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  unitsTable: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  unitsHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  unitsHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  unitCellName: {
    flex: 1.4,
  },
  unitCellQty: {
    flex: 0.6,
    textAlign: 'right',
  },
  unitCellPrice: {
    flex: 1,
    textAlign: 'right',
  },
  unitName: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitBarcode: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  unitQty: {
    fontSize: 14,
    fontWeight: '500',
  },
  unitPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
});