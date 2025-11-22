import React, { createContext, useContext, useState, useEffect, useCallback, useRef, startTransition } from 'react';
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
import { useBusinessSwitch } from './BusinessSwitchContext';
import { notificationCleanupService } from '../utils/notificationCleanup';
import { handleBusinessSwitch } from '../utils/notificationBusinessSwitch';
import SaleDetailsModal from '../components/sales/SaleDetailsModal';
import BusinessSwitchLoadingModal from '../components/notifications/BusinessSwitchLoadingModal';

type Notification = Database['public']['Tables']['notifications']['Row'];
type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];

interface NotificationContextData {
  notifications: Notification[];
  allBusinessNotifications: Notification[];
  unreadCount: number;
  allBusinessUnreadCount: number;
  preferences: NotificationPreferences | null;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  refreshAllBusinessNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAllAsReadAllBusinesses: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  cleanupNotificationsForBusiness: (businessId: string) => void;
  openSaleDetails: (saleId: string, notification?: Notification) => Promise<void>;
  closeSaleDetails: () => void;
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
  const [allBusinessNotifications, setAllBusinessNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allBusinessUnreadCount, setAllBusinessUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [saleModalId, setSaleModalId] = useState<string | null>(null);
  const [switchState, setSwitchState] = useState<{
    loading: boolean;
    businessName?: string;
    error: { type: string; message: string } | null;
  }>({ loading: false, businessName: undefined, error: null });
  const auth = useAuth();
  const router = useRouter();
  const businessSwitch = useBusinessSwitch();
  const notificationListener = useRef<Notifications.Subscription | undefined>();
  const responseListener = useRef<Notifications.Subscription | undefined>();
  const appState = useRef<string>(AppState.currentState);

  const filterValidNotifications = useCallback((notifs: Notification[]) => {
    const accessibleBusinessIds = new Set(auth.userBusinesses.map(b => b.id));
    return notifs.filter(n => accessibleBusinessIds.has(n.business_id));
  }, [auth.userBusinesses]);

  const loadNotifications = useCallback(async () => {
    if (!auth.userProfile?.user_id) {
      setNotifications([]);
      setAllBusinessNotifications([]);
      setUnreadCount(0);
      setAllBusinessUnreadCount(0);
      await BadgeSync.clearBadge();
      setLoading(false);
      return;
    }

    try {
      const [notifs, count, allBusinessCount, prefs] = await Promise.all([
        notificationService.getNotifications(auth.userProfile.user_id, auth.currentBusiness?.id),
        notificationService.getUnreadCount(auth.userProfile.user_id, auth.currentBusiness?.id),
        notificationService.getUnreadCountForAllBusinesses(auth.userProfile.user_id),
        notificationService.getPreferences(auth.userProfile.user_id),
      ]);

      const validNotifs = filterValidNotifications(notifs);
      setNotifications(validNotifs);
      setUnreadCount(count);
      setPreferences(prefs);

      await BadgeSync.updateBadge(allBusinessCount);
    } catch (error: any) {
      // Check if it's an auth error - these are expected during session transitions
      const isAuthError = error?.message?.includes('JWT') ||
                          error?.message?.includes('expired') ||
                          error?.message?.includes('Invalid API key') ||
                          error?.code === 'PGRST301';

      if (isAuthError) {
        console.log('Notification loading postponed - session is refreshing. Will retry automatically.');
      } else {
        console.error('Error loading notifications:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [auth.userProfile?.user_id, auth.currentBusiness?.id, filterValidNotifications]);

  const loadAllBusinessNotifications = useCallback(async () => {
    if (!auth.userProfile?.user_id) {
      setAllBusinessNotifications([]);
      setAllBusinessUnreadCount(0);
      return;
    }

    try {
      const [notifs, count] = await Promise.all([
        notificationService.getNotificationsForAllBusinesses(auth.userProfile.user_id),
        notificationService.getUnreadCountForAllBusinesses(auth.userProfile.user_id),
      ]);

      const validNotifs = filterValidNotifications(notifs);
      setAllBusinessNotifications(validNotifs);
      setAllBusinessUnreadCount(count);
    } catch (error: any) {
      // Check if it's an auth error - these are expected during session transitions
      const isAuthError = error?.message?.includes('JWT') ||
                          error?.message?.includes('expired') ||
                          error?.message?.includes('Invalid API key') ||
                          error?.code === 'PGRST301';

      if (isAuthError) {
        console.log('All business notifications loading postponed - session is refreshing.');
      } else {
        console.error('Error loading all business notifications:', error);
      }
    }
  }, [auth.userProfile?.user_id, filterValidNotifications]);

  useEffect(() => {
    loadNotifications();
    loadAllBusinessNotifications();
  }, [loadNotifications, loadAllBusinessNotifications]);

  useEffect(() => {
    if (!auth.userProfile?.user_id) return;

    const channel = notificationService.subscribeToNotifications(
      auth.userProfile.user_id,
      async (notification) => {
        const hasAccess = auth.userBusinesses.some(b => b.id === notification.business_id);

        if (!hasAccess) {
          console.warn('Received notification for inaccessible business:', notification.business_id);
          return;
        }

        setAllBusinessNotifications((prev) => [notification, ...prev]);
        setAllBusinessUnreadCount((prev) => {
          const newCount = prev + 1;
          BadgeSync.updateBadge(newCount);
          return newCount;
        });

        if (auth.currentBusiness?.id === notification.business_id) {
          setNotifications((prev) => [notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }

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
    );

    return () => {
      notificationService.unsubscribeFromNotifications(channel);
    };
  }, [auth.userProfile?.user_id, auth.currentBusiness?.id, preferences]);

  // Subscribe to notification DELETE events (from database trigger)
  useEffect(() => {
    if (!auth.userProfile?.user_id) return;

    console.log('Setting up notification DELETE subscription');

    const deleteChannel = supabase
      .channel(`notification_deletes:${auth.userProfile.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${auth.userProfile.user_id}`,
        },
        (payload) => {
          const deletedNotification = payload.old as Notification;
          console.log('Real-time DELETE: Notification removed from database:', deletedNotification.id);

          // Remove from all business notifications
          setAllBusinessNotifications((prev) => {
            const filtered = prev.filter(n => n.id !== deletedNotification.id);
            if (filtered.length !== prev.length) {
              console.log('Removed notification from allBusinessNotifications');
            }
            return filtered;
          });

          // Remove from current business notifications if applicable
          setNotifications((prev) => {
            const filtered = prev.filter(n => n.id !== deletedNotification.id);
            if (filtered.length !== prev.length) {
              console.log('Removed notification from current business notifications');
            }
            return filtered;
          });

          // Update unread counts
          if (!deletedNotification.is_read) {
            setAllBusinessUnreadCount((prev) => {
              const newCount = Math.max(0, prev - 1);
              BadgeSync.updateBadge(newCount);
              return newCount;
            });

            if (auth.currentBusiness?.id === deletedNotification.business_id) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up notification DELETE subscription');
      supabase.removeChannel(deleteChannel);
    };
  }, [auth.userProfile?.user_id, auth.currentBusiness?.id]);

  const handleNotificationWithBusinessSwitch = useCallback(async (notification: Notification, navigateTo: string) => {
    try {
      await businessSwitch.handleNotificationNavigation(notification, navigateTo);
    } catch (error) {
      console.error('Error handling notification with business switch:', error);
    }
  }, [businessSwitch]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setAllBusinessNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setAllBusinessUnreadCount((prev) => {
        const newCount = Math.max(0, prev - 1);
        BadgeSync.updateBadge(newCount);
        return newCount;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }, []);

  const openSaleDetails = useCallback(
    async (newSaleId: string, notification?: Notification) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // If notification is provided, handle business switching first
      if (notification) {
        const data = notification.data as any;
        const notificationBusinessName = data?.business_name;

        // Batch state update
        setSwitchState({
          loading: true,
          businessName: notificationBusinessName,
          error: null,
        });

        try {
          const switchResult = await handleBusinessSwitch(
            notification,
            auth.currentBusiness,
            auth.userBusinesses,
            auth.switchBusiness,
            auth.refreshUserBusinesses
          );

          if (!switchResult.success) {
            setSwitchState({
              loading: false,
              businessName: notificationBusinessName,
              error: {
                type: switchResult.error?.type || 'unknown',
                message: switchResult.error?.message || 'Failed to switch business',
              },
            });
            return;
          }

          // Business switched successfully
          setSwitchState({
            loading: false,
            businessName: undefined,
            error: null,
          });

          // Mark as read after successful business switch
          if (!notification.is_read) {
            markAsRead(notification.id).catch(err =>
              console.error('Failed to mark notification as read:', err)
            );
          }

          // Use startTransition for non-urgent modal opening
          startTransition(() => {
            setSaleModalId(newSaleId);
            setSaleModalVisible(true);
          });
        } catch (err: any) {
          setSwitchState({
            loading: false,
            businessName: notificationBusinessName,
            error: {
              type: 'unknown',
              message: err?.message || 'An unexpected error occurred',
            },
          });
        }
      } else {
        // No notification, just open the modal directly
        setSaleModalId(newSaleId);
        setSaleModalVisible(true);
      }
    },
    [auth.currentBusiness, auth.userBusinesses, auth.switchBusiness, auth.refreshUserBusinesses, markAsRead]
  );

  const closeSaleDetails = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSaleModalVisible(false);
    // Clear saleId after animation completes
    setTimeout(() => {
      setSaleModalId(null);
    }, 300);
  }, []);

  const dismissSwitchError = useCallback(() => {
    setSwitchState({
      loading: false,
      businessName: undefined,
      error: null,
    });
  }, []);

  useEffect(() => {
    const setupPushNotifications = async () => {
      try {
        await pushNotificationService.setupNotificationChannels();

        const pushToken = await pushNotificationService.registerForPushNotifications();
        console.log("Expo Push Notification: " + pushToken);

        if (pushToken && auth.userProfile?.user_id) {
          try {
            const { error } = await supabase
              .from('user_profiles')
              .update({ expo_push_token: pushToken })
              .eq('user_id', auth.userProfile.user_id);

            if (error) {
              // Check if it's an auth error - these are expected during session transitions
              const isAuthError = error.message?.includes('JWT') ||
                                  error.message?.includes('expired') ||
                                  error.message?.includes('Invalid API key');

              if (isAuthError) {
                console.log('Push token save skipped - session refreshing. Will retry automatically.');
              } else {
                console.error('Error saving push token:', error);
              }
            } else {
              console.log('Push token saved successfully');
            }
          } catch (error: any) {
            // Check if it's an auth error
            const isAuthError = error?.message?.includes('JWT') ||
                                error?.message?.includes('expired') ||
                                error?.message?.includes('Invalid API key');

            if (isAuthError) {
              console.log('Push token update postponed - session will refresh automatically');
            } else {
              console.error('Error updating push token:', error);
            }
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

        const mockNotification: Notification = {
          id: (data.id as string) || '',
          user_id: auth.userProfile?.user_id || '',
          business_id: (data.business_id as string) || '',
          type: data.type as any,
          title: (data.title as string) || '',
          message: (data.message as string) || '',
          data: data as Record<string, any>,
          is_read: false,
          created_at: new Date().toISOString(),
        };

        // Handle sale notifications with modal
        if (data.type === 'sale_created' || data.type === 'sale_voided') {
          if (data.sale_id) {
            await openSaleDetails(data.sale_id as string, mockNotification);
          }
          return;
        }

        // Handle other notifications with navigation
        let navigationTarget = '/(app)/(tabs)/';

        if (data.type === 'low_stock' || data.type === 'low_stock_alert') {
          navigationTarget = '/(app)/(tabs)/inventory/low-stock';
        } else if (data.type === 'role_assigned' || data.type === 'team_invite') {
          navigationTarget = '/(app)/(tabs)/';
        } else if (data.type === 'expense_added') {
          navigationTarget = '/(app)/(tabs)/expenses';
        }

        await handleNotificationWithBusinessSwitch(mockNotification, navigationTarget);
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
  }, [router, auth.userProfile?.user_id, handleNotificationWithBusinessSwitch, openSaleDetails]);

  const cleanupNotificationsForBusiness = useCallback((businessId: string) => {
    console.log('Cleaning up notifications for removed business:', businessId);

    setAllBusinessNotifications((prev) => {
      const filtered = prev.filter(n => n.business_id !== businessId);
      const removedCount = prev.length - filtered.length;
      console.log(`Removed ${removedCount} notifications for business ${businessId}`);
      return filtered;
    });

    setNotifications((prev) => {
      const filtered = prev.filter(n => n.business_id !== businessId);
      return filtered;
    });

    const unreadForBusiness = allBusinessNotifications.filter(
      n => n.business_id === businessId && !n.is_read
    ).length;

    setAllBusinessUnreadCount((prev) => {
      const newCount = Math.max(0, prev - unreadForBusiness);
      BadgeSync.updateBadge(newCount);
      return newCount;
    });

    if (auth.currentBusiness?.id === businessId) {
      const currentBusinessUnread = notifications.filter(
        n => n.business_id === businessId && !n.is_read
      ).length;
      setUnreadCount((prev) => Math.max(0, prev - currentBusinessUnread));
    }
  }, [allBusinessNotifications, notifications, auth.currentBusiness?.id]);

  useEffect(() => {
    notificationCleanupService.register(cleanupNotificationsForBusiness);

    return () => {
      notificationCleanupService.unregister();
    };
  }, [cleanupNotificationsForBusiness]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground');

        // Add a small delay to allow AuthContext to refresh session first
        // This prevents auth errors when loading notifications with a stale token
        setTimeout(async () => {
          try {
            await loadNotifications();
            await pushNotificationService.dismissAllNotifications();
          } catch (error) {
            console.warn('Error loading notifications on foreground:', error);
          }
        }, 500);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [loadNotifications]);

  useEffect(() => {
    BadgeSync.updateBadge(allBusinessUnreadCount);
  }, [allBusinessUnreadCount]);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const refreshAllBusinessNotifications = useCallback(async () => {
    await loadAllBusinessNotifications();
  }, [loadAllBusinessNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (!auth.userProfile?.user_id) return;

    try {
      await notificationService.markAllAsRead(auth.userProfile.user_id, auth.currentBusiness?.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

      setAllBusinessNotifications((prev) =>
        prev.map((n) =>
          n.business_id === auth.currentBusiness?.id ? { ...n, is_read: true } : n
        )
      );

      const otherBusinessesUnread = allBusinessUnreadCount - unreadCount;
      setUnreadCount(0);
      setAllBusinessUnreadCount(otherBusinessesUnread);
      await BadgeSync.updateBadge(otherBusinessesUnread);
      await pushNotificationService.dismissAllNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }, [auth.userProfile?.user_id, auth.currentBusiness?.id, unreadCount]);

  const markAllAsReadAllBusinesses = useCallback(async () => {
    if (!auth.userProfile?.user_id) return;

    try {
      await notificationService.markAllAsRead(auth.userProfile.user_id);
      setAllBusinessNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setAllBusinessUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await BadgeSync.clearBadge();
      await pushNotificationService.dismissAllNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }, [auth.userProfile?.user_id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);

      const deletedNotification = allBusinessNotifications.find((n) => n.id === notificationId);

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setAllBusinessNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      if (deletedNotification && !deletedNotification.is_read) {
        setAllBusinessUnreadCount((prev) => {
          const newCount = Math.max(0, prev - 1);
          BadgeSync.updateBadge(newCount);
          return newCount;
        });

        if (deletedNotification.business_id === auth.currentBusiness?.id) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }, [allBusinessNotifications, auth.currentBusiness?.id]);

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
        allBusinessNotifications,
        unreadCount,
        allBusinessUnreadCount,
        preferences,
        loading,
        refreshNotifications,
        refreshAllBusinessNotifications,
        markAsRead,
        markAllAsRead,
        markAllAsReadAllBusinesses,
        deleteNotification,
        updatePreferences,
        cleanupNotificationsForBusiness,
        openSaleDetails,
        closeSaleDetails,
      }}
    >
      {children}

      {/* Sale Details Modal */}
      <SaleDetailsModal
        visible={saleModalVisible}
        saleId={saleModalId}
        onClose={closeSaleDetails}
      />

      {/* Business Switch Loading Modal */}
      <BusinessSwitchLoadingModal
        visible={switchState.loading || switchState.error !== null}
        businessName={switchState.businessName}
        loading={switchState.loading}
        error={switchState.error}
        onDismiss={dismissSwitchError}
      />
    </NotificationContext.Provider>
  );
};
