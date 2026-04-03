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
  Layers,
  DollarSign,
  BarChart3,
  Sparkles,
  CheckCircle2,
  TriangleAlert as AlertTriangle,
  XCircle,
  Archive,
  Settings2,
} from 'lucide-react-native';
import {
  productInsightService,
  InsightSummary,
  ProductCategory,
} from '@/src/services/productInsight';
import TimePeriodSelector from '@/src/components/inventory/TimePeriodSelector';
import InsightSettingsSheet from '@/src/components/inventory/InsightSettingsSheet';
import ProductCategorySection, {
  CATEGORY_CONFIG,
} from '@/src/components/inventory/ProductCategorySection';

interface SettingsState {
  lookback_days: number;
  use_custom_range: boolean;
  custom_start_date?: string;
  custom_end_date?: string;
  hot_selling_min_units_per_day: number;
  slow_selling_max_units_per_day: number;
  reorder_warning_days: number;
  overstock_days_threshold: number;
  default_low_stock_level: number;
}

const ACTION_CATEGORIES: ProductCategory[] = ['out_of_stock', 'must_order'];
const INFO_CATEGORIES: ProductCategory[] = ['hot_selling', 'do_not_order', 'slow_moving', 'healthy'];

export default function ProductInsightScreen() {
  const [data, setData] = useState<InsightSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(() => {
    const defaults = productInsightService.getDefaultSettings();
    return {
      lookback_days: defaults.lookback_days,
      use_custom_range: defaults.use_custom_range,
      custom_start_date: defaults.custom_start_date,
      custom_end_date: defaults.custom_end_date,
      hot_selling_min_units_per_day: defaults.hot_selling_min_units_per_day,
      slow_selling_max_units_per_day: defaults.slow_selling_max_units_per_day,
      reorder_warning_days: defaults.reorder_warning_days,
      overstock_days_threshold: defaults.overstock_days_threshold,
      default_low_stock_level: defaults.default_low_stock_level,
    };
  });

  const router = useRouter();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  const loadInsights = useCallback(
    async (currentSettings: SettingsState) => {
      if (!currentBusiness?.id) return;
      try {
        const { startDate, endDate, lookbackDays } = productInsightService.getDateRange(currentSettings);
        const { products, salesByProduct } = await productInsightService.fetchProductsAndSales(
          currentBusiness.id,
          startDate,
          endDate
        );
        const summary = productInsightService.classifyProducts(
          products,
          salesByProduct,
          currentSettings,
          lookbackDays
        );
        setData(summary);
      } catch (e) {
        console.error('Error loading product insights:', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentBusiness?.id]
  );

  useEffect(() => {
    const init = async () => {
      if (!currentBusiness?.id) {
        setLoading(false);
        return;
      }
      let resolvedSettings = settings;
      try {
        const saved = await productInsightService.getSettings(currentBusiness.id);
        if (saved) {
          resolvedSettings = {
            lookback_days: saved.lookback_days,
            use_custom_range: saved.use_custom_range,
            custom_start_date: saved.custom_start_date,
            custom_end_date: saved.custom_end_date,
            hot_selling_min_units_per_day: saved.hot_selling_min_units_per_day,
            slow_selling_max_units_per_day: saved.slow_selling_max_units_per_day,
            reorder_warning_days: saved.reorder_warning_days,
            overstock_days_threshold: saved.overstock_days_threshold,
            default_low_stock_level: saved.default_low_stock_level,
          };
          setSettings(resolvedSettings);
        }
      } catch (e) {
        console.error('Failed to load insight settings:', e);
      }
      await loadInsights(resolvedSettings);
    };
    init();
  }, [currentBusiness?.id]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadInsights(settings);
  }, [loadInsights, settings]);

  const handlePresetSelect = useCallback(
    async (days: number) => {
      const updated = { ...settings, lookback_days: days, use_custom_range: false };
      setSettings(updated);
      if (currentBusiness?.id) {
        try {
          await productInsightService.upsertSettings(currentBusiness.id, {
            lookback_days: days,
            use_custom_range: false,
          });
        } catch (e) {
          console.error('Failed to save period:', e);
        }
      }
    },
    [settings, currentBusiness?.id]
  );

  const handleCustomRange = useCallback(
    async (start: Date, end: Date) => {
      const updated = {
        ...settings,
        use_custom_range: true,
        custom_start_date: start.toISOString(),
        custom_end_date: end.toISOString(),
      };
      setSettings(updated);
      if (currentBusiness?.id) {
        try {
          await productInsightService.upsertSettings(currentBusiness.id, {
            use_custom_range: true,
            custom_start_date: start.toISOString(),
            custom_end_date: end.toISOString(),
          });
        } catch (e) {
          console.error('Failed to save custom range:', e);
        }
      }
    },
    [settings, currentBusiness?.id]
  );

  const handleSettingsApply = useCallback(
    async (vals: {
      hot_selling_min_units_per_day: number;
      slow_selling_max_units_per_day: number;
      reorder_warning_days: number;
      overstock_days_threshold: number;
      default_low_stock_level: number;
    }) => {
      setSavingSettings(true);
      try {
        const updated = { ...settings, ...vals };
        setSettings(updated);
        if (currentBusiness?.id) {
          await productInsightService.upsertSettings(currentBusiness.id, vals);
        }
        setSettingsVisible(false);
      } catch (e) {
        console.error('Failed to save settings:', e);
      } finally {
        setSavingSettings(false);
      }
    },
    [settings, currentBusiness?.id]
  );

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    card: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    muted: isDark ? '#374151' : '#f3f4f6',
  };

  const actionProducts = data
    ? data.classifiedProducts.filter((p) => ACTION_CATEGORIES.includes(p.category))
    : [];
  const hasActionItems = actionProducts.length > 0;

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
              transform: [
                { scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) },
              ],
              marginRight: 6,
            }}
          >
            <Sparkles size={20} color="#2563eb" />
          </Animated.View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Product Insight</Text>
        </View>
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.settingsBtn}>
          <Settings2 size={22} color={colors.subtext} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        <TimePeriodSelector
          selectedDays={settings.lookback_days}
          useCustomRange={settings.use_custom_range}
          customStartDate={
            settings.custom_start_date ? new Date(settings.custom_start_date) : undefined
          }
          customEndDate={settings.custom_end_date ? new Date(settings.custom_end_date) : undefined}
          onSelectPreset={handlePresetSelect}
          onSelectCustomRange={handleCustomRange}
        />

        {data?.periodLabel && (
          <Text style={[styles.periodLabel, { color: colors.subtext }]}>
            Based on sales from {data.periodLabel}
          </Text>
        )}

        {/* Overview */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Overview</Text>
        <View style={styles.statGrid}>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Package size={22} color="#2563eb" />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {data?.totalActiveProducts ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Active Products</Text>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Layers size={22} color="#0891b2" />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {data?.totalUnitsInStock ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Units in Stock</Text>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <DollarSign size={22} color="#059669" />
            <Text
              style={[styles.statValue, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              ${(data?.totalStockValue ?? 0).toFixed(0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Stock Value</Text>
          </Card>
          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <BarChart3 size={22} color="#ea580c" />
            <Text
              style={[styles.statValue, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              ${(data?.avgSellingPrice ?? 0).toFixed(2)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Avg Price</Text>
          </Card>
        </View>

        {/* Stock Health */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Stock Health</Text>
        <Card
          style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.healthRow}>
            <View style={styles.healthItem}>
              <CheckCircle2 size={20} color="#059669" />
              <Text style={[styles.healthValue, { color: colors.text }]}>
                {data?.inStockCount ?? 0}
              </Text>
              <Text style={[styles.healthLabel, { color: colors.subtext }]}>Healthy</Text>
            </View>
            <View style={[styles.healthDivider, { backgroundColor: colors.border }]} />
            <View style={styles.healthItem}>
              <AlertTriangle size={20} color="#f59e0b" />
              <Text style={[styles.healthValue, { color: colors.text }]}>
                {data?.lowStockCount ?? 0}
              </Text>
              <Text style={[styles.healthLabel, { color: colors.subtext }]}>Low Stock</Text>
            </View>
            <View style={[styles.healthDivider, { backgroundColor: colors.border }]} />
            <View style={styles.healthItem}>
              <XCircle size={20} color="#dc2626" />
              <Text style={[styles.healthValue, { color: colors.text }]}>
                {data?.outOfStockCount ?? 0}
              </Text>
              <Text style={[styles.healthLabel, { color: colors.subtext }]}>Out of Stock</Text>
            </View>
            <View style={[styles.healthDivider, { backgroundColor: colors.border }]} />
            <View style={styles.healthItem}>
              <Archive size={20} color="#6b7280" />
              <Text style={[styles.healthValue, { color: colors.text }]}>
                {data?.totalArchivedProducts ?? 0}
              </Text>
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

        {/* Category Summary Badges */}
        {data && (
          <View style={styles.categoryBadgeRow}>
            {(Object.keys(data.categoryCounts) as ProductCategory[]).map((cat) => {
              const count = data.categoryCounts[cat];
              if (count === 0) return null;
              const config = CATEGORY_CONFIG[cat];
              return (
                <View
                  key={cat}
                  style={[styles.categoryBadge, { backgroundColor: `${config.color}12` }]}
                >
                  <Text style={[styles.categoryBadgeText, { color: config.color }]}>
                    {count} {config.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Action Required Section */}
        {hasActionItems ? (
          <>
            {ACTION_CATEGORIES.map((cat) => {
              const products = data!.classifiedProducts.filter((p) => p.category === cat);
              if (products.length === 0) return null;
              return (
                <ProductCategorySection key={cat} category={cat} products={products} />
              );
            })}
          </>
        ) : (
          data &&
          data.totalActiveProducts > 0 && (
            <Card
              style={[
                styles.allGoodCard,
                { backgroundColor: colors.card, borderColor: '#05966920' },
              ]}
            >
              <CheckCircle2 size={24} color="#059669" />
              <Text style={[styles.allGoodTitle, { color: colors.text }]}>All stocked up!</Text>
              <Text style={[styles.allGoodSub, { color: colors.subtext }]}>
                No products require immediate attention
              </Text>
            </Card>
          )
        )}

        {/* Info Categories */}
        {INFO_CATEGORIES.map((cat) => {
          const products = data?.classifiedProducts.filter((p) => p.category === cat) || [];
          if (products.length === 0) return null;
          return <ProductCategorySection key={cat} category={cat} products={products} />;
        })}

        {/* Highest Stock Value */}
        {(data?.highestValueProducts ?? []).length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.subtext, marginTop: 20 }]}>
              Highest Stock Value
            </Text>
            <Card
              style={[
                styles.listCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {(data?.highestValueProducts ?? []).map((p, i) => (
                <View key={p.id}>
                  <View style={styles.rankRow}>
                    <View
                      style={[
                        styles.rankBadge,
                        { backgroundColor: i === 0 ? '#059669' : colors.muted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rankText,
                          { color: i === 0 ? '#ffffff' : colors.subtext },
                        ]}
                      >
                        #{i + 1}
                      </Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[styles.rankSub, { color: colors.subtext }]}>
                        {p.currentStock} units @ ${p.price.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={[styles.rankRevenue, { color: '#059669' }]}>
                      ${p.value.toFixed(2)}
                    </Text>
                  </View>
                  {i < (data?.highestValueProducts ?? []).length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <InsightSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        currentSettings={{
          hot_selling_min_units_per_day: settings.hot_selling_min_units_per_day,
          slow_selling_max_units_per_day: settings.slow_selling_max_units_per_day,
          reorder_warning_days: settings.reorder_warning_days,
          overstock_days_threshold: settings.overstock_days_threshold,
          default_low_stock_level: settings.default_low_stock_level,
        }}
        onApply={handleSettingsApply}
        saving={savingSettings}
      />
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
  settingsBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  periodLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
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
  categoryBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  allGoodCard: {
    marginTop: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  allGoodTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  allGoodSub: {
    fontSize: 13,
    textAlign: 'center',
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
});
