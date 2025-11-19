import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationService } from '../services/notifications';
import { Database } from '../types/database';
import { useAuth } from './AuthContext';

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
  const { userProfile, currentBusiness } = useAuth();

  const loadNotifications = useCallback(async () => {
    if (!userProfile?.user_id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const [notifs, count, prefs] = await Promise.all([
        notificationService.getNotifications(userProfile.user_id, currentBusiness?.id),
        notificationService.getUnreadCount(userProfile.user_id, currentBusiness?.id),
        notificationService.getPreferences(userProfile.user_id),
      ]);

      setNotifications(notifs);
      setUnreadCount(count);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.user_id, currentBusiness?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userProfile?.user_id) return;

    const channel = notificationService.subscribeToNotifications(
      userProfile.user_id,
      (notification) => {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    );

    return () => {
      notificationService.unsubscribeFromNotifications(channel);
    };
  }, [userProfile?.user_id]);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.user_id) return;

    try {
      await notificationService.markAllAsRead(userProfile.user_id, currentBusiness?.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }, [userProfile?.user_id, currentBusiness?.id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      const deletedNotification = notifications.find((n) => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }, [notifications]);

  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    if (!userProfile?.user_id) return;

    try {
      const updated = await notificationService.updatePreferences(userProfile.user_id, prefs);
      setPreferences(updated);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }, [userProfile?.user_id]);

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
