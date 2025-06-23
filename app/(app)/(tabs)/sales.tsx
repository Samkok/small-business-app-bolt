import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  TextInput
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonSaleCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { SaleCard } from '@/src/components/sales/SaleCard';
import SalesForm from '@/src/components/sales/SalesForm';
import { ShoppingCart, Plus, Search, Filter, DollarSign, TrendingUp, Calendar, Receipt } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';

export default function SalesScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
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
    loadSales();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, searchQuery, selectedStatus, selectedPaymentMethod]);

  const loadSales = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh) {
      
      setLoading(true);
    }
    
    try {
      const data = await salesService.getSales(profile.id);
      setSales(data);
    } catch (error) {
      console.error('Error loading sales:', error);
      Alert.alert(t('common.error'), 'Failed to load sales');
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
    await loadSales(true);
  };

  const handleSaleComplete = () => {
    setShowSalesForm(false);
    loadSales();
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
              loadSales();
            } catch (error) {
              console.error('Error voiding sale:', error);
              Alert.alert('Error', 'Failed to void sale');
            }
          }
        },
      ]
    );
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

  const SkeletonStatsGrid = () => (
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4].map((index) => (
        <SkeletonCard key={index} style={styles.statsCard}>
          <View style={styles.statsContent}>
            <SkeletonLoader height={20} width={20} borderRadius={10} />
            <View style={styles.statsText}>
              <SkeletonLoader height={16} width="60%" style={{ marginBottom: 4 }} />
              <SkeletonLoader height={11} width="80%" />
            </View>
          </View>
        </SkeletonCard>
      ))}
    </View>
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
            onPress={() => setShowSalesForm(true)}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Search and Filter Skeleton */}
        <View style={styles.searchSection}>
          <SkeletonLoader height={48} borderRadius={8} style={{ marginBottom: 12 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {statusFilters.map((filter) => (
              <SkeletonLoader 
                key={filter.value}
                height={36} 
                width={80} 
                borderRadius={20} 
                style={{ marginRight: 8 }} 
              />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {paymentMethodFilters.map((filter) => (
              <SkeletonLoader 
                key={filter.value}
                height={36} 
                width={80} 
                borderRadius={20} 
                style={{ marginRight: 8 }} 
              />
            ))}
          </ScrollView>
        </View>

        <SkeletonStatsGrid />
        <SkeletonList itemComponent={SkeletonSaleCard} itemCount={5} style={styles.salesList} />
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
          onPress={() => setShowSalesForm(true)}
        >
          <Plus size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

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
            <ShoppingCart size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
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
                onPress={() => setShowSalesForm(true)}
                style={styles.emptyButton}
              />
            )}
          </Card>
        )}
      </ScrollView>

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
  salesList: {
    flex: 1,
    paddingHorizontal: 16,
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