import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useInstantCheckout } from '@/src/context/InstantCheckoutContext';
import { ShoppingCart } from 'lucide-react-native';
import { formatCurrency } from '@/src/utils/formatCurrency';

export function InstantCheckoutWidget() {
  const { isDark } = useTheme();
  const { session, getItemCount, getSessionSummary, openModal } = useInstantCheckout();

  const itemCount = getItemCount();
  const summary = getSessionSummary();

  if (!session || itemCount === 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: '#2563eb',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
      ]}
      onPress={openModal}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <View style={styles.iconContainer}>
            <ShoppingCart size={20} color="#ffffff" />
            {itemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{itemCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.itemsText}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.subtotalText}>{formatCurrency(summary.itemsSubtotalAfterDiscount)}</Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(summary.finalTotal)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70,
    right: 16,
    left: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  itemsText: {
    color: '#ffffff',
    fontSize: 13,
    opacity: 0.9,
  },
  subtotalText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.8,
  },
  totalValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
