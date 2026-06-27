import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonDashboardStats, SkeletonCard, SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import ProductForm from '@/src/components/products/ProductForm';
import CustomerForm from '@/src/components/customers/CustomerForm';
import SalesForm from '@/src/components/sales/SalesForm';
import { DollarSign, TrendingUp, TrendingDown, Package, TriangleAlert as AlertTriangle, Users, ShoppingCart, Plus, Receipt, Calculator, ChartBar as BarChart, Bell } from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';
import MonthPicker from '@/src/components/ui/MonthPicker';
import NotificationModal from '@/src/components/notifications/NotificationModal';
import { useNotifications } from '@/src/context/NotificationContext';
import { showNetworkAwareError } from '@/src/utils/offlineAlert';
import { useNetwork } from '@/src/context/NetworkContext';
import { dataCache } from '@/src/lib/dataCache';

interface DashboardStats {
  todayRevenue: number;
  monthlyRevenue: number;
  monthlyCOGS: number;
  totalProfit: number;
  totalExpenses: number;
  netProfit: number;
  lowStockCount: number;
  totalCustomers: number;
  totalProducts: number;
  totalCustomersBought: number;
  totalProductsSold: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface TopCustomer {
  name: string;
  phone?: string;
  totalSpent: number;
  orderCount: number;
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { unreadCount } = useNotifications();
  const { isConnected, wasOffline } = useNetwork();
  const router = useRouter();

  useEffect(() => {
    loadDashboardData();
  }, [currentBusiness, selectedMonth]);

  useEffect(() => {
    if (wasOffline && isConnected && currentBusiness?.id) {
      loadDashboardData(true);
    }
  }, [wasOffline, isConnected]);

  const handleNewSale = useCallback(() => {
    // Use router.navigate instead of router.push to properly handle tab navigation
    router.navigate('/sales/customer-selection');
  }, [router]);

  const loadDashboardData = async (isRefresh = false) => {
    if (!currentBusiness?.id) {
      console.log('DashboardScreen: No profile ID available, skipping data load');
      setLoading(false);
      return;
    }

    const monthKey = `${selectedMonth.getFullYear()}_${selectedMonth.getMonth() + 1}`;
    const businessId = currentBusiness.id;

    if (!isRefresh) {
      setLoading(true);
    }

    setError(null);

    // Step 1: Try loading from cache first
    const cachedStats = await dataCache.get<DashboardStats>(`dashboard_stats_${monthKey}`, businessId);
    const cachedProducts = await dataCache.get<TopProduct[]>(`dashboard_top_products_${monthKey}`, businessId);
    const cachedCustomers = await dataCache.get<TopCustomer[]>(`dashboard_top_customers_${monthKey}`, businessId);

    if (cachedStats) {
      setStats(cachedStats.data);
      setTopProducts(cachedProducts?.data || []);
      setTopCustomers(cachedCustomers?.data || []);
      setLoading(false);
    }

    // Step 2: If offline, stop here
    if (!isConnected) {
      if (!cachedStats) {
        setLoading(false);
      }
      return;
    }

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration is missing. Please check your environment variables.');
      }

      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;

      const [dashboardStats, products, customers] = await Promise.all([
        reportsService.getDashboardStats(businessId, year, month),
        reportsService.getTopProducts(businessId, 3, year, month),
        reportsService.getTopCustomers(businessId, 3, year, month)
      ]);

      setStats(dashboardStats);
      setTopProducts(products);
      setTopCustomers(customers);
      setError(null);

      // Cache the fresh data
      await dataCache.set(`dashboard_stats_${monthKey}`, businessId, dashboardStats);
      await dataCache.set(`dashboard_top_products_${monthKey}`, businessId, products);
      await dataCache.set(`dashboard_top_customers_${monthKey}`, businessId, customers);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      if (!cachedStats) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
        setError(errorMessage);

        if (Platform.OS !== 'web') {
          showNetworkAwareError(err, t('common.error'), errorMessage, isConnected);
        }
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData(true);
  };

  const handleProductSave = () => {
    setShowProductForm(false);
    loadDashboardData(); // Refresh stats
  };

  const handleCustomerSave = () => {
    setShowCustomerForm(false);
    loadDashboardData(); // Refresh stats
  };

  const handleSaleComplete = () => {
    setShowSalesForm(false);
    loadDashboardData(); // Refresh stats
  };

  const handleViewReports = () => {
    router.push('/reports');
  };

