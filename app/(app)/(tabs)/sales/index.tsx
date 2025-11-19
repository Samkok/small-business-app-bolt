import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { useInstantCheckout } from '@/src/context/InstantCheckoutContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { TabButton } from '@/src/components/ui/TabButton';
import { SkeletonSaleCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { SaleCard } from '@/src/components/sales/SaleCard';
import { ActiveCartCard } from '@/src/components/sales/ActiveCartCard';
import Input from '@/src/components/ui/Input';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { ShoppingCart, Plus, Search, Filter, DollarSign, TrendingUp, Calendar, Receipt, Users, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X, Zap } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import { exportService } from '@/src/services/exportService';
import { useDebounce } from '@/src/hooks/useDebounce';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { InstantCheckoutWidget } from '@/src/components/checkout/InstantCheckoutWidget';
import { InstantCheckoutModal } from '@/src/components/checkout/InstantCheckoutModal';

const SALES_PER_PAGE = 10;

export default function SalesScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'carts' | 'sales'>('carts');
  const [deletingCart, setDeletingCart] = useState<string | null>(null);
  const [showDateFilterTypeModal, setShowDateFilterTypeModal] = useState(false);
  const [showCustomDateRangePicker, setShowCustomDateRangePicker] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(true);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [saleToVoid, setSaleToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidingInProgress, setVoidingInProgress] = useState(false);

  // Animation for collapsible section
  const collapseAnim = useRef(new Animated.Value(0)).current;
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [hasMoreSales, setHasMoreSales] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState<'this_month' | 'three_months' | 'six_months' | 'custom' | 'all'>('this_month');
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [dateRangeText, setDateRangeText] = useState('This Month');
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness, userProfile } = useAuth();
  const { carts, loading: cartsLoading, deleteCart, refreshCarts } = useCart();
  const { openModal: openInstantCheckoutModal } = useInstantCheckout();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const statusFilters = [
    { value: 'all', label: 'All Sales' },
    { value: 'completed', label: 'Completed' },
    { value: 'voided', label: 'Voided' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'partially_returned', label: 'Partial Return' },
  ];

  const paymentMethodFilters = [
    { value: 'all', label: 'All Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'transfer', label: 'Transfer' },
    { value: 'other', label: 'Other' },
  ];

  const dateFilterOptions = [
    { value: 'this_month', label: 'This Month' },
    { value: 'three_months', label: 'Last 3 Months' },
    { value: 'six_months', label: 'Last 6 Months' },
    { value: 'custom', label: 'Custom Range' },
    { value: 'all', label: 'All Time' },
  ];

  // Helper function to calculate dates without state updates
  const calculateDatesForFilter = useCallback((filter: 'this_month' | 'three_months' | 'six_months' | 'custom' | 'all', customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let text = '';
    
    switch (filter) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'This Month';
        break;
      case 'three_months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'Last 3 Months';
        break;
      case 'six_months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'Last 6 Months';
        break;
      case 'custom':
        start = customStart || new Date();
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = customEnd || new Date();
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        break;
      case 'all':
        start = new Date(2000, 0, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = now;
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'All Time';
        break;
    }
    
    return { start, end, text };
  }, []);

  // Initial load on mount
  useEffect(() => {
    if (currentBusiness?.id) {
      // Set loading to false initially for carts tab, as CartContext handles its own loading
      if (activeTab === 'carts') {
        setLoading(false);
      } else {
        loadData();
      }
    }
  }, [currentBusiness?.id]);

  // Load sales data when tab changes to sales or filter parameters change
  useEffect(() => {
    if (activeTab === 'sales' && currentBusiness?.id) {
      loadSalesData(0, true);
    } else if (activeTab === 'carts') {
      // When switching to carts tab, set loading to false as CartContext manages its own loading
      setLoading(false);
    }
  }, [activeTab, dateFilter, startDate, endDate, selectedStatus, selectedPaymentMethod]);

  // Filter sales when search query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      filterSales();
    } else {
      setFilteredSales(sales);
    }
  }, [debouncedSearchQuery, sales]);

  // Animate the collapsible section
  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: statsCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [statsCollapsed, collapseAnim]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Refresh local carts
      await refreshCarts();
      
      if (activeTab === 'sales') {
        await loadSalesData(isRefresh);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('common.error'), 'Failed to load data');
      setLoading(false);
    }
  }, [currentBusiness?.id, activeTab, t, refreshCarts]);

  const loadSalesData = useCallback(async (page: number = 0, refresh: boolean = false) => {
    if (!currentBusiness?.id) return;

    if (refresh) {
      setLoading(true);
      setCurrentPage(0);
      setHasMoreSales(true);
    } else if (page > 0) {
      setLoadingMore(true);
    }

    try {
      // Use the current state values directly
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const statusFilter = selectedStatus !== 'all' ? selectedStatus : undefined;
      const paymentFilter = selectedPaymentMethod !== 'all' ? selectedPaymentMethod : undefined;

      // Run both queries in parallel for better performance
      const [count, salesData] = await Promise.all([
        salesService.getSalesCount(
          currentBusiness.id,
          start.toISOString(),
          end.toISOString(),
          statusFilter,
          paymentFilter
        ),
        salesService.getSalesPaginated(
          currentBusiness.id,
          start.toISOString(),
          end.toISOString(),
          page * SALES_PER_PAGE,
          SALES_PER_PAGE,
          statusFilter,
          paymentFilter
        )
      ]);

      setTotalSales(count);

      if (refresh || page === 0) {
        setSales(salesData);
        setFilteredSales(salesData);
        setCurrentPage(0);
      } else {
        // Append new data for infinite scroll
        setSales(prevSales => {
          const combined = [...prevSales, ...salesData];
          const uniqueById = Array.from(
            new Map(combined.map(item => [item.id, item])).values()
          );
          return uniqueById;
        });

        // Also update filtered sales if not searching
        if (!searchQuery.trim()) {
          setFilteredSales(prevFiltered => {
            const combined = [...prevFiltered, ...salesData];
            const uniqueById = Array.from(
              new Map(combined.map(item => [item.id, item])).values()
            );
            return uniqueById;
          });
        }

        setCurrentPage(page);
      }

      // Update hasMoreSales based on returned data length
      setHasMoreSales(salesData.length === SALES_PER_PAGE);
    } catch (error) {
      console.error('Error loading sales data:', error);
      Alert.alert(t('common.error'), 'Failed to load sales data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentBusiness?.id, startDate, endDate, selectedStatus, selectedPaymentMethod, searchQuery, t]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMoreSales || searchQuery.trim()) return;
    
    loadSalesData(currentPage + 1, false);
  }, [currentPage, hasMoreSales, loadingMore, searchQuery, loadSalesData]);

  const filterSales = useCallback(() => {
    if (!debouncedSearchQuery.trim()) {
      setFilteredSales(sales);
      return;
    }
    
    const filtered = sales.filter(sale =>
      sale.customers?.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      sale.id.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      sale.total_amount.toString().includes(debouncedSearchQuery)
    );
    
    setFilteredSales(filtered);
  }, [sales, debouncedSearchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      if (activeTab === 'carts') {
        await refreshCarts();
      } else {
        await loadSalesData(0, true);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert(t('common.error'), 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, refreshCarts, loadSalesData, t]);

  const handleVoidSale = useCallback((sale: any) => {
    setSaleToVoid(sale);
    setVoidReason('');
    setShowVoidModal(true);
  }, []);

  const handleDeleteCartItem = useCallback(async (cartId: string) => {
    Alert.alert(
      'Delete Cart',
      'Are you sure you want to delete this cart? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingCart(cartId);
              await deleteCart(cartId);
              Alert.alert('Success', 'Cart deleted successfully');
            } catch (error) {
              console.error('Error deleting cart:', error);
              Alert.alert('Error', 'Failed to delete cart');
            } finally {
              setDeletingCart(null);
            }
          }
        },
      ]
    );
  }, [deleteCart]);

  const handleNewSale = useCallback(() => {
    router.push('/sales/customer-selection');
  }, [router]);

  const handleCartPress = useCallback((cartId: string) => {
    router.push(`/sales/cart/${cartId}`);
  }, [router]);

  const handleExportSales = useCallback(async () => {
    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business currentBusiness found');
      return;
    }

    try {
      // Create start and end dates with proper time components
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const csvData = await exportService.exportSalesToCsv(
        currentBusiness.id, 
        start.toISOString(), 
        end.toISOString()
      );
      
      const fileName = `sales_export_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`;
      
      if (Platform.OS === 'web') {
        // Web platform - use browser download
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Alert.alert('Success', 'Sales data exported successfully');
      } else {
        // Mobile platform - use expo-file-system and expo-sharing
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType?.UTF8 || 'utf8' });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Sales Data',
            UTI: 'public.comma-separated-values-text'
          });
          Alert.alert('Success', 'Sales data exported successfully');
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('Error exporting sales:', error);
      Alert.alert('Error', 'Failed to export sales data');
    }
  }, [currentBusiness?.id, startDate, endDate]);

  const handleDateFilterChange = useCallback((filter: 'this_month' | 'three_months' | 'six_months' | 'custom' | 'all') => {
    setDateFilter(filter);
    setCurrentPage(0);
    
    if (filter === 'custom') {
      setShowDateFilterTypeModal(false);
      setShowCustomDateRangePicker(true);
    } else {
      // Calculate and set the dates for non-custom filters
      const { start, end, text } = calculateDatesForFilter(filter);
      setStartDate(start);
      setEndDate(end);
      setDateRangeText(text);
      setShowDateFilterTypeModal(false);
    }
  }, [calculateDatesForFilter]);

  const handleDateRangeConfirm = useCallback((start: Date, end: Date) => {
    // Set start date to beginning of day
    const adjustedStart = new Date(start);
    adjustedStart.setHours(0, 0, 0, 0);
    
    // Set end date to end of day
    const adjustedEnd = new Date(end);
    adjustedEnd.setHours(23, 59, 59, 999);
    
    setStartDate(adjustedStart);
    setEndDate(adjustedEnd);
    setDateRangeText(`${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
    setShowCustomDateRangePicker(false);
    setCurrentPage(0);
  }, []);

  const handleConfirmVoid = useCallback(async () => {
    if (!voidReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for voiding this sale');
      return;
    }

    if (!currentBusiness?.id || !saleToVoid || !userProfile?.user_id) return;

    setVoidingInProgress(true);
    try {
      await salesService.voidSale(saleToVoid.id, voidReason.trim(), userProfile.user_id);
      Alert.alert('Success', 'Sale voided successfully');
      setShowVoidModal(false);
      setSaleToVoid(null);
      setVoidReason('');
      // Refresh sales data after voiding
      await loadSalesData(0, true);
    } catch (error) {
      console.error('Error voiding sale:', error);
      Alert.alert('Error', 'Failed to void sale');
    } finally {
      setVoidingInProgress(false);
    }
  }, [voidReason, currentBusiness?.id, saleToVoid, loadSalesData]);

  const toggleStatsCollapse = useCallback(() => {
    setStatsCollapsed(!statsCollapsed);
  }, [statsCollapsed]);

  const getSalesStats = useCallback(() => {
    const totalSalesCount = totalSales;
    const completedSales = sales.filter(s => s.status === 'completed');
    const totalRevenue = completedSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0) || 0;
    const averageSale = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
    
    // Today's sales
    const today = new Date().toISOString().split('T')[0];
    const todaySales = completedSales.filter(sale => 
      sale.sale_date.split('T')[0] === today
    );
    const todayRevenue = todaySales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0) || 0;

    return { totalSalesCount, totalRevenue, averageSale, todayRevenue, todaySales: todaySales.length };
  }, [sales, totalSales]);

  const { totalSalesCount, totalRevenue, averageSale, todayRevenue, todaySales } = useMemo(
    () => getSalesStats(),
    [getSalesStats]
  );


  const renderDateFilter = useCallback(() => (
    <View style={styles.dateFilterContainer}>
      <TouchableOpacity
        style={[
          styles.dateFilterButton,
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
        ]}
        onPress={() => setShowDateFilterTypeModal(true)}
      >
        <Calendar size={16} color="#2563eb" />
        <Text style={[styles.dateFilterText, { color: isDark ? '#f9fafb' : '#374151' }]}>
          {dateRangeText}
        </Text>
        <ChevronDown size={16} color="#2563eb" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.exportIconButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
        onPress={handleExportSales}
      >
        <Download size={20} color="#059669" />
      </TouchableOpacity>
    </View>
  ), [isDark, dateRangeText]);

  const renderDateFilterTypeModal = useCallback(() => (
    <Modal
      visible={showDateFilterTypeModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDateFilterTypeModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowDateFilterTypeModal(false)}
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
  ), [showDateFilterTypeModal, isDark, dateFilter, handleDateFilterChange, dateFilterOptions]);

  const renderCustomDateRangePicker = useCallback(() => (
    <Modal
      visible={showCustomDateRangePicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowCustomDateRangePicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowCustomDateRangePicker(false)}
      >
        <View 
          style={[
            styles.dateFilterModal,
            { backgroundColor: isDark ? '#374151' : '#ffffff' }
          ]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.dateFilterModalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Select Custom Date Range
          </Text>
          
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onConfirm={handleDateRangeConfirm}
            onCancel={() => setShowCustomDateRangePicker(false)}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  ), [showCustomDateRangePicker, isDark, startDate, endDate, handleDateRangeConfirm]);

  const renderSaleItem = useCallback(({ item }) => (
    <SaleCard
      sale={item}
      onVoid={handleVoidSale}
    />
  ), [handleVoidSale]);

  const renderEmptyComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <Receipt size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {searchQuery || selectedStatus !== 'all' || selectedPaymentMethod !== 'all' 
          ? 'No sales found' 
          : 'No sales yet'
        }
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {searchQuery || selectedStatus !== 'all' || selectedPaymentMethod !== 'all' 
          ? 'Try adjusting your search or filter criteria'
          : 'Create your first sale to get started'
        }
      </Text>
      {!searchQuery && selectedStatus === 'all' && selectedPaymentMethod === 'all' && (
        <Button
          title="New Sale"
          onPress={handleNewSale}
          style={styles.emptyButton}
        />
      )}
    </Card>
  ), [searchQuery, selectedStatus, selectedPaymentMethod, isDark, handleNewSale]);

  const renderCartItem = useCallback(({ item }) => (
    <ActiveCartCard
      key={item.id}
      cart={item}
      onPress={() => handleCartPress(item.id)}
      onDelete={handleDeleteCartItem}
    />
  ), [handleCartPress, handleDeleteCartItem]);

  const renderEmptyCartsComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <ShoppingCart size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        No Active Carts
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        Start a new sale by selecting a customer and adding products
      </Text>
      <Button
        title="Start New Sale"
        onPress={handleNewSale}
        style={styles.emptyButton}
      />
    </Card>
  ), [isDark, handleNewSale]);

  if ((loading && !loadingMore) || cartsLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('sales.title')}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
              onPress={openInstantCheckoutModal}
            >
              <Zap size={24} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#2563eb', marginLeft: 8 }]}
              onPress={handleNewSale}
            >
              <Plus size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabs}>
          <TabButton
            title="Active Carts"
            icon={<ShoppingCart size={18} color={activeTab === 'carts' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
            isActive={activeTab === 'carts'}
            onPress={() => setActiveTab('carts')}
            isDark={isDark}
          />
          <TabButton
            title="Sales History"
            icon={<Receipt size={18} color={activeTab === 'sales' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
            isActive={activeTab === 'sales'}
            onPress={() => setActiveTab('sales')}
            isDark={isDark}
          />
        </View>

        <SkeletonList itemComponent={SkeletonSaleCard} itemCount={5} style={styles.content} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('sales.title')}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
            onPress={openInstantCheckoutModal}
          >
            <Zap size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2563eb', marginLeft: 8 }]}
            onPress={handleNewSale}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton
          title="Active Carts"
          icon={<ShoppingCart size={18} color={activeTab === 'carts' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'carts'}
          onPress={() => setActiveTab('carts')}
          count={carts.length}
          isDark={isDark}
        />
        <TabButton
          title="Sales History"
          icon={<Receipt size={18} color={activeTab === 'sales' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'sales'}
          onPress={() => setActiveTab('sales')}
          isDark={isDark}
        />
      </View>

      {activeTab === 'carts' ? (
        // Active Carts Tab
        <FlatList
          data={carts}
          renderItem={renderCartItem}
          keyExtractor={(item) => item.id}
          style={styles.content}
          contentContainerStyle={styles.cartsGrid}
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
          ListEmptyComponent={renderEmptyCartsComponent}
        />
      ) : (
        // Sales History Tab
        <View style={styles.content}>
          {/* Date Filter */}
          {renderDateFilter()}
          
          {/* Search and Filter */}
          <View style={styles.searchSection}>
            <View style={[styles.searchContainer, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}>
              <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              <TextInput
                style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
                placeholder="Search sales..."
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Collapsible Header */}
          <View style={styles.collapsibleHeader}>
            <View style={styles.collapsibleTitle}>
              <TrendingUp size={20} color={isDark ? '#f9fafb' : '#111827'} style={{ marginRight: 8 }} />
              <Text style={[styles.collapsibleTitleText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Sales Analytics
              </Text>
            </View>
            <TouchableOpacity onPress={toggleStatsCollapse} style={styles.collapseButton}>
              {statsCollapsed ? (
                <ChevronDown size={20} color={isDark ? '#f9fafb' : '#111827'} />
              ) : (
                <ChevronUp size={20} color={isDark ? '#f9fafb' : '#111827'} />
              )}
            </TouchableOpacity>
          </View>

          <Animated.View style={{
            maxHeight: collapseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 800] // Adjust this value based on your content height
            }),
            overflow: 'hidden',
            opacity: collapseAnim
          }}>
            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <Card style={styles.statsCard}>
                <View style={styles.statsContent}>
                  <DollarSign size={20} color="#2563eb" />
                  <View style={styles.statsText}>
                    <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                      ${todayRevenue.toFixed(2)}
                    </Text>
                    <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Today's Revenue
                    </Text>
                  </View>
                </View>
              </Card>

              <Card style={styles.statsCard}>
                <View style={styles.statsContent}>
                  <TrendingUp size={20} color="#059669" />
                  <View style={styles.statsText}>
                    <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                      ${totalRevenue.toFixed(2)}
                    </Text>
                    <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Total Revenue
                    </Text>
                  </View>
                </View>
              </Card>

              <Card style={styles.statsCard}>
                <View style={styles.statsContent}>
                  <Receipt size={20} color="#8b5cf6" />
                  <View style={styles.statsText}>
                    <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {todaySales}
                    </Text>
                    <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Today's Sales
                    </Text>
                  </View>
                </View>
              </Card>

              <Card style={styles.statsCard}>
                <View style={styles.statsContent}>
                  <ShoppingCart size={20} color="#ea580c" />
                  <View style={styles.statsText}>
                    <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                      ${averageSale.toFixed(2)}
                    </Text>
                    <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Average Sale
                    </Text>
                  </View>
                </View>
              </Card>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
              {statusFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: selectedStatus === filter.value 
                        ? '#2563eb' 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      borderColor: selectedStatus === filter.value 
                        ? '#2563eb' 
                        : (isDark ? '#4b5563' : '#d1d5db'),
                    }
                  ]}
                  onPress={() => {
                    setSelectedStatus(filter.value);
                    setCurrentPage(0);
                    setHasMoreSales(true);
                  }}
                >
                  <Text style={[
                    styles.filterButtonText,
                    { 
                      color: selectedStatus === filter.value 
                        ? '#ffffff' 
                        : (isDark ? '#f9fafb' : '#374151') 
                    }
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
              {paymentMethodFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: selectedPaymentMethod === filter.value 
                        ? '#059669' 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      borderColor: selectedPaymentMethod === filter.value 
                        ? '#059669' 
                        : (isDark ? '#4b5563' : '#d1d5db'),
                    }
                  ]}
                  onPress={() => {
                    setSelectedPaymentMethod(filter.value);
                    setCurrentPage(0);
                    setHasMoreSales(true);
                  }}
                >
                  <Text style={[
                    styles.filterButtonText,
                    { 
                      color: selectedPaymentMethod === filter.value 
                        ? '#ffffff' 
                        : (isDark ? '#f9fafb' : '#374151') 
                    }
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
          
          {/* Sales List */}
          <View style={styles.salesListContainer}>
            {searchQuery ? (
              <View style={styles.searchResultsHeader}>
                <Text style={[styles.searchResultsText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {filteredSales.length === 0 
                    ? `No sales found for "${searchQuery}"` 
                    : `Found ${filteredSales.length} sale${filteredSales.length !== 1 ? 's' : ''}`}
                </Text>
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearchText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <FlatList
              data={filteredSales}
              renderItem={renderSaleItem}
              keyExtractor={(item) => item.id}
              style={styles.salesList}
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
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.1}
              ListEmptyComponent={renderEmptyComponent}
              contentContainerStyle={filteredSales.length === 0 ? styles.emptyContainer : undefined}
              ListFooterComponent={() => {
                if (loadingMore) {
                  return (
                    <View style={styles.loadingMore}>
                      <ActivityIndicator size="small" color="#2563eb" />
                      <Text style={[styles.loadingMoreText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        Loading more sales...
                      </Text>
                    </View>
                  );
                }
                
                if (!hasMoreSales && filteredSales.length > 0 && !searchQuery.trim()) {
                  return (
                    <View style={styles.endOfList}>
                      <Text style={[styles.endOfListText, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                        You've reached the end of your sales
                      </Text>
                    </View>
                  );
                }
                
                return null;
              }}
            />
          </View>
        </View>
      )}

      {/* Loading overlay for cart deletion */}
      {deletingCart && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Deleting cart..." />
        </View>
      )}

      {/* Date Range Picker Modal */}
      {renderDateFilterTypeModal()}

      {/* Custom Date Range Picker Modal */}
      {renderCustomDateRangePicker()}

      {/* Void Sale Modal */}
      <Modal
        visible={showVoidModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVoidModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.voidModal}>
            <View style={styles.voidModalHeader}>
              <Text style={[styles.voidModalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Void Sale
              </Text>
              <TouchableOpacity onPress={() => setShowVoidModal(false)}>
                <X size={20} color={isDark ? '#f9fafb' : '#111827'} />
              </TouchableOpacity>
            </View>
            
            {saleToVoid && (
              <View style={styles.saleInfoSection}>
                <Text style={[styles.saleInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Sale #{saleToVoid.id.slice(-8)} - ${saleToVoid.total_amount.toFixed(2)}
                </Text>
                <Text style={[styles.customerInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Customer: {saleToVoid.customers?.name || 'Unknown'}
                </Text>
              </View>
            )}
            
            <Input
              label="Reason for Voiding"
              value={voidReason}
              onChangeText={setVoidReason}
              placeholder="Please provide a reason for voiding this sale"
              multiline
              numberOfLines={3}
              required
            />
            
            <View style={styles.voidModalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowVoidModal(false)}
                style={styles.voidModalButton}
              />
              <Button
                title="Void Sale"
                variant="danger"
                onPress={handleConfirmVoid}
                loading={voidingInProgress}
                style={styles.voidModalButton}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Instant Checkout Widget */}
      <InstantCheckoutWidget />

      {/* Instant Checkout Modal */}
      <InstantCheckoutModal />
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
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
  cartsGrid: {
    gap: 12,
    paddingBottom: 20,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateFilterLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateFilterText: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  exportIconButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  collapsibleTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapsibleTitleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapseButton: {
    padding: 4,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  actionButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    color: '#2563eb',
  },
  filterContainer: {
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 14,
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
    padding: 12,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    marginLeft: 8,
    flex: 1,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  statsLabel: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
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
  resultsHeader: {
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 14,
  },
  salesListContainer: {
    flex: 1,
  },
  salesList: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 16,
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
  listFooter: {
    paddingVertical: 8,
    alignItems: 'center',
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
    marginBottom: 20,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyButton: {
    marginTop: 16,
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
  voidModal: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  voidModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  voidModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saleInfoSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#dc262610',
    borderRadius: 8,
  },
  saleInfoText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  customerInfoText: {
    fontSize: 12,
  },
  voidModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  voidModalButton: {
    flex: 1,
  },
});