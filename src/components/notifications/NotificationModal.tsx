import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useNotifications } from '@/src/context/NotificationContext';
import { useAuth } from '@/src/context/AuthContext';
import { pushNotificationService } from '@/src/services/pushNotifications';
import { X, Bell, CheckCheck, Trash2, Clock, AlertCircle } from 'lucide-react-native';
import { Database } from '@/src/types/database';
import { handleBusinessSwitch } from '@/src/utils/notificationBusinessSwitch';

type Notification = Database['public']['Tables']['notifications']['Row'];

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 150;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.5,
  overshootClamping: false,
  restSpeedThreshold: 0.01,
  restDisplacementThreshold: 0.01,
};

const TIMING_CONFIG = {
  duration: 250,
};

export default function NotificationModal({ visible, onClose }: NotificationModalProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { switchBusiness, refreshUserBusinesses, userBusinesses, currentBusiness } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [accessDeniedError, setAccessDeniedError] = useState<{ businessName?: string } | null>(null);

  const MODAL_HEIGHT = SCREEN_HEIGHT - insets.top - 60;

  const translateY = useSharedValue(MODAL_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      pushNotificationService.dismissAllNotifications();
      translateY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, TIMING_CONFIG);
    } else {
      translateY.value = withTiming(MODAL_HEIGHT, TIMING_CONFIG);
      backdropOpacity.value = withTiming(0, TIMING_CONFIG);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    translateY.value = withTiming(MODAL_HEIGHT, TIMING_CONFIG, () => {
      runOnJS(onClose)();
    });
    backdropOpacity.value = withTiming(0, TIMING_CONFIG);
  }, [onClose, translateY, backdropOpacity]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        translateY.value = withTiming(MODAL_HEIGHT, TIMING_CONFIG, () => {
          runOnJS(handleClose)();
        });
        backdropOpacity.value = withTiming(0, TIMING_CONFIG);
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.value,
    };
  });

  const handleBackdropPress = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [markAsRead]);

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    handleClose();

    setTimeout(async () => {
      const switchResult = await handleBusinessSwitch(
        notification,
        currentBusiness,
        userBusinesses,
        switchBusiness,
        refreshUserBusinesses
      );

      if (!switchResult.success && switchResult.error?.type === 'access_denied') {
        setAccessDeniedError({ businessName: switchResult.error.businessName });
        return;
      }

      const data = notification.data as any;

      if (notification.type === 'sale_created' || notification.type === 'sale_voided') {
        if (data?.sale_id) {
          router.push(`/(app)/(tabs)/sales/details/${data.sale_id}`);
        }
      } else if (notification.type === 'low_stock') {
        router.push('/(app)/(tabs)/inventory/low-stock');
      } else if (notification.type === 'role_assigned' || notification.type === 'team_invite') {
        router.push('/(app)/(tabs)/');
      } else if (notification.type === 'expense_added') {
        router.push('/(app)/(tabs)/expenses');
      }
    }, 300);
  }, [handleMarkAsRead, handleClose, router, currentBusiness, userBusinesses, switchBusiness, refreshUserBusinesses]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [markAllAsRead]);

  const handleDelete = useCallback(async (notificationId: string) => {
    setDeletingId(notificationId);
    try {
      await deleteNotification(notificationId);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setDeletingId(null);
    }
  }, [deleteNotification]);

  const getNotificationIcon = useCallback((type: string) => {
    switch (type) {
      case 'sale_created':
        return '💰';
      case 'sale_voided':
        return '⚠️';
      case 'low_stock':
        return '📦';
      case 'team_invite':
      case 'role_assigned':
        return '👥';
      case 'expense_added':
        return '💳';
      default:
        return '📢';
    }
  }, []);

  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, []);

  const renderNotification = useCallback(({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        {
          backgroundColor: item.is_read
            ? (isDark ? '#1f2937' : '#f9fafb')
            : (isDark ? '#374151' : '#ffffff'),
          borderLeftColor: item.is_read ? '#6b7280' : '#2563eb',
        },
      ]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationHeader}>
        <View style={[
          styles.notificationIconContainer,
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
        ]}>
          <Text style={styles.notificationIcon}>{getNotificationIcon(item.type)}</Text>
        </View>
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {item.title}
          </Text>
          <Text style={[styles.notificationMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {item.message}
          </Text>
          <View style={styles.notificationFooter}>
            <Clock size={12} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.notificationTime, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {formatTimeAgo(item.created_at)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
          disabled={deletingId === item.id}
          activeOpacity={0.6}
        >
          <Trash2 size={16} color="#dc2626" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [isDark, deletingId, handleNotificationPress, handleDelete, getNotificationIcon, formatTimeAgo]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const ItemSeparator = useMemo(() => (
    <View style={[styles.separator, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />
  ), [isDark]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                height: MODAL_HEIGHT,
                paddingBottom: insets.bottom
              },
              modalAnimatedStyle
            ]}
          >
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: isDark ? '#4b5563' : '#d1d5db' }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
              <View style={styles.modalTitleContainer}>
                <Bell size={24} color={isDark ? '#f9fafb' : '#111827'} />
                <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Notifications
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllButton}
                    onPress={handleMarkAllAsRead}
                    activeOpacity={0.6}
                  >
                    <CheckCheck size={20} color="#2563eb" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                  activeOpacity={0.6}
                >
                  <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
                </TouchableOpacity>
              </View>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Bell size={64} color={isDark ? '#4b5563' : '#d1d5db'} />
                <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  No Notifications
                </Text>
                <Text style={[styles.emptyMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  You're all caught up! Check back later for updates.
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={keyExtractor}
                style={styles.notificationList}
                contentContainerStyle={styles.notificationListContent}
                showsVerticalScrollIndicator={true}
                ItemSeparatorComponent={() => ItemSeparator}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                windowSize={10}
              />
            )}
          </Animated.View>
        </GestureDetector>
      </View>

      <Modal
        visible={accessDeniedError !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAccessDeniedError(null)}
      >
        <View style={styles.errorModalOverlay}>
          <View style={[styles.errorModalContent, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <View style={[styles.errorIconContainer, { backgroundColor: isDark ? '#374151' : '#fee2e2' }]}>
              <AlertCircle size={48} color="#dc2626" />
            </View>
            <Text style={[styles.errorTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Access Denied
            </Text>
            <Text style={[styles.errorMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {accessDeniedError?.businessName
                ? `You no longer have access to ${accessDeniedError.businessName}. The business owner may have removed your access.`
                : 'You no longer have access to this business. The business owner may have removed your access.'}
            </Text>
            <TouchableOpacity
              style={[styles.errorButton, { backgroundColor: '#2563eb' }]}
              onPress={() => {
                setAccessDeniedError(null);
                router.push('/(app)/(tabs)/');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.errorButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    padding: 8,
  },
  closeButton: {
    padding: 4,
  },
  notificationList: {
    flex: 1,
  },
  notificationListContent: {
    paddingVertical: 8,
  },
  notificationItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderLeftWidth: 4,
  },
  separator: {
    height: 1,
    marginHorizontal: 20,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationIcon: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  errorButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
