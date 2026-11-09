import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { Card } from '@/src/components/ui/Card';
import { User, Calendar, DollarSign, ChevronRight, UserCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { PaymentMethodIcon } from '@/src/utils/paymentMethodIcon';
import { getSaleNetProceeds, getSaleRefunds } from '@/src/utils/saleMoney';
import { useRouter } from 'expo-router';
import { getUserDisplayName } from '@/src/utils/userDisplayName';
import { paymentStatusLabel } from '@/src/utils/paymentStatus';

interface SaleCardProps {
  sale: {
    id: string;
    total_amount: number;
    display_amount?: number;
    returned_amount?: number | null;
    sale_actions?: Array<{ action_type?: string | null; amount?: number | null; adjusted_amount?: number | null }> | null;
    currency_id?: string;
    payment_method: string;
    /** PAID or COD; null on sales made before the field existed */
    payment_status?: 'paid' | 'cod' | null;
    status: string;
    sale_date: string;
    notes?: string;
    created_by_name?: string;
    customers?: {
      name: string;
      phone?: string;
    };
    carts?: {
      created_by_name?: string;
      cart_items?: Array<{
        quantity: number;
        products?: {
          name: string;
        };
      }>;
    };
  };
  onVoid: (sale: any) => void;
  showCreator?: boolean;
}

export const SaleCard = React.memo(function SaleCard({ sale, onVoid, showCreator = false }: SaleCardProps) {
  const { isDark } = useTheme();
  const router = useRouter();
  const { formatPrice } = useCurrencyContext();
  const { t } = useTranslation();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const fmtAmount = (amount: number) => formatPrice(amount, sale.currency_id);

  // What the sale is worth now: the original total less what was refunded on returns. A void
  // shows the voided amount (getSaleNetProceeds is 0 for a void, so it is handled apart).
  const refunded = getSaleRefunds(sale as any) || Number(sale.returned_amount) || 0;
  const shownAmount = sale.status === 'voided'
    ? sale.total_amount
    : sale.display_amount ?? (refunded > 0 ? Math.max(0, getSaleNetProceeds(sale as any)) : sale.total_amount);

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

  const getTotalItems = () => {
    if (!sale.carts?.cart_items) return 0;
    return sale.carts.cart_items.reduce((total, item) => total + item.quantity, 0);
  };

  const handleViewDetails = () => {
    router.push(`/sales/details/${sale.id}`);
  };

  return (
    <TouchableOpacity onPress={handleViewDetails} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.saleInfo}>
            <View style={styles.titleRow}>
              <Text style={[styles.saleId, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Sale #{sale.id.slice(-8)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sale.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(sale.status) }]}>
                  {sale.status.charAt(0).toUpperCase() + sale.status.slice(1).replace('_', ' ')}
                </Text>
              </View>
              {/* PAID or COD, so a cash-on-delivery order stands out in the list */}
              {sale.status !== 'voided' && paymentStatusLabel(sale.payment_status) && (
                <View style={[styles.statusBadge, { backgroundColor: sale.payment_status === 'cod' ? '#d9770620' : '#05966920' }]}>
                  <Text style={[styles.statusText, { color: sale.payment_status === 'cod' ? '#d97706' : '#059669' }]}>
                    {paymentStatusLabel(sale.payment_status)}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.amountRow}>
              <DollarSign size={18} color={sale.status === 'voided' ? '#9ca3af' : '#059669'} />
              <View style={styles.amountContainer}>
                {/* A voided sale brought in nothing: grey and struck through, never green */}
                <Text style={[styles.amount, sale.status === 'voided' ? { color: '#9ca3af', textDecorationLine: 'line-through' } : { color: '#059669' }]}>
                  {fmtAmount(shownAmount)}
                </Text>
                {shownAmount !== sale.total_amount && (
                  <Text style={[styles.originalAmount, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                    {fmtAmount(sale.total_amount)}
                  </Text>
                )}
                {refunded > 0 && sale.status !== 'voided' && (
                  <Text style={[styles.returnedAmount, { color: '#dc2626' }]}>
                    {fmtAmount(refunded)} returned
                  </Text>
                )}
              </View>
            </View>
          </View>
          
          {sale.status === 'completed' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
              onPress={(e) => {
                e.stopPropagation();
                onVoid(sale);
              }}
            >
              <Text style={styles.voidText}>{t('sales.void')}</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <User size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {sale.customers?.name || 'Unknown Customer'}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Calendar size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {formatDate(sale.sale_date)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <PaymentMethodIcon method={sale.payment_method} size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1)}
            </Text>
          </View>

          {showCreator && (sale.created_by_name || sale.carts?.created_by_name) && (
            <View style={styles.detailRow}>
              <UserCheck size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {getUserDisplayName(sale.created_by_name || sale.carts?.created_by_name)}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={[styles.itemCount, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
            {getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''}
          </Text>
          
          {sale.customers?.phone && (
            <Text style={[styles.phone, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
              {sale.customers.phone}
            </Text>
          )}
          
          <ChevronRight size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
        </View>
        
        {sale.notes && (
          <View style={styles.notesSection}>
            <Text style={[styles.notesText, { color: isDark ? '#d1d5db' : '#374151' }]} numberOfLines={2}>
              {sale.notes}
            </Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  saleInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  saleId: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountContainer: {
    marginLeft: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  originalAmount: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  returnedAmount: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voidText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  details: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  phone: {
    fontSize: 12,
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesText: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});