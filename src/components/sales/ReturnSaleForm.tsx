import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { X, ShoppingCart, User, DollarSign, Minus, Plus, Info, Calendar, Receipt, Package, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';

interface ReturnItem {
  productId: string;
  productName: string;
  originalQuantity: number;
  returnQuantity: number;
  unitPrice: number;
  maxReturnQuantity: number;
}

interface ReturnSaleFormProps {
  sale: any;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ReturnSaleForm({ sale, onComplete, onCancel }: ReturnSaleFormProps) {
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { isDark } = useTheme();
  const { currentBusiness, userProfile } = useAuth();

  useEffect(() => {
    if (sale?.carts?.cart_items) {
      // Initialize return items from sale cart items
      const items: ReturnItem[] = sale.carts.cart_items.map((item: any) => ({
        productId: item.product_id,
        productName: item.products?.name || 'Unknown Product',
        originalQuantity: item.quantity,
        returnQuantity: 0,
        unitPrice: item.unit_price,
        maxReturnQuantity: item.quantity // For now, allow returning all items
      }));
      setReturnItems(items);
    }
  }, [sale]);

  const updateReturnQuantity = useCallback((productId: string, quantity: number) => {
    setReturnItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(0, Math.min(quantity, item.maxReturnQuantity));
        return { ...item, returnQuantity: newQuantity };
      }
      return item;
    }));
  }, []);

  const handleQuantityChange = useCallback((productId: string, change: number) => {
    const item = returnItems.find(i => i.productId === productId);
    if (!item) return;
    
    const newQuantity = item.returnQuantity + change;
    updateReturnQuantity(productId, newQuantity);
  }, [returnItems, updateReturnQuantity]);

  const calculateRefundAmount = useCallback(() => {
    return returnItems.reduce((total, item) => {
      return total + (item.returnQuantity * item.unitPrice);
    }, 0);
  }, [returnItems]);

  const getTotalReturnItems = useCallback(() => {
    return returnItems.reduce((total, item) => total + item.returnQuantity, 0);
  }, [returnItems]);

  const handleSubmitReturn = useCallback(async () => {
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    
    if (itemsToReturn.length === 0) {
      Alert.alert('Error', 'Please select at least one item to return');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the return');
      return;
    }

    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business found');
      return;
    }

    setLoading(true);
    try {
      const returnData = itemsToReturn.map(item => ({
        productId: item.productId,
        quantity: item.returnQuantity
      }));

      await salesService.returnItems(
        sale.id,
        returnData,
        reason.trim(),
        userProfile.user_id
      );

      Alert.alert(
        'Return Processed',
        `Successfully processed return for ${getTotalReturnItems()} items. Refund amount: $${calculateRefundAmount().toFixed(2)}`,
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (error) {
      console.error('Error processing return:', error);
      Alert.alert('Error', 'Failed to process return');
    } finally {
      setLoading(false);
    }
  }, [returnItems, reason, currentBusiness?.id, sale.id, onComplete, getTotalReturnItems, calculateRefundAmount]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#059669';
      case 'voided':
        return '#dc2626';
      case 'refunded':
        return '#ea580c';
      case 'partially_returned':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Return Items
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sale Information */}
        <Card style={styles.saleInfoCard}>
          <View style={styles.saleInfoHeader}>
            <Receipt size={20} color="#2563eb" />
            <Text style={[styles.saleInfoTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Sale Information
            </Text>
          </View>
          
          <View style={styles.saleInfoContent}>
            <View style={styles.saleInfoRow}>
              <Text style={[styles.saleInfoLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Sale ID:
              </Text>
              <Text style={[styles.saleInfoValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                #{sale.id.slice(-8)}
              </Text>
            </View>
            
            <View style={styles.saleInfoRow}>
              <Text style={[styles.saleInfoLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Customer:
              </Text>
              <Text style={[styles.saleInfoValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {sale.customers?.name || 'Unknown Customer'}
              </Text>
            </View>
            
            <View style={styles.saleInfoRow}>
              <Text style={[styles.saleInfoLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Sale Date:
              </Text>
              <Text style={[styles.saleInfoValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {formatDate(sale.sale_date)}
              </Text>
            </View>
            
            <View style={styles.saleInfoRow}>
              <Text style={[styles.saleInfoLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Status:
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sale.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(sale.status) }]}>
                  {sale.status.charAt(0).toUpperCase() + sale.status.slice(1).replace('_', ' ')}
                </Text>
              </View>
            </View>
            
            <View style={styles.saleInfoRow}>
              <Text style={[styles.saleInfoLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Amount:
              </Text>
              <Text style={[styles.saleInfoValue, { color: '#059669' }]}>
                ${sale.total_amount.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Return Items Selection */}
        <Card style={styles.itemsCard}>
          <View style={styles.itemsHeader}>
            <ShoppingCart size={20} color="#8b5cf6" />
            <Text style={[styles.itemsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Items to Return
            </Text>
          </View>
          
          <Text style={[styles.itemsSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Choose the quantity of each item you want to return
          </Text>
          
          {returnItems.map((item) => (
            <View key={item.productId} style={styles.returnItem}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {item.productName}
                </Text>
                <Text style={[styles.itemDetails, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Original: {item.originalQuantity} × ${item.unitPrice.toFixed(2)}
                </Text>
                <Text style={[styles.itemSubtotal, { color: '#059669' }]}>
                  Subtotal: ${(item.originalQuantity * item.unitPrice).toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.returnControls}>
                <Text style={[styles.returnLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Return Qty:
                </Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      { 
                        backgroundColor: item.returnQuantity > 0 ? '#dc2626' : (isDark ? '#4b5563' : '#e5e7eb'),
                        opacity: item.returnQuantity === 0 ? 0.5 : 1
                      }
                    ]}
                    onPress={() => handleQuantityChange(item.productId, -1)}
                    disabled={item.returnQuantity === 0}
                  >
                    <Minus size={16} color={item.returnQuantity > 0 ? '#ffffff' : (isDark ? '#9ca3af' : '#6b7280')} />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={[styles.quantityInput, { 
                      backgroundColor: isDark ? '#374151' : '#f9fafb',
                      borderColor: isDark ? '#4b5563' : '#d1d5db',
                      color: isDark ? '#f9fafb' : '#111827'
                    }]}
                    value={item.returnQuantity.toString()}
                    onChangeText={(value) => {
                      const quantity = parseInt(value) || 0;
                      updateReturnQuantity(item.productId, quantity);
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      { 
                        backgroundColor: '#2563eb',
                        opacity: item.returnQuantity >= item.maxReturnQuantity ? 0.5 : 1
                      }
                    ]}
                    onPress={() => handleQuantityChange(item.productId, 1)}
                    disabled={item.returnQuantity >= item.maxReturnQuantity}
                  >
                    <Plus size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                
                {item.returnQuantity > 0 && (
                  <Text style={[styles.returnAmount, { color: '#dc2626' }]}>
                    Refund: ${(item.returnQuantity * item.unitPrice).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
          ))}
          
          {getTotalReturnItems() > 0 && (
            <View style={styles.returnSummary}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Items to Return:
                </Text>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {getTotalReturnItems()}
                </Text>
              </View>
              
              <View style={[styles.summaryRow, styles.totalRefundRow]}>
                <Text style={[styles.totalRefundLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Total Refund Amount:
                </Text>
                <Text style={[styles.totalRefundValue, { color: '#dc2626' }]}>
                  ${calculateRefundAmount().toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Return Reason */}
        <Card style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Info size={20} color="#ea580c" />
            <Text style={[styles.reasonTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Return Reason
            </Text>
          </View>
          
          <Input
            label="Reason for Return"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g., Defective product, Customer changed mind, Wrong item"
            required
          />
          
          <Input
            label="Additional Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional details about the return"
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Return Policy Information */}
        <Card style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <AlertTriangle size={20} color="#f59e0b" />
            <Text style={[styles.policyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Return Policy
            </Text>
          </View>
          
          <View style={styles.policyContent}>
            <Text style={[styles.policyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • Returned items will be added back to inventory
            </Text>
            <Text style={[styles.policyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • Sale status will be updated to "Partially Returned"
            </Text>
            <Text style={[styles.policyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • This action cannot be undone
            </Text>
            <Text style={[styles.policyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • Customer refund amount will be calculated automatically
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onCancel}
          style={styles.footerButton}
        />
        <Button
          title={`Process Return - $${calculateRefundAmount().toFixed(2)}`}
          onPress={handleSubmitReturn}
          loading={loading}
          style={styles.footerButton}
          disabled={getTotalReturnItems() === 0 || !reason.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  saleInfoCard: {
    padding: 16,
    marginBottom: 16,
  },
  saleInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  saleInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saleInfoContent: {
    gap: 8,
  },
  saleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleInfoLabel: {
    fontSize: 14,
  },
  saleInfoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  itemsCard: {
    padding: 16,
    marginBottom: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  itemsSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  returnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    marginBottom: 2,
  },
  itemSubtotal: {
    fontSize: 12,
    fontWeight: '500',
  },
  returnControls: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  returnLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    width: 40,
    height: 28,
    borderWidth: 1,
    borderRadius: 4,
    textAlign: 'center',
    fontSize: 14,
    marginHorizontal: 8,
  },
  returnAmount: {
    fontSize: 12,
    fontWeight: '500',
  },
  returnSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRefundRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalRefundLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalRefundValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  reasonCard: {
    padding: 16,
    marginBottom: 16,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  policyCard: {
    padding: 16,
    marginBottom: 20,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  policyContent: {
    gap: 8,
  },
  policyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerButton: {
    flex: 1,
  },
});