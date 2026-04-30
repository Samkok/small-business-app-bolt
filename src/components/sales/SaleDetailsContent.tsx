import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { SkeletonLoader, SkeletonCard } from '@/src/components/ui/SkeletonLoader';
import { User, Calendar, CreditCard, DollarSign, ShoppingCart, Percent, FileText, TriangleAlert as AlertTriangle, UserCheck, Pencil } from 'lucide-react-native';
import ReturnSaleForm from './ReturnSaleForm';
import VoidSaleModal from './VoidSaleModal';
import SaleEditModal from './SaleEditModal';
import { getUserDisplayName } from '@/src/utils/userDisplayName';

interface SaleDetailsContentProps {
  sale: any;
  saleDetails: any;
  loading: boolean;
  voidingInProgress: boolean;
  showReturnForm: boolean;
  showVoidModal: boolean;
  showEditModal: boolean;
  onVoidSale: () => void;
  onVoidSaleConfirm: (options: {
    reason: string;
    includeDeliveryCost: boolean;
    lossAmount?: number;
    lossPercentage?: number;
    lossType?: 'fixed' | 'percentage';
  }) => Promise<void>;
  onReturnItems: () => void;
  onReturnComplete: () => void;
  onCancelReturn: () => void;
  onCancelVoid: () => void;
  onEditSale: () => void;
  onEditSaleConfirm: (updates: {
    customerId?: string | null;
    discountType?: 'percentage' | 'fixed' | null;
    discountValue?: number | null;
    deliveryCost?: number | null;
  }) => Promise<void>;
  onCancelEdit: () => void;
  userProfile?: any;
  currentBusiness?: any;
}

