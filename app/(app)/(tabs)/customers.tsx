import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  TextInput,
  FlatList,
  ScrollView
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonCustomerCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { CustomerCard } from '@/src/components/customers/CustomerCard';
import CustomerForm from '@/src/components/customers/CustomerForm';
import { Users, Plus, Search, Filter, UserPlus, Phone, MapPin, MessageCircle, Tag, X, ArrowUpDown } from 'lucide-react-native';
import { customerService } from '@/src/services/customers';
import { useDebounce } from '@/src/hooks/useDebounce';
import { useRouter } from 'expo-router';
import { showNetworkAwareError } from '@/src/utils/offlineAlert';
import { useNetwork } from '@/src/context/NetworkContext';
import { dataCache } from '@/src/lib/dataCache';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'purchase_asc' | 'purchase_desc'>('name_asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [availablePlatforms, setAvailablePlatforms] = useState<Array<{value: string, label: string, count: number}>>([
    { value: 'all', label: 'All Platforms', count: 0 },
    { value: 'facebook', label: 'Facebook', count: 0 },
    { value: 'instagram', label: 'Instagram', count: 0 },
    { value: 'telegram', label: 'Telegram', count: 0 },
    { value: 'walk_in', label: 'Walk-in', count: 0 },
    { value: 'other', label: 'Other', count: 0 },
  ]);
  
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const router = useRouter();
  const { isConnected, wasOffline } = useNetwork();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadCustomers();
  }, []);

  // Auto-refetch when coming back online
  useEffect(() => {
    if (wasOffline && isConnected) {
      loadCustomers(true);
    }
  }, [wasOffline, isConnected]);

  useEffect(() => {
    filterCustomers();
  }, [customers, debouncedSearchQuery, selectedPlatform, sortBy]);

  const loadCustomers = useCallback(async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }

    // Cache-first: restore from cache immediately
    if (!isRefresh) {
      try {
        const cached = await dataCache.get<any[]>('customers', currentBusiness.id);
        if (cached) {
          setCustomers(cached.data);
          setLoading(false);
        }
      } catch {}
    }

    // If offline, stop here
    if (!isConnected) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await customerService.getCustomers(currentBusiness.id);
      setCustomers(data);

      // Cache customers
      dataCache.set('customers', currentBusiness.id, data).catch(() => {});
      
      // Count platforms manually
      const platformCounts: Record<string, number> = { all: data.length };
      data.forEach(customer => {
        if (customer.platform) {
          platformCounts[customer.platform] = (platformCounts[customer.platform] || 0) + 1;
        }
      });
      
      // Get unique platforms from customers
      const uniquePlatforms = new Set(['all']);
      data.forEach(customer => {
        if (customer.platform) {
          uniquePlatforms.add(customer.platform);
        }
      });
      
      // Create platform objects with counts
      const platforms = Array.from(uniquePlatforms).map(platform => {
        if (platform === 'all') {
          return { value: 'all', label: 'All Platforms', count: data.length };
        }
        
        // Format platform name (convert snake_case to Title Case)
        const formattedName = platform
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        return {
          value: platform,
          label: formattedName,
          count: platformCounts[platform] || 0
        };
      });
      
      setAvailablePlatforms(platforms);
    } catch (error) {
      console.error('Error loading customers:', error);
      showNetworkAwareError(error, t('common.error'), 'Failed to load customers', isConnected);
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
        (customer.phone && customer.phone.includes(debouncedSearchQuery)) ||
        (customer.address && customer.address.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      );
    }

    // Filter by platform
    if (selectedPlatform !== 'all') {
      filtered = filtered.filter(customer => customer.platform === selectedPlatform);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'date_asc':
          return (a.created_at || '').localeCompare(b.created_at || '');
        case 'date_desc':
          return (b.created_at || '').localeCompare(a.created_at || '');
        case 'purchase_asc':
          return (a.updated_at || '').localeCompare(b.updated_at || '');
        case 'purchase_desc':
          return (b.updated_at || '').localeCompare(a.updated_at || '');
        default:
          return 0;
      }
    });

    setFilteredCustomers(filtered);
  }, [customers, debouncedSearchQuery, selectedPlatform, sortBy]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomers(true);
  }, [loadCustomers]);

  const handleCustomerSave = useCallback(() => {
    setShowCustomerForm(false);
    setSelectedCustomer(null);
    loadCustomers();
  }, [loadCustomers]);

  const handleEditCustomer = useCallback((customer: any) => {
    setSelectedCustomer(customer);
    setShowCustomerForm(true);
  }, []);

  const handleViewOrders = useCallback((customer: any) => {
    router.push(`/customer-orders/${customer.id}`);
  }, [router]);

  const handleDeleteCustomer = useCallback((customer: any) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customer.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await customerService.deleteCustomer(customer.id);
              Alert.alert('Success', 'Customer deleted successfully');
              loadCustomers();
            } catch (error) {
              console.error('Error deleting customer:', error);
              Alert.alert('Error', 'Failed to delete customer');
            }
          }
        },
      ]
    );
  }, [loadCustomers]);

  const getCustomerStats = useCallback(() => {
    const totalCustomers = customers.length;
    const platformCounts = availablePlatforms
      .filter(platform => platform.value !== 'all')
      .map(platform => ({
        ...platform,
        count: customers.filter(c => c.platform === platform.value).length
      }));
    
    return { totalCustomers, platformCounts };
  }, [customers, availablePlatforms]);

  const { totalCustomers, platformCounts } = useMemo(() => getCustomerStats(), [getCustomerStats]);

  const renderCustomerItem = useCallback(({ item }) => (
    <CustomerCard
      customer={item}
      onEdit={handleEditCustomer}
      onDelete={handleDeleteCustomer}
      onViewOrders={handleViewOrders}
    />
  ), [handleEditCustomer, handleDeleteCustomer, handleViewOrders]);

  const renderEmptyComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <Users size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {searchQuery || selectedPlatform !== 'all' ? 'No customers found' : 'No customers yet'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {searchQuery || selectedPlatform !== 'all' 
          ? 'Try adjusting your search or filter criteria'
          : 'Add your first customer to get started'
        }
      </Text>
      {!searchQuery && selectedPlatform === 'all' && (
        <Button
          title="Add Customer"
          onPress={() => setShowCustomerForm(true)}
          style={styles.emptyButton}
        />
      )}
    </Card>
  ), [searchQuery, selectedPlatform, isDark]);

  const SkeletonStatsCards = () => (
    <View style={styles.statsContainer}>
      <SkeletonCard style={styles.statsCard}>
        <View style={styles.statsContent}>
          <SkeletonLoader height={24} width={24} borderRadius={12} />
          <View style={styles.statsText}>
            <SkeletonLoader height={20} width="60%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={12} width="80%" />
          </View>
        </View>
      </SkeletonCard>
      <SkeletonCard style={styles.statsCard}>
        <View style={styles.statsContent}>
          <SkeletonLoader height={24} width={24} borderRadius={12} />
          <View style={styles.statsText}>
            <SkeletonLoader height={20} width="60%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={12} width="80%" />
          </View>
        </View>
      </SkeletonCard>
    </View>
  );

  const SkeletonPlatformCard = () => (
    <SkeletonCard style={styles.platformCard}>
      <SkeletonLoader height={16} width="60%" style={{ marginBottom: 12 }} />
      <View style={styles.platformGrid}>
        {[1, 2, 3, 4, 5, 6].map((index) => (
          <View key={index} style={styles.platformItem}>
            <SkeletonLoader height={12} width="80%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={16} width="40%" />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('customers.title')}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCustomerForm(true)}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Search and Filter Skeleton */}
        <View style={styles.searchSection}>
          <SkeletonLoader height={48} borderRadius={8} style={{ marginBottom: 12 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {[1, 2, 3, 4, 5].map((index) => (
              <SkeletonLoader 
                key={index}
                height={36} 
                width={80} 
                borderRadius={20} 
                style={{ marginRight: 8 }} 
              />
            ))}
          </ScrollView>
        </View>

        <SkeletonStatsCards />
        <SkeletonPlatformCard />
        <SkeletonList itemComponent={SkeletonCustomerCard} itemCount={5} style={styles.customersList} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('customers.title')}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCustomerForm(true)}
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
            placeholder="Search customers..."
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer} contentContainerStyle={{ flexGrow: 1 }}>
            {availablePlatforms.map((platform) => (
              <TouchableOpacity
                key={platform.value}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: selectedPlatform === platform.value
                      ? '#2563eb'
                      : (isDark ? '#374151' : '#f3f4f6'),
                    borderColor: selectedPlatform === platform.value
                      ? '#2563eb'
                      : (isDark ? '#4b5563' : '#d1d5db'),
                  }
                ]}
                onPress={() => setSelectedPlatform(platform.value)}
              >
                <Text style={[
                  styles.filterButtonText,
                  {
                    color: selectedPlatform === platform.value
                      ? '#ffffff'
                      : (isDark ? '#f9fafb' : '#374151')
                  }
                ]}>
                  {platform.label} ({platform.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6', borderColor: isDark ? '#4b5563' : '#d1d5db' }]}
            onPress={() => setShowSortMenu(!showSortMenu)}
          >
            <ArrowUpDown size={16} color={isDark ? '#f9fafb' : '#374151'} />
          </TouchableOpacity>
        </View>

        {showSortMenu && (
          <View style={[styles.sortMenu, { backgroundColor: isDark ? '#374151' : '#ffffff', borderColor: isDark ? '#4b5563' : '#e5e7eb' }]}>
            {([
              { key: 'name_asc', label: 'Name A-Z' },
              { key: 'name_desc', label: 'Name Z-A' },
              { key: 'date_desc', label: 'Newest First' },
              { key: 'date_asc', label: 'Oldest First' },
              { key: 'purchase_desc', label: 'Recent Purchase' },
              { key: 'purchase_asc', label: 'Oldest Purchase' },
            ] as const).map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.sortOption, sortBy === option.key && { backgroundColor: isDark ? '#1f2937' : '#eff6ff' }]}
                onPress={() => { setSortBy(option.key); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortOptionText, { color: sortBy === option.key ? '#2563eb' : (isDark ? '#f9fafb' : '#374151') }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <Users size={24} color="#2563eb" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {totalCustomers}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Customers
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <MessageCircle size={24} color="#059669" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {availablePlatforms.length - 1}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Active Platforms
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Platform Breakdown */}
      <Card style={styles.platformCard}>
        <View style={styles.platformHeader}>
          <Text style={[styles.platformTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Customers by Platform
          </Text>
          <TouchableOpacity
            style={styles.managePlatformsButton}
            onPress={() => setShowCustomerForm(true)}
          >
            <Tag size={14} color="#2563eb" />
            <Text style={styles.managePlatformsText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.platformGrid}>
          {platformCounts.map((platform) => (
            <View key={platform.value} style={styles.platformItem}>
              <Text style={[styles.platformLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {platform.label}
              </Text>
              <Text style={[styles.platformCount, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {platform.count}
              </Text>
            </View>
          ))}
        </View>
      </Card>

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

      <Modal
        visible={showCustomerForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CustomerForm
          customer={selectedCustomer}
          onSave={handleCustomerSave}
          onCancel={() => {
            setShowCustomerForm(false);
            setSelectedCustomer(null);
          }}
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
    flex: 1,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortMenu: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  sortOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '500',
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  statsCard: {
    flex: 1,
    padding: 16,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    marginLeft: 12,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  platformCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  platformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  managePlatformsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  managePlatformsText: {
    fontSize: 12,
    color: '#2563eb',
    marginLeft: 4,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  platformItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  platformLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  platformCount: {
    fontSize: 16,
    fontWeight: 'bold',
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