import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, Trash2, Calendar, Tag, DollarSign } from 'lucide-react-native';

interface ExpenseCardProps {
  expense: {
    id: string;
    amount: number;
    description: string;
    expense_date: string;
    notes?: string;
    expense_categories?: {
      name: string;
    };
    profiles?: {
      full_name: string;
    };
  };
  onEdit: (expense: any) => void;
  onDelete: (expense: any) => void;
}

export function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
  const { isDark } = useTheme();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
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
      
      <View style={styles.footer}>
        <View style={styles.amountContainer}>
          <DollarSign size={16} color="#dc2626" />
          <Text style={[styles.amount, { color: '#dc2626' }]}>
            {formatCurrency(expense.amount)}
          </Text>
        </View>
      </View>
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