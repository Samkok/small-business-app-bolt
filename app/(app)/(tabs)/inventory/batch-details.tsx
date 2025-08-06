import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import EditBatchForm from '@/src/components/inventory/EditBatchForm';
import { ArrowLeft, Package, Calendar, DollarSign, CircleCheck as CheckCircle, Clock, FileText, TrendingUp, Trash2 } from 'lucide-react-native';
import { batchImportService } from '@/src/services/batchImport';

export default function BatchDetailsScreen() {
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAsArrived, setMarkingAsArrived] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditBatchForm, setShowEditBatchForm] = useState(false);

  
  const router = useRouter();
  const { batchId } = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  useEffect(() => {
    if (batchId) {
      loadBatchDetails();
    }
  }, [batchId]);

  const loadBatchDetails = async (isRefresh = false) => {
    if (!batchId) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const data = await batchImportService.getBatchImport(batchId as string);
      setBatch(data);
    } catch (error) {
      console.error('Error loading batch details:', error);
      Alert.alert('Error', 'Failed to load batch details');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBatchDetails(true);
  };

  const handleMarkAsArrived = async () => {
    if (!batch || batch.status === 'completed') return;

    Alert.alert(
      'Mark Batch as Arrived',
      'Are you sure you want to mark this batch as arrived? This will update all product stocks in this batch and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            setMarkingAsArrived(true);
            try {
              await batchImportService.markBatchAsArrived(batch.id);
              Alert.alert('Success', 'Batch marked as arrived successfully');
              loadBatchDetails();
            } catch (error) {
              console.error('Error marking batch as arrived:', error);
              Alert.alert('Error', 'Failed to mark batch as arrived');
            } finally {
              setMarkingAsArrived(false);
            }
          }
        },
      ]
    );
  };

  const handleDeleteBatch = async () => {
    if (!batch) return;

    Alert.alert(
      'Delete Batch',
      `Are you sure you want to delete this entire batch? ${batch.status === 'completed' ? 'This will also adjust all product stocks in this batch.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await batchImportService.deleteBatchImport(batch.id);
              Alert.alert('Success', 'Batch deleted successfully');
              router.back();
            } catch (error) {
              console.error('Error deleting batch:', error);
              Alert.alert('Error', 'Failed to delete batch');
            } finally {
              setDeleting(false);
            }
          }
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: 'pending' | 'completed') => {
    return status === 'completed' ? '#059669' : '#f59e0b';
  };

  const getStatusIcon = (status: 'pending' | 'completed') => {
    return status === 'completed' ? (
      <CheckCircle size={20} color={getStatusColor(status)} />
    ) : (
      <Clock size={20} color={getStatusColor(status)} />
    );
  };

  const getTotalQuantity = () => {
    if (!batch?.inventory_imports) return 0;
    return batch.inventory_imports.reduce((sum: number, item: any) => sum + item.quantity, 0);
  };

  if (loading) {
    return <LoadingSpinner text="Loading batch details..." />;
  }

  if (!batch) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Batch Not Found
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            The batch you're looking for doesn't exist or has been deleted.
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Batch Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
            title="Pull to refresh"
            titleColor={isDark ? '#f9fafb' : '#111827'}
          />
        }
      >
        {/* Batch Overview */}
        <Card style={styles.batchOverview}>
          <View style={styles.batchHeader}>
            <View style={styles.batchTitleRow}>
              <Text style={[styles.batchId, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Batch #{batch.id.slice(-8)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(batch.status) + '20' }]}>
                {getStatusIcon(batch.status)}
                <Text style={[styles.statusText, { color: getStatusColor(batch.status) }]}>
                  {batch.status === 'completed' ? 'Completed' : 'Pending'}
                </Text>
              </View>
            </View>
            
            <View style={styles.batchMetaRow}>
              <View style={styles.metaItem}>
                <Calendar size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Purchased: {formatDate(batch.purchase_date)}
                </Text>
              </View>
              
              {batch.arrival_date && (
                <View style={styles.metaItem}>
                  <CheckCircle size={16} color="#059669" />
                  <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Arrived: {formatDate(batch.arrival_date)}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.batchSummary}>
              <View style={styles.summaryItem}>
                <Package size={18} color="#2563eb" />
                <Text style={[styles.summaryText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {batch.inventory_imports.length} products, {getTotalQuantity()} total units
                </Text>
              </View>
              
              <View style={styles.summaryItem}>
                <DollarSign size={18} color="#059669" />
                <Text style={[styles.summaryText, { color: '#059669' }]}>
                  Total Cost: {formatCurrency(batch.total_batch_cost)}
                </Text>
              </View>
            </View>
          </View>
          
          {batch.notes && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Notes:
              </Text>
              <Text style={[styles.notesText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {batch.notes}
              </Text>
            </View>
          )}
        </Card>

        {/* Additional Costs */}
        {batch.import_costs && batch.import_costs.length > 0 && (
          <Card style={styles.costsCard}>
            <View style={styles.sectionHeader}>
              <DollarSign size={20} color="#ea580c" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Additional Costs
              </Text>
            </View>
            
            {batch.import_costs.map((cost: any, index: number) => (
              <View key={index} style={styles.costItem}>
                <View style={styles.costInfo}>
                  <Text style={[styles.costType, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {cost.cost_type}
                  </Text>
                  <Text style={[styles.costCalculation, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {cost.calculation_type.replace('_', ' ')}
                  </Text>
                  {cost.description && (
                    <Text style={[styles.costDescription, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                      {cost.description}
                    </Text>
                  )}
                </View>
                <Text style={[styles.costAmount, { color: '#ea580c' }]}>
                  {formatCurrency(cost.amount)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Products in this Batch */}
        <Card style={styles.productsCard}>
          <View style={styles.sectionHeader}>
            <Package size={20} color="#2563eb" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Products in this Batch ({batch.inventory_imports.length})
            </Text>
          </View>
          
          {batch.inventory_imports.map((importItem: any, index: number) => (
            <View key={importItem.id} style={[
              styles.productItem,
              index < batch.inventory_imports.length - 1 && styles.productItemBorder
            ]}>
              <View style={styles.productInfo}>
                <View style={styles.productHeader}>
                  <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {importItem.products?.name || 'Unknown Product'}
                  </Text>
                  {importItem.products?.barcode && (
                    <Text style={[styles.productBarcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                      {importItem.products.barcode}
                    </Text>
                  )}
                </View>
                
                <View style={styles.productDetails}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Quantity:
                    </Text>
                    <Text style={[styles.detailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {importItem.quantity} units
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Base Unit Cost:
                    </Text>
                    <Text style={[styles.detailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {formatCurrency(importItem.base_unit_cost_per_item)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Final Unit Cost:
                    </Text>
                    <Text style={[styles.detailValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {formatCurrency(importItem.final_unit_cost_per_item)}
                    </Text>
                  </View>
                  
                  <View style={[styles.detailRow, styles.totalRow]}>
                    <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      Total Cost:
                    </Text>
                    <Text style={[styles.totalValue, { color: '#059669' }]}>
                      {formatCurrency(importItem.total_cost_for_item)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </Card>

        {/* Cost Breakdown */}
        <Card style={styles.costBreakdownCard}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color="#8b5cf6" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Cost Breakdown
            </Text>
          </View>
          
          <View style={styles.costBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Base Cost:
              </Text>
              <Text style={[styles.breakdownValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {formatCurrency(
                  batch.inventory_imports.reduce((sum: number, item: any) => 
                    sum + (item.quantity * item.base_unit_cost_per_item), 0
                  )
                )}
              </Text>
            </View>
            
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Additional Costs:
              </Text>
              <Text style={[styles.breakdownValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {formatCurrency(
                  batch.import_costs?.reduce((sum: number, cost: any) => sum + cost.amount, 0) || 0
                )}
              </Text>
            </View>
            
            <View style={[styles.breakdownRow, styles.totalBreakdownRow]}>
              <Text style={[styles.totalBreakdownLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Total Batch Cost:
              </Text>
              <Text style={[styles.totalBreakdownValue, { color: '#059669' }]}>
                {formatCurrency(batch.total_batch_cost)}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <Modal
        visible={showEditBatchForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <EditBatchForm
          batch={batch}
          onComplete={() => { setShowEditBatchForm(false); loadBatchDetails(); }}
          onCancel={() => setShowEditBatchForm(false)}
        />
      </Modal>
      {/* Action Buttons */}
      <View style={styles.footer}>
        {batch.status === 'pending' && (
          <Button
            title="Mark as Arrived"
            onPress={handleMarkAsArrived}
            loading={markingAsArrived}
            style={[styles.footerButton, { backgroundColor: '#059669' }]}
          />
        )}
        
        {batch.status === 'pending' && (
          <Button
            title="Edit Batch"
            onPress={() => setShowEditBatchForm(true)}
            style={styles.footerButton}
          />
        )}
        
        <Button
          title="Delete Batch"
          variant="danger"
          onPress={handleDeleteBatch}
          loading={deleting}
          style={styles.footerButton}
        />
      </View>
    </View>
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
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  batchOverview: {
    padding: 16,
    marginBottom: 16,
  },
  batchHeader: {
    marginBottom: 16,
  },
  batchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchId: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  batchMetaRow: {
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    marginLeft: 6,
  },
  batchSummary: {
    gap: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  notesSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  costsCard: {
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
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  costInfo: {
    flex: 1,
    marginRight: 12,
  },
  costType: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  costCalculation: {
    fontSize: 12,
    marginBottom: 2,
  },
  costDescription: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  costAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  productsCard: {
    padding: 16,
    marginBottom: 16,
  },
  productItem: {
    marginBottom: 16,
  },
  productItemBorder: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  productInfo: {
    flex: 1,
  },
  productHeader: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productBarcode: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  productDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  costBreakdownCard: {
    padding: 16,
    marginBottom: 16,
  },
  costBreakdown: {
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalBreakdownRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalBreakdownLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalBreakdownValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
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
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 120,
  },
});