import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, TrendingUp, Package, TriangleAlert as AlertTriangle } from 'lucide-react-native';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    description?: string;
    image_url?: string;
    barcode?: string;
    current_stock: number;
    min_stock_level: number;
  };
  onEdit: (product: any) => void;
  onImportStock: (product: any) => void;
}

export function ProductCard({ product, onEdit, onImportStock }: ProductCardProps) {
  const { isDark } = useTheme();

  const isLowStock = product.current_stock <= product.min_stock_level;
  const isOutOfStock = product.current_stock === 0;

  const getStockStatus = () => {
    if (isOutOfStock) return { color: '#dc2626', label: 'Out of Stock' };
    if (isLowStock) return { color: '#ea580c', label: 'Low Stock' };
    return { color: '#059669', label: 'In Stock' };
  };

  const stockStatus = getStockStatus();

  return (
    <Card style={styles.card}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}>
          <Package size={32} color={isDark ? '#9ca3af' : '#6b7280'} />
        </View>
      )}
      
      {(isLowStock || isOutOfStock) && (
        <View style={[styles.stockAlert, { backgroundColor: stockStatus.color }]}>
          <AlertTriangle size={12} color="#ffffff" />
        </View>
      )}
      
      <View style={styles.content}>
        <Text style={[styles.name, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={2}>
          {product.name}
        </Text>
        
        {product.description && (
          <Text style={[styles.description, { color: isDark ? '#d1d5db' : '#6b7280' }]} numberOfLines={2}>
            {product.description}
          </Text>
        )}
        
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: '#059669' }]}>
            ${product.price.toFixed(2)}
          </Text>
          
          <View style={styles.stockInfo}>
            <Text style={[styles.stockText, { color: stockStatus.color }]}>
              {product.current_stock} in stock
            </Text>
          </View>
        </View>
        
        {product.barcode && (
          <Text style={[styles.barcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
            {product.barcode}
          </Text>
        )}
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onEdit(product)}
          >
            <Edit size={16} color="#2563eb" />
            <Text style={[styles.actionText, { color: '#2563eb' }]}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onImportStock(product)}
          >
            <TrendingUp size={16} color="#059669" />
            <Text style={[styles.actionText, { color: '#059669' }]}>Stock</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 200,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockAlert: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stockInfo: {
    alignItems: 'flex-end',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
  },
  barcode: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});