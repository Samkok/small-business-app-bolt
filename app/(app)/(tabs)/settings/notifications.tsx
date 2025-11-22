import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/src/context/ThemeContext';
import { useNotifications } from '@/src/context/NotificationContext';
import { useAuth } from '@/src/context/AuthContext';
import { useSaleDetailsModal } from '@/src/context/SaleDetailsModalContext';
import { pushNotificationService } from '@/src/services/pushNotifications';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import {
  ArrowLeft,
  Bell,
  Check,
  Trash2,
  ShoppingCart,
  AlertTriangle,
  UserPlus,
  Settings,
  Building2,
} from 'lucide-react-native';
import { format } from 'date-fns';

export default function NotificationsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const {
    allBusinessNotifications,
    allBusinessUnreadCount,
    loading,
    refreshAllBusinessNotifications,
    markAsRead,
    markAllAsReadAllBusinesses,
    deleteNotification,
  } = useNotifications();
  const { switchBusiness, refreshUserBusinesses, userBusinesses, currentBusiness } = useAuth();
  const saleDetailsModal = useSaleDetailsModal();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useFocusEffect(
    React.useCallback(() => {
      pushNotificationService.dismissAllNotifications();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllBusinessNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadAllBusinesses();
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const handleDelete = (notificationId: string) => {
    Alert.alert('Delete Notification', 'Are you sure you want to delete this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNotification(notificationId);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete notification');
          }
        },
      },
    ]);
  };

  const handleNotificationPress = async (notification: any) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    // Validate business access before proceeding
    const data = notification.data as any;
    const businessName = data?.business_name || 'this business';
    let hasAccess = userBusinesses.some(b => b.id === notification.business_id);

    // If business not found in current list, refresh and check with fresh data
    if (!hasAccess) {
      console.log('Business not in current list, refreshing...');
      const freshBusinesses = await refreshUserBusinesses();
      hasAccess = freshBusinesses.some(b => b.id === notification.business_id);

      if (!hasAccess) {
        console.warn('User no longer has access to business:', notification.business_id);
        Alert.alert(
          'Access Denied',
          `You no longer have access to ${businessName}. The owner may have removed you from the team.`,
          [
            {
              text: 'OK',
              onPress: async () => {
                // Remove this notification from view
                try {
                  await deleteNotification(notification.id);
                } catch (error) {
                  console.error('Failed to delete notification:', error);
                }
              },
            },
          ]
        );
        return;
      }
    }

    // Switch business if needed
    if (currentBusiness?.id !== notification.business_id) {
      try {
        await switchBusiness(notification.business_id);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('Failed to switch business:', error);
        Alert.alert('Error', 'Failed to switch to the business. Please try again.');
        return;
      }
    }

    // Navigate based on notification type
    if (notification.type === 'sale_created' || notification.type === 'sale_voided') {
      if (data?.sale_id) {
        await saleDetailsModal.openSaleDetails(data.sale_id, notification);
      }
    } else if (notification.type === 'low_stock') {
      router.push('/(app)/(tabs)/inventory/low-stock');
    } else if (notification.type === 'role_assigned' || notification.type === 'team_invite') {
      await handleRoleAssignedNotification(data);
    } else if (notification.type === 'expense_added') {
      router.push('/(app)/(tabs)/expenses');
    }
  };

  const handleRoleAssignedNotification = async (data: any) => {
    try {
      const businessId = data.business_id;
      const businessName = data.business_name || 'the business';

      if (!businessId) {
        console.warn('No business_id in role_assigned notification data');
        router.push('/(app)/(tabs)/settings/team');
        return;
      }

      console.log(`Attempting to switch to business: ${businessName} (${businessId})`);

      let hasAccess = userBusinesses.some(b => b.id === businessId);

      // If business not found, refresh and check with fresh data
      if (!hasAccess) {
        console.log('Business not found in current list, refreshing businesses...');
        const freshBusinesses = await refreshUserBusinesses();
        hasAccess = freshBusinesses.some(b => b.id === businessId);

        if (!hasAccess) {
          console.warn('User no longer has access to business:', businessId);
          Alert.alert(
            'Access Denied',
            `You no longer have access to ${businessName}. The owner may have removed you from the team.`
          );
          router.push('/(app)/(tabs)/settings/team');
          return;
        }
      }

      if (currentBusiness?.id !== businessId) {
        console.log(`Switching to business: ${businessName}`);
        await switchBusiness(businessId);
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.log('Already on the assigned business');
      }

      router.replace('/(app)/(tabs)/');
    } catch (error) {
      console.error('Error handling role_assigned notification:', error);
      router.push('/(app)/(tabs)/');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'sale_created':
        return <ShoppingCart size={20} color="#10b981" />;
      case 'sale_voided':
        return <AlertTriangle size={20} color="#ef4444" />;
      case 'role_assigned':
      case 'team_invite':
        return <UserPlus size={20} color="#3b82f6" />;
      case 'low_stock':
        return <AlertTriangle size={20} color="#f59e0b" />;
      case 'expense_added':
        return <ShoppingCart size={20} color="#8b5cf6" />;
      default:
        return <Bell size={20} color="#6b7280" />;
    }
  };

  const filteredNotifications =
    filter === 'unread'
      ? allBusinessNotifications.filter((n) => !n.is_read)
      : allBusinessNotifications;

  const getBusinessName = (businessId: string) => {
    const business = userBusinesses.find(b => b.id === businessId);
    return business?.business_name || 'Unknown Business';
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Notifications
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
        </View>
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
          Notifications
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/settings/notification-preferences')}
          style={styles.backButton}
        >
          <Settings size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'all' && styles.filterButtonActive,
            { backgroundColor: filter === 'all' ? '#2563eb' : isDark ? '#374151' : '#e5e7eb' },
          ]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              { color: filter === 'all' ? '#ffffff' : isDark ? '#d1d5db' : '#6b7280' },
            ]}
          >
            All ({allBusinessNotifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'unread' && styles.filterButtonActive,
            {
              backgroundColor: filter === 'unread' ? '#2563eb' : isDark ? '#374151' : '#e5e7eb',
            },
          ]}
          onPress={() => setFilter('unread')}
        >
          <Text
            style={[
              styles.filterButtonText,
              { color: filter === 'unread' ? '#ffffff' : isDark ? '#d1d5db' : '#6b7280' },
            ]}
          >
            Unread ({allBusinessUnreadCount})
          </Text>
        </TouchableOpacity>

        {allBusinessUnreadCount > 0 && (
          <Button
            title="Mark all read"
            onPress={handleMarkAllAsRead}
            variant="outline"
            style={styles.markAllButton}
          />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredNotifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Bell size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              No notifications
            </Text>
            <Text style={[styles.emptySubtext, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
              {filter === 'unread'
                ? "You're all caught up!"
                : "You'll see notifications here when something happens"}
            </Text>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              onPress={() => handleNotificationPress(notification)}
            >
              <Card
                style={[
                  styles.notificationCard,
                  !notification.is_read && styles.unreadCard,
                  {
                    backgroundColor: !notification.is_read
                      ? isDark
                        ? '#1e3a5f'
                        : '#eff6ff'
                      : isDark
                      ? '#1f2937'
                      : '#ffffff',
                  },
                ]}
              >
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.businessBadgeContainer}>
                      <Building2 size={12} color={isDark ? '#9ca3af' : '#6b7280'} />
                      <Text
                        style={[
                          styles.businessBadge,
                          { color: isDark ? '#9ca3af' : '#6b7280' },
                        ]}
                      >
                        {getBusinessName(notification.business_id)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.notificationTitle,
                        { color: isDark ? '#f9fafb' : '#111827' },
                      ]}
                    >
                      {notification.title}
                    </Text>
                    <Text
                      style={[
                        styles.notificationMessage,
                        { color: isDark ? '#d1d5db' : '#4b5563' },
                      ]}
                    >
                      {notification.message}
                    </Text>
                    <Text
                      style={[
                        styles.notificationTime,
                        { color: isDark ? '#9ca3af' : '#6b7280' },
                      ]}
                    >
                      {format(new Date(notification.created_at), 'MMM dd, yyyy h:mm a')}
                    </Text>
                  </View>
                </View>

                <View style={styles.notificationActions}>
                  {!notification.is_read && (
                    <TouchableOpacity
                      onPress={() => handleMarkAsRead(notification.id)}
                      style={styles.actionButton}
                    >
                      <Check size={18} color="#10b981" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDelete(notification.id)}
                    style={styles.actionButton}
                  >
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  markAllButton: {
    marginLeft: 'auto',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  notificationCard: {
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  notificationHeader: {
    flexDirection: 'row',
    flex: 1,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  businessBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  businessBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  actionButton: {
    padding: 8,
  },
});
