import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const pushNotificationService = {
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permissions');
        return null;
      }

      // Try to get projectId from multiple sources with fallbacks
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        Constants.manifest2?.extra?.eas?.projectId ||
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

      // If projectId is available, use it; otherwise proceed without it
      // This allows development and testing without EAS project setup
      const tokenOptions = projectId ? { projectId } : undefined;

      const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);

      console.log('Expo Push Token:', tokenData.data);
      return tokenData.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);

      // Provide helpful error message for common issues
      if (error instanceof Error && error.message.includes('projectId')) {
        console.log(
          'Tip: For production use, configure EAS projectId in app.json under extra.eas.projectId ' +
          'or set EXPO_PUBLIC_EAS_PROJECT_ID environment variable'
        );
      }

      return null;
    }
  },

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Notifications only work on physical devices');
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permissions');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  },

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') return 'granted';
      if (status === 'denied') return 'denied';
      return 'undetermined';
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'undetermined';
    }
  },

  async setupNotificationChannels() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('high', {
        name: 'High Priority',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#dc2626',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('low', {
        name: 'Low Priority',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 100],
        lightColor: '#6b7280',
        sound: null,
        enableVibrate: true,
        showBadge: true,
      });

      console.log('Notification channels configured');
    }
  },

  async scheduleLocalNotification(
    notification: NotificationData,
    priority: 'default' | 'high' | 'low' = 'default'
  ): Promise<string | null> {
    try {
      const permissionGranted = await this.requestPermissions();
      if (!permissionGranted) {
        console.log('Notification permission not granted');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: {
            id: notification.id,
            type: notification.type,
            ...notification.data,
          },
          sound: true,
          badge: 1,
          vibrate: [0, 250, 250, 250],
          priority:
            priority === 'high'
              ? Notifications.AndroidNotificationPriority.HIGH
              : priority === 'low'
              ? Notifications.AndroidNotificationPriority.LOW
              : Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null,
      });

      console.log('Notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  },

  async cancelNotification(notificationId: string) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('Notification cancelled:', notificationId);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  },

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  },

  async dismissNotification(notificationId: string) {
    try {
      await Notifications.dismissNotificationAsync(notificationId);
      console.log('Notification dismissed:', notificationId);
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  },

  async dismissAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('All notifications dismissed');
    } catch (error) {
      console.error('Error dismissing all notifications:', error);
    }
  },

  async getPresentedNotifications() {
    try {
      const notifications = await Notifications.getPresentedNotificationsAsync();
      return notifications;
    } catch (error) {
      console.error('Error getting presented notifications:', error);
      return [];
    }
  },

  async setBadgeCount(count: number) {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Notifications.setBadgeCountAsync(count);
        console.log('Badge count set to:', count);
      }
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  },

  async getBadgeCount(): Promise<number> {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const count = await Notifications.getBadgeCountAsync();
        return count;
      }
      return 0;
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  },

  async clearBadge() {
    try {
      await this.setBadgeCount(0);
      console.log('Badge cleared');
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  },

  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  removeNotificationSubscription(subscription: Notifications.Subscription) {
    if (subscription) {
      subscription.remove();
    }
  },

  getNotificationPriority(type: string): 'default' | 'high' | 'low' {
    switch (type) {
      case 'sale_voided':
      case 'low_stock_alert':
        return 'high';
      case 'sale_created':
      case 'role_assigned':
        return 'default';
      default:
        return 'low';
    }
  },
};
