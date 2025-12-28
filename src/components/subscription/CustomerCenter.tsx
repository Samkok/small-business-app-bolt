import React, { useEffect, useState } from 'react';
import { Platform, Alert, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { presentCustomerCenter, CustomerCenterResult } from 'react-native-purchases-ui';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface CustomerCenterProps {
  onDismiss?: () => void;
}

export const CustomerCenterButton: React.FC<CustomerCenterProps> = ({ onDismiss }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleOpenCustomerCenter = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        t('subscription.customerCenter.unavailable'),
        t('subscription.customerCenter.webMessage'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    try {
      setLoading(true);
      console.log('[CustomerCenter] Opening customer center...');

      const result: CustomerCenterResult = await presentCustomerCenter();

      console.log('[CustomerCenter] Result:', result);

      switch (result) {
        case CustomerCenterResult.RESTORED:
          Alert.alert(
            t('subscription.alerts.restoreSuccessTitle'),
            t('subscription.alerts.restoreSuccessMessage'),
            [{ text: t('common.ok') }]
          );
          break;

        case CustomerCenterResult.ERROR:
          console.error('[CustomerCenter] Error occurred');
          Alert.alert(
            t('common.error'),
            t('subscription.customerCenter.errorMessage'),
            [{ text: t('common.ok') }]
          );
          break;
      }

      onDismiss?.();
    } catch (error) {
      console.error('[CustomerCenter] Error opening customer center:', error);
      Alert.alert(
        t('common.error'),
        t('subscription.customerCenter.errorMessage'),
        [{ text: t('common.ok') }]
      );
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.button, isDark && styles.buttonDark]}
      onPress={handleOpenCustomerCenter}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#3b82f6'} />
      ) : (
        <>
          <Settings size={20} color={isDark ? '#60a5fa' : '#3b82f6'} />
          <Text style={[styles.buttonText, isDark && styles.buttonTextDark]}>
            {t('subscription.customerCenter.title')}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    marginTop: 12,
  },
  buttonDark: {
    backgroundColor: '#1e3a8a',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  buttonTextDark: {
    color: '#93c5fd',
  },
});

export default CustomerCenterButton;
