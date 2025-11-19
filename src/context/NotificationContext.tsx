import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { notificationService } from '../services/notifications';
import { pushNotificationService } from '../services/pushNotifications';
import { BadgeSync } from '../utils/badgeSync';
import { Database } from '../types/database';
import { useAuth } from './AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '../config/supabase';

type Notification = Database['public']['Tables']['notifications']['Row'];
type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];

interface NotificationContextData {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useAuth();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appState = useRef(AppState.currentState);

  const loadNotifications = useCallback(async () => {
    if (!auth.userProfile?.user_id) {
      setNotifications([]);
      setUnreadCount(0);
      await BadgeSync.clearBadge();
      setLoading(false);
      return;
    }

    try {
      const [notifs, count, prefs] = await Promise.all([
        notificationService.getNotifications(auth.userProfile.user_id, auth.currentBusiness?.id),
        notificationService.getUnreadCount(auth.userProfile.user_id, auth.currentBusiness?.id),
        notificationService.getPreferences(auth.userProfile.user_id),
      ]);

      setNotifications(notifs);
      setUnreadCount(count);
      setPreferences(prefs);

      await BadgeSync.updateBadge(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [auth.userProfile?.user_id, auth.currentBusiness?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!auth.userProfile?.user_id) return;

    const channel = notificationService.subscribeToNotifications(
      auth.userProfile.user_id,
      async (notification) => {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          BadgeSync.updateBadge(newCount);
          return newCount;
        });

        if (preferences?.enable_notifications !== false) {
          const priority = pushNotificationService.getNotificationPriority(notification.type);
          await pushNotificationService.scheduleLocalNotification(
            {
              id: notification.id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              data: notification.data,
            },
            priority
          );

          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      }
    );

    return () => {
      notificationService.unsubscribeFromNotifications(channel);
    };
  }, [auth.userProfile?.user_id, preferences]);

  const handleRoleAssignedNotification = useCallback(async (data: any) => {
    try {
      const businessId = data.business_id;
      const businessName = data.business_name || 'the business';

      if (!businessId) {
        console.warn('No business_id in role_assigned notification data');
        router.push('/(app)/(tabs)/settings/team');
        return;
      }

      console.log(`Attempting to switch to business: ${businessName} (${businessId})`);
      console.log('Current userBusinesses count:', auth.userBusinesses.length);
      console.log('Current business ID:', auth.currentBusiness?.id);

      let businessExists = auth.userBusinesses.some(b => b.id === businessId);

      if (!businessExists) {
        console.log('Business not found in current list, refreshing businesses...');
        await auth.refreshUserBusinesses();

        console.log('Waiting for business list to update...');
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 300));

          if (auth.userBusinesses.some(b => b.id === businessId)) {
            businessExists = true;
            console.log('Business found after refresh!');
            break;
          }
        }

        if (!businessExists) {
          console.warn('Business still not found after refresh and waiting');
          router.push('/(app)/(tabs)/settings/team');
          return;
        }
      }

      console.log('Business exists, attempting switch...');
      if (auth.currentBusiness?.id !== businessId) {
        console.log(`Switching to business: ${businessName} (${businessId})`);
        await auth.switchBusiness(businessId);

        console.log('Waiting for business switch to complete...');
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Business switch complete');
      } else {
        console.log('Already on the assigned business');
      }

      console.log('Navigating to team page...');
      router.push('/(app)/(tabs)/settings/team');
    } catch (error) {
      console.error('Error handling role_assigned notification:', error);
      router.push('/(app)/(tabs)/settings/team');
    }
  }, [auth, router]);

  useEffect(() => {
    const setupPushNotifications = async () => {
      try {
        await pushNotificationService.setupNotificationChannels();

        const pushToken = await pushNotificationService.registerForPushNotifications();

        if (pushToken && auth.userProfile?.user_id) {
          try {
            const { error } = await supabase
              .from('user_profiles')
              .update({ expo_push_token: pushToken })
              .eq('user_id', auth.userProfile.user_id);

            if (error) {
              console.error('Error saving push token:', error);
            } else {
              console.log('Push token saved successfully');
            }
          } catch (error) {
            console.error('Error updating push token:', error);
          }
        } else if (!pushToken) {
          console.log('Push token not available - app will still work without push notifications');
        }
      } catch (error) {
        console.error('Error setting up push notifications:', error);
        console.log('App will continue to work without push notifications');
      }
    };

    if (auth.userProfile?.user_id) {
      setupPushNotifications().catch(err => {
        console.error('Failed to setup push notifications:', err);
      });
    }

    notificationListener.current = pushNotificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received in foreground:', notification);
      }
    );

    responseListener.current = pushNotificationService.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);

        if (data.type === 'sale_created' || data.type === 'sale_voided') {
          if (data.sale_id) {
            router.push({
              pathname: '/(app)/(tabs)/sales/details/[saleId]',
              params: { saleId: data.sale_id }
            });
          }
        } else if (data.type === 'low_stock_alert') {
          router.push('/(app)/(tabs)/inventory/low-stock');
        } else if (data.type === 'role_assigned') {
          await handleRoleAssignedNotification(data);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        pushNotificationService.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        pushNotificationService.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [router, auth.userProfile?.user_id, handleRoleAssignedNotification]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground');
        await loadNotifications();
        await pushNotificationService.dismissAllNotifications();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [loadNotifications]);

  useEffect(() => {
    BadgeSync.updateBadge(unreadCount);
  }, [unreadCount]);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => {
        const newCount = Math.max(0, prev - 1);
        BadgeSync.updateBadge(newCount);
        return newCount;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!auth.userProfile?.user_id) return;

    try {
      await notificationService.markAllAsRead(auth.userProfile.user_id, auth.currentBusiness?.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await BadgeSync.clearBadge();
      await pushNotificationService.dismissAllNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }, [auth.userProfile?.user_id, auth.currentBusiness?.id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      const deletedNotification = notifications.find((n) => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount((prev) => {
          const newCount = Math.max(0, prev - 1);
          BadgeSync.updateBadge(newCount);
          return newCount;
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }, [notifications]);

  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    if (!auth.userProfile?.user_id) return;

    try {
      const updated = await notificationService.updatePreferences(auth.userProfile.user_id, prefs);
      setPreferences(updated);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }, [auth.userProfile?.user_id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        loading,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        updatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
