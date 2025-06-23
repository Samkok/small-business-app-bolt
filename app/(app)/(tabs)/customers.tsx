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
import { SkeletonCustomerCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { CustomerCard } from '@/src/components/customers/CustomerCard';
import CustomerForm from '@/src/components/customers/CustomerForm';
import { Users, Plus, Search, Filter, UserPlus, Phone, MapPin, MessageCircle, Tag } from 'lucide-react-native';
import { customerService } from '@/src/services/customers';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [availablePlatforms, setAvailablePlatforms] = useState<Array<{value: string, label: string, count: number}>>([
    { value: 'all', label: 'All Platforms', count: 0 },
  ]);
  
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery, selectedPlatform]);

  const loadCustomers = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const data = await customerService.getCustomers(profile.id);
      setCustomers(data);
      
      // Get platform usage and update available platforms
      const platformUsage = await customerService.getPlatformUsage(profile.id);
      
      // Create a set of all platforms used by customers
      const platformSet = new Set(['all']);
      data.forEach(customer => {
        if (customer.platform) {
          platformSet.add(customer.platform);
        }
      });
      
      // Convert to array of platform objects with counts
      const platforms = Array.from(platformSet).map(platform => {
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
          count: platformUsage[platform] || 0
        };
      });
      
      setAvailablePlatforms(platforms);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert(t('common.error'), 'Failed to load customers');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchQuery)) ||
        (customer.address && customer.address.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by platform
    if (selectedPlatform !== 'all') {
      filtered = filtered.filter(customer => customer.platform === selectedPlatform);
    }

    setFilteredCustomers(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCustomers(true);
  };

  const handleCustomerSave = () => {
    setShowCustomerForm(false);
    setSelectedCustomer(null);
    loadCustomers();
  };

  const handleEditCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleDeleteCustomer = (customer: any) => {
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
  };

  const getCustomerStats = () => {
    const totalCustomers = customers.length;
    const platformCounts = availablePlatforms
      .filter(platform => platform.value !== 'all')
      .map(platform => ({
        ...platform,
        count: customers.filter(c => c.platform === platform.value).length
      }));
    
    return { totalCustomers, platformCounts };
  };

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

  const { totalCustomers, platformCounts } = getCustomerStats();

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
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
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
      <ScrollView
        style={styles.customersList}
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
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={handleEditCustomer}
              onDelete={handleDeleteCustomer}
            />
          ))
        ) : (
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
        )}
      </ScrollView>

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