import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useSaleDetailsModal } from '@/src/context/SaleDetailsModalContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, Receipt, Calendar, ChevronDown, Package, DollarSign, ShoppingCart } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { useTranslation } from '@/src/locales';

export default function ProductSalesScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Date filter states
  const [dateFilter, setDateFilter] = useState<'this_month' | 'three_months' | 'six_months' | 'custom' | 'all'>('this_month');
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [dateRangeText, setDateRangeText] = useState('This Month');
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams();
  const { productId, productName } = params;
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { t } = useTranslation();
  const { openSaleDetails } = useSaleDetailsModal();

  const dateFilterOptions = [
    { value: 'this_month', label: t('dateRanges.thisMonth') },
    { value: 'three_months', label: 'Last 3 Months' },
    { value: 'six_months', label: 'Last 6 Months' },
    { value: 'custom', label: 'Custom Range' },
    { value: 'all', label: 'All Time' },
  ];

  useEffect(() => {
    if (productId && currentBusiness?.id) {
      loadSalesData();
    }
  }, [productId, currentBusiness?.id, startDate, endDate]);

  const calculateDatesForFilter = useCallback((filter: 'this_month' | 'three_months' | 'six_months' | 'custom' | 'all', customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let text = '';

    switch (filter) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        text = 'This Month';
        break;
      case 'three_months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        text = 'Last 3 Months';
        break;
      case 'six_months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        text = 'Last 6 Months';
        break;
      case 'custom':
        start = customStart || new Date();
        start.setHours(0, 0, 0, 0);
        end = customEnd || new Date();
        end.setHours(23, 59, 59, 999);
        text = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        break;
      case 'all':
        start = new Date(2000, 0, 1);
        start.setHours(0, 0, 0, 0);
        end = now;
        end.setHours(23, 59, 59, 999);
        text = 'All Time';
        break;
    }

    return { start, end, text };
  }, []);

  const loadSalesData = useCallback(async (isRefresh = false) => {
    if (!productId || !currentBusiness?.id) return;

    if (!isRefresh) {
      setLoading(true);
    }

    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const salesData = await salesService.getSalesByProduct(
        currentBusiness.id,
        productId as string,
        start.toISOString(),
        end.toISOString()
      );

      setSales(salesData);
    } catch (error) {
      console.error('Error loading product sales:', error);
      Alert.alert('Error', 'Failed to load sales data');
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [productId, currentBusiness?.id, startDate, endDate]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSalesData(true);
  }, [loadSalesData]);

  const handleDateFilterChange = useCallback((filter: 'this_month' | 'three_months' | 'six_months' | 'custom' | 'all') => {
    setDateFilter(filter);
    setShowDateFilterModal(false);

    if (filter === 'custom') {
      setTimeout(() => setShowCustomDatePicker(true), 300);
    } else {
      const { start, end, text } = calculateDatesForFilter(filter);
      setStartDate(start);
      setEndDate(end);
      setDateRangeText(text);
    }
  }, [calculateDatesForFilter]);

  const handleDateRangeConfirm = useCallback((start: Date, end: Date) => {
    const adjustedStart = new Date(start);
    adjustedStart.setHours(0, 0, 0, 0);

    const adjustedEnd = new Date(end);
    adjustedEnd.setHours(23, 59, 59, 999);

    setStartDate(adjustedStart);
    setEndDate(adjustedEnd);
    setDateRangeText(`${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
    setShowCustomDatePicker(false);
  }, []);

  // Helper to check if a sale is completely voided
  const isSaleVoided = useCallback((sale: any): boolean => {
    if (!sale.sale_actions || sale.sale_actions.length === 0) return false;
    return sale.sale_actions.some((action: any) => action.action_type === 'void');
  }, []);

  // Helper to check if a sale has returns
  const getSaleReturns = useCallback((sale: any): any[] => {
    if (!sale.sale_actions || sale.sale_actions.length === 0) return [];
    return sale.sale_actions.filter((action: any) => action.action_type === 'return');
  }, []);

  // Helper to get returned quantity for a specific product
  const getReturnedQuantityForProduct = useCallback((sale: any, productId: string): number => {
    const returns = getSaleReturns(sale);
    let returnedQty = 0;

    returns.forEach((returnAction: any) => {
      if (returnAction.items_metadata) {
        const returnedItems = returnAction.items_metadata;
        const productReturn = returnedItems.find((item: any) => item.productId === productId);
        if (productReturn) {
          returnedQty += productReturn.quantity || 0;
        }
      }
    });

    return returnedQty;
  }, [getSaleReturns]);

  // Helper to get returned revenue for a specific product
  const getReturnedRevenueForProduct = useCallback((sale: any, productId: string): number => {
    const returns = getSaleReturns(sale);
    let returnedRevenue = 0;

    returns.forEach((returnAction: any) => {
      if (returnAction.items_metadata) {
        const returnedItems = returnAction.items_metadata;
        const productReturn = returnedItems.find((item: any) => item.productId === productId);
        if (productReturn) {
          returnedRevenue += parseFloat(productReturn.adjustedAmount || 0);
        }
      }
    });

    return returnedRevenue;
  }, [getSaleReturns]);

  const calculateStats = useCallback(() => {
    // Filter out voided sales
    const validSales = sales.filter(sale => !isSaleVoided(sale));

    const totalSales = validSales.length;
    let totalQuantity = 0;
    let totalRevenue = 0;

    validSales.forEach(sale => {
      const cartItems = sale.carts?.cart_items || [];
      const productItem = cartItems.find((item: any) => item.product_id === productId);

      if (productItem) {
        // Get original quantities and revenue
        const originalQuantity = productItem.quantity;
        const originalRevenue = parseFloat(productItem.subtotal || 0);

        // Subtract returned quantities and revenue (if any)
        const returnedQuantity = getReturnedQuantityForProduct(sale, productId as string);
        const returnedRevenue = getReturnedRevenueForProduct(sale, productId as string);

        const netQuantity = originalQuantity - returnedQuantity;
        const netRevenue = originalRevenue - returnedRevenue;

        // Only add if net values are positive (sale not fully returned)
        if (netQuantity > 0) {
          totalQuantity += netQuantity;
          totalRevenue += netRevenue;
        }
      }
    });

    const averageQuantity = totalSales > 0 ? totalQuantity / totalSales : 0;
    const averageRevenue = totalSales > 0 ? totalRevenue / totalSales : 0;

    return { totalSales, totalQuantity, totalRevenue, averageQuantity, averageRevenue };
  }, [sales, productId, isSaleVoided, getReturnedQuantityForProduct, getReturnedRevenueForProduct]);

  const stats = calculateStats();

  const renderSaleItem = useCallback(({ item }: { item: any }) => {
    const cartItems = item.carts?.cart_items || [];
    const productItem = cartItems.find((i: any) => i.product_id === productId);

    if (!productItem) return null;

    // Check if sale is voided
    const isVoided = isSaleVoided(item);

    // Check if product was returned
    const returnedQty = getReturnedQuantityForProduct(item, productId as string);
    const isPartiallyReturned = returnedQty > 0 && returnedQty < productItem.quantity;
    const isFullyReturned = returnedQty > 0 && returnedQty >= productItem.quantity;

    // Calculate net values
    const netQuantity = productItem.quantity - returnedQty;
    const returnedRevenue = getReturnedRevenueForProduct(item, productId as string);
    const netRevenue = parseFloat(productItem.subtotal) - returnedRevenue;

    return (
      <TouchableOpacity
        onPress={() => openSaleDetails(item.id)}
      >
        <Card style={[
          styles.saleCard,
          (isVoided || isFullyReturned) && { opacity: 0.6, borderLeftWidth: 3, borderLeftColor: '#dc2626' }
        ]}>
          <View style={styles.saleHeader}>
            <View style={styles.saleInfo}>
              <Text style={[styles.saleId, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Sale #{item.id.slice(-8)}
              </Text>
              <Text style={[styles.saleDate, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                {new Date(item.sale_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              {
                backgroundColor: isVoided
                  ? '#dc262620'
                  : isFullyReturned
                  ? '#f59e0b20'
                  : isPartiallyReturned
                  ? '#3b82f620'
                  : '#10b98120'
              }
            ]}>
              <Text style={[
                styles.statusText,
                {
                  color: isVoided
                    ? '#dc2626'
                    : isFullyReturned
                    ? '#f59e0b'
                    : isPartiallyReturned
                    ? '#3b82f6'
                    : '#10b981'
                }
              ]}>
                {isVoided ? 'VOIDED' : isFullyReturned ? 'RETURNED' : isPartiallyReturned ? 'PARTIAL' : 'COMPLETED'}
              </Text>
            </View>
          </View>

          <View style={styles.saleDetails}>
            <View style={styles.saleDetailRow}>
              <Package size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.saleDetailLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Quantity:
              </Text>
              <View style={styles.saleDetailValue}>
                {(isVoided || isFullyReturned) ? (
                  <Text style={{ textDecorationLine: 'line-through', color: '#dc2626' }}>
                    {productItem.quantity}
                  </Text>
                ) : isPartiallyReturned ? (
                  <Text style={[{ color: isDark ? '#f9fafb' : '#111827' }]}>
                    <Text style={{ textDecorationLine: 'line-through', color: '#9ca3af' }}>
                      {productItem.quantity}
                    </Text>
                    <Text> → </Text>
                    <Text style={{ fontWeight: '600' }}>{netQuantity}</Text>
                  </Text>
                ) : (
                  <Text style={[{ color: isDark ? '#f9fafb' : '#111827' }]}>
                    {productItem.quantity}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.saleDetailRow}>
              <DollarSign size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.saleDetailLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Unit Price:
              </Text>
              <Text style={[styles.saleDetailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${parseFloat(productItem.unit_price).toFixed(2)}
              </Text>
            </View>

            <View style={styles.saleDetailRow}>
              <ShoppingCart size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.saleDetailLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Subtotal:
              </Text>
              <View style={styles.saleDetailValue}>
                {(isVoided || isFullyReturned) ? (
                  <Text style={{ textDecorationLine: 'line-through', color: '#dc2626', fontWeight: '600' }}>
                    ${parseFloat(productItem.subtotal).toFixed(2)}
                  </Text>
                ) : isPartiallyReturned ? (
                  <Text>
                    <Text style={{ textDecorationLine: 'line-through', color: '#9ca3af', fontSize: 12 }}>
                      ${parseFloat(productItem.subtotal).toFixed(2)}
                    </Text>
                    <Text> → </Text>
                    <Text style={{ color: '#2563eb', fontWeight: '600' }}>${netRevenue.toFixed(2)}</Text>
                  </Text>
                ) : (
                  <Text style={{ color: '#2563eb', fontWeight: '600' }}>
                    ${parseFloat(productItem.subtotal).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>

            {isPartiallyReturned && (
              <View style={[styles.returnInfo, { borderColor: '#3b82f6', backgroundColor: '#3b82f620' }]}>
                <Text style={{ color: '#3b82f6', fontSize: 12 }}>
                  ⚠️ {returnedQty} unit(s) returned (${returnedRevenue.toFixed(2)})
                </Text>
              </View>
            )}

            {item.customers && (
              <View style={styles.customerInfo}>
                <Text style={[styles.customerLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Customer:
                </Text>
                <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {item.customers.name}
                </Text>
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  }, [productId, isDark, router, isSaleVoided, getReturnedQuantityForProduct, getReturnedRevenueForProduct]);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyState}>
      <Receipt size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        No Sales Found
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        This product hasn't been sold in the selected period
      </Text>
    </View>
  ), [isDark]);

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
            Product Sales
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
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
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Product Sales
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            {decodeURIComponent((productName as string) || 'Product')}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* Date Filter */}
        <View style={styles.dateFilterContainer}>
          <TouchableOpacity
            style={[
              styles.dateFilterButton,
              { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
            ]}
            onPress={() => setShowDateFilterModal(true)}
          >
            <Calendar size={16} color="#2563eb" />
            <Text style={[styles.dateFilterText, { color: isDark ? '#f9fafb' : '#374151' }]}>
              {dateRangeText}
            </Text>
            <ChevronDown size={16} color="#2563eb" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statsCard}>
            <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {stats.totalSales}
            </Text>
            <Text style={[styles.statsLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Total Sales
            </Text>
          </Card>

          <Card style={styles.statsCard}>
            <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {stats.totalQuantity}
            </Text>
            <Text style={[styles.statsLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Units Sold
            </Text>
          </Card>

          <Card style={styles.statsCard}>
            <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              ${stats.totalRevenue.toFixed(2)}
            </Text>
            <Text style={[styles.statsLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {t('financials.totalRevenue')}
            </Text>
          </Card>

          <Card style={styles.statsCard}>
            <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {stats.averageQuantity.toFixed(1)}
            </Text>
            <Text style={[styles.statsLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Avg. Qty/Sale
            </Text>
          </Card>
        </View>

        {/* Sales List */}
        <FlatList
          data={sales}
          renderItem={renderSaleItem}
          keyExtractor={(item) => item.id}
          style={styles.salesList}
          contentContainerStyle={sales.length === 0 ? styles.emptyContainer : styles.listContent}
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
          ListEmptyComponent={renderEmptyComponent}
        />
      </View>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateFilterModal(false)}
        >
          <View
            style={[
              styles.dateFilterModal,
              { backgroundColor: isDark ? '#374151' : '#ffffff' }
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.dateFilterModalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Date Range
            </Text>

            <View style={styles.dateFilterOptions}>
              {dateFilterOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dateFilterOption,
                    {
                      backgroundColor: dateFilter === option.value
                        ? '#2563eb'
                        : (isDark ? '#4b5563' : '#f3f4f6')
                    }
                  ]}
                  onPress={() => handleDateFilterChange(option.value as any)}
                >
                  <Text style={{
                    color: dateFilter === option.value
                      ? '#ffffff'
                      : (isDark ? '#f9fafb' : '#374151'),
                    fontWeight: '500'
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Date Range Picker */}
      <Modal
        visible={showCustomDatePicker}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowCustomDatePicker(false)}
      >
        <View style={[styles.datePickerScreen, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
          <View style={[styles.datePickerHeader, { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
            <TouchableOpacity onPress={() => setShowCustomDatePicker(false)} style={styles.datePickerBack}>
              <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
            </TouchableOpacity>
            <Text style={[styles.datePickerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Custom Date Range
            </Text>
            <View style={styles.datePickerHeaderRight} />
          </View>
          <ScrollView contentContainerStyle={styles.datePickerContent} showsVerticalScrollIndicator={false}>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onConfirm={handleDateRangeConfirm}
              onCancel={() => setShowCustomDatePicker(false)}
            />
          </ScrollView>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterContainer: {
    marginBottom: 16,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateFilterText: {
    fontSize: 14,
    marginHorizontal: 8,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  statsCard: {
    width: '48%',
    padding: 16,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  salesList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  saleCard: {
    padding: 16,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saleInfo: {
    flex: 1,
  },
  saleId: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  saleDate: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  saleDetails: {
    gap: 8,
  },
  saleDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saleDetailLabel: {
    fontSize: 14,
  },
  saleDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  returnInfo: {
    marginTop: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderRadius: 4,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  customerLabel: {
    fontSize: 13,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerScreen: {
    flex: 1,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  datePickerBack: {
    padding: 8,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  datePickerHeaderRight: {
    width: 40,
  },
  datePickerContent: {
    padding: 16,
    paddingBottom: 40,
  },
  dateFilterModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dateFilterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateFilterOptions: {
    gap: 8,
  },
  dateFilterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
});
