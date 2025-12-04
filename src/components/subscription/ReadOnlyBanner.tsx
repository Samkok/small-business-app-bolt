import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, X } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface ReadOnlyBannerProps {
  salesCount: number;
  onUpgrade: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
}

export const ReadOnlyBanner: React.FC<ReadOnlyBannerProps> = ({
  salesCount,
  onUpgrade,
  onDismiss,
  dismissible = false
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        {
          paddingTop: Math.max(12, insets.top + 12),
          paddingLeft: Math.max(16, insets.left + 8),
          paddingRight: Math.max(16, insets.right + 8)
        }
      ]}
    >
      <View style={styles.content}>
        <AlertCircle size={20} color="#f59e0b" />
        <View style={styles.textContainer}>
          <Text style={[styles.title, isDark && styles.titleDark]}>
            Free limit reached
          </Text>
          <Text style={[styles.message, isDark && styles.messageDark]}>
            Upgrade to unlock unlimited sales
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.upgradeButton, isDark && styles.upgradeButtonDark]}
          onPress={onUpgrade}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.upgradeText}>Upgrade</Text>
        </TouchableOpacity>
        {dismissible && onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    gap: 12,
  },
  containerDark: {
    backgroundColor: '#78350f',
    borderBottomColor: '#92400e',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 2,
  },
  titleDark: {
    color: '#fcd34d',
  },
  message: {
    fontSize: 12,
    color: '#92400e',
  },
  messageDark: {
    color: '#fde68a',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeButtonDark: {
    backgroundColor: '#fbbf24',
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  dismissButton: {
    padding: 12,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
