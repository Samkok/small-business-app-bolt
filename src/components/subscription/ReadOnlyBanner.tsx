import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
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
        >
          <Text style={styles.upgradeText}>Upgrade</Text>
        </TouchableOpacity>
        {dismissible && onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
    padding: 4,
  },
});
