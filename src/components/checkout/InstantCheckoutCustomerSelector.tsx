import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { customerService } from '@/src/services/customers';
import { Database } from '@/src/types/database';
import { UserCheck, UserPlus, Users, Check } from 'lucide-react-native';
import { InlineCustomerForm } from './InlineCustomerForm';
import { LoadingSpinner } from '../ui/LoadingSpinner';

type Customer = Database['public']['Tables']['customers']['Row'];

interface InstantCheckoutCustomerSelectorProps {
  selectedCustomerId?: string;
  guestCustomerId: string;
  onSelectCustomer: (customerId: string | undefined, customerName?: string, customerPhone?: string) => void;
}

type CustomerOption = 'guest' | 'existing' | 'new';

export function InstantCheckoutCustomerSelector({
  selectedCustomerId,
  guestCustomerId,
  onSelectCustomer,
}: InstantCheckoutCustomerSelectorProps) {
  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<CustomerOption>('guest');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedOption === 'existing') {
      loadCustomers();
    }
  }, [selectedOption, currentBusiness?.id]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    if (!currentBusiness?.id) return;

    setLoading(true);
    try {
      const allCustomers = await customerService.getCustomers(currentBusiness.id);
      const regularCustomers = allCustomers.filter((c) => !c.is_system_customer);
      setCustomers(regularCustomers);
      setFilteredCustomers(regularCustomers);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (option: CustomerOption) => {
    setSelectedOption(option);
    if (option === 'guest') {
      onSelectCustomer(undefined);
    } else if (option === 'new') {
      onSelectCustomer(undefined);
    }
  };

  const handleSelectExistingCustomer = (customer: Customer) => {
    onSelectCustomer(customer.id, customer.name, customer.phone || undefined);
  };

  const handleCreateCustomer = async (name: string, phone?: string) => {
    if (!currentBusiness?.id || !user?.id) return;

    try {
      const newCustomer = await customerService.createCustomer({
        name,
        phone: phone || null,
        business_id: currentBusiness.id,
        is_system_customer: false,
      });

      onSelectCustomer(newCustomer.id, newCustomer.name, newCustomer.phone || undefined);
      setSelectedOption('existing');
      await loadCustomers();
    } catch (error) {
      throw error;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
        Customer
      </Text>

      <TouchableOpacity
        style={[
          styles.optionCard,
          {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: selectedOption === 'guest' ? '#2563eb' : isDark ? '#374151' : '#e5e7eb',
            borderWidth: selectedOption === 'guest' ? 2 : 1,
          },
        ]}
        onPress={() => handleOptionChange('guest')}
      >
        <View style={styles.optionHeader}>
          <UserCheck size={20} color={selectedOption === 'guest' ? '#2563eb' : isDark ? '#d1d5db' : '#6b7280'} />
          <Text style={[styles.optionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Continue as Guest
          </Text>
          {selectedOption === 'guest' && <Check size={20} color="#2563eb" />}
        </View>
        <Text style={[styles.optionDescription, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          Sale will be recorded under: Guest Customer
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.optionCard,
          {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor:
              selectedOption === 'existing' ? '#2563eb' : isDark ? '#374151' : '#e5e7eb',
            borderWidth: selectedOption === 'existing' ? 2 : 1,
          },
        ]}
        onPress={() => handleOptionChange('existing')}
      >
        <View style={styles.optionHeader}>
          <Users size={20} color={selectedOption === 'existing' ? '#2563eb' : isDark ? '#d1d5db' : '#6b7280'} />
          <Text style={[styles.optionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Select Existing Customer
          </Text>
          {selectedOption === 'existing' && selectedCustomerId && <Check size={20} color="#2563eb" />}
        </View>
        {selectedOption === 'existing' && (
          <View style={styles.customerList}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: isDark ? '#111827' : '#f9fafb',
                  color: isDark ? '#f9fafb' : '#111827',
                  borderColor: isDark ? '#374151' : '#e5e7eb',
                },
              ]}
              placeholder="Search customers..."
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {loading ? (
              <LoadingSpinner />
            ) : (
              <ScrollView style={styles.customersScroll} nestedScrollEnabled>
                {filteredCustomers.map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    style={[
                      styles.customerItem,
                      {
                        backgroundColor:
                          selectedCustomerId === customer.id
                            ? isDark
                              ? '#1e3a8a'
                              : '#dbeafe'
                            : 'transparent',
                      },
                    ]}
                    onPress={() => handleSelectExistingCustomer(customer)}
                  >
                    <View style={styles.customerInfo}>
                      <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {customer.name}
                      </Text>
                      {customer.phone && (
                        <Text style={[styles.customerPhone, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                          {customer.phone}
                        </Text>
                      )}
                    </View>
                    {selectedCustomerId === customer.id && <Check size={18} color="#2563eb" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.optionCard,
          {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: selectedOption === 'new' ? '#2563eb' : isDark ? '#374151' : '#e5e7eb',
            borderWidth: selectedOption === 'new' ? 2 : 1,
          },
        ]}
        onPress={() => handleOptionChange('new')}
      >
        <View style={styles.optionHeader}>
          <UserPlus size={20} color={selectedOption === 'new' ? '#2563eb' : isDark ? '#d1d5db' : '#6b7280'} />
          <Text style={[styles.optionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Create New Customer
          </Text>
          {selectedOption === 'new' && <Check size={20} color="#2563eb" />}
        </View>
        {selectedOption === 'new' && (
          <InlineCustomerForm
            onCustomerCreate={handleCreateCustomer}
            onCancel={() => handleOptionChange('guest')}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionCard: {
    padding: 16,
    borderRadius: 8,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 32,
  },
  customerList: {
    marginTop: 12,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  customersScroll: {
    maxHeight: 200,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 12,
  },
});
