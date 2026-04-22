import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Minus, Plus, Trash2, AlertCircle, Tag, X as XIcon } from 'lucide-react-native';
import { InstantCheckoutItem } from '@/src/context/InstantCheckoutContext';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface InstantCheckoutProductListProps {
  items: InstantCheckoutItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyDiscount?: (productId: string) => void;
  onRemoveDiscount?: (productId: string) => void;
}

function QuantityInput({
  item,
  onUpdateQuantity,
  isDark,
}: {
  item: InstantCheckoutItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  isDark: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(item.quantity.toString());

  useEffect(() => {
    if (!isEditing) {
      setInputValue(item.quantity.toString());
    }
  }, [item.quantity, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const newQuantity = parseInt(inputValue, 10);

    if (isNaN(newQuantity) || newQuantity < 1) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity (minimum 1)');
      setInputValue(item.quantity.toString());
      return;
    }

    if (newQuantity > item.available_stock) {
      Alert.alert(
        'Insufficient Stock',
        `Only ${item.available_stock} units available in stock. Quantity adjusted.`
      );
      setInputValue(item.available_stock.toString());
      onUpdateQuantity(item.product_id, item.available_stock);
      return;
    }

    if (newQuantity !== item.quantity) {
      onUpdateQuantity(item.product_id, newQuantity);
    }
  };

  const handleIncrement = () => {
    if (item.quantity < item.available_stock) {
      onUpdateQuantity(item.product_id, item.quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.product_id, item.quantity - 1);
    }
  };

  return (
    <View style={styles.quantityControls}>
      <TouchableOpacity
        style={[
          styles.quantityButton,
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
        ]}
        onPress={handleDecrement}
        disabled={item.quantity <= 1}
      >
        <Minus
          size={16}
          color={item.quantity <= 1 ? '#9ca3af' : isDark ? '#f9fafb' : '#111827'}
        />
      </TouchableOpacity>

      {isEditing ? (
        <TextInput
          style={[
            styles.quantityInput,
            {
              color: isDark ? '#f9fafb' : '#111827',
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
            },
          ]}
          value={inputValue}
          onChangeText={setInputValue}
          onBlur={handleBlur}
          keyboardType="number-pad"
          autoFocus
          selectTextOnFocus
        />
      ) : (
        <TouchableOpacity onPress={() => setIsEditing(true)}>
          <Text style={[styles.quantity, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {item.quantity}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.quantityButton,
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
        ]}
        onPress={handleIncrement}
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
  );
}

export function InstantCheckoutProductList({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount,
  onRemoveDiscount,
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
          {item.product_image ? (
            <Image source={{ uri: item.product_image }} style={styles.productImage} />
          ) : null}

          <View style={styles.itemDetails}>
            <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {item.product_name}
            </Text>

            <Text style={[styles.price, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {formatCurrency(item.unit_price)} each
            </Text>

            {item.quantity > item.available_stock && (
              <View style={styles.stockWarning}>
                <AlertCircle size={14} color="#ef4444" />
                <Text style={styles.stockWarningText}>
                  Only {item.available_stock} in stock
                </Text>
              </View>
            )}

            {(item.item_discount_amount ?? 0) > 0 ? (
              <View style={styles.discountRow}>
                <Text style={styles.discountText}>
                  Discount: -{formatCurrency(item.item_discount_amount ?? 0)}
                </Text>
                {onRemoveDiscount ? (
                  <TouchableOpacity
                    onPress={() => onRemoveDiscount(item.product_id)}
                    style={styles.removeDiscountButton}
                  >
                    <XIcon size={14} color="#6b7280" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <View style={styles.quantityRow}>
              <QuantityInput item={item} onUpdateQuantity={onUpdateQuantity} isDark={isDark} />

              <View style={styles.priceActions}>
                {onApplyDiscount ? (
                  <TouchableOpacity
                    style={[
                      styles.discountButton,
                      { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
                    ]}
                    onPress={() => onApplyDiscount(item.product_id)}
                  >
                    <Tag size={14} color={isDark ? '#f9fafb' : '#111827'} />
                  </TouchableOpacity>
                ) : null}
                <Text style={[styles.subtotal, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {formatCurrency(item.subtotal)}
                </Text>
              </View>
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
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  discountText: {
    fontSize: 12,
    color: '#10b981',
  },
  removeDiscountButton: {
    padding: 2,
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
  quantityInput: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
    borderRadius: 4,
  },
  priceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtotal: {
    fontSize: 16,
    fontWeight: '700',
  },
  removeButton: {
    padding: 8,
  },
});
