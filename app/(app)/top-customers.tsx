import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonLoader, SkeletonCard } from '@/src/components/ui/SkeletonLoader';
import { ArrowLeft, Users, ShoppingCart, DollarSign, Calendar, User, Phone } from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';

interface TopCustomer {
  name: string;
  phone?: string;
  totalSpent: number;
  orderCount: number;
}

export default function TopCustomersScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const [customers, setCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTopCustomers();
  }, []);

  const loadTopCustomers = async (isRefresh = false) => {
    if (!currentBusiness?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Get all customers who made purchases this month (no limit)
      const data = await reportsService.getTopCustomers(currentBusiness.id, 100);
      setCustomers(data);
    } catch (error) {
      console.error('Error loading top customers:', error);
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
    await loadTopCustomers(true);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const CustomerCard = ({ customer, index }: { customer: TopCustomer; index: number }) => (
    <Card style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <View style={styles.rankContainer}>
          <Text style={[styles.rank, { color: '#2563eb' }]}>
            #{index + 1}
          </Text>
        </View>
        
        <View style={styles.customerInfo}>
          <View style={styles.customerNameRow}>
            <User size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {customer.name}
            </Text>
          </View>
          
          {customer.phone && (
            <View style={styles.customerPhoneRow}>
              <Phone size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.customerPhone, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {customer.phone}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.customerStats}>
        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <ShoppingCart size={16} color="#8b5cf6" />
          </View>
          <View style={styles.statContent}>
            <Text style={[styles.statValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {customer.orderCount}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Orders
            </Text>
          </View>
        </View>
        
        <View style={styles.statItem}>
          <View style={styles.statIconContainer}>
            <DollarSign size={16} color="#059669" />
          </View>
          <View style={styles.statContent}>
            <Text style={[styles.statValue, { color: '#059669' }]}>
              {formatCurrency(customer.totalSpent)}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Total Spent
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );

  const SkeletonCustomerCard = () => (
    <SkeletonCard style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <SkeletonLoader height={32} width={32} borderRadius={16} />
        <View style={styles.customerInfo}>
          <SkeletonLoader height={16} width="70%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={14} width="50%" />
        </View>
      </View>
      <View style={styles.customerStats}>
        <View style={styles.statItem}>
          <SkeletonLoader height={16} width={16} borderRadius={8} />
          <View style={styles.statContent}>
            <SkeletonLoader height={18} width={40} style={{ marginBottom: 4 }} />
            <SkeletonLoader height={12} width={50} />
          </View>
        </View>
        <View style={styles.statItem}>
          <SkeletonLoader height={16} width={16} borderRadius={8} />
          <View style={styles.statContent}>
            <SkeletonLoader height={18} width={60} style={{ marginBottom: 4 }} />
            <SkeletonLoader height={12} width={70} />
          </View>
        </View>
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
            Top Customers
          </Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          <SkeletonCard style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <SkeletonLoader height={20} width={20} borderRadius={10} />
              <SkeletonLoader height={16} width="60%" />
            </View>
            <SkeletonLoader height={14} width="80%" />
          </SkeletonCard>

          <View style={styles.customersList}>
            {[1, 2, 3, 4, 5].map((index) => (
              <SkeletonCustomerCard key={index} />
            ))}
          </View>
        </View>
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
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Top Customers
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
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
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Calendar size={20} color="#2563eb" />
            <Text style={[styles.summaryTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              This Month's Performance
            </Text>
          </View>
          <Text style={[styles.summaryText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {customers.length} customers made purchases this month
          </Text>
        </Card>

        {/* Customers List */}
        <View style={styles.customersList}>
          {customers.length > 0 ? (
            customers.map((customer, index) => (
              <CustomerCard key={index} customer={customer} index={index} />
            ))
          ) : (
            <Card style={styles.emptyState}>
              <Users size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                No Customer Purchases
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                No customers have made purchases this month yet
              </Text>
            </Card>
          )}
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  summaryText: {
    fontSize: 14,
  },
  customersList: {
    flex: 1,
  },
  customerCard: {
    padding: 16,
    marginBottom: 12,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rank: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  customerInfo: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  customerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerPhone: {
    fontSize: 12,
    marginLeft: 6,
  },
  customerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#8b5cf620',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
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
  },
});