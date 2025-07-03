import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, Trash2, Package, Calendar, DollarSign, User, CircleCheck as CheckCircle, Clock } from 'lucide-react-native';

interface ImportHistoryCardProps {
  importRecord: {
    id: string;
    quantity: number;
    base_unit_cost: number;
    final_unit_cost: number;
    total_cost: number;
    notes?: string;
    created_at: string;
    purchase_date: string;
    arrival_date?: string;
    status: 'pending' | 'completed';
    products?: {
      name: string;
      barcode?: string;
    };
    import_costs?: Array<{
      cost_type: string;
      amount: number;
      calculation_type: string;
      description?: string;
    }>;
  };
  onEdit: (importRecord: any) => void;
  onDelete: (importRecord: any) => void;
  onMarkAsArrived: (importRecord: any) => void;
}

export function ImportHistoryCard({ importRecord, onEdit, onDelete, onMarkAsArrived }: ImportHistoryCardProps) {
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

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.importInfo}>
          <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {importRecord.products?.name || 'Unknown Product'}
          </Text>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Package size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {importRecord.quantity} units
              </Text>
            </View>
            
            <View style={styles.metaItem}>
              <Calendar size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Purchased: {formatDate(importRecord.purchase_date)}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              {getStatusIcon(importRecord.status)}
              <Text style={[styles.statusText, { color: getStatusColor(importRecord.status) }]}>
                {importRecord.status === 'completed' ? 'Completed' : 'Pending'}
              </Text>
            </View>
            
            {importRecord.arrival_date && (
              <Text style={[styles.arrivalDate, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Arrived: {formatDate(importRecord.arrival_date)}
              </Text>
            )}
          </View>
          
          {importRecord.products?.barcode && (
            <Text style={[styles.barcode, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
              {importRecord.products.barcode}
            </Text>
          )}
        </View>
        
        <View style={styles.actions}>
          {importRecord.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6', marginBottom: 8 }]}
              onPress={() => onMarkAsArrived(importRecord)}
            >
              <CheckCircle size={16} color="#059669" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onEdit(importRecord)}
          >
            <Edit size={16} color="#2563eb" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6', marginLeft: 8 }]}
            onPress={() => onDelete(importRecord)}
          >
            <Trash2 size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.costBreakdown}>
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Base Unit Cost:
          </Text>
          <Text style={[styles.costValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
            {formatCurrency(importRecord.base_unit_cost)}
          </Text>
        </View>
        
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Final Unit Cost:
          </Text>
          <Text style={[styles.costValue, { color: isDark ? '#f9fafb' : '#374151' }]}>
            {formatCurrency(importRecord.final_unit_cost)}
          </Text>
        </View>
        
        <View style={[styles.costRow, styles.totalRow]}>
          <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
            Total Cost:
          </Text>
          <Text style={[styles.totalValue, { color: '#059669' }]}>
            {formatCurrency(importRecord.total_cost)}
          </Text>
        </View>
      </View>
      
      {importRecord.import_costs && importRecord.import_costs.length > 0 && (
        <View style={styles.additionalCosts}>
          <Text style={[styles.costsTitle, { color: isDark ? '#f9fafb' : '#374151' }]}>
            Additional Costs:
          </Text>
          {importRecord.import_costs.map((cost, index) => (
            <View key={index} style={styles.costItem}>
              <Text style={[styles.costType, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {cost.cost_type} ({cost.calculation_type.replace('_', ' ')})
              </Text>
              <Text style={[styles.costAmount, { color: isDark ? '#f9fafb' : '#374151' }]}>
                {formatCurrency(cost.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {importRecord.notes && (
        <View style={styles.notesSection}>
          <Text style={[styles.notesText, { color: isDark ? '#d1d5db' : '#374151' }]} numberOfLines={2}>
            {importRecord.notes}
          </Text>
        </View>
      )}
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
  importInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  arrivalDate: {
    fontSize: 12,
  },
  barcode: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'column',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costBreakdown: {
    marginBottom: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  costLabel: {
    fontSize: 12,
  },
  costValue: {
    fontSize: 12,
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
  additionalCosts: {
    marginBottom: 12,
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
  notesSection: {
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