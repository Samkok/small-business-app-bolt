import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, Trash2, Package, Calendar, DollarSign, CircleCheck as CheckCircle, Clock, ChevronRight, Eye } from 'lucide-react-native';

interface BatchHistoryCardProps {
  batch: {
    id: string;
    business_id: string;
    imported_by: string;
    purchase_date: string;
    arrival_date?: string;
    notes?: string;
    status: 'pending' | 'completed';
    total_batch_cost: number;
    created_at: string;
    updated_at: string;
    inventory_imports: Array<{
      id: string;
      product_id: string;
      quantity: number;
      base_unit_cost_per_item: number;
      final_unit_cost_per_item: number;
      total_cost_for_item: number;
      products?: {
        name: string;
        barcode?: string;
      };
    }>;
    import_costs: Array<{
      id: string;
      cost_type: string;
      amount: number;
      calculation_type: 'per_unit' | 'per_total';
      description?: string;
    }>;
  };
  onEdit: (batch: any) => void;
  onDelete: (batch: any) => void;
  onMarkAsArrived: (batch: any) => void;
  onViewDetails: (batch: any) => void;
  onEdit: (batch: any) => void;
}

export function BatchHistoryCard({ batch, onEdit, onDelete, onMarkAsArrived, onViewDetails }: BatchHistoryCardProps) {
  const { isDark } = useTheme();

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
      <CheckCircle size={14} color={getStatusColor(status)} />
    ) : (
      <Clock size={14} color={getStatusColor(status)} />
    );
  };

  const getTotalQuantity = () => {
    return batch.inventory_imports.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getProductNames = () => {
    const names = batch.inventory_imports.map(item => item.products?.name || 'Unknown Product');
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.batchInfo}>
          <View style={styles.titleRow}>
            <Text style={[styles.batchId, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Batch #{batch.id.slice(-8)}
            </Text>
            <View style={styles.statusBadge}>
              {getStatusIcon(batch.status)}
              <Text style={[styles.statusText, { color: getStatusColor(batch.status) }]}>
                {batch.status === 'completed' ? 'Completed' : 'Pending'}
              </Text>
            </View>
          </View>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Calendar size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {formatDate(batch.purchase_date)}
              </Text>
            </View>
            
            <View style={styles.metaItem}>
              <Package size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {batch.inventory_imports.length} products, {getTotalQuantity()} units
              </Text>
            </View>
          </View>

          {batch.arrival_date && (
            <View style={styles.metaItem}>
              <CheckCircle size={14} color="#059669" />
              <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Arrived: {formatDate(batch.arrival_date)}
              </Text>
            </View>
          )}
          
          <Text style={[styles.productNames, { color: isDark ? '#d1d5db' : '#6b7280' }]} numberOfLines={1}>
            {getProductNames()}
          </Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onViewDetails(batch)}
          >
            <Eye size={16} color="#2563eb" />
          </TouchableOpacity>
          
          {batch.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
              onPress={() => onEdit(batch)}
            >
              <Edit size={16} color="#2563eb" />
            </TouchableOpacity>
          )}

          {batch.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
              onPress={() => onMarkAsArrived(batch)}
            >
              <CheckCircle size={16} color="#059669" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onDelete(batch)}
          >
            <Trash2 size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.costSection}>
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Total Batch Cost:
          </Text>
          <Text style={[styles.costValue, { color: '#059669' }]}>
            {formatCurrency(batch.total_batch_cost)}
          </Text>
        </View>
        
        {batch.import_costs && batch.import_costs.length > 0 && (
          <View style={styles.additionalCosts}>
            <Text style={[styles.costsTitle, { color: isDark ? '#f9fafb' : '#374151' }]}>
              Additional Costs:
            </Text>
            {batch.import_costs.slice(0, 2).map((cost, index) => (
              <View key={index} style={styles.costItem}>
                <Text style={[styles.costType, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {cost.cost_type} ({cost.calculation_type.replace('_', ' ')})
                </Text>
                <Text style={[styles.costAmount, { color: isDark ? '#f9fafb' : '#374151' }]}>
                  {formatCurrency(cost.amount)}
                </Text>
              </View>
            ))}
            {batch.import_costs.length > 2 && (
              <Text style={[styles.moreCosts, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                +{batch.import_costs.length - 2} more costs
              </Text>
            )}
          </View>
        )}
      </View>
      
      {batch.notes && (
        <View style={styles.notesSection}>
          <Text style={[styles.notesText, { color: isDark ? '#d1d5db' : '#374151' }]} numberOfLines={2}>
            {batch.notes}
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={styles.viewDetailsButton}
        onPress={() => onViewDetails(batch)}
      >
        <Text style={[styles.viewDetailsText, { color: '#2563eb' }]}>
          View Details
        </Text>
        <ChevronRight size={16} color="#2563eb" />
      </TouchableOpacity>
    </Card>
  );
}

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
  batchInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  batchId: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    marginLeft: 4,
  },
  productNames: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costSection: {
    marginBottom: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  costValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  additionalCosts: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  costsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  costType: {
    fontSize: 11,
    flex: 1,
  },
  costAmount: {
    fontSize: 11,
    fontWeight: '500',
  },
  moreCosts: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  notesSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2563eb20',
    borderRadius: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
});