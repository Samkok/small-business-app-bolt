import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Plus, Minus, Percent, Trash2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface CartItemProps {
  itemId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  originalSubtotal: number;
  subtotal: number;
  itemDiscountType?: 'percentage' | 'fixed';
  itemDiscountValue?: number;
  itemDiscountScope?: 'per_unit' | 'total';
  initialQuantity: number;
  availableStock: number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onShowDiscount: (itemId: string) => void;
  onRemoveDiscount: (itemId: string) => void;
  isUpdating: boolean;
  currencySymbol?: string;
}

const CartItemComponent: React.FC<CartItemProps> = ({
  itemId,
  productId,
  productName,
  unitPrice,
  quantity,
  originalSubtotal,
  subtotal,
  itemDiscountType,
  itemDiscountValue,
  itemDiscountScope,
  initialQuantity,
  availableStock,
  onQuantityChange,
  onShowDiscount,
  onRemoveDiscount,
  isUpdating,
  currencySymbol = '$'
}) => {
  const { isDark } = useTheme();
  const [inputValue, setInputValue] = useState(quantity.toString());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  const hasQuantityChange = quantity !== initialQuantity;

  useEffect(() => {
    if (!isEditing) {
      setInputValue(quantity.toString());
    }
  }, [quantity, isEditing]);

  const validateAndUpdateQuantity = useCallback((value: string) => {
    const numValue = parseInt(value, 10);

    if (value === '' || isNaN(numValue)) {
      setValidationError('Enter a valid number');
      return false;
    }

    if (numValue < 0) {
      setValidationError('Quantity cannot be negative');
      return false;
    }

    if (numValue > availableStock) {
      setValidationError(`Only ${availableStock} available`);
      return false;
    }

    setValidationError(null);
    return true;
  }, [availableStock]);

  const handleInputChange = useCallback((text: string) => {
    const sanitized = text.replace(/[^0-9]/g, '');
    setInputValue(sanitized);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (sanitized && validateAndUpdateQuantity(sanitized)) {
        const numValue = parseInt(sanitized, 10);
        if (numValue !== quantity) {
          onQuantityChange(itemId, numValue);
        }
      }
    }, 800);
  }, [quantity, itemId, onQuantityChange, validateAndUpdateQuantity]);

  const handleInputFocus = useCallback(() => {
    setIsEditing(true);
    setValidationError(null);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsEditing(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const numValue = parseInt(inputValue, 10);

    if (inputValue === '' || isNaN(numValue)) {
      setInputValue(quantity.toString());
      setValidationError(null);
      return;
    }

    if (!validateAndUpdateQuantity(inputValue)) {
      setInputValue(quantity.toString());
      return;
    }

    if (numValue !== quantity) {
      onQuantityChange(itemId, numValue);
    }
  }, [inputValue, quantity, itemId, onQuantityChange, validateAndUpdateQuantity]);

  const handleIncrement = useCallback(() => {
    const newQuantity = quantity + 1;
    if (newQuantity > availableStock) {
      Alert.alert('Stock Limit', `Only ${availableStock} items available in stock.`);
      return;
    }
    onQuantityChange(itemId, newQuantity);
  }, [quantity, availableStock, itemId, onQuantityChange]);

  const handleDecrement = useCallback(() => {
    const newQuantity = Math.max(0, quantity - 1);
    onQuantityChange(itemId, newQuantity);
  }, [quantity, itemId, onQuantityChange]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const stockWarningColor = availableStock <= 5 ? '#ea580c' : (isDark ? '#9ca3af' : '#6b7280');
  const isLowStock = availableStock <= 5;
  const inputBorderColor = validationError
    ? '#dc2626'
    : isEditing
      ? '#2563eb'
      : (isDark ? '#4b5563' : '#d1d5db');

  return (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <View style={styles.itemNameRow}>
          <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {productName}
          </Text>
          {hasQuantityChange && (
            <View style={styles.changedBadge}>
              <Text style={styles.changedBadgeText}>•</Text>
            </View>
          )}
        </View>
        <Text style={[styles.itemPrice, { color: '#059669' }]}>
          {formatCurrency(unitPrice, currencySymbol)} each
        </Text>
        <View style={styles.stockRow}>
          {isLowStock && <AlertCircle size={12} color={stockWarningColor} />}
          <Text style={[styles.stockText, { color: stockWarningColor }]}>
            {availableStock} in stock
          </Text>
        </View>
        {itemDiscountType && (
          <View style={styles.itemDiscountInfo}>
            <Text style={[styles.itemDiscountText, { color: '#dc2626' }]}>
              {itemDiscountType === 'percentage'
                ? `${itemDiscountValue}% off`
                : `${formatCurrency(itemDiscountValue, currencySymbol)} off`
              }
              {' '}
              <Text style={[styles.itemDiscountScope, { color: '#9ca3af' }]}>
                ({itemDiscountScope === 'per_unit' ? 'per unit' : 'total'})
              </Text>
            </Text>
            <TouchableOpacity
              onPress={() => onRemoveDiscount(itemId)}
              style={styles.removeDiscountButton}
            >
              <Trash2 size={12} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.itemControls}>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={[styles.quantityButton, { backgroundColor: '#dc2626' }]}
            onPress={handleDecrement}
            disabled={isUpdating || quantity === 0}
          >
            <Minus size={16} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.quantityInputContainer}>
            <TextInput
              ref={inputRef}
              style={[
                styles.quantityInput,
                {
                  color: isDark ? '#f9fafb' : '#111827',
                  borderColor: inputBorderColor,
                  backgroundColor: isDark ? '#374151' : '#ffffff',
                }
              ]}
              value={inputValue}
              onChangeText={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              keyboardType="number-pad"
              maxLength={5}
              selectTextOnFocus
              editable={!isUpdating}
            />
            {validationError && (
              <Text style={styles.validationError}>{validationError}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.quantityButton, { backgroundColor: '#2563eb' }]}
            onPress={handleIncrement}
            disabled={isUpdating || quantity >= availableStock}
          >
            <Plus size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.discountButton}
          onPress={() => onShowDiscount(itemId)}
        >
          <Percent size={14} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      <View style={styles.itemTotal}>
        {originalSubtotal > subtotal && (
          <Text style={[styles.originalPrice, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
            {formatCurrency(originalSubtotal, currencySymbol)}
          </Text>
        )}
        <Text style={[styles.itemSubtotal, { color: '#059669' }]}>
          {formatCurrency(subtotal, currencySymbol)}
        </Text>
      </View>
    </View>
  );
};

export const CartItem = memo(CartItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.itemId === nextProps.itemId &&
    prevProps.quantity === nextProps.quantity &&
    prevProps.initialQuantity === nextProps.initialQuantity &&
    prevProps.availableStock === nextProps.availableStock &&
    prevProps.subtotal === nextProps.subtotal &&
    prevProps.itemDiscountType === nextProps.itemDiscountType &&
    prevProps.itemDiscountValue === nextProps.itemDiscountValue &&
    prevProps.itemDiscountScope === nextProps.itemDiscountScope &&
    prevProps.isUpdating === nextProps.isUpdating &&
    prevProps.currencySymbol === nextProps.currencySymbol
  );
});

const styles = StyleSheet.create({
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  changedBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ea580c',
    marginLeft: 4,
  },
  changedBadgeText: {
    color: '#ea580c',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 8,
  },
  itemPrice: {
    fontSize: 12,
    marginBottom: 2,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemDiscountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDiscountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  itemDiscountScope: {
    fontSize: 10,
    fontWeight: '400',
  },
  removeDiscountButton: {
    marginLeft: 6,
    padding: 2,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 8,
    gap: 6,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInputContainer: {
    alignItems: 'center',
  },
  quantityInput: {
    fontSize: 14,
    fontWeight: '500',
    width: 48,
    height: 32,
    textAlign: 'center',
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  validationError: {
    fontSize: 9,
    color: '#dc2626',
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 48,
  },
  discountButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf620',
  },
  itemTotal: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
