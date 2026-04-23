import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, TrendingUp, Package, TriangleAlert as AlertTriangle, X, Trash2, ArchiveRestore, Zap, ChevronDown, ChevronUp, Layers } from 'lucide-react-native';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import { useRouter } from 'expo-router';
import { useInstantCheckout } from '@/src/context/InstantCheckoutContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import type { Unit } from '@/src/services/units';

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
    is_archived?: boolean;
    archived_at?: string;
    archived_by?: string;
    currency_id?: string | null;
    unit_group_id?: string | null;
  };
  onEdit: (product: any) => void;
  onViewDetails: (product: any) => void;
  onDelete: (product: any) => void;
  onUnarchive?: (product: any) => void;
  isArchived?: boolean;
  units?: Unit[];
}

export const ProductCard = React.memo(function ProductCard({ product, onEdit, onViewDetails, onDelete, onUnarchive, isArchived, units, unitPrices }: ProductCardProps) {
  const { isDark } = useTheme();
  const [showImageModal, setShowImageModal] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const hasVariants = !!(units && units.length > 0);
  const router = useRouter();
  const { addProduct, openModal } = useInstantCheckout();
  const { formatPrice } = useCurrencyContext();

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const handleBuyNow = () => {
    addProduct(product);
    openModal();
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

          {isArchived && (
            <View style={[styles.archivedBadge, { backgroundColor: '#6b7280' }]}>
              <Text style={styles.archivedBadgeText}>Archived</Text>
            </View>
          )}

          {!isArchived && (isLowStock || isOutOfStock) && (
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
              {formatPrice(product.price, product.currency_id ?? undefined)}
            </Text>

            <Text style={[styles.stockText, { color: stockStatus.color }]}>
              {hasVariants
                ? `${product.current_stock} base units`
                : `${product.current_stock} in stock`}
            </Text>
          </View>

          {hasVariants ? (
            <TouchableOpacity
              style={[styles.unitsToggle, { backgroundColor: isDark ? '#374151' : '#eff6ff', borderColor: isDark ? '#4b5563' : '#dbeafe' }]}
              onPress={() => setShowUnits(prev => !prev)}
              activeOpacity={0.7}
            >
              <Layers size={14} color="#2563eb" />
              <Text style={[styles.unitsToggleText, { color: '#2563eb' }]}>
                {showUnits ? 'Hide units' : `View ${units!.length} units`}
              </Text>
              {showUnits ? (
                <ChevronUp size={14} color="#2563eb" />
              ) : (
                <ChevronDown size={14} color="#2563eb" />
              )}
            </TouchableOpacity>
          ) : null}

          {hasVariants && showUnits && (
            <View style={[styles.variantsBox, { borderColor: isDark ? '#374151' : '#e5e7eb', backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
              {units!.map((unit, idx) => {
                const pu = unitPrices?.find(p => p.unit_id === unit.id);
                const qty = Math.floor(product.current_stock / unit.conversion_factor_to_base);
                const variantPrice = pu?.price ?? product.price;
                const variantCurrency = pu?.currency_id ?? product.currency_id ?? undefined;
                const variantName = pu?.name || unit.name;
                return (
                  <View
                    key={unit.id}
                    style={[
                      styles.variantRow,
                      idx < units!.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#e5e7eb' },
                    ]}
                  >
                    <View style={styles.variantMain}>
                      <Text style={[styles.variantName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
                        {variantName}
                      </Text>
                      {pu?.barcode ? (
                        <Text style={[styles.variantBarcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]} numberOfLines={1}>
                          {pu.barcode}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.variantMeta}>
                      <Text style={[styles.variantPrice, { color: '#059669' }]}>
                        {formatPrice(variantPrice, variantCurrency)}
                      </Text>
                      <Text style={[styles.variantStock, { color: stockStatus.color }]}>
                        {qty} in stock
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {product.barcode && !hasVariants && (
            <Text style={[styles.barcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
              {product.barcode}
            </Text>
          )}

          {isArchived && product.archived_at && (
            <Text style={[styles.archivedDate, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Archived: {formatDate(product.archived_at)}
            </Text>
          )}

          {!isArchived && !isOutOfStock && (
            <TouchableOpacity
              style={[styles.buyNowButton, { backgroundColor: '#2563eb' }]}
              onPress={handleBuyNow}
            >
              <Zap size={16} color="#ffffff" />
              <Text style={styles.buyNowText}>Go to checkout</Text>
            </TouchableOpacity>
          )}

          <View style={styles.actions}>
            {!isArchived && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
                onPress={() => onEdit(product)}
              >
                <Edit size={16} color="#2563eb" />
                <Text style={[styles.actionText, { color: '#2563eb' }]}>Edit</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
              onPress={handleViewDetails}
            >
              <TrendingUp size={16} color="#059669" />
              <Text style={[styles.actionText, { color: '#059669' }]}>Details</Text>
            </TouchableOpacity>

            {isArchived && onUnarchive ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#dbeafe' }]}
                onPress={() => onUnarchive(product)}
              >
                <ArchiveRestore size={16} color="#2563eb" />
                <Text style={[styles.actionText, { color: '#2563eb' }]}>Unarchive</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton, { backgroundColor: isDark ? '#4b5563' : '#fee2e2' }]}
                onPress={() => onDelete(product)}
              >
                <Trash2 size={16} color={isDark ? '#f87171' : '#dc2626'} />
                <Text style={[styles.actionText, { color: isDark ? '#f87171' : '#dc2626' }]}>Delete</Text>
              </TouchableOpacity>
            )}
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
    textAlign: 'right',
  },
  stockTextSmall: {
    fontSize: 10,
    textAlign: 'right',
  },
  barcode: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  unitsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
  },
  unitsToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  variantsBox: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  variantMain: {
    flex: 1,
    minWidth: 0,
  },
  variantName: {
    fontSize: 13,
    fontWeight: '600',
  },
  variantBarcode: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  variantMeta: {
    alignItems: 'flex-end',
  },
  variantPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  variantStock: {
    fontSize: 11,
    fontWeight: '500',
  },
  archivedBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  archivedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  archivedDate: {
    fontSize: 11,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  buyNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  buyNowText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: '#374151',
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