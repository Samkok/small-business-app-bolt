import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/context/CartContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import CustomerForm from '@/src/components/customers/CustomerForm';
import { ArrowLeft, Users, Plus, Search, User } from 'lucide-react-native';
import { customerService } from '@/src/services/customers';
import { useDebounce } from '@/src/hooks/useDebounce';

export default function CustomerSelectionScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [creatingCart, setCreatingCart] = useState(false);
  const [quickCustomers, setQuickCustomers] = useState<any[]>([]);
  
  const router = useRouter();
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const { createCart } = useCart();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadCustomers();
  }, []);

  // Set initial quick customers when customers are loaded
  useEffect(() => {
    if (customers.length > 0 && quickCustomers.length === 0) {
      // Initially set the first 5 customers as quick customers
      setQuickCustomers(customers.slice(0, 5));
    }
  }, [customers]);

  useEffect(() => {
    filterCustomers();
  }, [customers, debouncedSearchQuery]);

  const loadCustomers = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const data = await customerService.getCustomers(profile.id);
      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const filterCustomers = useCallback(() => {
    if (debouncedSearchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (customer.phone && customer.phone.includes(debouncedSearchQuery))
      );
      setFilteredCustomers(filtered);
    }
  }, [customers, debouncedSearchQuery]);

  const handleCustomerSelect = useCallback(async (customer: any) => {
    if (!profile?.id) return;
    
    setCreatingCart(true);
    try {
      // Create a new cart locally
      const cart = await createCart({
        id: customer.id,
        name: customer.name,
        phone: customer.phone
      });

      // Navigate to product selection with the cart ID
      router.push(`/sales/product-selection?cartId=${cart.id}`);
    } catch (error) {
      console.error('Error creating cart:', error);
      Alert.alert('Error', 'Failed to create cart');
    } finally {
      setCreatingCart(false);
    }
  }, [profile?.id, createCart, router]);

  const handleAddToQuickCustomers = useCallback((customer: any) => {
    // Check if customer is already in quick customers
    if (!quickCustomers.some(c => c.id === customer.id)) {
      // Add to quick customers (limit to 10)
      setQuickCustomers(prev => {
        const updated = [...prev, customer];
        return updated.slice(0, 10); // Keep only the 10 most recent
      });
    } else {
      // Remove from quick customers
      setQuickCustomers(prev => prev.filter(c => c.id !== customer.id));
    }
  }, [quickCustomers]);

  const handleCustomerSave = useCallback(async () => {
    setShowCustomerForm(false);
    await loadCustomers();
  }, [loadCustomers]);

  const renderCustomerItem = useCallback(({ item }) => (
    <Card style={styles.customerCard}>
      <TouchableOpacity
        style={[styles.customerCardInner, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
        onPress={() => handleCustomerSelect(item)}
        disabled={creatingCart}
      >
        <View style={styles.customerInfo}>
          <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.customerDetails}>
            <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {item.name}
            </Text>
            {item.phone && (
              <Text style={[styles.customerPhone, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {item.phone}
              </Text>
            )}
            {item.platform && (
              <Text style={[styles.customerPlatform, { color: '#2563eb' }]}>
                {item.platform.charAt(0).toUpperCase() + item.platform.slice(1).replace('_', ' ')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.customerActions}>
          <TouchableOpacity
            style={[styles.quickAddButton, { backgroundColor: quickCustomers.some(c => c.id === item.id) ? '#2563eb20' : '#f3f4f620' }]}
            onPress={() => handleAddToQuickCustomers(item)}
          >
            <Text style={[styles.quickAddButtonText, { 
              color: quickCustomers.some(c => c.id === item.id) ? '#2563eb' : (isDark ? '#9ca3af' : '#6b7280') 
            }]}>
              {quickCustomers.some(c => c.id === item.id) ? 'Remove' : 'Quick Add'}
            </Text>
          </TouchableOpacity>
          <View style={[styles.selectButton, { backgroundColor: '#2563eb20' }]}>
            <Text style={[styles.selectButtonText, { color: '#2563eb' }]}>
              Select
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  ), [isDark, handleCustomerSelect, creatingCart]);

  const renderEmptyComponent = useCallback(() => (
    <Card style={styles.emptyState}>
      <Users size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
      <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        {searchQuery ? 'No customers found' : 'No customers yet'}
      </Text>
      <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
        {searchQuery 
          ? `No customers match "${searchQuery}"`
          : 'Add your first customer to start making sales'
        }
      </Text>
      {!searchQuery && (
        <Button
          title="Add Customer"
          onPress={() => setShowCustomerForm(true)}
          style={styles.emptyButton}
        />
      )}
    </Card>
  ), [searchQuery, isDark]);

  if (loading) {
    return <LoadingSpinner text="Loading customers..." />;
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
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Select Customer
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCustomerForm(true)}
        >
          <Plus size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Quick Customer Bar */}
      {quickCustomers.length > 0 && (
        <View style={styles.quickCustomerBarContainer}>
          <View style={styles.quickCustomerBarHeader}>
            <Text style={[styles.quickCustomerBarTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Quick Select
            </Text>
            <TouchableOpacity onPress={() => setQuickCustomers([])}>
              <Text style={styles.clearQuickCustomersText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.quickCustomerScrollView}
            contentContainerStyle={styles.quickCustomerScrollContent}
          >
            {quickCustomers.map((customer) => (
              <TouchableOpacity
                key={customer.id}
                style={[
                  styles.quickCustomerButton,
                  { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
                ]}
                onPress={() => handleCustomerSelect(customer)}
              >
                <View style={[styles.quickCustomerAvatar, { backgroundColor: '#2563eb' }]}>
                  <Text style={styles.quickCustomerAvatarText}>
                    {customer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text 
                  style={[styles.quickCustomerButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}
                  numberOfLines={1}
                >
                  {customer.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search */}
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
      </View>

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomerItem}
        keyExtractor={(item) => item.id}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={filteredCustomers.length === 0 ? styles.emptyContainer : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      {/* Loading Overlay */}
      {creatingCart && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner text="Creating cart..." />
        </View>
      )}

      {/* Customer Form Modal */}
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16
  },
  quickCustomerBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 16
  },
  quickCustomerBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  quickCustomerBarTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  clearQuickCustomersText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500'
  },
  quickCustomerScrollView: {
    flexGrow: 0
  },
  quickCustomerScrollContent: {
    paddingBottom: 4
  },
  quickCustomerButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 10,
    minWidth: 80
  },
  quickCustomerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  quickCustomerAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  quickCustomerButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    maxWidth: 80
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  customerCard: {
    marginBottom: 0,
    overflow: 'hidden'
  },
  customerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 12,
  },
  customerPlatform: {
    fontSize: 12,
    fontWeight: '500',
  },
  customerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  quickAddButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});