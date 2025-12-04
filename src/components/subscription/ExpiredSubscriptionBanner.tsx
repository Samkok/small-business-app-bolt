import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';

interface ExpiredSubscriptionBannerProps {
  onUpgrade: () => void;
}

export const ExpiredSubscriptionBanner: React.FC<ExpiredSubscriptionBannerProps> = ({
  onUpgrade,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();
  const insets = useSafeAreaInsets();

  const isOwner = user?.id === currentBusiness?.owner_user_id;

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
        <AlertCircle size={20} color="#ef4444" />
        <View style={styles.textContainer}>
          <Text style={[styles.title, isDark && styles.titleDark]}>
            {isOwner ? t('subscription.subscriptionExpired') : t('subscription.subscriptionExpiredNonOwner')}
          </Text>
          <Text style={[styles.message, isDark && styles.messageDark]}>
            {isOwner
              ? t('subscription.renewToUnlock')
              : t('subscription.contactOwnerToRenew')
            }
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.upgradeButton, isDark && styles.upgradeButtonDark]}
          onPress={onUpgrade}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.upgradeText}>
            {isOwner ? t('subscription.renew') : t('subscription.contactOwner')}
          </Text>
        </TouchableOpacity>
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
  message: {
    fontSize: 12,
    color: '#7f1d1d',
  },
  messageDark: {
    color: '#fecaca',
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
  upgradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
