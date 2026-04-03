import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  XCircle,
  AlertTriangle,
  TrendingUp,
  PackageX,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { ClassifiedProduct, ProductCategory } from '@/src/services/productInsight';

interface ProductCategorySectionProps {
  category: ProductCategory;
  products: ClassifiedProduct[];
}

const CATEGORY_CONFIG: Record<
  ProductCategory,
  { label: string; color: string; icon: any; emptyMessage: string }
> = {
  out_of_stock: {
    label: 'Out of Stock',
    color: '#dc2626',
    icon: XCircle,
    emptyMessage: 'No products are out of stock',
  },
  must_order: {
    label: 'Should Order',
    color: '#ea580c',
    icon: AlertTriangle,
    emptyMessage: 'No urgent reorders needed',
  },
  hot_selling: {
    label: 'Hot Selling',
    color: '#059669',
    icon: TrendingUp,
    emptyMessage: 'No hot sellers in this period',
  },
  do_not_order: {
    label: 'No Need to Order',
    color: '#2563eb',
    icon: PackageX,
    emptyMessage: 'No overstocked products',
  },
  slow_moving: {
    label: 'Slow Moving',
    color: '#6b7280',
    icon: TrendingDown,
    emptyMessage: 'No slow moving products',
  },
  healthy: {
    label: 'Healthy',
    color: '#059669',
    icon: CheckCircle2,
    emptyMessage: 'No healthy products',
  },
};

export { CATEGORY_CONFIG };

function formatRate(rate: number): string {
  if (rate >= 1) return `${rate.toFixed(1)}/day`;
  if (rate >= 1 / 7) return `${(rate * 7).toFixed(1)}/wk`;
  return `${(rate * 30).toFixed(1)}/mo`;
}

function formatDays(days: number | null): string {
  if (days === null) return 'N/A';
  if (days < 1) return '<1 day';
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

function getSubtext(product: ClassifiedProduct): string {
  switch (product.category) {
    case 'out_of_stock':
      if (product.dailySalesRate > 0) return `Was selling ${formatRate(product.dailySalesRate)}`;
      return 'No recent sales data';
    case 'must_order':
      return `Stock-out in ${formatDays(product.daysOfStockRemaining)}`;
    case 'hot_selling':
      return `${formatRate(product.dailySalesRate)} | ${formatDays(product.daysOfStockRemaining)} remaining`;
    case 'do_not_order':
      return `${formatDays(product.daysOfStockRemaining)} of stock remaining`;
    case 'slow_moving':
      if (product.totalUnitsSold === 0) return 'No sales in this period';
      return `${product.totalUnitsSold} sold | ${formatRate(product.dailySalesRate)}`;
    case 'healthy':
      return `${formatRate(product.dailySalesRate)} | ${formatDays(product.daysOfStockRemaining)} remaining`;
    default:
      return '';
  }
}

function getRightText(product: ClassifiedProduct): { text: string; color: string } {
  switch (product.category) {
    case 'out_of_stock':
      return { text: '0 units', color: '#dc2626' };
    case 'must_order':
      return { text: `${product.currentStock} left`, color: '#ea580c' };
    case 'hot_selling':
      return { text: `$${product.totalRevenue.toFixed(0)}`, color: '#059669' };
    case 'do_not_order':
      return { text: `${product.currentStock} units`, color: '#2563eb' };
    case 'slow_moving':
      return {
        text: product.totalUnitsSold === 0 ? 'Unsold' : `${product.totalUnitsSold} sold`,
        color: product.totalUnitsSold === 0 ? '#dc2626' : '#6b7280',
      };
    case 'healthy':
      return { text: `${product.currentStock} units`, color: '#059669' };
    default:
      return { text: '', color: '#6b7280' };
  }
}

export default function ProductCategorySection({ category, products }: ProductCategorySectionProps) {
  const { isDark } = useTheme();
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  const colors = {
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    muted: isDark ? '#374151' : '#f3f4f6',
  };

  const sorted = [...products].sort((a, b) => {
    if (category === 'hot_selling') return b.dailySalesRate - a.dailySalesRate;
    if (category === 'must_order') return (a.daysOfStockRemaining ?? 0) - (b.daysOfStockRemaining ?? 0);
    if (category === 'do_not_order') return (b.daysOfStockRemaining ?? 0) - (a.daysOfStockRemaining ?? 0);
    if (category === 'slow_moving') return a.totalUnitsSold - b.totalUnitsSold;
    return b.totalRevenue - a.totalRevenue;
  });

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${config.color}15` }]}>
          <Icon size={16} color={config.color} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{config.label}</Text>
        <View style={[styles.countBadge, { backgroundColor: `${config.color}15` }]}>
          <Text style={[styles.countText, { color: config.color }]}>{products.length}</Text>
        </View>
      </View>

      <Card style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {sorted.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>{config.emptyMessage}</Text>
        ) : (
          sorted.map((product, i) => {
            const right = getRightText(product);
            return (
              <View key={product.id}>
                <View style={styles.productRow}>
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={[styles.productSub, { color: colors.subtext }]}>
                      {getSubtext(product)}
                    </Text>
                  </View>
                  <Text style={[styles.rightText, { color: right.color }]}>{right.text}</Text>
                </View>
                {i < sorted.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            );
          })
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listCard: {
    padding: 4,
    borderWidth: 1,
    borderRadius: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
  },
  productSub: {
    fontSize: 12,
    marginTop: 2,
  },
  rightText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 16,
  },
});