export default function SaleDetailsContent({
  sale,
  saleDetails,
  loading,
  voidingInProgress,
  showReturnForm,
  showVoidModal,
  showEditModal,
  onVoidSale,
  onVoidSaleConfirm,
  onReturnItems,
  onReturnComplete,
  onCancelReturn,
  onCancelVoid,
  onEditSale,
  onEditSaleConfirm,
  onCancelEdit,
  currentBusiness,
}: SaleDetailsContentProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return '💵';
      case 'card':
        return '💳';
      case 'transfer':
        return '🏦';
      default:
        return '💰';
    }
  };

  const SaleDetailsSkeleton = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Sale Header Skeleton */}
      <SkeletonCard style={styles.saleHeader}>
        <View style={styles.saleIdRow}>
          <SkeletonLoader height={20} width="40%" />
          <SkeletonLoader height={24} width={80} borderRadius={12} />
        </View>

        <View style={styles.saleInfoRow}>
          <View style={styles.saleInfoItem}>
            <SkeletonLoader height={16} width={16} borderRadius={8} style={{ marginRight: 6 }} />
            <SkeletonLoader height={14} width={120} />
          </View>

          <View style={styles.saleInfoItem}>
            <SkeletonLoader height={16} width={16} borderRadius={8} style={{ marginRight: 6 }} />
            <SkeletonLoader height={14} width={80} />
          </View>
        </View>

        <View style={styles.amountRow}>
          <SkeletonLoader height={24} width={24} borderRadius={12} style={{ marginRight: 8 }} />
          <SkeletonLoader height={24} width={100} />
        </View>
      </SkeletonCard>

      {/* Customer Info Skeleton */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="50%" />
        </View>

        <View style={styles.customerInfo}>
          <SkeletonLoader height={18} width="60%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={14} width="40%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={14} width="50%" style={{ marginBottom: 4 }} />
          <SkeletonLoader height={14} width="35%" />
        </View>
      </SkeletonCard>

      {/* Items Skeleton */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="40%" />
        </View>

        <View style={styles.itemsContainer}>
          {[1, 2, 3].map((index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <SkeletonLoader height={14} width="70%" style={{ marginBottom: 4 }} />
                <SkeletonLoader height={12} width="50%" style={{ marginBottom: 4 }} />
                <View style={styles.discountInfo}>
                  <SkeletonLoader height={12} width={12} borderRadius={6} style={{ marginRight: 4 }} />
                  <SkeletonLoader height={11} width={80} />
                </View>
              </View>

              <View style={styles.itemTotal}>
                <SkeletonLoader height={12} width={60} style={{ marginBottom: 2 }} />
                <SkeletonLoader height={14} width={70} />
              </View>
            </View>
          ))}
        </View>
      </SkeletonCard>

      {/* Price Breakdown Skeleton */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="40%" />
        </View>

        <View style={styles.priceBreakdown}>
          {[1, 2, 3, 4, 5].map((index) => (
            <View key={index} style={styles.priceRow}>
              <SkeletonLoader height={14} width="60%" />
              <SkeletonLoader height={14} width="25%" />
            </View>
          ))}

          <View style={[styles.priceRow, styles.totalRow]}>
            <SkeletonLoader height={16} width="30%" />
            <SkeletonLoader height={18} width="35%" />
          </View>
        </View>
      </SkeletonCard>

      {/* Additional Information Skeleton */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <SkeletonLoader height={20} width={20} borderRadius={10} style={{ marginRight: 8 }} />
          <SkeletonLoader height={16} width="30%" />
        </View>

        <SkeletonLoader height={14} width="100%" style={{ marginBottom: 8 }} />
        <SkeletonLoader height={14} width="80%" style={{ marginBottom: 8 }} />
        <SkeletonLoader height={14} width="90%" />
      </SkeletonCard>
    </ScrollView>
  );

  if (loading) {
    return <SaleDetailsSkeleton />;
  }

  if (!sale) {
    return (
      <View style={styles.errorContainer}>
        <AlertTriangle size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
        <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('sales.saleNotFound')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sale Header */}
        <Card style={styles.saleHeader}>
          <View style={styles.saleIdRow}>
            <Text style={[styles.saleId, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('sales.saleNumber', { number: sale.id.slice(-8) })}
            </Text>
            <View style={styles.saleIdRight}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sale.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(sale.status) }]}>
                  {sale.status.charAt(0).toUpperCase() + sale.status.slice(1).replace('_', ' ')}
                </Text>
              </View>
              {(sale.status === 'completed' || sale.status === 'partially_returned') && (
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={onEditSale}
                >
                  <Pencil size={14} color="#2563eb" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.saleInfoRow}>
            <View style={styles.saleInfoItem}>
              <Calendar size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.saleInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {formatDate(sale.sale_date)}
              </Text>
            </View>

            <View style={styles.saleInfoItem}>
              <CreditCard size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.saleInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {getPaymentMethodIcon(sale.payment_method)} {sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1)}
              </Text>
            </View>
          </View>

          {(sale.created_by_name || sale.carts?.created_by_name) && (
            <View style={styles.saleInfoRow}>
              <View style={styles.saleInfoItem}>
                <UserCheck size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={[styles.saleInfoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {t('reports.createdBy')}: {getUserDisplayName(sale.created_by_name || sale.carts?.created_by_name)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.amountRow}>
            <DollarSign size={24} color="#059669" />
            <View style={styles.amountContainer}>
              {sale.status === 'voided' ? (
                <>
                  <Text style={[styles.originalAmount, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                    {t('sales.original')}: ${sale.total_amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.currentAmount, { color: '#dc2626' }]}>
                    ${(() => {
                      const voidAction = sale.sale_actions?.find((a: any) => a.action_type === 'void');
                      return (voidAction?.adjusted_amount ?? sale.total_amount).toFixed(2);
                    })()}
                  </Text>
                  <Text style={[styles.returnedAmount, { color: '#6b7280' }]}>
                    ({t('status.voided')})
                  </Text>
                </>
              ) : sale.status === 'partially_returned' ? (
                <>
                  <Text style={[styles.originalAmount, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                    {t('sales.original')}: ${sale.total_amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.currentAmount, { color: '#059669' }]}>
                    ${(sale.current_total_amount ?? sale.total_amount).toFixed(2)}
                  </Text>
                  <Text style={[styles.returnedAmount, { color: '#dc2626' }]}>
                    (${(() => {
                      const totalReturned = sale.sale_actions
                        ?.filter((a: any) => a.action_type === 'return')
                        ?.reduce((sum: number, a: any) => sum + (a.adjusted_amount || a.amount || 0), 0) || 0;
                      return totalReturned.toFixed(2);
                    })()} {t('sales.returned')})
                  </Text>
                </>
              ) : (
                <Text style={[styles.amount, { color: '#059669' }]}>
                  ${sale.total_amount.toFixed(2)}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Customer Info */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#2563eb" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('sales.customerInformation')}
            </Text>
          </View>

          <View style={styles.customerInfo}>
            <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {sale.customers?.name || t('customers.unknown')}
            </Text>

            {sale.customers?.phone && (
              <Text style={[styles.customerDetail, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('customers.phone')}: {sale.customers.phone}
              </Text>
            )}

            {sale.customers?.address && (
              <Text style={[styles.customerDetail, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('customers.address')}: {sale.customers.address}
              </Text>
            )}

            {sale.customers?.platform && (
              <Text style={[styles.customerDetail, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('customers.platform')}: {sale.customers.platform.charAt(0).toUpperCase() + sale.customers.platform.slice(1).replace('_', ' ')}
              </Text>
            )}
          </View>
        </Card>

        {/* Items */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <ShoppingCart size={20} color="#059669" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('sales.items')} ({sale.carts?.cart_items?.length || 0})
            </Text>
          </View>

          <View style={styles.itemsContainer}>
            {sale.carts?.cart_items?.map((item: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {item.products?.name}
                  </Text>
                  <Text style={[styles.itemPrice, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    ${item.unit_price.toFixed(2)} × {item.quantity}
                  </Text>

                  {item.item_discount_type && (
                    <View style={styles.discountInfo}>
                      <Percent size={12} color="#dc2626" />
                      <Text style={[styles.discountText, { color: '#dc2626' }]}>
                        {item.item_discount_type === 'percentage'
                          ? `${item.item_discount_value}% ${t('sales.off')}`
                          : `$${item.item_discount_value} ${t('sales.off')}`
                        }
                        {item.item_discount_amount > 0 && ` (-$${item.item_discount_amount.toFixed(2)})`}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.itemTotal}>
                  {item.original_subtotal > item.subtotal && (
                    <Text style={[styles.originalPrice, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                      ${item.original_subtotal.toFixed(2)}
                    </Text>
                  )}
                  <Text style={[styles.subtotal, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    ${item.subtotal.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Price Breakdown */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <DollarSign size={20} color="#8b5cf6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('sales.priceBreakdown')}
            </Text>
          </View>

          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('sales.itemsSubtotal')}:
              </Text>
              <Text style={[styles.priceValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${saleDetails?.items_original_total.toFixed(2)}
              </Text>
            </View>

            {saleDetails?.items_total_discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {t('sales.itemDiscounts')}:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -${saleDetails.items_total_discount.toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('sales.subtotalAfterItemDiscounts')}:
              </Text>
              <Text style={[styles.priceValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${saleDetails?.items_subtotal_after_discount.toFixed(2)}
              </Text>
            </View>

            {saleDetails?.cart_discount_amount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {t('sales.cartDiscount')}
                  {saleDetails.cart_discount_type && saleDetails.cart_discount_value &&
                    ` (${saleDetails.cart_discount_type === 'percentage'
                      ? `${saleDetails.cart_discount_value}%`
                      : `$${saleDetails.cart_discount_value}`})`
                  }:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -${saleDetails.cart_discount_amount.toFixed(2)}
                </Text>
              </View>
            )}

            {saleDetails?.delivery_cost > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {t('sales.deliveryCost')}:
                </Text>
                <Text style={[styles.discountAmount, { color: '#dc2626' }]}>
                  -${saleDetails.delivery_cost.toFixed(2)}
                </Text>
              </View>
            )}

            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {sale.returned_amount > 0 ? t('sales.currentTotal') : t('common.total')}:
              </Text>
              <Text style={[styles.totalValue, { color: '#059669' }]}>
                ${(sale.total_amount - (sale.returned_amount || 0)).toFixed(2)}
              </Text>
            </View>

            {sale.returned_amount > 0 && (
              <>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {t('sales.originalTotal')}:
                  </Text>
                  <Text style={[styles.originalTotalValue, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                    ${sale.total_amount.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {t('sales.returnedAmount')}:
                  </Text>
                  <Text style={[styles.returnedAmountValue, { color: '#dc2626' }]}>
                    -${(sale.returned_amount || 0).toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Card>

        {/* Additional Information */}
        {(sale.notes || sale.sale_actions?.length > 0) && (
          <Card style={styles.section}>
            {sale.notes && (
              <>
                <View style={styles.sectionHeader}>
                  <FileText size={20} color="#ea580c" />
                  <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {t('common.notes')}
                  </Text>
                </View>

                <Text style={[styles.notesText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {sale.notes}
                </Text>
              </>
            )}

            {sale.sale_actions?.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: sale.notes ? 16 : 0 }]}>
                  <AlertTriangle size={20} color="#dc2626" />
                  <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {t('sales.saleActions')}
                  </Text>
                </View>

                {sale.sale_actions.map((action: any, index: number) => (
                  <View key={index} style={styles.actionItem}>
                    <View style={styles.actionHeader}>
                      <Text style={[styles.actionType, { color: '#dc2626' }]}>
                        {action.action_type.toUpperCase()}
                      </Text>
                      <Text style={[styles.actionDate, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        {formatDate(action.created_at)}
                      </Text>
                    </View>

                    <Text style={[styles.actionReason, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      Reason: {action.reason}
                    </Text>

                    {/* Amount Breakdown */}
                    <View style={styles.amountBreakdown}>
                      {action.amount && (
                        <View style={styles.actionAmountRow}>
                          <Text style={[styles.amountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                            Original Amount:
                          </Text>
                          <Text style={[styles.amountValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                            ${action.amount.toFixed(2)}
                          </Text>
                        </View>
                      )}

                      {/* Delivery Cost Info */}
                      {action.delivery_cost_amount > 0 && (
                        <View style={styles.actionAmountRow}>
                          <Text style={[styles.amountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                            {action.delivery_cost_included ? 'Delivery (included):' : 'Delivery (excluded):'}
                          </Text>
                          <Text style={[styles.amountValue, { color: action.delivery_cost_included ? isDark ? '#f9fafb' : '#111827' : '#f59e0b' }]}>
                            ${action.delivery_cost_amount.toFixed(2)}
                          </Text>
                        </View>
                      )}

                      {/* Loss Amount Info */}
                      {action.loss_amount > 0 && (
                        <>
                          <View style={styles.actionAmountRow}>
                            <Text style={[styles.amountLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                              Loss Adjustment:
                            </Text>
                            <Text style={[styles.amountValue, { color: '#dc2626' }]}>
                              -${action.loss_amount.toFixed(2)}
                            </Text>
                          </View>
                          {action.loss_type && (
                            <View style={styles.lossTypeRow}>
                              <Text style={[styles.lossTypeText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                                {action.loss_type === 'fixed'
                                  ? 'Fixed amount loss'
                                  : `Percentage loss (${action.loss_percentage?.toFixed(1)}%)`}
                              </Text>
                            </View>
                          )}
                        </>
                      )}

                      {/* Adjusted Amount (Final) */}
                      {action.adjusted_amount != null && action.adjusted_amount !== action.amount && (
                        <View style={[styles.actionAmountRow, styles.adjustedAmountRow]}>
                          <Text style={[styles.amountLabel, styles.adjustedAmountLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                            Final Amount:
                          </Text>
                          <Text style={[styles.amountValue, styles.adjustedAmountValue, { color: '#2563eb' }]}>
                            ${action.adjusted_amount.toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {action.notes && (
                      <Text style={[styles.actionNotes, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        Notes: {action.notes}
                      </Text>
                    )}

                    <Text style={[styles.actionPerformer, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      Performed by: {action.performer_name || 'Unknown'}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </Card>
        )}
      </ScrollView>

      {/* Actions */}
      {(sale.status === 'completed' || sale.status === 'partially_returned') && (
        <View style={styles.footer}>
          <Button
            title={sale.status === 'completed' ? t('sales.returnItems') : t('sales.returnMoreItems')}
            variant="secondary"
            onPress={onReturnItems}
            style={styles.footerButton}
          />
          <Button
            title={t('sales.voidSale')}
            variant="danger"
            onPress={onVoidSale}
            loading={voidingInProgress}
            style={styles.footerButton}
          />
        </View>
      )}

      {/* Return Items Modal */}
      <Modal
        visible={showReturnForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ReturnSaleForm
          sale={sale}
          onComplete={onReturnComplete}
          onCancel={onCancelReturn}
        />
      </Modal>

      {/* Void Sale Modal */}
      {sale && (
        <VoidSaleModal
          visible={showVoidModal}
          sale={sale}
          onConfirm={onVoidSaleConfirm}
          onCancel={onCancelVoid}
          loading={voidingInProgress}
        />
      )}

      {/* Edit Sale Modal */}
      {sale && (
        <SaleEditModal
          visible={showEditModal}
          sale={sale}
          saleDetails={saleDetails}
          businessId={currentBusiness?.id || sale?.business_id || ''}
          onConfirm={onEditSaleConfirm}
          onCancel={onCancelEdit}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  saleHeader: {
    padding: 16,
    marginBottom: 16,
  },
  saleIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saleId: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  saleIdRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  saleInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 16,
  },
  saleInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saleInfoText: {
    fontSize: 14,
    marginLeft: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountContainer: {
    marginLeft: 8,
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  originalAmount: {
    fontSize: 16,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  currentAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  returnedAmount: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  customerInfo: {
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  customerDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  itemsContainer: {
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontWeight: '500',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 12,
    marginBottom: 4,
  },
  discountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountText: {
    fontSize: 11,
    marginLeft: 4,
  },
  itemTotal: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  subtotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceBreakdown: {
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  discountAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  originalTotalValue: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  returnedAmountValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#dc262610',
    borderRadius: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionType: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionDate: {
    fontSize: 12,
  },
  actionReason: {
    fontSize: 14,
    marginBottom: 4,
  },
  actionNotes: {
    fontSize: 14,
    marginBottom: 4,
  },
  actionPerformer: {
    fontSize: 12,
    marginTop: 4,
  },
  amountBreakdown: {
    marginTop: 8,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 13,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  lossTypeRow: {
    marginLeft: 16,
    marginBottom: 6,
  },
  lossTypeText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  adjustedAmountRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  adjustedAmountLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  adjustedAmountValue: {
    fontSize: 14,
    fontWeight: '700',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
  },
});
