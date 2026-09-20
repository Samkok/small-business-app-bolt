import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react-native';

interface WebOrderBadgeProps {
  orderRef?: string | null;
}

/** Marks a cart that a customer placed on the public online menu (carts.source = 'web'). */
export const WebOrderBadge = React.memo(function WebOrderBadge({ orderRef }: WebOrderBadgeProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.badge} accessibilityLabel={`${t('onlineMenu.onlineOrder')}${orderRef ? ` ${orderRef}` : ''}`}>
      <Globe size={12} color="#7c3aed" />
      <Text style={styles.text}>
        {t('onlineMenu.onlineOrder')}{orderRef ? ` · ${orderRef}` : ''}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: '#7c3aed1f', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  text: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },
});
