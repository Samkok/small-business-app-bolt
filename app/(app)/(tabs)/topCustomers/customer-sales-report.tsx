import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  FlatList,
  ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { ArrowLeft, Users, Search, Filter, DollarSign, Phone, ShoppingCart, X, TrendingUp, Calendar } from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';
import { useDebounce } from '@/src/hooks/useDebounce';
import { startOfMonth, endOfMonth } from 'date-fns';

interface CustomerSalesData {
  id: string;
  name: string;
  phone?: string;
  totalSpent: number;
  orderCount: number;
}

export default function CustomerSalesReportScreen() {
  const [customers, setCustomers] = useState<CustomerSalesData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerSalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { customerName } = params;
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    // Pre-fill search if customer name is provided from navigation
    if (customerName && typeof customerName === 'string') {
      setSearchQuery(customerName);
    }
    loadCustomerSalesData();
  }, [customerName]);

  useEffect(() => {
    filterCustomers();
  }, [customers, debouncedSearchQuery, minAmount, maxAmount]);

  const loadCustomerSalesData = useCallback(async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Get current month date range
      const now = new Date();
      const startDate = startOfMonth(now);
      const endDate = endOfMonth(now);
      endDate.setHours(23, 59, 59, 999);
      
      const data = await reportsService.getAllCustomersWithSalesSummary(
        currentBusiness.id,
        startDate,
        endDate
      );
      
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customer sales data:', error);
      Alert.alert(t('common.error'), 'Failed to load customer sales data');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [currentBusiness?.id, t]);

  const filterCustomers = useCallback(() => {
    let filtered = customers;

    // Filter by search query
    if (debouncedSearchQuery.trim()) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (customer.phone && customer.phone.includes(debouncedSearchQuery))
      );
    }

    // Filter by minimum amount
    if (minAmount.trim()) {
      const minValue = parseFloat(minAmount);
      if (!isNaN(minValue)) {
        filtered = filtered.filter(customer => customer.totalSpent >= minValue);
      }
    }

    // Filter by maximum amount
    if (maxAmount.trim()) {
      const maxValue = parseFloat(maxAmount);
      if (!isNaN(maxValue)) {
        filtered = filtered.filter(customer => customer.totalSpent <= maxValue);
      }
    }

    setFilteredCustomers(filtered);
  }, [customers, debouncedSearchQuery, minAmount, maxAmount]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomerSalesData(true);
  }, [loadCustomerSalesData]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setMinAmount('');
    setMaxAmount('');
    setShowFilters(false);
  }, []);

  const getFilteredStats = useMemo(() => {
    const totalCustomers = filteredCustomers.length;
    const totalRevenue = filteredCustomers.reduce((sum, customer) => sum + customer.totalSpent, 0);
    const totalOrders = filteredCustomers.reduce((sum, customer) => sum + customer.orderCount, 0);
    const averageSpent = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    return { totalCustomers, totalRevenue, totalOrders, averageSpent };
  }, [filteredCustomers]);

  const renderCustomerItem = useCallback(({ item, index }: { item: CustomerSalesData; index: number }) => (
    <Card style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <View style={styles.rankContainer}>
          <Text style={[styles.rank, { color: isDark ? '#f9fafb' : '#111827' }]}>
            #{index + 1}
          </Text>
        </View>
        
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {item.name}
          </Text>
          {item.phone && (
            <View style={styles.phoneRow}>
              <Phone size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.customerPhone, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {item.phone}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.customerStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#059669' }]}>
              ${item.totalSpent.toFixed(2)}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Total Spent
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2563eb' }]}>
              {item.orderCount}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Orders
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.customerFooter}>
        <Text style={[styles.averageOrder, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
          Avg. order: ${(item.totalSpent / item.orderCount).toFixed(2)}
        </Text>
      </View>
    </Card>
  ), [isDark]);

  const renderEmptyComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <Users size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {searchQuery || minAmount || maxAmount ? 'No customers found' : 'No customer sales this month'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {searchQuery || minAmount || maxAmount
          ? 'Try adjusting your search or filter criteria'
          : 'Customer sales data will appear here once you have completed sales'
        }
      </Text>
      {(searchQuery || minAmount || maxAmount) && (
        <Button
          title="Clear Filters"
          onPress={clearFilters}
          style={styles.emptyButton}
        />
      )}
    </Card>
  ), [searchQuery, minAmount, maxAmount, isDark, clearFilters]);

  const SkeletonCustomerSalesCard = () => (
    <SkeletonCard style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <View style={styles.rankContainer}>
          <SkeletonLoader height={16} width={20} />
        </View>
        
        <View style={styles.customerInfo}>
          <SkeletonLoader height={18} width="70%" style={{ marginBottom: 8 }} />
          <View style={styles.phoneRow}>
            <SkeletonLoader height={14} width={14} borderRadius={7} style={{ marginRight: 6 }} />
            <SkeletonLoader height={14} width="60%" />
          </View>
        </View>
        
        <View style={styles.customerStats}>
          <View style={styles.statItem}>
            <SkeletonLoader height={16} width="80%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={12} width="60%" />
          </View>
          
          <View style={styles.statItem}>
            <SkeletonLoader height={16} width="40%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={12} width="50%" />
          </View>
        </View>
      </View>
      
      <View style={styles.customerFooter}>
        <SkeletonLoader height={12} width="40%" />
      </View>
    </SkeletonCard>
  );

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
            Customer Sales Report
          </Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        {/* Search and Filter Skeleton */}
        <View style={styles.searchSection}>
          <SkeletonLoader height={48} borderRadius={8} style={{ marginBottom: 12 }} />
        </View>

        {/* Stats Skeleton */}
        <View style={styles.statsContainer}>
          {[1, 2, 3, 4].map((index) => (
            <SkeletonCard key={index} style={styles.statsCard}>
              <View style={styles.statsContent}>
                <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
                <View style={styles.statsText}>
                  <SkeletonLoader height={16} width="60%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="80%" />
                </View>
              </View>
            </SkeletonCard>
          ))}
        </View>

        <SkeletonList itemComponent={SkeletonCustomerSalesCard} itemCount={5} style={styles.customersList} />
      </View>
    );
  }

  const { totalCustomers, totalRevenue, totalOrders, averageSpent } = getFilteredStats;

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
          Customer Sales Report
        </Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      {/* Period Info */}
      <Card style={styles.periodCard}>
        <View style={styles.periodInfo}>
          <Calendar size={16} color="#2563eb" />
          <Text style={[styles.periodText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            This Month's Customer Sales
          </Text>
        </View>
      </Card>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}>
          <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
            placeholder="Search customers..."
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

        {showFilters && (
          <Card style={styles.filtersCard}>
            <Text style={[styles.filtersTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Filter by Total Amount
            </Text>
            
            <View style={styles.amountFilters}>
              <View style={styles.amountFilterInput}>
                <Text style={[styles.amountLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  Min Amount
                </Text>
                <View style={[styles.amountInputContainer, { 
                  backgroundColor: isDark ? '#374151' : '#f9fafb',
                  borderColor: isDark ? '#4b5563' : '#d1d5db'
                }]}>
                  <DollarSign size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <TextInput
                    style={[styles.amountInput, { color: isDark ? '#f9fafb' : '#111827' }]}
                    value={minAmount}
                    onChangeText={setMinAmount}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              
              <View style={styles.amountFilterInput}>
                <Text style={[styles.amountLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  Max Amount
                </Text>
                <View style={[styles.amountInputContainer, { 
                  backgroundColor: isDark ? '#374151' : '#f9fafb',
                  borderColor: isDark ? '#4b5563' : '#d1d5db'
                }]}>
                  <DollarSign size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <TextInput
                    style={[styles.amountInput, { color: isDark ? '#f9fafb' : '#111827' }]}
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    placeholder="999.99"
                    placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
            
            <View style={styles.filterActions}>
              <Button
                title="Clear Filters"
                variant="outline"
                onPress={clearFilters}
                style={styles.filterActionButton}
              />
              <Button
                title="Hide Filters"
                onPress={() => setShowFilters(false)}
                style={styles.filterActionButton}
              />
            </View>
          </Card>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <Users size={20} color="#2563eb" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {totalCustomers}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Customers
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <DollarSign size={20} color="#059669" />
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
            <ShoppingCart size={20} color="#8b5cf6" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {totalOrders}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Orders
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <TrendingUp size={20} color="#ea580c" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                ${averageSpent.toFixed(2)}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Avg. Spent
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomerItem}
        keyExtractor={(item) => item.id}
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
        contentContainerStyle={filteredCustomers.length === 0 ? styles.emptyContainer : styles.customersList}
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
  filterButton: {
    padding: 8,
  },
  periodCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchSection: {
    paddingHorizontal: 16,
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
  filtersCard: {
    padding: 16,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  amountFilters: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  amountFilterInput: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  filterActionButton: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
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
  customersList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  customerCard: {
    marginBottom: 12,
    padding: 16,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  customerInfo: {
    flex: 1,
    marginRight: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhone: {
    fontSize: 12,
    marginLeft: 6,
  },
  customerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  customerFooter: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  averageOrder: {
    fontSize: 12,
    fontStyle: 'italic',
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