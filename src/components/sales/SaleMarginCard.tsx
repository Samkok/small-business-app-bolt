import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { SaleMargin } from '@/src/utils/saleMargin';

interface SaleMarginCardProps {
  margin: SaleMargin;
  formatAmount: (amount: number) => string;
}

/**
 * What the business will make on the sale being built, after discounts and the
 * courier fee. Shown in Quick Checkout, the cart and the checkout confirmation,
 * all fed by computeSaleMargin so the three always agree.
 */
export function SaleMarginCard({ margin, formatAmount }: SaleMarginCardProps) {
  const { isDark } = useTheme();
  if (!margin.hasItems) return null;

  const tone = margin.isLoss ? '#dc2626' : margin.marginPct < 10 ? '#d97706' : '#059669';
  const Icon = margin.isLoss ? TrendingDown : TrendingUp;
  const colors = {
    bg: isDark ? '#1f2937' : '#f9fafb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };
  const gaveSomethingUp = margin.discounts > 0 || margin.deliveryCost > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderColor: `${tone}55` }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Icon size={18} color={tone} />
          <Text style={[styles.title, { color: colors.text }]}>Profit on this sale</Text>
        </View>
        <View style={[styles.marginPill, { backgroundColor: `${tone}18` }]}>
          <Text style={[styles.marginPillText, { color: tone }]}>{margin.marginPct.toFixed(1)}% margin</Text>
        </View>
      </View>

      {/* Every deduction gets its own line, so the card can be checked top to bottom:
          full price − discounts − cost of goods − delivery fee = profit */}
      {margin.discounts > 0 ? (
        <>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.subtext }]}>Items at full price</Text>
            <Text style={[styles.value, { color: colors.text }]}>{formatAmount(margin.itemsOriginalTotal)}</Text>
          </View>
          {margin.itemDiscounts > 0 && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.subtext }]}>Item discounts</Text>
              <Text style={[styles.value, { color: colors.text }]}>-{formatAmount(margin.itemDiscounts)}</Text>
            </View>
          )}
          {margin.cartDiscount > 0 && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.subtext }]}>Order discount</Text>
              <Text style={[styles.value, { color: colors.text }]}>-{formatAmount(margin.cartDiscount)}</Text>
            </View>
          )}
          <View style={[styles.row, styles.subtotalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.label, styles.subtotalText, { color: colors.text }]}>Customer pays</Text>
            <Text style={[styles.value, styles.subtotalText, { color: colors.text }]}>{formatAmount(margin.customerPays)}</Text>
          </View>
        </>
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.subtext }]}>Customer pays</Text>
          <Text style={[styles.value, { color: colors.text }]}>{formatAmount(margin.customerPays)}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.subtext }]}>Cost of goods</Text>
        <Text style={[styles.value, { color: colors.text }]}>-{formatAmount(margin.cogs)}</Text>
      </View>
      {margin.deliveryCost > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.subtext }]}>Delivery fee you pay</Text>
          <Text style={[styles.value, { color: colors.text }]}>-{formatAmount(margin.deliveryCost)}</Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.row}>
        <Text style={[styles.profitLabel, { color: colors.text }]}>{margin.isLoss ? 'Loss' : 'Profit'}</Text>
        <Text style={[styles.profitValue, { color: tone }]}>{formatAmount(margin.profit)}</Text>
      </View>

      {gaveSomethingUp && margin.marginPointsLost > 0.05 && (
        <Text style={[styles.hint, { color: colors.subtext }]}>
          At full price with no delivery fee this would be {margin.fullPriceMarginPct.toFixed(1)}% ({formatAmount(margin.fullPriceProfit)}).
          {margin.discounts > 0 ? ` Discounts of ${formatAmount(margin.discounts)}` : ''}
          {margin.discounts > 0 && margin.deliveryCost > 0 ? ' and' : ''}
          {margin.deliveryCost > 0 ? ` the ${formatAmount(margin.deliveryCost)} delivery fee` : ''} cost you{' '}
          {margin.marginPointsLost.toFixed(1)} points.
        </Text>
      )}

      {margin.isLoss && (
        <View style={styles.warnRow}>
          <AlertTriangle size={14} color="#dc2626" />
          <Text style={[styles.warnText, { color: '#dc2626' }]}>This sale loses money at the current discount and delivery fee.</Text>
        </View>
      )}
      {margin.linesWithoutCost > 0 && (
        <View style={styles.warnRow}>
          <AlertTriangle size={14} color="#d97706" />
          <Text style={[styles.warnText, { color: '#d97706' }]}>
            {margin.linesWithoutCost} {margin.linesWithoutCost === 1 ? 'item has' : 'items have'} no cost recorded, so the real profit is lower than shown.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 8, borderWidth: 1, marginTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  marginPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  marginPillText: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subtotalRow: { borderTopWidth: 1, paddingTop: 8 },
  subtotalText: { fontWeight: '700' },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '500' },
  divider: { height: 1, marginVertical: 8 },
  profitLabel: { fontSize: 16, fontWeight: '700' },
  profitValue: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  warnText: { fontSize: 12, flex: 1, lineHeight: 16 },
});
