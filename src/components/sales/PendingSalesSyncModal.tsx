import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useNetwork } from '@/src/context/NetworkContext';
import { useAuth } from '@/src/context/AuthContext';
import { offlineSaleQueue, OfflineSalePayload } from '@/src/lib/offlineSaleQueue';
import { salesService } from '@/src/services/sales';
import { cartService } from '@/src/services/carts';
import { isNetworkError } from '@/src/lib/network';
import { Wifi, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';
import { format } from 'date-fns';

export function PendingSalesSyncModal() {
  const { colors } = useTheme();
  const { isConnected, wasOffline, setPendingSalesCount } = useNetwork();
  const { currentBusiness, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [pendingSales, setPendingSales] = useState<OfflineSalePayload[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<Map<string, 'success' | 'failed'>>(new Map());

  useEffect(() => {
    if (isConnected && wasOffline) {
      checkPendingSales();
    }
  }, [isConnected, wasOffline]);

  useEffect(() => {
    loadPendingCount();
  }, [currentBusiness]);

  const loadPendingCount = async () => {
    const count = await offlineSaleQueue.getCount();
    setPendingSalesCount(count);
  };

  const checkPendingSales = async () => {
    const pending = await offlineSaleQueue.getPendingSales();
    if (pending.length > 0) {
      setPendingSales(pending);
      setVisible(true);
    }
  };

  const syncAllSales = async () => {
    if (!user?.id) return;
    setSyncing(true);
    const results = new Map<string, 'success' | 'failed'>();

    for (const sale of pendingSales) {
      try {
        await offlineSaleQueue.updateStatus(sale.id, 'syncing');

        const tempCart: any = {
          customer_id: sale.customerId,
          status: 'active',
          total_amount: sale.totalAmount,
          discount_type: sale.discountType,
          discount_value: sale.discountValue,
          delivery_cost: sale.deliveryCost,
          notes: sale.notes,
          business_id: sale.businessId,
          created_by: sale.createdBy,
        };

        const { data: cartData, error: cartError } = await (await import('@/src/config/supabase')).supabase
          .from('carts')
          .insert(tempCart)
          .select()
          .single();

        if (cartError) throw cartError;

        for (const item of sale.cartItems) {
          const { error: itemError } = await (await import('@/src/config/supabase')).supabase
            .from('cart_items')
            .insert({
              cart_id: cartData.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              cost_per_unit: item.cost_per_unit || 0,
              subtotal: item.subtotal,
              original_subtotal: item.original_subtotal,
              item_discount_type: item.item_discount_type,
              item_discount_value: item.item_discount_value,
              item_discount_amount: item.item_discount_amount,
              item_discount_scope: item.item_discount_scope,
            });

          if (itemError) throw itemError;
        }

        await salesService.completeSale({
          cart_id: cartData.id,
          customer_id: sale.customerId,
          payment_method: sale.paymentMethod as any,
          notes: sale.notes,
          sale_date: sale.saleDate,
          business_id: sale.businessId,
          created_by: sale.createdBy,
        });

        await offlineSaleQueue.remove(sale.id);
        results.set(sale.id, 'success');
      } catch (error: any) {
        console.error(`[OfflineSync] Failed to sync sale ${sale.id}:`, error);
        const reason = isNetworkError(error)
          ? 'Network error - will retry later'
          : error?.message || 'Unknown error';
        await offlineSaleQueue.updateStatus(sale.id, 'failed', reason);
        results.set(sale.id, 'failed');
      }
    }

    setSyncResults(results);
    setSyncing(false);

    const successCount = [...results.values()].filter(r => r === 'success').length;
    const failCount = [...results.values()].filter(r => r === 'failed').length;

    await loadPendingCount();

    if (failCount === 0) {
      Alert.alert('Sync Complete', `${successCount} sale(s) synced successfully.`);
      setVisible(false);
      setSyncResults(new Map());
    } else {
      Alert.alert(
        'Sync Partially Complete',
        `${successCount} synced, ${failCount} failed. Failed sales will remain in queue.`
      );
    }
  };

  const dismissModal = () => {
    setVisible(false);
    setSyncResults(new Map());
  };

  const renderSaleItem = ({ item }: { item: OfflineSalePayload }) => {
    const result = syncResults.get(item.id);
    return (
      <View style={[styles.saleItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.saleHeader}>
          <View style={styles.saleInfo}>
            <Text style={[styles.saleCustomer, { color: colors.text }]}>
              {item.customerName || 'Guest Customer'}
            </Text>
            <Text style={[styles.saleDate, { color: colors.textSecondary }]}>
              {format(new Date(item.saleDate), 'MMM d, yyyy h:mm a')}
            </Text>
          </View>
          <View style={styles.saleAmountContainer}>
            <Text style={[styles.saleAmount, { color: colors.text }]}>
              ${item.totalAmount.toFixed(2)}
            </Text>
            {result === 'success' && <CheckCircle size={16} color="#16A34A" />}
            {result === 'failed' && <XCircle size={16} color="#DC2626" />}
          </View>
        </View>
        <Text style={[styles.saleItems, { color: colors.textSecondary }]}>
          {item.cartItems.length} item(s) - {item.paymentMethod}
        </Text>
        {item.failureReason && (
          <Text style={styles.failureReason}>{item.failureReason}</Text>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Wifi size={24} color="#16A34A" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              Back Online
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You have {pendingSales.length} sale(s) saved while offline. Would you like to sync them now?
            </Text>
          </View>

          <FlatList
            data={pendingSales}
            keyExtractor={item => item.id}
            renderItem={renderSaleItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.dismissButton, { borderColor: colors.border }]}
              onPress={dismissModal}
              disabled={syncing}
            >
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.syncButton, { opacity: syncing ? 0.6 : 1 }]}
              onPress={syncAllSales}
              disabled={syncing}
            >
              <Text style={styles.syncButtonText}>
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  saleItem: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  saleInfo: {
    flex: 1,
  },
  saleCustomer: {
    fontSize: 15,
    fontWeight: '600',
  },
  saleDate: {
    fontSize: 12,
    marginTop: 2,
  },
  saleAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saleAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  saleItems: {
    fontSize: 12,
    marginTop: 4,
  },
  failureReason: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissButton: {
    borderWidth: 1,
  },
  syncButton: {
    backgroundColor: '#16A34A',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
