import React from 'react';
import { Platform, Alert, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface CustomerCenterProps {
  onDismiss?: () => void;
}

export const CustomerCenterButton: React.FC<CustomerCenterProps> = ({ onDismiss }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const handleOpenCustomerCenter = () => {
    Alert.alert(
      t('subscription.customerCenter.unavailable'),
      'Customer Center requires a development build. Run: npx expo prebuild',
      [{ text: t('common.ok') }]
    );
  };

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.button, isDark && styles.buttonDark]}
      onPress={handleOpenCustomerCenter}
    >
      <Settings size={20} color={isDark ? '#60a5fa' : '#3b82f6'} />
      <Text style={[styles.buttonText, isDark && styles.buttonTextDark]}>
        {t('subscription.customerCenter.title')}
      </Text>
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