  const handleLowStockPress = () => {
    // Use router.navigate instead of router.push to properly handle tab navigation
    router.navigate('/(app)/(tabs)/inventory/low-stock');
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color = '#2563eb',
    trend,
    onPress
  }: {
    title: string;
    value: string;
    icon: React.ReactNode;
    color?: string;
    trend?: 'up' | 'down';
    onPress?: () => void;
  }) => (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={styles.statCardContainer}>
      <Card style={styles.statCard}>
        <View style={styles.statHeader}>
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            {icon}
          </View>
          {trend && (
            <View style={styles.trendContainer}>
              {trend === 'up' ? (
                <TrendingUp size={14} color="#059669" />
              ) : (
                <TrendingDown size={14} color="#dc2626" />
              )}
            </View>
          )}
        </View>
        <View style={styles.statContent}>
          <Text style={[styles.statValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          <Text style={[styles.statTitle, { color: isDark ? '#d1d5db' : '#6b7280' }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const TopProductCard = ({ product }: { product: TopProduct }) => (
    <View style={styles.topItemRow}>
      <View style={styles.topItemInfo}>
        <Text style={[styles.topItemName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.topItemSubtext, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {product.quantity} {t('dashboard.sold')}
        </Text>
      </View>
      <View style={styles.topItemValues}>
        <Text style={[styles.topItemValue, { color: '#059669' }]}>
          ${product.revenue.toFixed(2)}
        </Text>
        <Text style={[styles.topItemProfit, { color: product.profit >= 0 ? '#059669' : '#dc2626' }]}>
          {t('financials.profit')}: ${product.profit.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const TopCustomerCard = ({ customer }: { customer: TopCustomer }) => (
    <View style={styles.topItemRow} >
      <View style={styles.topItemInfo}>
        <Text style={[styles.topItemName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={[styles.topItemSubtext, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {customer.orderCount} {t('dashboard.orders')}
        </Text>
      </View>
      <Text style={[styles.topItemValue, { color: '#059669' }]}>
        ${customer.totalSpent.toFixed(2)}
      </Text>
    </View>
  );

  const SkeletonTopSection = () => (
    <SkeletonCard style={styles.topSection}>
      <SkeletonLoader height={18} width="60%" style={{ marginBottom: 16 }} />
      {[1, 2, 3].map((index) => (
        <View key={index} style={styles.topItemRow}>
          <View style={styles.topItemInfo}>
            <SkeletonLoader height={14} width="70%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={12} width="50%" />
          </View>
          <SkeletonLoader height={14} width="25%" />
        </View>
      ))}
    </SkeletonCard>
  );

  // Show error state
  if (error && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.welcomeText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('dashboard.welcomeBack')},
          </Text>
          <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
            {currentBusiness?.business_name || t('dashboard.businessOwner')}
          </Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <AlertTriangle size={48} color="#dc2626" style={styles.errorIcon} />
            <Text style={[styles.errorTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('dashboard.unableToLoad')}
            </Text>
            <Text style={[styles.errorMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadDashboardData()}
            >
              <Text style={styles.retryButtonText}>{t('actions.tryAgain')}</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </View>
    );
  }

  // Show no data state when loading is complete but stats is null
  if (!loading && !stats) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.welcomeText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('dashboard.welcomeBack')},
          </Text>
          <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
            {currentBusiness?.business_name || t('dashboard.businessOwner')}
          </Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Package size={48} color="#6b7280" style={styles.errorIcon} />
            <Text style={[styles.errorTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('dashboard.noData')}
            </Text>
            <Text style={[styles.errorMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t('dashboard.noDataMessage')}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadDashboardData()}
            >
              <Text style={styles.retryButtonText}>{t('actions.refresh')}</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#2563eb']} // Android
          tintColor="#2563eb" // iOS
          title={t('actions.refresh')}
          titleColor={isDark ? '#f9fafb' : '#111827'}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.welcomeText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('dashboard.welcomeBack')},
          </Text>
          <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
            {currentBusiness?.business_name || t('dashboard.businessOwner')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <Bell size={24} color={isDark ? '#f9fafb' : '#111827'} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <MonthPicker
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            maxDate={new Date()}
          />
        </View>
      </View>

      {loading ? (
        <>
          <SkeletonDashboardStats />
          <View style={styles.statsRow}>
            <SkeletonCard style={styles.statCardContainer}>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <SkeletonLoader height={36} width={36} borderRadius={8} />
                </View>
                <View style={styles.statContent}>
                  <SkeletonLoader height={18} width="60%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="80%" />
                </View>
              </View>
            </SkeletonCard>
            <SkeletonCard style={styles.statCardContainer}>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <SkeletonLoader height={36} width={36} borderRadius={8} />
                </View>
                <View style={styles.statContent}>
                  <SkeletonLoader height={18} width="60%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="80%" />
                </View>
              </View>
            </SkeletonCard>
          </View>
          <SkeletonTopSection />
          <SkeletonTopSection />
        </>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <StatCard
              title={t('financials.todayRevenue')}
              value={`$${stats.todayRevenue.toFixed(2)}`}
              icon={<DollarSign size={20} color="#2563eb" />}
              color="#2563eb"
              trend={stats.todayRevenue > 0 ? "up" : undefined}
            />
            <StatCard
              title={t('financials.monthlyRevenue')}
              value={`$${stats.monthlyRevenue.toFixed(2)}`}
              icon={<TrendingUp size={20} color="#059669" />}
              color="#059669"
              trend={stats.monthlyRevenue > 0 ? "up" : undefined}
            />
            <StatCard
              title={t('dashboard.monthlyCOGS')}
              value={`$${stats.monthlyCOGS.toFixed(2)}`}
              icon={<Calculator size={20} color="#8b5cf6" />}
              color="#8b5cf6"
            />
            <StatCard
              title={t('financials.totalProfit')}
              value={`$${stats.totalProfit.toFixed(2)}`}
              icon={<DollarSign size={20} color="#059669" />}
              color="#059669"
              trend={stats.totalProfit >= 0 ? "up" : "down"}
            />
            <StatCard
              title={t('expenses.totalExpenses')}
              value={`$${stats.totalExpenses.toFixed(2)}`}
              icon={<TrendingDown size={20} color="#ea580c" />}
              color="#ea580c"
            />
            <StatCard
              title={t('financials.netProfit')}
              value={`$${stats.netProfit.toFixed(2)}`}
              icon={<DollarSign size={20} color={stats.netProfit >= 0 ? "#059669" : "#dc2626"} />}
              color={stats.netProfit >= 0 ? "#059669" : "#dc2626"}
              trend={stats.netProfit >= 0 ? "up" : "down"}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title={t('dashboard.totalProductsSold')}
              value={stats.totalProductsSold.toString()}
              icon={<Package size={20} color="#8b5cf6" />}
              color="#8b5cf6"
            />
            <StatCard
              title={t('dashboard.monthlyCustomer')}
              value={stats.totalCustomersBought.toString()}
              icon={<Users size={20} color="#06b6d4" />}
              color="#06b6d4"
            />
          </View>

          {/* Reports Card */}
          <TouchableOpacity onPress={handleViewReports}>
            <Card style={styles.reportsCard}>
              <View style={styles.reportsContent}>
                <BarChart size={24} color="#2563eb" />
                <View style={styles.reportsText}>
                  <Text style={[styles.reportsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {t('dashboard.businessReports')}
                  </Text>
                  <Text style={[styles.reportsSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {t('dashboard.viewReports')}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>

          {/* Top Products Section */}
          {topProducts.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/top-products')}>
              <Card style={styles.topSection}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {t('dashboard.topProductsMonth')}
                </Text>
                {topProducts.map((product, index) => (
                  <TopProductCard key={index} product={product} />
                ))}
              </Card>
            </TouchableOpacity>
          )}

          {/* Top Customers Section */}
          {topCustomers.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/top-customers')}>
              <Card style={styles.topSection}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {t('dashboard.topCustomersMonth')}
                </Text>
                {topCustomers.map((customer, index) => (
                  <TopCustomerCard key={index} customer={customer} />
                ))}
              </Card>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Modals */}
      <Modal
        visible={showProductForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ProductForm
          onSave={handleProductSave}
          onCancel={() => setShowProductForm(false)}
        />
      </Modal>

      <Modal
        visible={showCustomerForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CustomerForm
          onSave={handleCustomerSave}
          onCancel={() => setShowCustomerForm(false)}
        />
      </Modal>

      <Modal
        visible={showSalesForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SalesForm
          onComplete={handleSaleComplete}
          onCancel={() => setShowSalesForm(false)}
        />
      </Modal>

      <NotificationModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  welcomeText: {
    fontSize: 16,
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statCardContainer: {
    width: '48%',
  },
  statCard: {
    padding: 12,
    minHeight: 100,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendContainer: {
    padding: 2,
  },
  statContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
    lineHeight: 22,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  reportsCard: {
    marginBottom: 16,
    padding: 16,
  },
  reportsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportsText: {
    marginLeft: 12,
    flex: 1,
  },
  reportsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  reportsSubtitle: {
    fontSize: 14,
  },
  alertCard: {
    marginBottom: 16,
    padding: 16,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertText: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 14,
  },
  topSection: {
    padding: 16,
    marginBottom: 16,
  },
  topItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  topItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  topItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  topItemSubtext: {
    fontSize: 12,
  },
  topItemValues: {
    alignItems: 'flex-end',
  },
  topItemValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  topItemProfit: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  quickActions: {
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    flex: 1,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
});