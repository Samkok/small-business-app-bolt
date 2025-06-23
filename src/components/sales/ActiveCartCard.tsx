import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { ShoppingCart, User, Clock, DollarSign } from 'lucide-react-native';

interface ActiveCartCardProps {
  cart: {
    id: string;
    customers: {
      name: string;
      phone?: string;
    };
    cart_items: Array<{
      quantity: number;
      products: {
        name: string;
      };
    }>;
    created_at: string;
    total_amount: number;
  };
  onPress: () => void;
}

export function ActiveCartCard({ cart, onPress }: ActiveCartCardProps) {
  const { isDark } = useTheme();

  const getTotalItems = () => {
    return cart.cart_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <TouchableOpacity onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.customerInfo}>
            <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
              <Text style={styles.avatarText}>
                {cart.customers?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.customerDetails}>
              <Text style={[styles.customerName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {cart.customers?.name || 'Unknown Customer'}
              </Text>
              {cart.customers?.phone && (
                <Text style={[styles.customerPhone, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {cart.customers.phone}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.timeInfo}>
            <Clock size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.timeText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {getTimeAgo(cart.created_at)}
            </Text>
          </View>
        </View>
        
        <View style={styles.itemsSection}>
          <Text style={[styles.itemsTitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Items:
          </Text>
          <View style={styles.itemsList}>
            {cart.cart_items?.slice(0, 3).map((item, index) => (
              <Text 
                key={index} 
                style={[styles.itemText, { color: isDark ? '#f9fafb' : '#111827' }]}
                numberOfLines={1}
              >
                • {item.quantity}x {item.products?.name}
              </Text>
            ))}
            {(cart.cart_items?.length || 0) > 3 && (
              <Text style={[styles.moreItems, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                +{cart.cart_items.length - 3} more items
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.footer}>
          <View style={styles.totalItems}>
            <ShoppingCart size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.totalItemsText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {getTotalItems()} items
            </Text>
          </View>
          <View style={styles.totalAmount}>
            <DollarSign size={16} color="#059669" />
            <Text style={[styles.totalAmountText, { color: '#059669' }]}>
              ${cart.total_amount.toFixed(2)}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 12,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
    justifyContent: 'flex-end',
    marginTop: 2,
  },
,
  timeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  itemsSection: {
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  itemsList: {
    marginLeft: 4,
  },
  itemText: {
    fontSize: 13,
    marginBottom: 2,
  },
  moreItems: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalItems: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalItemsText: {
    fontSize: 14,
    marginLeft: 4,
  },
  totalAmount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});