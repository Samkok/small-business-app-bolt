import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { TabButton } from '@/src/components/ui/TabButton';
import { SkeletonSaleCard, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { SaleCard } from '@/src/components/sales/SaleCard';
import VoidSaleModal from '@/src/components/sales/VoidSaleModal';
import { ActiveCartCard } from '@/src/components/sales/ActiveCartCard';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { ShoppingCart, Plus, Search, DollarSign, TrendingUp, Calendar, Receipt, Download, ChevronDown, ChevronUp, X, Zap } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import { exportService } from '@/src/services/exportService';
import { useDebounce } from '@/src/hooks/useDebounce';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { InstantCheckoutWidget } from '@/src/components/checkout/InstantCheckoutWidget';
import { InstantCheckoutModal } from '@/src/components/checkout/InstantCheckoutModal';
import { Paywall } from '@/src/components/subscription/Paywall';
import { ReadOnlyBanner } from '@/src/components/subscription/ReadOnlyBanner';
import { WarningBanner } from '@/src/components/subscription/WarningBanner';
import { UpgradePrompt } from '@/src/components/subscription/UpgradePrompt';
import { dataCleanupRegistry } from '@/src/utils/dataCleanupRegistry';
import { errorHandler } from '@/src/utils/errorHandler';
import { useBusinessMismatchDetector } from '@/src/hooks/useBusinessMismatchDetector';
import { FREE_TIER_LIMIT } from '@/src/services/subscriptionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SALES_PER_PAGE = 10;
const WARNING_BANNER_DISMISSED_KEY = 'warning_banner_dismissed_';

export default function SalesScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'carts' | 'sales'>('sales');
  const [deletingCart, setDeletingCart] = useState<string | null>(null);
  const [showDateFilterTypeModal, setShowDateFilterTypeModal] = useState(false);
  const [showCustomDateRangePicker, setShowCustomDateRangePicker] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(true);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [saleToVoid, setSaleToVoid] = useState<any>(null);
  const [voidingInProgress, setVoidingInProgress] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [warningBannerDismissed, setWarningBannerDismissed] = useState(false);

  // Analytics states
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    averageSale: 0,
    todayRevenue: 0,
    todaySalesCount: 0
  });

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
  const { currentBusiness, userProfile, userBusinesses } = useAuth();
  const { carts, loading: cartsLoading, deleteCart, refreshCarts } = useCart();
  const { openModal: openInstantCheckoutModal } = useInstantCheckout();
  const { salesCountData, canAccessFeature, showPaywall, hidePaywall, isPaywallVisible, isSubscribed, subscriptionStatus } = useSubscription();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Detect business mismatch in sales data
  const { hasMismatch, mismatchedItems } = useBusinessMismatchDetector(sales, currentBusiness);

  const statusFilters = [
    { value: 'all', label: t('sales.title') },
    { value: 'completed', label: t('status.completed') },
    { value: 'voided', label: t('status.voided') },
    { value: 'refunded', label: t('sales.refund') },
    { value: 'partially_returned', label: t('sales.return') },
  ];

  const paymentMethodFilters = [
    { value: 'all', label: t('sales.paymentMethod') },
    { value: 'cash', label: t('sales.cash') },
    { value: 'card', label: t('sales.card') },
    { value: 'transfer', label: t('sales.transfer') },
    { value: 'other', label: t('customers.other') },
  ];

  const dateFilterOptions = [
    { value: 'this_month', label: t('dateRanges.thisMonth') },
    { value: 'three_months', label: t('dateRanges.last3Months') },
    { value: 'six_months', label: t('dateRanges.last6Months') },
    { value: 'custom', label: t('dateRanges.customRange') },
    { value: 'all', label: t('dateRanges.allTime') },
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
        
        text = t('dateRanges.thisMonth');
        break;
      case 'three_months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = t('dateRanges.last3Months');
        break;
      case 'six_months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = t('dateRanges.last6Months');
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
        
        text = t('dateRanges.allTime');
        break;
    }
    
    return { start, end, text };
  }, []);

  // Cleanup function for when business changes
  const clearSalesData = useCallback(() => {
    console.log('[SalesScreen] Clearing sales data');
    setSales([]);
    setFilteredSales([]);
    setCurrentPage(0);
    setTotalSales(0);
    setHasMoreSales(true);
  }, []);

  // Register cleanup callback with cleanup registry
  useEffect(() => {
    dataCleanupRegistry.register('sales-screen', clearSalesData);

    return () => {
      dataCleanupRegistry.unregister('sales-screen');
    };
  }, [clearSalesData]);

  // Initial load on mount and when business changes
  useEffect(() => {
    if (currentBusiness?.id) {
      // Clear previous business data first
      clearSalesData();

      // Set loading to false initially for carts tab, as CartContext handles its own loading
      if (activeTab === 'carts') {
        setLoading(false);
      } else {
        loadData();
      }
    } else {
      // No business selected, clear data
      clearSalesData();
      setLoading(false);
    }
  }, [currentBusiness?.id, clearSalesData]);

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

  useEffect(() => {
    const loadWarningBannerState = async () => {
      if (!currentBusiness?.id) return;
      try {
        const key = `${WARNING_BANNER_DISMISSED_KEY}${currentBusiness.id}`;
        const dismissed = await AsyncStorage.getItem(key);
        setWarningBannerDismissed(dismissed === 'true');
      } catch (error) {
        console.error('Error loading warning banner state:', error);
      }
    };
    loadWarningBannerState();
  }, [currentBusiness?.id, salesCountData.salesCount]);

  const handleDismissWarning = useCallback(async () => {
    if (!currentBusiness?.id) return;
    try {
      const key = `${WARNING_BANNER_DISMISSED_KEY}${currentBusiness.id}`;
      await AsyncStorage.setItem(key, 'true');
      setWarningBannerDismissed(true);
    } catch (error) {
      console.error('Error dismissing warning banner:', error);
    }
  }, [currentBusiness?.id]);

  const handleUpgradeFromPrompt = useCallback(() => {
    setShowUpgradePrompt(false);
    setTimeout(() => {
      showPaywall();
    }, 350);
  }, [showPaywall]);

  const shouldShowWarningBanner = useCallback(() => {
    if (salesCountData.isAtLimit || isSubscribed || warningBannerDismissed) {
      return false;
    }
    const percentageUsed = (salesCountData.salesCount / FREE_TIER_LIMIT) * 100;
    return percentageUsed >= 80;
  }, [salesCountData, isSubscribed, warningBannerDismissed]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Refresh local carts
      await refreshCarts();
      
      if (activeTab === 'sales') {
        await loadSalesData(0, isRefresh);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('common.error'), t('errors.loadFailed'));
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

      // For first page or refresh, fetch analytics; for pagination, skip analytics
      if (refresh || page === 0) {
        const [count, salesData, analyticsData] = await Promise.all([
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
          ),
          salesService.getSalesAnalytics(
            currentBusiness.id,
            start.toISOString(),
            end.toISOString(),
            statusFilter,
            paymentFilter
          )
        ]);

        setTotalSales(count);
        setAnalytics(analyticsData);
        setSales(salesData);
        setFilteredSales(salesData);
        setCurrentPage(0);
      } else {
        // Pagination: only fetch sales data, not analytics
        const salesData = await salesService.getSalesPaginated(
          currentBusiness.id,
          start.toISOString(),
          end.toISOString(),
          page * SALES_PER_PAGE,
          SALES_PER_PAGE,
          statusFilter,
          paymentFilter
        );

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

        // Update hasMoreSales based on returned data length
        setHasMoreSales(salesData.length === SALES_PER_PAGE);
      }
    } catch (error) {
      console.error('Error loading sales data:', error);
      Alert.alert(t('common.error'), t('sales.loadFailed'));
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
      Alert.alert(t('common.error'), t('sales.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, refreshCarts, loadSalesData, t]);

  const handleVoidSale = useCallback((sale: any) => {
    setSaleToVoid(sale);
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
              Alert.alert(t('common.success'), t('sales.cartDeleted'));
            } catch (error) {
              console.error('Error deleting cart:', error);
              Alert.alert(t('common.error'), t('sales.cartDeleteFailed'));
            } finally {
              setDeletingCart(null);
            }
          }
        },
      ]
    );
  }, [deleteCart]);

  const handleNewSale = useCallback(() => {
    if (salesCountData.isAtLimit && !canAccessFeature) {
      setShowUpgradePrompt(true);
      return;
    }
    router.push('/sales/customer-selection');
  }, [router, salesCountData.isAtLimit, canAccessFeature]);

  const handleCartPress = useCallback((cartId: string) => {
    router.push(`/sales/cart/${cartId}`);
  }, [router]);

  const handleExportSales = useCallback(async () => {
    if (!currentBusiness?.id) {
      Alert.alert(t('common.error'), t('sales.noBusinessFound'));
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

        Alert.alert(t('common.success'), t('sales.exportSuccess'));
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
          Alert.alert(t('common.success'), t('sales.exportSuccess'));
        } else {
          Alert.alert(t('common.error'), t('sales.sharingNotAvailable'));
        }
      }
    } catch (error) {
      console.error('Error exporting sales:', error);
      Alert.alert(t('common.error'), t('sales.exportFailed'));
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

  const handleConfirmVoid = useCallback(async (options: {
    reason: string;
    includeDeliveryCost: boolean;
    lossAmount?: number;
    lossPercentage?: number;
    lossType?: 'fixed' | 'percentage';
  }) => {
    if (!currentBusiness?.id || !saleToVoid || !userProfile?.user_id) return;

    setVoidingInProgress(true);
    try {
      // Call voidSale with business validation and adjustments
      await salesService.voidSale(
        saleToVoid.id,
        options.reason,
        userProfile.user_id,
        currentBusiness,
        userBusinesses,
        {
          includeDeliveryCost: options.includeDeliveryCost,
          lossAmount: options.lossAmount,
          lossPercentage: options.lossPercentage,
          lossType: options.lossType,
        }
      );

      Alert.alert(t('common.success'), t('sales.voidSuccess'));
      setShowVoidModal(false);
      setSaleToVoid(null);

      // Refresh sales data after voiding
      await loadSalesData(0, true);
    } catch (error: any) {
      console.error('Error voiding sale:', error);

      // Handle business access errors with user-friendly messages
      const userFriendlyError = errorHandler.handleBusinessAccessError(
        error,
        'void sale',
        currentBusiness,
        saleToVoid.business_name
      );

      Alert.alert(
        userFriendlyError.title,
        errorHandler.formatErrorMessage(userFriendlyError)
      );

      // If it's a business access error, close modal and refresh data
      if (userFriendlyError.isBusinessAccessError) {
        setShowVoidModal(false);
        setSaleToVoid(null);

        // Refresh to clear stale data
        if (userFriendlyError.action === 'REFRESH') {
          await loadSalesData(0, true);
        }
      }
    } finally {
      setVoidingInProgress(false);
    }
  }, [currentBusiness, saleToVoid, userProfile?.user_id, userBusinesses, loadSalesData]);

  const toggleStatsCollapse = useCallback(() => {
    setStatsCollapsed(!statsCollapsed);
  }, [statsCollapsed]);

  // Use analytics from database query instead of calculating from paginated data
  const totalRevenue = analytics.totalRevenue;
  const averageSale = analytics.averageSale;
  const todayRevenue = analytics.todayRevenue;
  const todaySales = analytics.todaySalesCount;


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
            {t('sales.selectDateRange')}
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
            {t('sales.selectCustomDateRange')}
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

  const renderSaleItem = useCallback(({ item }: { item: any }) => (
    <SaleCard
      sale={item}
      onVoid={handleVoidSale}
      showCreator={true}
    />
  ), [handleVoidSale]);

  const renderEmptyComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <Receipt size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {searchQuery || selectedStatus !== 'all' || selectedPaymentMethod !== 'all'
          ? t('sales.noSalesFound')
          : t('sales.noSalesYet')
        }
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {searchQuery || selectedStatus !== 'all' || selectedPaymentMethod !== 'all'
          ? t('sales.tryAdjustingFilter')
          : t('sales.createFirstSale')
        }
      </Text>
      {!searchQuery && selectedStatus === 'all' && selectedPaymentMethod === 'all' && (
        <Button
          title={t('sales.newSale')}
          onPress={handleNewSale}
          style={styles.emptyButton}
        />
      )}
    </Card>
  ), [searchQuery, selectedStatus, selectedPaymentMethod, isDark, handleNewSale]);

  const renderCartItem = useCallback(({ item }: { item: any }) => (
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
        {t('empty.noData')}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {t('sales.startNewSaleHint')}
      </Text>
      <Button
        title={t('actions.startNewSale')}
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
            title={t('sales.activeCarts')}
            icon={<ShoppingCart size={18} color={activeTab === 'carts' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
            isActive={activeTab === 'carts'}
            onPress={() => setActiveTab('carts')}
            isDark={isDark}
          />
          <TabButton
            title={t('sales.saleHistory')}
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
      {salesCountData.isAtLimit && !canAccessFeature ? (
        <ReadOnlyBanner
          salesCount={salesCountData.salesCount}
          onUpgrade={showPaywall}
        />
      ) : subscriptionStatus.subscriptionStatus === 'expired' && !salesCountData.isAtLimit ? (
        <WarningBanner
          salesCount={salesCountData.salesCount}
          remainingSales={salesCountData.remainingSales}
          totalLimit={FREE_TIER_LIMIT}
          onUpgrade={showPaywall}
          onDismiss={handleDismissWarning}
          dismissible={true}
        />
      ) : !salesCountData.isAtLimit && shouldShowWarningBanner() ? (
        <WarningBanner
          salesCount={salesCountData.salesCount}
          remainingSales={salesCountData.remainingSales}
          totalLimit={FREE_TIER_LIMIT}
          onUpgrade={showPaywall}
          onDismiss={handleDismissWarning}
          dismissible={true}
        />
      ) : null}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('sales.title')}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: salesCountData.isAtLimit && !canAccessFeature ? '#9ca3af' : '#f59e0b',
                opacity: salesCountData.isAtLimit && !canAccessFeature ? 0.5 : 1
              }
            ]}
            onPress={salesCountData.isAtLimit && !canAccessFeature ? () => setShowUpgradePrompt(true) : openInstantCheckoutModal}
            disabled={salesCountData.isAtLimit && !canAccessFeature}
          >
            <Zap size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: salesCountData.isAtLimit && !canAccessFeature ? '#9ca3af' : '#2563eb',
                marginLeft: 8,
                opacity: salesCountData.isAtLimit && !canAccessFeature ? 0.5 : 1
              }
            ]}
            onPress={handleNewSale}
            disabled={salesCountData.isAtLimit && !canAccessFeature}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton
          title={t('sales.activeCarts')}
          icon={<ShoppingCart size={18} color={activeTab === 'carts' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'carts'}
          onPress={() => setActiveTab('carts')}
          count={carts.length}
          isDark={isDark}
        />
        <TabButton
          title={t('sales.saleHistory')}
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
              title={t('common.pullToRefresh')}
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
                placeholder={t('sales.searchPlaceholder')}
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
                {t('sales.salesAnalytics')}
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
                      {t('financials.todayRevenue')}
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
                      {t('financials.totalRevenue')}
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
                      {t('financials.todaySales')}
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
                      {t('financials.averageSale')}
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
          <LoadingSpinner text={t('sales.deletingCart')} />
        </View>
      )}

      {/* Date Range Picker Modal */}
      {renderDateFilterTypeModal()}

      {/* Custom Date Range Picker Modal */}
      {renderCustomDateRangePicker()}

      {/* Void Sale Modal */}
      {saleToVoid && (
        <VoidSaleModal
          visible={showVoidModal}
          sale={saleToVoid}
          onConfirm={handleConfirmVoid}
          onCancel={() => {
            setShowVoidModal(false);
            setSaleToVoid(null);
          }}
          loading={voidingInProgress}
        />
      )}

      {/* Instant Checkout Widget */}
      <InstantCheckoutWidget />

      {/* Instant Checkout Modal */}
      <InstantCheckoutModal />

      {/* Subscription Paywall */}
      <Paywall
        visible={isPaywallVisible}
        onClose={hidePaywall}
        canClose={true}
      />

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        onUpgrade={handleUpgradeFromPrompt}
        salesCount={salesCountData.salesCount}
        message="You've reached the free limit. Upgrade to continue creating sales and unlock all features."
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