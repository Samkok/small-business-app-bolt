import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Minus, Plus, Trash2, AlertCircle } from 'lucide-react-native';
import { InstantCheckoutItem } from '@/src/context/InstantCheckoutContext';

interface InstantCheckoutProductListProps {
  items: InstantCheckoutItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
}

export function InstantCheckoutProductList({
  items,
  onUpdateQuantity,
  onRemoveItem,
}: InstantCheckoutProductListProps) {
  const { isDark } = useTheme();

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <AlertCircle size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
        <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          No products added yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <View
          key={item.product_id}
          style={[
            styles.itemContainer,
            {
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              borderColor: isDark ? '#374151' : '#e5e7eb',
            },
          ]}
        >
          {item.product_image && (
            <Image source={{ uri: item.product_image }} style={styles.productImage} />
          )}

          <View style={styles.itemDetails}>
            <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {item.product_name}
            </Text>

            <Text style={[styles.price, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              ${item.unit_price.toFixed(2)} each
            </Text>

            {item.quantity > item.available_stock && (
              <View style={styles.stockWarning}>
                <AlertCircle size={14} color="#ef4444" />
                <Text style={styles.stockWarningText}>
                  Only {item.available_stock} in stock
                </Text>
              </View>
            )}

            {item.item_discount_amount && item.item_discount_amount > 0 && (
              <Text style={styles.discountText}>
                Discount: -${item.item_discount_amount.toFixed(2)}
              </Text>
            )}

            <View style={styles.quantityRow}>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={[
                    styles.quantityButton,
                    { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
                  ]}
                  onPress={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                >
                  <Minus size={16} color={isDark ? '#f9fafb' : '#111827'} />
                </TouchableOpacity>

                <Text style={[styles.quantity, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {item.quantity}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.quantityButton,
                    { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
                  ]}
                  onPress={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                  disabled={item.quantity >= item.available_stock}
                >
                  <Plus
                    size={16}
                    color={
                      item.quantity >= item.available_stock
                        ? '#9ca3af'
                        : isDark
                        ? '#f9fafb'
                        : '#111827'
                    }
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.subtotal, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${item.subtotal.toFixed(2)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemoveItem(item.product_id)}
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  price: {
    fontSize: 13,
    marginBottom: 4,
  },
  stockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  stockWarningText: {
    fontSize: 12,
    color: '#ef4444',
  },
  discountText: {
    fontSize: 12,
    color: '#10b981',
    marginBottom: 4,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '700',
  },
  removeButton: {
    padding: 8,
  },
});
