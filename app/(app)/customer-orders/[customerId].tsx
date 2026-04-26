import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  SectionList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { SkeletonCard, SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { ArrowLeft, User, Phone, ShoppingBag, DollarSign, Package, Calendar, ChevronRight, Receipt } from 'lucide-react-native';
import { supabase } from '@/src/config/supabase';
import { useCurrencyContext } from '@/src/context/CurrencyContext';

interface RawOrder {
  id: string;
  total_amount: number;
  current_total_amount: number | null;
  returned_amount: number | null;
  payment_method: string;
  sale_date: string;
  status: string;
  carts: {
    cart_items: Array<{
      quantity: number;
      unit_price: number;
      products: { name: string; cost_per_unit: number | null } | null;
    }>;
  } | null;
}

interface ProcessedOrder {
  id: string;
  displayAmount: number;
  returned_amount: number;
  payment_method: string;
  sale_date: string;
  status: string;
  itemsCount: number;
  productNames: string[];
  profit: number;
}

interface DateGroup {
  date: string;          // yyyy-MM-dd
  displayDate: string;   // human-readable
  orders: ProcessedOrder[];
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  totalProfit: number;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  platform?: string;
}

function formatDateKey(dateString: string): string {
  return dateString.slice(0, 10); // yyyy-MM-dd
}

function formatDisplayDate(dateKey: string): string {
  const date = new Date(dateKey + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateKey === formatDateKey(today.toISOString())) return 'Today';
  if (dateKey === formatDateKey(yesterday.toISOString())) return 'Yesterday';

  return date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return '#059669';
    case 'voided': return '#dc2626';
    case 'refunded': return '#ea580c';
    case 'partially_returned': return '#f59e0b';
    default: return '#6b7280';
  }
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

export default function CustomerOrdersScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { formatPrice } = useCurrencyContext();

  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [orders, setOrders] = useState<ProcessedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!customerId || !currentBusiness?.id) return;
    if (!isRefresh) setLoading(true);

    try {
      const [{ data: customerData, error: customerError }, { data: salesData, error: salesError }] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, phone, address, platform')
          .eq('id', customerId)
          .eq('business_id', currentBusiness.id)
          .maybeSingle(),
        supabase
          .from('sales')
          .select(`
            id,
            total_amount,
            current_total_amount,
            returned_amount,
            payment_method,
            sale_date,
            status,
            carts(
              cart_items(
                quantity,
                unit_price,
                products(name, cost_per_unit)
              )
            )
          `)
          .eq('customer_id', customerId)
          .eq('business_id', currentBusiness.id)
          .not('status', 'eq', 'voided')
          .order('sale_date', { ascending: false }),
      ]);

      if (customerError) throw customerError;
      if (salesError) throw salesError;

      setCustomer(customerData);

      const processed: ProcessedOrder[] = (salesData as RawOrder[] ?? []).map(sale => {
        const items = sale.carts?.cart_items ?? [];
        const itemsCount = items.reduce((s, i) => s + (i.quantity || 0), 0);
        const productNames = items.map(i => i.products?.name ?? 'Unknown');
        const returned = sale.returned_amount ?? 0;
        const displayAmount = sale.current_total_amount ?? sale.total_amount ?? 0;
        const profit = items.reduce((s, i) => {
          const cost = i.products?.cost_per_unit ?? 0;
          return s + (i.unit_price - cost) * i.quantity;
        }, 0);

        return {
          id: sale.id,
          displayAmount,
          returned_amount: returned,
          payment_method: sale.payment_method,
          sale_date: sale.sale_date,
          status: sale.status,
          itemsCount,
          productNames,
          profit,
        };
      });

      setOrders(processed);
    } catch (error) {
      console.error('Error loading customer orders:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [customerId, currentBusiness?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Group orders by date, newest first
  const sections: DateGroup[] = useMemo(() => {
    const map: Record<string, ProcessedOrder[]> = {};
    for (const order of orders) {
      const key = formatDateKey(order.sale_date);
      if (!map[key]) map[key] = [];
      map[key].push(order);
    }

    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const groupOrders = map[dateKey];
        const totalProducts = groupOrders.reduce((s, o) => s + o.itemsCount, 0);
        const totalRevenue = groupOrders.reduce((s, o) => s + o.displayAmount, 0);
        const totalProfit = groupOrders.reduce((s, o) => s + o.profit, 0);
        return {
          date: dateKey,
          displayDate: formatDisplayDate(dateKey),
          orders: groupOrders,
          totalOrders: groupOrders.length,
          totalProducts,
          totalRevenue,
          totalProfit,
        };
      });
  }, [orders]);

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((s, o) => s + o.displayAmount, 0);

  // --- Sub-components ---

  const OrderRow = ({ order }: { order: ProcessedOrder }) => (
    <TouchableOpacity
      style={[styles.orderRow, { borderBottomColor: isDark ? '#374151' : '#f3f4f6' }]}
      onPress={() => router.push(`/sales/details/${order.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.orderRowLeft}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
        <View style={styles.orderRowInfo}>
          <Text style={[styles.orderId, { color: isDark ? '#f9fafb' : '#111827' }]}>
            #{order.id.slice(-8).toUpperCase()}
          </Text>
          <Text style={[styles.orderMeta, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            {order.itemsCount} {order.itemsCount === 1 ? 'item' : 'items'}
            {' · '}
            <Text style={[styles.statusLabel, { color: getStatusColor(order.status) }]}>
              {formatStatus(order.status)}
            </Text>
          </Text>
          {order.productNames.length > 0 && (
            <Text style={[styles.productNames, { color: isDark ? '#d1d5db' : '#6b7280' }]} numberOfLines={1}>
              {order.productNames.slice(0, 3).join(', ')}
              {order.productNames.length > 3 ? ` +${order.productNames.length - 3}` : ''}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.orderRowRight}>
        <Text style={[styles.orderAmount, { color: '#059669' }]}>
          {formatPrice(order.displayAmount)}
        </Text>
        {order.returned_amount > 0 && (
          <Text style={styles.returnedNote}>
            -{formatPrice(order.returned_amount)} returned
          </Text>
        )}
        <ChevronRight size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
      </View>
    </TouchableOpacity>
  );

  const GroupHeader = ({ group }: { group: DateGroup }) => (
    <View style={[styles.groupHeader, { backgroundColor: isDark ? '#1f2937' : '#f9fafb' }]}>
      <View style={styles.groupHeaderTop}>
        <Calendar size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
        <Text style={[styles.groupDate, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {group.displayDate}
        </Text>
      </View>
      <View style={[styles.groupPills, { borderColor: isDark ? '#374151' : '#e5e7eb' }]}>
        <View style={styles.groupPill}>
          <Text style={[styles.groupPillValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {group.totalOrders}
          </Text>
          <Text style={[styles.groupPillLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Orders</Text>
        </View>
        <View style={[styles.groupPillDivider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
        <View style={styles.groupPill}>
          <Text style={[styles.groupPillValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {group.totalProducts}
          </Text>
          <Text style={[styles.groupPillLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Products</Text>
        </View>
        <View style={[styles.groupPillDivider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
        <View style={styles.groupPill}>
          <Text style={[styles.groupPillValue, { color: '#059669' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatPrice(group.totalRevenue)}
          </Text>
          <Text style={[styles.groupPillLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Revenue</Text>
        </View>
        <View style={[styles.groupPillDivider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
        <View style={styles.groupPill}>
          <Text style={[styles.groupPillValue, { color: group.totalProfit >= 0 ? '#2563eb' : '#dc2626' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatPrice(group.totalProfit)}
          </Text>
          <Text style={[styles.groupPillLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Profit</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>Orders</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonCard style={{ padding: 16 }}>
            <SkeletonLoader height={48} width={48} borderRadius={24} />
          </SkeletonCard>
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} style={{ padding: 16 }}>
              <SkeletonLoader height={16} width="60%" style={{ marginBottom: 8 }} />
              <SkeletonLoader height={12} width="40%" />
            </SkeletonCard>
          ))}
        </View>
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>Orders</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <User size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
          <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>Customer not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
          {customer.name}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <SectionList
        sections={sections.map(g => ({ ...g, data: g.orders }))}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            {/* Customer Info */}
            <Card style={styles.customerCard}>
              <View style={styles.customerRow}>
                <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
                  <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.customerInfo}>
                  <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {customer.name}
                  </Text>
                  {customer.phone && (
                    <View style={styles.infoRow}>
                      <Phone size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
                      <Text style={[styles.infoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        {customer.phone}
                      </Text>
                    </View>
                  )}
                  {customer.platform && (
                    <Text style={[styles.platform, { color: '#2563eb' }]}>
                      {customer.platform.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Text>
                  )}
                </View>
              </View>
            </Card>

            {/* Stats */}
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <View style={styles.statContent}>
                  <View style={[styles.statIcon, { backgroundColor: '#eff6ff' }]}>
                    <ShoppingBag size={18} color="#2563eb" />
                  </View>
                  <Text style={[styles.statValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {totalOrders}
                  </Text>
                  <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                    Orders
                  </Text>
                </View>
              </Card>
              <Card style={styles.statCard}>
                <View style={styles.statContent}>
                  <View style={[styles.statIcon, { backgroundColor: '#f0fdf4' }]}>
                    <DollarSign size={18} color="#059669" />
                  </View>
                  <Text style={[styles.statValue, { color: '#059669' }]}>
                    {formatPrice(totalSpent)}
                  </Text>
                  <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                    Total Spent
                  </Text>
                </View>
              </Card>
            </View>

            {orders.length > 0 && (
              <Text style={[styles.sectionHeading, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Order History
              </Text>
            )}
          </View>
        )}
        renderSectionHeader={({ section }) => <GroupHeader group={section as unknown as DateGroup} />}
        renderItem={({ item }) => (
          <Card style={[styles.groupCard, { marginHorizontal: 16 }]}>
            <OrderRow order={item} />
          </Card>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={() => (
          <Card style={styles.emptyCard}>
            <Receipt size={40} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>No orders yet</Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              This customer hasn't made any orders
            </Text>
          </Card>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: { padding: 8 },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerRight: { width: 40 },
  listContent: { paddingBottom: 32 },
  listHeader: { padding: 16, gap: 12 },
  customerCard: { padding: 16 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  infoText: { fontSize: 13 },
  platform: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, padding: 16 },
  statContent: { alignItems: 'center', gap: 6 },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 12 },
  sectionHeading: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  groupHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    marginTop: 4,
    gap: 8,
  },
  groupHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupDate: { fontSize: 13, fontWeight: '700' },
  groupPills: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  groupPillDivider: { width: 1 },
  groupPillValue: { fontSize: 13, fontWeight: '700' },
  groupPillLabel: { fontSize: 10, marginTop: 1 },
  groupCard: { marginBottom: 0, padding: 0, overflow: 'hidden' },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  orderRowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  orderRowInfo: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  orderMeta: { fontSize: 12, marginBottom: 2 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  productNames: { fontSize: 12, marginTop: 1 },
  orderRowRight: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  orderAmount: { fontSize: 15, fontWeight: '700' },
  returnedNote: { fontSize: 10, color: '#dc2626', fontStyle: 'italic' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyCard: { margin: 16, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});
