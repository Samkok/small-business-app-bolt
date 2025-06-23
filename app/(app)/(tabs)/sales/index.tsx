import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput
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
import { ShoppingCart, Plus, Search, Filter, DollarSign, TrendingUp, Calendar, Receipt, Users } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import { cartService } from '@/src/services/carts';

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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, searchQuery, selectedStatus, selectedPaymentMethod]);

  const loadData = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const [salesData, cartsData] = await Promise.all([
        salesService.getSales(profile.id),
        cartService.getActiveCarts(profile.id)
      ]);
      
      setSales(salesData);
      setActiveCarts(cartsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('common.error'), 'Failed to load sales data');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const filterSales = () => {
    let filtered = sales;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(sale =>
        sale.customers?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.total_amount.toString().includes(searchQuery)
      );
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(sale => sale.status === selectedStatus);
    }

    // Filter by payment method
    if (selectedPaymentMethod !== 'all') {
      filtered = filtered.filter(sale => sale.payment_method === selectedPaymentMethod);
    }

    setFilteredSales(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
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

  const handleNewSale = () => {
    router.push('/sales/customer-selection');
  };

  const handleCartPress = (cartId: string) => {
    router.push(`/sales/cart/${cartId}`);
  };

  const getSalesStats = () => {
    const totalSales = sales.length;
    const completedSales = sales.filter(s => s.status === 'completed');
    const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const averageSale = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
    
    // Today's sales
    const today = new Date().toISOString().split('T')[0];
    const todaySales = completedSales.filter(sale => 
      sale.sale_date.split('T')[0] === today
    );
    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total_amount, 0);

    return { totalSales, totalRevenue, averageSale, todayRevenue, todaySales: todaySales.length };
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('sales.title')}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleNewSale}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
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

  const { totalSales, totalRevenue, averageSale, todayRevenue, todaySales } = getSalesStats();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('sales.title')}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleNewSale}
        >
          <Plus size={24} color="#ffffff" />
        </TouchableOpacity>
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
                  onPress={() => setSelectedStatus(filter.value)}
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
                  onPress={() => setSelectedPaymentMethod(filter.value)}
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

          {/* Sales List */}
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
                    title="Start New Sale"
                    onPress={handleNewSale}
                    style={styles.emptyButton}
                  />
                )}
              </Card>
            )}
          </ScrollView>
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
  addButton: {
    backgroundColor: '#2563eb',
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
  salesList: {
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
});