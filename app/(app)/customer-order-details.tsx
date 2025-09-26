import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  RefreshControl
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonSaleCard, SkeletonCard, SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { SaleCard } from '@/src/components/sales/SaleCard';
import { ArrowLeft, User, Search, Filter, DollarSign, ShoppingCart, Calendar, TrendingUp, X } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import { useDebounce } from '@/src/hooks/useDebounce';

export default function CustomerOrderDetailsScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const router = useRouter();
  const { customerId, customerName } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (customerId && currentBusiness?.id) {
      loadCustomerData();
    }
  }, [customerId, currentBusiness?.id, debouncedSearchQuery, minAmount, maxAmount]);

  const loadCustomerData = useCallback(async (isRefresh = false) => {
    if (!customerId || !currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Parse filter values
      const minAmountValue = minAmount ? parseFloat(minAmount) : undefined;
      const maxAmountValue = maxAmount ? parseFloat(maxAmount) : undefined;
      
      // Load sales and stats in parallel
      const [salesData, statsData] = await Promise.all([
        salesService.getSalesByCustomer(
          currentBusiness.id,
          customerId as string,
          debouncedSearchQuery || undefined,
          minAmountValue,
          maxAmountValue
        ),
        salesService.getCustomerSalesStats(currentBusiness.id, customerId as string)
      ]);
      
      setSales(salesData);
      setCustomerStats(statsData);
    } catch (error) {
      console.error('Error loading customer data:', error);
      Alert.alert('Error', 'Failed to load customer order details');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [customerId, currentBusiness?.id, debouncedSearchQuery, minAmount, maxAmount]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomerData(true);
  }, [loadCustomerData]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setMinAmount('');
    setMaxAmount('');
    setShowFilters(false);
  }, []);

  const handleVoidSale = useCallback(async (sale: any) => {
    // This would typically open a void confirmation modal
    Alert.alert(
      'Void Sale',
      `Are you sure you want to void sale #${sale.id.slice(-8)} for $${sale.total_amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Void Sale', 
          style: 'destructive',
          onPress: async () => {
            try {
              await salesService.voidSale(sale.id, 'Voided from customer details', currentBusiness!.id);
              Alert.alert('Success', 'Sale voided successfully');
              loadCustomerData();
            } catch (error) {
              console.error('Error voiding sale:', error);
              Alert.alert('Error', 'Failed to void sale');
            }
          }
        },
      ]
    );
  }, [currentBusiness, loadCustomerData]);

  const renderSaleItem = useCallback(({ item }) => (
    <SaleCard
      sale={item}
      onVoid={handleVoidSale}
    />
  ), [handleVoidSale]);

  const renderEmptyComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <ShoppingCart size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {searchQuery || minAmount || maxAmount ? 'No orders found' : 'No orders yet'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {searchQuery || minAmount || maxAmount 
          ? 'Try adjusting your search or filter criteria'
          : 'This customer hasn\'t placed any orders yet'
        }
      </Text>
      {(searchQuery || minAmount || maxAmount) && (
        <Button
          title="Clear Filters"
          onPress={handleClearFilters}
          style={styles.emptyButton}
        />
      )}
    </Card>
  ), [searchQuery, minAmount, maxAmount, isDark, handleClearFilters]);

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
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
            {customerName || 'Customer Orders'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Loading Skeletons */}
        <ScrollView style={styles.content}>
          {/* Customer Stats Skeleton */}
          <SkeletonCard style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
              <SkeletonLoader height={16} width="60%" />
            </View>
            <View style={styles.statsGrid}>
              {[1, 2, 3, 4].map((index) => (
                <View key={index} style={styles.statItem}>
                  <SkeletonLoader height={18} width="60%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="80%" />
                </View>
              ))}
            </View>
          </SkeletonCard>

          {/* Search and Filter Skeleton */}
          <View style={styles.searchSection}>
            <SkeletonLoader height={48} borderRadius={8} style={{ marginBottom: 12 }} />
            <SkeletonLoader height={40} borderRadius={8} />
          </View>

          {/* Sales List Skeleton */}
          <View style={styles.salesList}>
            {[1, 2, 3].map((index) => (
              <SkeletonSaleCard key={index} />
            ))}
          </View>
        </ScrollView>
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
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
          {customerName || 'Customer Orders'}
        </Text>
        <TouchableOpacity
          style={styles.filterToggleButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
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
        {/* Customer Stats */}
        {customerStats && (
          <Card style={styles.statsCard}>
            <View style={styles.statsHeader}>
              <User size={20} color="#2563eb" />
              <Text style={[styles.statsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Customer Statistics
              </Text>
            </View>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#059669' }]}>
                  ${customerStats.totalSpent.toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Spent
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#2563eb' }]}>
                  {customerStats.orderCount}
                </Text>
                <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Orders
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#8b5cf6' }]}>
                  ${customerStats.averageOrderValue.toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Avg Order Value
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#ea580c' }]}>
                  ${customerStats.thisMonthSpent.toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  This Month
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Search */}
        <View style={styles.searchSection}>
          <View style={[styles.searchContainer, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}>
            <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
              placeholder="Search by product name or sale ID..."
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

          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: showFilters ? '#2563eb' : (isDark ? '#374151' : '#ffffff'),
                borderColor: showFilters ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
              }
            ]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} color={showFilters ? '#ffffff' : (isDark ? '#f9fafb' : '#111827')} />
          </TouchableOpacity>
        </View>

        {/* Amount Filters */}
        {showFilters && (
          <Card style={styles.filtersCard}>
            <View style={styles.filtersHeader}>
              <Text style={[styles.filtersTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Filter by Amount
              </Text>
              <TouchableOpacity onPress={handleClearFilters}>
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.amountFilters}>
              <View style={styles.amountInputContainer}>
                <Text style={[styles.amountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Min Amount
                </Text>
                <View style={[styles.amountInputWrapper, { backgroundColor: isDark ? '#374151' : '#f9fafb' }]}>
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
              
              <View style={styles.amountInputContainer}>
                <Text style={[styles.amountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Max Amount
                </Text>
                <View style={[styles.amountInputWrapper, { backgroundColor: isDark ? '#374151' : '#f9fafb' }]}>
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
          </Card>
        )}

        {/* Results Summary */}
        {(searchQuery || minAmount || maxAmount) && (
          <View style={styles.resultsHeader}>
            <Text style={[styles.resultsText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {sales.length === 0 
                ? 'No orders found' 
                : `Found ${sales.length} order${sales.length !== 1 ? 's' : ''}`}
            </Text>
            {(searchQuery || minAmount || maxAmount) && (
              <TouchableOpacity onPress={handleClearFilters}>
                <Text style={styles.clearSearchText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Sales List */}
        <View style={styles.salesList}>
          <FlatList
            data={sales}
            renderItem={renderSaleItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            ListEmptyComponent={renderEmptyComponent}
          />
        </View>
      </ScrollView>
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
  filterToggleButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsCard: {
    padding: 16,
    marginBottom: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  searchSection: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  filtersCard: {
    padding: 16,
    marginBottom: 16,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  amountFilters: {
    flexDirection: 'row',
    gap: 12,
  },
  amountInputContainer: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  salesList: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
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