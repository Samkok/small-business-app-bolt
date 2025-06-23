import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { CreditCard as Edit, Trash2, Phone, MapPin, MessageCircle } from 'lucide-react-native';

interface CustomerCardProps {
  customer: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    platform?: string;
    notes?: string;
    created_at: string;
  };
  onEdit: (customer: any) => void;
  onDelete: (customer: any) => void;
}

export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps) {
  const { isDark } = useTheme();

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'facebook':
        return '📘';
      case 'instagram':
        return '📷';
      case 'telegram':
        return '✈️';
      case 'walk_in':
        return '🚶';
      default:
        return '👤';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.customerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {customer.name}
            </Text>
            {customer.platform && (
              <Text style={styles.platformIcon}>
                {getPlatformIcon(customer.platform)}
              </Text>
            )}
          </View>
          
          {customer.phone && (
            <View style={styles.contactRow}>
              <Phone size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.contactText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {customer.phone}
              </Text>
            </View>
          )}
          
          {customer.address && (
            <View style={styles.contactRow}>
              <MapPin size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.contactText, { color: isDark ? '#d1d5db' : '#6b7280' }]} numberOfLines={1}>
                {customer.address}
              </Text>
            </View>
          )}
          
          {customer.platform && (
            <View style={styles.contactRow}>
              <MessageCircle size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.contactText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {customer.platform.charAt(0).toUpperCase() + customer.platform.slice(1).replace('_', ' ')}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onEdit(customer)}
          >
            <Edit size={16} color="#2563eb" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }]}
            onPress={() => onDelete(customer)}
          >
            <Trash2 size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
      
      {customer.notes && (
        <View style={styles.notesSection}>
          <Text style={[styles.notesLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Notes:
          </Text>
          <Text style={[styles.notesText, { color: isDark ? '#d1d5db' : '#374151' }]} numberOfLines={2}>
            {customer.notes}
          </Text>
        </View>
      )}
      
      <View style={styles.footer}>
        <Text style={[styles.dateText, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
          Added {formatDate(customer.created_at)}
        </Text>
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
  customerInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  platformIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
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
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
  },
});