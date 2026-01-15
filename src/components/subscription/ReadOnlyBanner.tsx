import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AlertCircle, X } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface ReadOnlyBannerProps {
  salesCount?: number;
  businessName?: string;
  businessCount?: number;
  onUpgrade: () => void;
  onSwitchBusiness?: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  showSelectBusinesses?: boolean;
  variant?: 'sales_limit' | 'business_readonly';
  isOwner?: boolean;
  ownershipMessage?: string;
}

export const ReadOnlyBanner: React.FC<ReadOnlyBannerProps> = ({
  salesCount,
  businessName,
  businessCount,
  onUpgrade,
  onSwitchBusiness,
  onDismiss,
  dismissible = false,
  showSelectBusinesses = false,
  variant = 'sales_limit',
  isOwner = true,
  ownershipMessage
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const getTitle = () => {
    if (!isOwner && variant === 'business_readonly') {
      return t('subscription.inactiveBusinessTeamMember.title');
    }
    if (!isOwner && ownershipMessage) {
      return 'Business in Read-Only Mode';
    }
    if (variant === 'business_readonly') {
      return businessName
        ? `'${businessName}' is in read-only mode`
        : 'Business is in read-only mode';
    }
    return t('subscription.freeLimitReached');
  };

  const getMessage = () => {
    if (!isOwner && variant === 'business_readonly') {
      return t('subscription.inactiveBusinessTeamMember.message');
    }
    if (!isOwner && ownershipMessage) {
      return ownershipMessage;
    }
    if (variant === 'business_readonly') {
      return 'You can view data and manage products, but cannot create sales transactions.';
    }
    return t('subscription.upgradeMessage');
  };

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        variant === 'business_readonly' && styles.containerWarning,
        variant === 'business_readonly' && isDark && styles.containerWarningDark,
        {
          paddingTop: Math.max(12, insets.top + 12),
          paddingLeft: Math.max(16, insets.left + 8),
          paddingRight: Math.max(16, insets.right + 8)
        }
      ]}
    >
      <View style={styles.content}>
        <AlertCircle size={20} color={variant === 'business_readonly' ? '#f59e0b' : '#ef4444'} />
        <View style={styles.textContainer}>
          <Text style={[
            styles.title,
            isDark && styles.titleDark,
            variant === 'business_readonly' && styles.titleWarning,
            variant === 'business_readonly' && isDark && styles.titleWarningDark
          ]}>
            {getTitle()}
          </Text>
          <Text style={[
            styles.message,
            isDark && styles.messageDark,
            variant === 'business_readonly' && styles.messageWarning,
            variant === 'business_readonly' && isDark && styles.messageWarningDark
          ]}>
            {getMessage()}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {showSelectBusinesses ? (
          <TouchableOpacity
            style={[styles.upgradeButton, isDark && styles.upgradeButtonDark]}
            onPress={onUpgrade}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.upgradeText}>Choose Active</Text>
          </TouchableOpacity>
        ) : (
          <>
            {!(!isOwner && variant === 'business_readonly') && isOwner && (
              <TouchableOpacity
                style={[
                  styles.upgradeButton,
                  isDark && styles.upgradeButtonDark,
                  variant === 'business_readonly' && styles.upgradeButtonWarning,
                  variant === 'business_readonly' && isDark && styles.upgradeButtonWarningDark
                ]}
                onPress={onUpgrade}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.upgradeText}>{t('subscription.upgrade')}</Text>
              </TouchableOpacity>
            )}
            {variant === 'business_readonly' && onSwitchBusiness && isOwner && (
              <TouchableOpacity
                style={[styles.secondaryButton, isDark && styles.secondaryButtonDark]}
                onPress={onSwitchBusiness}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.secondaryButtonText, isDark && styles.secondaryButtonTextDark]}>
                  Switch
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
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
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    gap: 12,
  },
  containerDark: {
    backgroundColor: '#7f1d1d',
    borderBottomColor: '#991b1b',
  },
  containerWarning: {
    backgroundColor: '#fef3c7',
    borderBottomColor: '#fde68a',
  },
  containerWarningDark: {
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
    color: '#991b1b',
    marginBottom: 2,
  },
  titleDark: {
    color: '#fca5a5',
  },
  titleWarning: {
    color: '#92400e',
  },
  titleWarningDark: {
    color: '#fbbf24',
  },
  message: {
    fontSize: 12,
    color: '#7f1d1d',
  },
  messageDark: {
    color: '#fecaca',
  },
  messageWarning: {
    color: '#78350f',
  },
  messageWarningDark: {
    color: '#fde68a',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeButtonDark: {
    backgroundColor: '#dc2626',
  },
  upgradeButtonWarning: {
    backgroundColor: '#f59e0b',
  },
  upgradeButtonWarningDark: {
    backgroundColor: '#d97706',
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#92400e',
    minHeight: 44,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonDark: {
    borderColor: '#fbbf24',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  secondaryButtonTextDark: {
    color: '#fbbf24',
  },
  dismissButton: {
    padding: 12,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
