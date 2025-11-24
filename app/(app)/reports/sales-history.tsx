import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonCard } from '@/src/components/ui/SkeletonLoader';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { ArrowLeft, Download, User, DollarSign, Calendar, Filter, ChevronDown, X } from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';
import { exportService } from '@/src/services/exportService';
import { format } from 'date-fns';
import { getUserDisplayName } from '@/src/utils/userDisplayName';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const ITEMS_PER_PAGE = 20;

export default function SalesHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [creators, setCreators] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedCreator, setSelectedCreator] = useState<string>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Date range
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  useEffect(() => {
    if (currentBusiness?.id) {
      loadSalesHistory(true);
    }
  }, [currentBusiness?.id, startDate, endDate, selectedStatus, selectedPaymentMethod, selectedCreator]);

  const loadSalesHistory = async (reset = false) => {
    if (!currentBusiness?.id) return;

    try {
      if (reset) {
        setLoading(true);
        setCurrentPage(0);
      } else {
        setLoadingMore(true);
      }

      const page = reset ? 0 : currentPage;
      const offset = page * ITEMS_PER_PAGE;

      const data = await reportsService.getSalesHistoryReport(
        currentBusiness.id,
        startDate.toISOString(),
        endDate.toISOString(),
        {
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          paymentMethod: selectedPaymentMethod !== 'all' ? selectedPaymentMethod : undefined,
          createdBy: selectedCreator !== 'all' ? selectedCreator : undefined,
          offset,
          limit: ITEMS_PER_PAGE,
        }
      );

      if (reset) {
        setSales(data.sales);
      } else {
        setSales(prev => [...prev, ...data.sales]);
      }

      setTotalCount(data.totalCount);
      setCreators(data.creators);
      setStats(data.stats);

      if (!reset) {
        setCurrentPage(page + 1);
      }
    } catch (error) {
      console.error('Error loading sales history:', error);
      Alert.alert(t('common.error'), 'Failed to load sales history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && sales.length < totalCount) {
      loadSalesHistory(false);
    }
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setShowDatePicker(false);
  };

  const handleExport = async () => {
    if (!currentBusiness?.id) {
      Alert.alert(t('common.error'), 'No business selected');
      return;
    }

    try {
      const csvData = await exportService.exportSalesToCsv(
        currentBusiness.id,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        selectedStatus !== 'all' ? selectedStatus : undefined,
        selectedPaymentMethod !== 'all' ? selectedPaymentMethod : undefined
      );

      const fileName = `sales_history_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        await Sharing.shareAsync(fileUri);
      }

      Alert.alert(t('common.success'), 'Sales history exported successfully');
    } catch (error) {
      console.error('Error exporting sales history:', error);
      Alert.alert(t('common.error'), 'Failed to export sales history');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'voided':
        return '#ef4444';
      case 'refunded':
        return '#f59e0b';
      case 'partially_returned':
        return '#3b82f6';
      default:
        return isDark ? '#9ca3af' : '#6b7280';
    }
  };

  const renderSaleItem = ({ item }: { item: any }) => {
    const displayAmount = item.status === 'voided'
      ? 0
      : item.status === 'partially_returned'
      ? item.total_amount - (item.sale_actions?.reduce((sum: number, a: any) =>
          a.action_type === 'return' ? sum + (a.adjusted_amount || a.amount || 0) : sum, 0) || 0)
      : item.total_amount;

    const creatorName = getUserDisplayName(item.created_by_name || item.carts?.created_by_name);
    const isDeleted = creatorName.includes('deleted');

    return (
      <Card style={[styles.saleCard, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
        <View style={styles.saleHeader}>
          <View style={styles.saleHeaderLeft}>
            <Text style={[styles.saleDate, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {format(new Date(item.sale_date), 'MMM dd, yyyy HH:mm')}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status}
              </Text>
            </View>
          </View>
          <Text style={[styles.saleAmount, { color: isDark ? '#f9fafb' : '#111827' }]}>
            ${displayAmount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.saleDetails}>
          <View style={styles.detailRow}>
            <User size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
              {item.customers?.name || 'Walk-in Customer'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <DollarSign size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
              {item.payment_method}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <User size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.detailText, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
              {t('reports.createdBy')}: {creatorName}
              {isDeleted && (
                <Text style={styles.deletedBadge}> ({t('common.deleted')})</Text>
              )}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('common.filters')}
            </Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterContent}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
                {t('sales.status')}
              </Text>
              {['all', 'completed', 'voided', 'refunded', 'partially_returned'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterOption,
                    selectedStatus === status && styles.filterOptionSelected,
                    { backgroundColor: selectedStatus === status ? '#3b82f6' : 'transparent' }
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    { color: selectedStatus === status ? '#ffffff' : isDark ? '#d1d5db' : '#4b5563' }
                  ]}>
                    {status === 'all' ? t('common.all') : status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
                {t('sales.paymentMethod')}
              </Text>
              {['all', 'cash', 'card', 'transfer', 'other'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.filterOption,
                    selectedPaymentMethod === method && styles.filterOptionSelected,
                    { backgroundColor: selectedPaymentMethod === method ? '#3b82f6' : 'transparent' }
                  ]}
                  onPress={() => setSelectedPaymentMethod(method)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    { color: selectedPaymentMethod === method ? '#ffffff' : isDark ? '#d1d5db' : '#4b5563' }
                  ]}>
                    {method === 'all' ? t('common.all') : method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
                {t('reports.createdBy')}
              </Text>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedCreator === 'all' && styles.filterOptionSelected,
                  { backgroundColor: selectedCreator === 'all' ? '#3b82f6' : 'transparent' }
                ]}
                onPress={() => setSelectedCreator('all')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: selectedCreator === 'all' ? '#ffffff' : isDark ? '#d1d5db' : '#4b5563' }
                ]}>
                  {t('common.all')}
                </Text>
              </TouchableOpacity>
              {creators.map((creator) => (
                <TouchableOpacity
                  key={creator.id}
                  style={[
                    styles.filterOption,
                    selectedCreator === creator.id && styles.filterOptionSelected,
                    { backgroundColor: selectedCreator === creator.id ? '#3b82f6' : 'transparent' }
                  ]}
                  onPress={() => setSelectedCreator(creator.id)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    { color: selectedCreator === creator.id ? '#ffffff' : isDark ? '#d1d5db' : '#4b5563' }
                  ]}>
                    {getUserDisplayName(creator.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              title={t('common.reset')}
              onPress={() => {
                setSelectedStatus('all');
                setSelectedPaymentMethod('all');
                setSelectedCreator('all');
              }}
              variant="secondary"
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title={t('common.apply')}
              onPress={() => setShowFilterModal(false)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('reports.salesHistory')}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <LoadingSpinner text="Loading sales history..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('reports.salesHistory')}
        </Text>
        <TouchableOpacity onPress={handleExport} style={styles.exportButton}>
          <Download size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Calendar size={20} color={isDark ? '#f9fafb' : '#111827'} />
          <Text style={[styles.controlButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}
          onPress={() => setShowFilterModal(true)}
        >
          <Filter size={20} color={isDark ? '#f9fafb' : '#111827'} />
          <Text style={[styles.controlButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('common.filters')}
          </Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <Card style={[styles.statsCard, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {t('reports.totalSales')}:
            </Text>
            <Text style={[styles.statValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {stats.totalSales}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {t('reports.totalRevenue')}:
            </Text>
            <Text style={[styles.statValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              ${stats.totalRevenue.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {t('reports.averageSale')}:
            </Text>
            <Text style={[styles.statValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              ${stats.averageSale.toFixed(2)}
            </Text>
          </View>
        </Card>
      )}

      <FlatList
        data={sales}
        renderItem={renderSaleItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {t('sales.noSalesFound')}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : null
        }
      />

      {showDatePicker && (
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onConfirm={handleDateRangeChange}
          onCancel={() => setShowDatePicker(false)}
        />
      )}

      {renderFilterModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  exportButton: {
    padding: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  saleCard: {
    marginBottom: 12,
    padding: 16,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saleHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  saleDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  saleAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  saleDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
  },
  deletedBadge: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  loadingMore: {
    padding: 16,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterContent: {
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#3b82f6',
  },
  filterOptionText: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
});
