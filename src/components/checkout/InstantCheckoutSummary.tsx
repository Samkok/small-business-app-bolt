import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { InstantCheckoutSummary as SummaryType } from '@/src/context/InstantCheckoutContext';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface InstantCheckoutSummaryProps {
  summary: SummaryType;
  formatAmount?: (amount: number) => string;
}

export function InstantCheckoutSummary({ summary, formatAmount }: InstantCheckoutSummaryProps) {
  const { isDark } = useTheme();
  const fmt = formatAmount ?? formatCurrency;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1f2937' : '#f9fafb' }]}>
      <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
        Order Summary
      </Text>

      <View style={styles.row}>
        <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Items Total
        </Text>
        <Text style={[styles.value, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {fmt(summary.itemsOriginalTotal)}
        </Text>
      </View>

      {summary.itemsTotalDiscount > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: '#10b981' }]}>Item Discounts</Text>
          <Text style={[styles.value, { color: '#10b981' }]}>
            -{fmt(summary.itemsTotalDiscount)}
          </Text>
        </View>
      )}

      {summary.cartDiscountAmount > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: '#10b981' }]}>Order Discount</Text>
          <Text style={[styles.value, { color: '#10b981' }]}>
            -{fmt(summary.cartDiscountAmount)}
          </Text>
        </View>
      )}

      {summary.deliveryCost > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Delivery Fee
          </Text>
          <Text style={[styles.value, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {fmt(summary.deliveryCost)}
          </Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />

      <View style={styles.row}>
        <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Total
        </Text>
        <Text style={[styles.totalValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {fmt(summary.finalTotal)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
});
