import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface WarningBannerProps {
  salesCount: number;
  remainingSales: number;
  totalLimit: number;
  onUpgrade: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  isOwner?: boolean;
  ownershipMessage?: string;
}

export const WarningBanner: React.FC<WarningBannerProps> = ({
  salesCount,
  remainingSales,
  totalLimit,
  onUpgrade,
  onDismiss,
  dismissible = true,
  isOwner = true,
  ownershipMessage
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const percentageUsed = (salesCount / totalLimit) * 100;
  const isHighWarning = percentageUsed >= 90;

  const colors = {
    background: isDark ? '#78350f' : '#fef3c7',
    border: isDark ? '#92400e' : '#fde68a',
    icon: '#f59e0b',
    text: isDark ? '#fde68a' : '#92400e',
    title: isDark ? '#fcd34d' : '#78350f',
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingTop: Math.max(12, insets.top + 12),
          paddingLeft: Math.max(16, insets.left + 8),
          paddingRight: Math.max(16, insets.right + 8)
        }
      ]}
    >
      <View style={styles.content}>
        <AlertTriangle size={20} color={colors.icon} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.title }]}>
            {!isOwner && ownershipMessage
              ? 'Business in Read-Only Mode'
              : isHighWarning ? t('subscription.almostAtFreeLimit') : t('subscription.approachingFreeLimit')}
          </Text>
          <Text style={[styles.message, { color: colors.text }]}>
            {!isOwner && ownershipMessage
              ? ownershipMessage
              : remainingSales === 1
              ? t('subscription.onlyOneSaleRemaining', { current: salesCount, limit: totalLimit })
              : t('subscription.salesRemainingCount', { remaining: remainingSales, current: salesCount, limit: totalLimit })}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {isOwner && (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={onUpgrade}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.upgradeText}>{t('subscription.upgrade')}</Text>
          </TouchableOpacity>
        )}
        {dismissible && onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    gap: 12,
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
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
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
