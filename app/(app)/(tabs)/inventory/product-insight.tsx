import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  TriangleAlert as AlertTriangle,
  Archive,
  DollarSign,
  BarChart3,
  Sparkles,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react-native';
import { supabase } from '@/src/config/supabase';

interface InsightData {
  totalProducts: number;
  totalActiveProducts: number;
  totalArchivedProducts: number;
  totalStockValue: number;
  totalUnitsInStock: number;
  outOfStockCount: number;
  lowStockCount: number;
  inStockCount: number;
  topSellingProducts: { id: string; name: string; totalQty: number; totalRevenue: number }[];
  slowMovingProducts: { id: string; name: string; totalQty: number; current_stock: number }[];
  highestValueProducts: { id: string; name: string; price: number; current_stock: number; value: number }[];
  avgSellingPrice: number;
  categoryCounts: { category: string; count: number }[];
}

export default function ProductInsightScreen() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  const loadInsights = useCallback(async () => {
    if (!currentBusiness?.id) return;

    try {
      const [productsRes, saleItemsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, price, current_stock, low_stock_threshold, is_archived')
          .eq('business_id', currentBusiness.id),
        supabase
          .from('sale_items')
          .select('product_id, quantity, unit_price, products!inner(name, business_id)')
          .eq('products.business_id', currentBusiness.id),
      ]);

      const products = productsRes.data || [];
      const saleItems = saleItemsRes.data || [];

      const active = products.filter((p) => !p.is_archived);
      const archived = products.filter((p) => p.is_archived);

      const outOfStock = active.filter((p) => p.current_stock <= 0);
      const lowStock = active.filter(
        (p) => p.current_stock > 0 && p.current_stock <= (p.low_stock_threshold || 10)
      );
      const inStock = active.filter(
        (p) => p.current_stock > (p.low_stock_threshold || 10)
      );

      const totalUnitsInStock = active.reduce((s, p) => s + (p.current_stock || 0), 0);
      const totalStockValue = active.reduce((s, p) => s + (p.current_stock || 0) * (p.price || 0), 0);
      const avgSellingPrice =
        active.length > 0 ? active.reduce((s, p) => s + (p.price || 0), 0) / active.length : 0;

      const salesByProduct: Record<string, { name: string; totalQty: number; totalRevenue: number }> = {};
      saleItems.forEach((si: any) => {
        const pid = si.product_id;
        if (!pid) return;
        if (!salesByProduct[pid]) {
          salesByProduct[pid] = { name: si.products?.name || 'Unknown', totalQty: 0, totalRevenue: 0 };
        }
        salesByProduct[pid].totalQty += si.quantity || 0;
        salesByProduct[pid].totalRevenue += (si.quantity || 0) * (si.unit_price || 0);
      });

      const topSelling = Object.entries(salesByProduct)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 5);

      const productSalesQtyMap: Record<string, number> = {};
      Object.entries(salesByProduct).forEach(([id, v]) => {
        productSalesQtyMap[id] = v.totalQty;
      });

      const slowMoving = active
        .filter((p) => p.current_stock > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          totalQty: productSalesQtyMap[p.id] || 0,
          current_stock: p.current_stock,
        }))
        .sort((a, b) => a.totalQty - b.totalQty)
        .slice(0, 5);

      const highestValue = active
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price || 0,
          current_stock: p.current_stock || 0,
          value: (p.current_stock || 0) * (p.price || 0),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      setData({
        totalProducts: products.length,
        totalActiveProducts: active.length,
        totalArchivedProducts: archived.length,
        totalStockValue,
        totalUnitsInStock,
        outOfStockCount: outOfStock.length,
        lowStockCount: lowStock.length,
        inStockCount: inStock.length,
        topSellingProducts: topSelling,
        slowMovingProducts: slowMoving,
        highestValueProducts: highestValue,
        avgSellingPrice,
        categoryCounts: [],
      });
    } catch (e) {
      console.error('Error loading product insights:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentBusiness?.id]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadInsights();
  }, [loadInsights]);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    card: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    muted: isDark ? '#374151' : '#f3f4f6',
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Product Insight</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Analyzing your inventory...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Animated.View
            style={{
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
              marginRight: 6,
            }}
          >
            <Sparkles size={20} color="#2563eb" />
          </Animated.View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Product Insight</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} tintColor="#2563eb" />
        }
      >
        {/* Overview Section */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Overview</Text>
        <View style={styles.statGrid}>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Package size={22} color="#2563eb" />
            <Text style={[styles.statValue, { color: colors.text }]}>{data?.totalActiveProducts ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Active Products</Text>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Layers size={22} color="#7c3aed" />
            <Text style={[styles.statValue, { color: colors.text }]}>{data?.totalUnitsInStock ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Units in Stock</Text>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <DollarSign size={22} color="#059669" />
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              ${(data?.totalStockValue ?? 0).toFixed(0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Stock Value</Text>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <BarChart3 size={22} color="#ea580c" />
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              ${(data?.avgSellingPrice ?? 0).toFixed(2)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Avg Price</Text>
          </Card>
        </View>

        {/* Stock Health */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Stock Health</Text>
        <Card style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.healthRow}>
            <View style={styles.healthItem}>
              <CheckCircle2 size={20} color="#059669" />
              <Text style={[styles.healthValue, { color: colors.text }]}>{data?.inStockCount ?? 0}</Text>
              <Text style={[styles.healthLabel, { color: colors.subtext }]}>Healthy</Text>
            </View>
            <View style={[styles.healthDivider, { backgroundColor: colors.border }]} />
            <View style={styles.healthItem}>
              <AlertTriangle size={20} color="#f59e0b" />
              <Text style={[styles.healthValue, { color: colors.text }]}>{data?.lowStockCount ?? 0}</Text>
              <Text style={[styles.healthLabel, { color: colors.subtext }]}>Low Stock</Text>
            </View>
            <View style={[styles.healthDivider, { backgroundColor: colors.border }]} />
            <View style={styles.healthItem}>
              <XCircle size={20} color="#dc2626" />
              <Text style={[styles.healthValue, { color: colors.text }]}>{data?.outOfStockCount ?? 0}</Text>
              <Text style={[styles.healthLabel, { color: colors.subtext }]}>Out of Stock</Text>
            </View>
            <View style={[styles.healthDivider, { backgroundColor: colors.border }]} />
            <View style={styles.healthItem}>
              <Archive size={20} color="#6b7280" />
              <Text style={[styles.healthValue, { color: colors.text }]}>{data?.totalArchivedProducts ?? 0}</Text>
              <Text style={[styles.healthLabel, { color: colors.subtext }]}>Archived</Text>
            </View>
          </View>

          {(data?.totalActiveProducts ?? 0) > 0 && (
            <View style={styles.stockBarContainer}>
              <View style={styles.stockBar}>
                <View
                  style={[
                    styles.stockBarSegment,
                    {
                      flex: (data?.inStockCount ?? 0) / (data?.totalActiveProducts ?? 1),
                      backgroundColor: '#059669',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.stockBarSegment,
                    {
                      flex: (data?.lowStockCount ?? 0) / (data?.totalActiveProducts ?? 1),
                      backgroundColor: '#f59e0b',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.stockBarSegment,
                    {
                      flex: (data?.outOfStockCount ?? 0) / (data?.totalActiveProducts ?? 1),
                      backgroundColor: '#dc2626',
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Top Selling Products */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Top Selling Products</Text>
        <Card style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(data?.topSellingProducts ?? []).length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No sales data yet</Text>
          ) : (
            (data?.topSellingProducts ?? []).map((p, i) => (
              <View key={p.id}>
                <View style={styles.rankRow}>
                  <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#2563eb' : colors.muted }]}>
                    <Text style={[styles.rankText, { color: i === 0 ? '#ffffff' : colors.subtext }]}>#{i + 1}</Text>
                  </View>
                  <View style={styles.rankInfo}>
                    <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.rankSub, { color: colors.subtext }]}>{p.totalQty} units sold</Text>
                  </View>
                  <Text style={[styles.rankRevenue, { color: '#059669' }]}>${p.totalRevenue.toFixed(2)}</Text>
                </View>
                {i < (data?.topSellingProducts ?? []).length - 1 && (
                  <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))
          )}
        </Card>

        {/* Highest Stock Value Products */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Highest Stock Value</Text>
        <Card style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(data?.highestValueProducts ?? []).length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No products found</Text>
          ) : (
            (data?.highestValueProducts ?? []).map((p, i) => (
              <View key={p.id}>
                <View style={styles.rankRow}>
                  <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#059669' : colors.muted }]}>
                    <Text style={[styles.rankText, { color: i === 0 ? '#ffffff' : colors.subtext }]}>#{i + 1}</Text>
                  </View>
                  <View style={styles.rankInfo}>
                    <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.rankSub, { color: colors.subtext }]}>{p.current_stock} units @ ${p.price.toFixed(2)}</Text>
                  </View>
                  <Text style={[styles.rankRevenue, { color: '#059669' }]}>${p.value.toFixed(2)}</Text>
                </View>
                {i < (data?.highestValueProducts ?? []).length - 1 && (
                  <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))
          )}
        </Card>

        {/* Slow Moving Products */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Slow Moving / Unsold Products</Text>
        <Card style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(data?.slowMovingProducts ?? []).length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No data available</Text>
          ) : (
            (data?.slowMovingProducts ?? []).map((p, i) => (
              <View key={p.id}>
                <View style={styles.rankRow}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.muted }]}>
                    <TrendingDown size={14} color="#ea580c" />
                  </View>
                  <View style={styles.rankInfo}>
                    <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.rankSub, { color: colors.subtext }]}>{p.current_stock} in stock</Text>
                  </View>
                  <Text style={[styles.rankRevenue, { color: p.totalQty === 0 ? '#dc2626' : '#ea580c' }]}>
                    {p.totalQty === 0 ? 'Never sold' : `${p.totalQty} sold`}
                  </Text>
                </View>
                {i < (data?.slowMovingProducts ?? []).length - 1 && (
                  <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))
          )}
        </Card>

        <View style={{ height: 40 }} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  statCard: {
    width: '47.5%',
    padding: 16,
    alignItems: 'flex-start',
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  healthCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  healthValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  healthLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  healthDivider: {
    width: 1,
    height: 40,
  },
  stockBarContainer: {
    marginTop: 4,
  },
  stockBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  stockBarSegment: {
    height: 6,
  },
  listCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '600',
  },
  rankSub: {
    fontSize: 12,
    marginTop: 1,
  },
  rankRevenue: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 20,
  },
});
