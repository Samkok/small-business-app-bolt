import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl
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
import { DollarSign, TrendingUp, TrendingDown, Package, TriangleAlert as AlertTriangle, Users, ShoppingCart, Plus, Receipt, Calculator, ChartBar as BarChart } from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';

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
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadDashboardData();
  }, [profile?.id]);

  const handleNewSale = useCallback(() => {
    router.push('/sales/customer-selection');
  }, [router]);

  const loadDashboardData = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const [dashboardStats, products, customers] = await Promise.all([
        reportsService.getDashboardStats(profile.id),
        reportsService.getTopProducts(profile.id, 3),
        reportsService.getTopCustomers(profile.id, 3)
      ]);
      
      setStats(dashboardStats);
      setTopProducts(products);
      setTopCustomers(customers);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert(t('common.error'), 'Failed to load dashboard data');
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
          {product.quantity} sold
        </Text>
      </View>
      <View style={styles.topItemValues}>
        <Text style={[styles.topItemValue, { color: '#059669' }]}>
          ${product.revenue.toFixed(2)}
        </Text>
        <Text style={[styles.topItemProfit, { color: product.profit >= 0 ? '#059669' : '#dc2626' }]}>
          Profit: ${product.profit.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const TopCustomerCard = ({ customer }: { customer: TopCustomer }) => (
    <View style={styles.topItemRow}>
      <View style={styles.topItemInfo}>
        <Text style={[styles.topItemName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={[styles.topItemSubtext, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {customer.orderCount} orders
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
          title="Pull to refresh"
          titleColor={isDark ? '#f9fafb' : '#111827'}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.welcomeText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Welcome back,
        </Text>
        <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
          {profile?.business_name || 'Business Owner'}
        </Text>
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
              title="Today's Revenue"
              value={`$${stats!.todayRevenue.toFixed(2)}`}
              icon={<DollarSign size={20} color="#2563eb" />}
              color="#2563eb"
              trend={stats!.todayRevenue > 0 ? "up" : undefined}
            />
            <StatCard
              title="Monthly Revenue"
              value={`$${stats!.monthlyRevenue.toFixed(2)}`}
              icon={<TrendingUp size={20} color="#059669" />}
              color="#059669"
              trend={stats!.monthlyRevenue > 0 ? "up" : undefined}
            />
            <StatCard
              title="Monthly COGS"
              value={`$${stats!.monthlyCOGS.toFixed(2)}`}
              icon={<Calculator size={20} color="#8b5cf6" />}
              color="#8b5cf6"
            />
            <StatCard
              title="Total Profit"
              value={`$${stats!.totalProfit.toFixed(2)}`}
              icon={<DollarSign size={20} color="#059669" />}
              color="#059669"
              trend={stats!.totalProfit >= 0 ? "up" : "down"}
            />
            <StatCard
              title="Total Expenses"
              value={`$${stats!.totalExpenses.toFixed(2)}`}
              icon={<TrendingDown size={20} color="#ea580c" />}
              color="#ea580c"
            />
            <StatCard
              title="Net Profit"
              value={`$${stats!.netProfit.toFixed(2)}`}
              icon={<DollarSign size={20} color={stats!.netProfit >= 0 ? "#059669" : "#dc2626"} />}
              color={stats!.netProfit >= 0 ? "#059669" : "#dc2626"}
              trend={stats!.netProfit >= 0 ? "up" : "down"}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title="Total Products"
              value={stats!.totalProducts.toString()}
              icon={<Package size={20} color="#8b5cf6" />}
              color="#8b5cf6"
            />
            <StatCard
              title="Total Customers"
              value={stats!.totalCustomers.toString()}
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
                    Business Reports
                  </Text>
                  <Text style={[styles.reportsSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    View detailed reports, charts, and financial statements
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>

          {stats!.lowStockCount > 0 && (
            <TouchableOpacity>
              <Card style={styles.alertCard}>
                <View style={styles.alertContent}>
                  <AlertTriangle size={24} color="#ea580c" />
                  <View style={styles.alertText}>
                    <Text style={[styles.alertTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      Low Stock Alerts
                    </Text>
                    <Text style={[styles.alertSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {stats!.lowStockCount} products are running low on stock
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}

          {/* Top Products Section */}
          {topProducts.length > 0 && (
            <Card style={styles.topSection}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Top Products This Month
              </Text>
              {topProducts.map((product, index) => (
                <TopProductCard key={index} product={product} />
              ))}
            </Card>
          )}

          {/* Top Customers Section */}
          {topCustomers.length > 0 && (
            <Card style={styles.topSection}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Top Customers This Month
              </Text>
              {topCustomers.map((customer, index) => (
                <TopCustomerCard key={index} customer={customer} />
              ))}
            </Card>
          )}
        </>
      )}

      <Card style={styles.quickActions}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleNewSale}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#2563eb20' }]}>
              <ShoppingCart size={24} color="#2563eb" />
            </View>
            <Text style={[styles.actionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              New Sale
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowProductForm(true)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#05966920' }]}>
              <Package size={24} color="#059669" />
            </View>
            <Text style={[styles.actionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Add Product
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowCustomerForm(true)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#8b5cf620' }]}>
              <Users size={24} color="#8b5cf6" />
            </View>
            <Text style={[styles.actionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Add Customer
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

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
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 16,
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
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