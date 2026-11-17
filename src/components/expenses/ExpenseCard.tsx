import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, Trash2, Calendar, Tag, DollarSign, Paperclip } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface ExpenseCardProps {
  expense: {
    id: string;
    amount: number;
    description: string;
    expense_date: string;
    notes?: string;
    receipt_paths?: string[] | null;
    expense_categories?: {
      name: string;
    };
    profiles?: {
      full_name: string;
    };
  };
  onEdit: (expense: any) => void;
  onDelete: (expense: any) => void;
  onViewReceipts?: (expense: any) => void;
}

export const ExpenseCard = React.memo(function ExpenseCard({ expense, onEdit, onDelete, onViewReceipts }: ExpenseCardProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const receiptCount = expense.receipt_paths?.length ?? 0;
  const { formatPrice } = useCurrencyContext();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return formatPrice(amount);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.expenseInfo}>
          <Text style={[styles.description, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {expense.description}
          </Text>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Tag size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {expense.expense_categories?.name || 'Uncategorized'}
              </Text>
            </View>
            
            <View style={styles.metaItem}>
              <Calendar size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.metaText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {formatDate(expense.expense_date)}
              </Text>
            </View>
          </View>
          
          {expense.profiles?.full_name && (
            <Text style={[styles.createdBy, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
              Added by {expense.profiles.full_name}
            </Text>
          )}
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onEdit(expense)}
          >
            <Edit size={16} color="#2563eb" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onDelete(expense)}
          >
            <Trash2 size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
      
      {expense.notes && (
        <View style={styles.notesSection}>
          <Text style={[styles.notesText, { color: isDark ? '#d1d5db' : '#374151' }]} numberOfLines={2}>
            {expense.notes}
          </Text>
        </View>
      )}
      
      <View style={[styles.footer, receiptCount > 0 && styles.footerWithReceipts]}>
        {receiptCount > 0 && (
          <TouchableOpacity
            style={[styles.receiptChip, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}
            onPress={() => onViewReceipts?.(expense)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Paperclip size={13} color="#2563eb" />
            <Text style={styles.receiptChipText}>
              {receiptCount === 1
                ? t('expenses.receiptOne')
                : t('expenses.receiptMany', { count: receiptCount })}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.amountContainer}>
          <DollarSign size={16} color="#dc2626" />
          <Text style={[styles.amount, { color: '#dc2626' }]}>
            {formatCurrency(expense.amount)}
          </Text>
        </View>
      </View>
    </Card>
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
  expenseInfo: {
    flex: 1,
    marginRight: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
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
  createdBy: {
    fontSize: 11,
    marginTop: 4,
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
  notesSection: {
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  footerWithReceipts: {
    justifyContent: 'space-between',
  },
  receiptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
  },
  receiptChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});