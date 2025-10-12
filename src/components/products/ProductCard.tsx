import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, TrendingUp, Package, TriangleAlert as AlertTriangle, X, Trash2 } from 'lucide-react-native';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { useRouter } from 'expo-router';

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
  onViewDetails: (product: any) => void;
  onDelete: (product: any) => void;
}

export const ProductCard = React.memo(function ProductCard({ product, onEdit, onViewDetails, onDelete }: ProductCardProps) {
  const { isDark } = useTheme();
  const [showImageModal, setShowImageModal] = useState(false);
  const router = useRouter();

  const isLowStock = product.current_stock <= product.min_stock_level;
  const isOutOfStock = product.current_stock === 0;

  const getStockStatus = () => {
    if (isOutOfStock) return { color: '#dc2626', label: 'Out of Stock' };
    if (isLowStock) return { color: '#ea580c', label: 'Low Stock' };
    return { color: '#059669', label: 'In Stock' };
  };

  const stockStatus = getStockStatus();

  const handleViewDetails = () => {
    router.push(`/inventory/product-details?productId=${product.id}`);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.cardInnerContainer}>
        {/* Image Section */}
        <TouchableOpacity 
          style={styles.imageContainer}
          onPress={() => product.image_url && setShowImageModal(true)}
          disabled={!product.image_url}
        >
          {product.image_url ? (
            <OptimizedImage 
              source={{ uri: product.image_url }} 
              style={styles.image} 
              resizeMode="contain" 
              alt={product.name}
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}>
              <Package size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
            </View>
          )}
          
          {(isLowStock || isOutOfStock) && (
            <View style={[styles.stockAlert, { backgroundColor: stockStatus.color }]}>
              <AlertTriangle size={12} color="#ffffff" />
            </View>
          )}
        </TouchableOpacity>
        
        {/* Content Section */}
        <View style={styles.content}>
          <Text style={[styles.name, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
            {product.name}
          </Text>
          
          {product.description && (
            <Text style={[styles.description, { color: isDark ? '#d1d5db' : '#6b7280' }]} numberOfLines={1}>
              {product.description}
            </Text>
          )}
          
          <View style={styles.priceStockContainer}>
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
              onPress={handleViewDetails}
            >
              <TrendingUp size={16} color="#059669" />
              <Text style={[styles.actionText, { color: '#059669' }]}>Stock</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton, { backgroundColor: isDark ? '#7f1d1d' : '#fee2e2' }]}
              onPress={() => onDelete(product)}
            >
              <Trash2 size={16} color="#dc2626" />
              <Text style={[styles.actionText, { color: '#dc2626' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
          
          <Image
            source={{ uri: product.image_url }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    overflow: 'hidden',
    padding: 12,
  },
  cardInnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  stockAlert: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 18,
  },
  priceStockContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
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
    marginBottom: 8,
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
  deleteButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '90%',
    height: '70%',
  },
});