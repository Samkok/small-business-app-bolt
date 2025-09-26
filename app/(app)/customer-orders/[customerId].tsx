import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonLoader, SkeletonCard } from '@/src/components/ui/SkeletonLoader';
import { ArrowLeft, User, Phone, ShoppingCart, DollarSign, Calendar, Receipt, Package } from 'lucide-react-native';
import { supabase } from '@/src/config/supabase';

interface CustomerOrder {
  id: string;
  total_amount: number;
  payment_method: string;
  sale_date: string;
  status: string;
  items_count: number;
  products: string[];
}

interface CustomerInfo {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  platform?: string;
}

export default function CustomerOrdersScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    if (customerId && currentBusiness?.id) {
      loadCustomerOrders();
    }
  }, [customerId, currentBusiness?.id]);

  const loadCustomerOrders = async (isRefresh = false) => {
    if (!customerId || typeof customerId !== 'string' || !currentBusiness?.id) {
      console.log('Missing required parameters:', { customerId, currentBusinessId: currentBusiness?.id });
      return;
    }
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      // Get customer information
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId as string)
        .eq('business_id', currentBusiness.id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      console.log("Customer: ", customerData);

      // Get customer's orders with cart items
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          payment_method,
          sale_date,
          status,
          carts(
            cart_items(
              quantity,
              products(name)
            )
          )
        `)
        .eq('customer_id', customerId as string)
        .eq('business_id', currentBusiness.id)
        .order('sale_date', { ascending: false });

      if (salesError) throw salesError;

      // Process orders data
      const processedOrders: CustomerOrder[] = salesData.map(sale => {
        const items = sale.carts?.cart_items || [];
        const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
        const products = items.map(item => item.products?.name || 'Unknown Product');

        return {
          id: sale.id,
          total_amount: sale.total_amount,
          payment_method: sale.payment_method,
          sale_date: sale.sale_date,
          status: sale.status,
          items_count: itemsCount,
          products: products
        };
      });

      setOrders(processedOrders);

      // Calculate totals
      const completedOrders = processedOrders.filter(order => order.status === 'completed');
      const totalSpentAmount = completedOrders.reduce((sum, order) => sum + order.total_amount, 0);
      
      setTotalSpent(totalSpentAmount);
      setTotalOrders(completedOrders.length);

    } catch (error) {
      console.error('Error loading customer orders:', error);
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
    await loadCustomerOrders(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#059669';
      case 'voided':
        return '#dc2626';
      case 'refunded':
        return '#ea580c';
      case 'partially_returned':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return '💵';
      case 'card':
        return '💳';
      case 'transfer':
        return '🏦';
      default:
        return '💰';
    }
  };

  const OrderCard = ({ order }: { order: CustomerOrder }) => (
    <TouchableOpacity
      onPress={() => router.push(`/sales/details/${order.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={[styles.orderId, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Order #{order.id.slice(-8)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.orderAmount, { color: '#059669' }]}>
            {formatCurrency(order.total_amount)}
          </Text>
        </View>
        
        <View style={styles.orderDetails}>
          <View style={styles.orderDetailRow}>
            <Calendar size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.orderDetailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {formatDate(order.sale_date)}
            </Text>
          </View>
          
          <View style={styles.orderDetailRow}>
            <Receipt size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.orderDetailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {getPaymentMethodIcon(order.payment_method)} {order.payment_method.charAt(0).toUpperCase() + order.payment_method.slice(1)}
            </Text>
          </View>
          
          <View style={styles.orderDetailRow}>
            <Package size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.orderDetailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {order.items_count} items
            </Text>
          </View>
        </View>
        
        <View style={styles.productsSection}>
          <Text style={[styles.productsLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Products:
          </Text>
          <Text style={[styles.productsText, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={2}>
            {order.products.slice(0, 3).join(', ')}
            {order.products.length > 3 && ` +${order.products.length - 3} more`}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const SkeletonOrderCard = () => (
    <SkeletonCard style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <SkeletonLoader height={16} width="40%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={20} width={80} borderRadius={12} />
        </View>
        <SkeletonLoader height={20} width="25%" />
      </View>
      
      <View style={styles.orderDetails}>
        <View style={styles.orderDetailRow}>
          <SkeletonLoader height={14} width={14} borderRadius={7} style={{ marginRight: 6 }} />
          <SkeletonLoader height={14} width="30%" />
        </View>
        <View style={styles.orderDetailRow}>
          <SkeletonLoader height={14} width={14} borderRadius={7} style={{ marginRight: 6 }} />
          <SkeletonLoader height={14} width="25%" />
        </View>
        <View style={styles.orderDetailRow}>
          <SkeletonLoader height={14} width={14} borderRadius={7} style={{ marginRight: 6 }} />
          <SkeletonLoader height={14} width="20%" />
        </View>
      </View>
      
      <View style={styles.productsSection}>
        <SkeletonLoader height={12} width="20%" style={{ marginBottom: 4 }} />
        <SkeletonLoader height={14} width="80%" />
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
            Customer Orders
          </Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.content}>
          {/* Customer Info Skeleton */}
          <SkeletonCard style={styles.customerInfoCard}>
            <View style={styles.customerInfoHeader}>
              <SkeletonLoader height={48} width={48} borderRadius={24} style={{ marginRight: 12 }} />
              <View style={styles.customerInfoDetails}>
                <SkeletonLoader height={18} width="60%" style={{ marginBottom: 4 }} />
                <SkeletonLoader height={14} width="40%" style={{ marginBottom: 4 }} />
                <SkeletonLoader height={14} width="50%" />
              </View>
            </View>
          </SkeletonCard>

          {/* Stats Skeleton */}
          <View style={styles.statsContainer}>
            <SkeletonCard style={styles.statCard}>
              <View style={styles.statContent}>
                <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
                <View style={styles.statText}>
                  <SkeletonLoader height={18} width="40%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="60%" />
                </View>
              </View>
            </SkeletonCard>
            
            <SkeletonCard style={styles.statCard}>
              <View style={styles.statContent}>
                <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
                <View style={styles.statText}>
                  <SkeletonLoader height={18} width="40%" style={{ marginBottom: 4 }} />
                  <SkeletonLoader height={12} width="60%" />
                </View>
              </View>
            </SkeletonCard>
          </View>

          {/* Orders List Skeleton */}
          <View style={styles.ordersList}>
            {[1, 2, 3, 4, 5].map((index) => (
              <SkeletonOrderCard key={index} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (!customer) {
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
            Customer Orders
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <User size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text style={[styles.errorTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Customer Not Found
          </Text>
          <Text style={[styles.errorText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            The customer you're looking for doesn't exist or you don't have access to view their orders.
          </Text>
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
          Customer Orders
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
        {/* Customer Information */}
        <Card style={styles.customerInfoCard}>
          <View style={styles.customerInfoHeader}>
            <View style={[styles.customerAvatar, { backgroundColor: '#2563eb' }]}>
              <Text style={styles.customerAvatarText}>
                {customer.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerInfoDetails}>
              <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {customer.name}
              </Text>
              {customer.phone && (
                <View style={styles.customerDetailRow}>
                  <Phone size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <Text style={[styles.customerDetailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {customer.phone}
                  </Text>
                </View>
              )}
              {customer.platform && (
                <Text style={[styles.customerPlatform, { color: '#2563eb' }]}>
                  {customer.platform.charAt(0).toUpperCase() + customer.platform.slice(1).replace('_', ' ')}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Customer Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <ShoppingCart size={20} color="#2563eb" />
              <View style={styles.statText}>
                <Text style={[styles.statValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {totalOrders}
                </Text>
                <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Orders
                </Text>
              </View>
            </View>
          </Card>
          
          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <DollarSign size={20} color="#059669" />
              <View style={styles.statText}>
                <Text style={[styles.statValue, { color: '#059669' }]}>
                  {formatCurrency(totalSpent)}
                </Text>
                <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Spent
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Orders List */}
        <View style={styles.ordersList}>
          <Text style={[styles.ordersTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Order History ({orders.length})
          </Text>
          
          {orders.length > 0 ? (
            orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          ) : (
            <Card style={styles.emptyState}>
              <Receipt size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                No Orders Found
              </Text>
              <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                This customer hasn't made any orders yet
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
  customerInfoCard: {
    padding: 16,
    marginBottom: 16,
  },
  customerInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerInfoDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  customerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  customerDetailText: {
    fontSize: 14,
    marginLeft: 6,
  },
  customerPlatform: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 16,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  ordersList: {
    flex: 1,
  },
  ordersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  orderCard: {
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderDetailText: {
    fontSize: 12,
    marginLeft: 6,
  },
  productsSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  productsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  productsText: {
    fontSize: 14,
    lineHeight: 18,
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});