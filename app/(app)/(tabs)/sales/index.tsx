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
  Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonSaleCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { SaleCard } from '@/src/components/sales/SaleCard';
import { ActiveCartCard } from '@/src/components/sales/ActiveCartCard';
import ImportSalesModal from '@/src/components/sales/ImportSalesModal';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { ShoppingCart, Plus, Search, Filter, DollarSign, TrendingUp, Calendar, Receipt, Users, FileUp, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import { cartService } from '@/src/services/carts';
import { importService } from '@/src/services/importService';

const SALES_PER_PAGE = 10;

export default function SalesScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [activeCarts, setActiveCarts] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'carts' | 'sales'>('carts');
  const [deletingCart, setDeletingCart] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(true);
  
  // Animation for collapsible section
  const collapseAnim = useRef(new Animated.Value(0)).current;
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState<'this_month' | 'three_months' | 'six_months' | 'custom' | 'all'>('this_month');
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [dateRangeText, setDateRangeText] = useState('This Month');
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();

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

  useEffect(() => {
    loadData();
  }, []);

  // Only load sales data when tab changes or filter parameters change
  useEffect(() => {
    if (activeTab === 'sales') {
      loadSalesData();
    }
  }, [activeTab, dateFilter, startDate, endDate, selectedStatus, selectedPaymentMethod, currentPage]);

  // Filter sales when search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      filterSales();
    } else {
      setFilteredSales(sales);
    }
  }, [searchQuery, sales]);

  // Animate the collapsible section
  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: statsCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [statsCollapsed, collapseAnim]);

  const loadData = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const cartsData = await cartService.getActiveCarts(profile.id);
      setActiveCarts(cartsData);
      
      if (activeTab === 'sales') {
        await loadSalesData(isRefresh);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('common.error'), 'Failed to load data');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSalesData = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh && !loadingMore) {
      setLoading(true);
    }
    
    try {
      // Use the current state values directly
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Set to beginning of day
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set to end of day
      
      // First get the total count for pagination
      const count = await salesService.getSalesCount(
        profile.id, 
        start.toISOString(), 
        end.toISOString(),
        selectedStatus !== 'all' ? selectedStatus : undefined,
        selectedPaymentMethod !== 'all' ? selectedPaymentMethod : undefined
      );
      
      setTotalSales(count);
      setTotalPages(Math.ceil(count / SALES_PER_PAGE));
      
      // Then get the paginated data
      const salesData = await salesService.getSalesPaginated(
        profile.id,
        start.toISOString(),
        end.toISOString(),
        currentPage * SALES_PER_PAGE,
        SALES_PER_PAGE,
        selectedStatus !== 'all' ? selectedStatus : undefined,
        selectedPaymentMethod !== 'all' ? selectedPaymentMethod : undefined
      );
      
      setSales(salesData);
      setFilteredSales(salesData);
    } catch (error) {
      console.error('Error loading sales data:', error);
      Alert.alert(t('common.error'), 'Failed to load sales data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const filterSales = () => {
    if (!searchQuery.trim()) {
      setFilteredSales(sales);
      return;
    }
    
    const filtered = sales.filter(sale =>
      sale.customers?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.total_amount.toString().includes(searchQuery)
    );
    
    setFilteredSales(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(0);
    await loadData(true);
  };

  const handleVoidSale = async (sale: any) => {
    Alert.alert(
      'Void Sale',
      `Are you sure you want to void this sale for $${sale.total_amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Void Sale', 
          style: 'destructive',
          onPress: async () => {
            try {
              if (!profile?.id) return;
              await salesService.voidSale(sale.id, 'Sale voided by user', profile.id);
              Alert.alert('Success', 'Sale voided successfully');
              loadData();
            } catch (error) {
              console.error('Error voiding sale:', error);
              Alert.alert('Error', 'Failed to void sale');
            }
          }
        },
      ]
    );
  };

  const handleDeleteCart = async (cartId: string) => {
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
              await cartService.deleteCart(cartId);
              setActiveCarts(activeCarts.filter(cart => cart.id !== cartId));
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
  };

  const handleNewSale = () => {
    router.push('/sales/customer-selection');
  };

  const handleCartPress = (cartId: string) => {
    router.push(`/sales/cart/${cartId}`);
  };

  const handleImportSales = () => {
    router.push('/sales/import');
  };

  const handleExportSales = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Not Supported', 'Export is only available on web platform');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
      return;
    }

    try {
      // Create start and end dates with proper time components
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const csvData = await importService.exportSalesToCsv(
        profile.id, 
        start.toISOString(), 
        end.toISOString()
      );
      
      // Create a download link
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_export_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      Alert.alert('Success', 'Sales data exported successfully');
    } catch (error) {
      console.error('Error exporting sales:', error);
      Alert.alert('Error', 'Failed to export sales data');
    }
  };

  const handleDateFilterChange = (filter: 'this_month' | 'three_months' | 'six_months' | 'custom' | 'all') => {
    setDateFilter(filter);
    setCurrentPage(0);
    
    if (filter === 'custom') {
      setShowDateRangePicker(true);
    } else {
      // Calculate and set the dates for non-custom filters
      const { start, end, text } = calculateDatesForFilter(filter);
      setStartDate(start);
      setEndDate(end);
      setDateRangeText(text);
    }
  };

  const handleDateRangeConfirm = (start: Date, end: Date) => {
    // Set start date to beginning of day
    const adjustedStart = new Date(start);
    adjustedStart.setHours(0, 0, 0, 0);
    
    // Set end date to end of day
    const adjustedEnd = new Date(end);
    adjustedEnd.setHours(23, 59, 59, 999);
    
    setStartDate(adjustedStart);
    setEndDate(adjustedEnd);
    setDateRangeText(`${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
    setShowDateRangePicker(false);
    setCurrentPage(0);
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages - 1 && !loadingMore) {
      setLoadingMore(true);
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 0 && page < totalPages) {
      setCurrentPage(page);
    }
  };

  const getSalesStats = () => {
    const totalSalesCount = totalSales;
    const completedSales = sales.filter(s => s.status === 'completed');
    const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
    const averageSale = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
    
    // Today's sales
    const today = new Date().toISOString().split('T')[0];
    const todaySales = completedSales.filter(sale => 
      sale.sale_date.split('T')[0] === today
    );
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

    return { totalSalesCount, totalRevenue, averageSale, todayRevenue, todaySales: todaySales.length };
  };

  const toggleStatsCollapse = () => {
    setStatsCollapsed(!statsCollapsed);
  };

  const TabButton = ({ 
    title, 
    icon,
    isActive, 
    onPress,
    count
  }: { 
    title: string; 
    icon: React.ReactNode;
    isActive: boolean; 
    onPress: () => void;
    count?: number;
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
        ]}>
          {title}
        </Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: isActive ? '#ffffff' : '#2563eb' }]}>
            <Text style={[styles.countText, { color: isActive ? '#2563eb' : '#ffffff' }]}>
              {count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    // Calculate range of page numbers to show
    let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);
    
    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[
            styles.pageButton,
            { opacity: currentPage === 0 ? 0.5 : 1 }
          ]}
          onPress={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <ChevronLeft size={16} color={isDark ? '#f9fafb' : '#374151'} />
        </TouchableOpacity>
        
        {pageNumbers.map(page => (
          <TouchableOpacity
            key={page}
            style={[
              styles.pageButton,
              {
                backgroundColor: currentPage === page 
                  ? '#2563eb' 
                  : (isDark ? '#374151' : '#f3f4f6')
              }
            ]}
            onPress={() => handlePageChange(page)}
          >
            <Text style={{
              color: currentPage === page 
                ? '#ffffff' 
                : (isDark ? '#f9fafb' : '#374151')
            }}>
              {page + 1}
            </Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity
          style={[
            styles.pageButton,
            { opacity: currentPage === totalPages - 1 ? 0.5 : 1 }
          ]}
          onPress={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages - 1}
        >
          <ChevronRight size={16} color={isDark ? '#f9fafb' : '#374151'} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDateFilter = () => (
    <View style={styles.dateFilterContainer}>
      <Text style={[styles.dateFilterLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        Date Range:
      </Text>
      <TouchableOpacity
        style={[
          styles.dateFilterButton,
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
        ]}
        onPress={() => setShowDateRangePicker(true)}
      >
        <Calendar size={16} color="#2563eb" />
        <Text style={[styles.dateFilterText, { color: isDark ? '#f9fafb' : '#374151' }]}>
          {dateRangeText}
        </Text>
        <ChevronDown size={16} color="#2563eb" />
      </TouchableOpacity>
    </View>
  );

  const renderDateFilterOptions = () => (
    <Modal
      visible={showDateRangePicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDateRangePicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowDateRangePicker(false)}
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
          
          {dateFilter === 'custom' ? (
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onConfirm={handleDateRangeConfirm}
              onCancel={() => setShowDateRangePicker(false)}
            />
          ) : (
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
                  onPress={() => {
                    handleDateFilterChange(option.value as any);
                    if (option.value !== 'custom') {
                      setShowDateRangePicker(false);
                    }
                  }}
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
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (loading && !loadingMore) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('sales.title')}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#059669' }]}
              onPress={handleImportSales}
            >
              <FileUp size={20} color="#ffffff" />
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
          />
          <TabButton
            title="Sales History"
            icon={<Receipt size={18} color={activeTab === 'sales' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
            isActive={activeTab === 'sales'}
            onPress={() => setActiveTab('sales')}
          />
        </View>

        <SkeletonList itemComponent={SkeletonSaleCard} itemCount={5} style={styles.content} />
      </View>
    );
  }

  const { totalSalesCount, totalRevenue, averageSale, todayRevenue, todaySales } = getSalesStats();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('sales.title')}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#059669' }]}
            onPress={handleImportSales}
          >
            <FileUp size={20} color="#ffffff" />
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
          count={activeCarts.length}
        />
        <TabButton
          title="Sales History"
          icon={<Receipt size={18} color={activeTab === 'sales' ? '#ffffff' : (isDark ? '#f9fafb' : '#374151')} />}
          isActive={activeTab === 'sales'}
          onPress={() => setActiveTab('sales')}
        />
      </View>

      {activeTab === 'carts' ? (
        // Active Carts Tab
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
          {activeCarts.length > 0 ? (
            <View style={styles.cartsGrid}>
              {activeCarts.map((cart) => (
                <ActiveCartCard
                  key={cart.id}
                  cart={cart}
                  onPress={() => handleCartPress(cart.id)}
                  onDelete={handleDeleteCart}
                />
              ))}
            </View>
          ) : (
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
          )}
        </ScrollView>
      ) : (
        // Sales History Tab
        <View style={styles.content}>
          {/* Date Filter */}
          {renderDateFilter()}
          
          {/* Collapsible Section */}
          <View style={styles.collapsibleHeader}>
            <View style={styles.collapsibleTitle}>
              <Text style={[styles.collapsibleTitleText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Sales Statistics
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.collapseButton}
              onPress={toggleStatsCollapse}
            >
              {statsCollapsed ? (
                <ChevronDown size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              ) : (
                <ChevronUp size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              )}
            </TouchableOpacity>
          </View>
          
          <Animated.View style={{
            maxHeight: collapseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 500] // Adjust this value based on your content height
            }),
            overflow: 'hidden',
            opacity: collapseAnim
          }}>
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
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={handleImportSales}
                >
                  <FileUp size={16} color="#2563eb" />
                  <Text style={styles.actionButtonText}>Import</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={handleExportSales}
                >
                  <Download size={16} color="#059669" />
                  <Text style={[styles.actionButtonText, { color: '#059669' }]}>Export</Text>
                </TouchableOpacity>
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
            </View>

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
            ) : (
              <View style={styles.resultsHeader}>
                <Text style={[styles.resultsText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Showing {Math.min(currentPage * SALES_PER_PAGE + 1, totalSales)} - {Math.min((currentPage + 1) * SALES_PER_PAGE, totalSales)} of {totalSales} sales
                </Text>
              </View>
            )}

            {searchQuery ? (
              // Show filtered results when searching
              <ScrollView
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
              >
                {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => (
                    <SaleCard
                      key={sale.id}
                      sale={sale}
                      onVoid={handleVoidSale}
                    />
                  ))
                ) : (
                  <Card style={styles.emptyState}>
                    <Receipt size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
                    <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      No sales found
                    </Text>
                    <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Try adjusting your search criteria
                    </Text>
                  </Card>
                )}
              </ScrollView>
            ) : (
              // Show paginated results when not searching
              <>
                <FlatList
                  data={sales}
                  renderItem={({ item }) => (
                    <SaleCard
                      sale={item}
                      onVoid={handleVoidSale}
                    />
                  )}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.flatListContent}
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
                  ListEmptyComponent={() => (
                    <Card style={styles.emptyState}>
                      <Receipt size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
                      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        No sales found
                      </Text>
                      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        Try adjusting your filter criteria or create your first sale
                      </Text>
                      <View style={styles.emptyActions}>
                        <Button
                          title="Import Sales"
                          variant="outline"
                          onPress={handleImportSales}
                          style={styles.emptyButton}
                        />
                        <Button
                          title="New Sale"
                          onPress={handleNewSale}
                          style={styles.emptyButton}
                        />
                      </View>
                    </Card>
                  )}
                  ListFooterComponent={() => (
                    <View style={styles.listFooter}>
                      {loadingMore && (
                        <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 16 }} />
                      )}
                    </View>
                  )}
                />
                
                {renderPagination()}
              </>
            )}
          </View>
        </View>
      )}

      {/* Loading overlay for cart deletion */}
      {deletingCart && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Deleting cart..." />
        </View>
      )}

      {/* Import Sales Modal */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowImportModal(false)}
      >
        <ImportSalesModal
          onClose={() => setShowImportModal(false)}
          onComplete={() => {
            setShowImportModal(false);
            loadData();
          }}
        />
      </Modal>

      {/* Date Range Picker Modal */}
      {renderDateFilterOptions()}
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
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  countText: {
    fontSize: 10,
    fontWeight: 'bold',
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
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  pageButton: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  listFooter: {
    paddingVertical: 8,
    alignItems: 'center',
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
});