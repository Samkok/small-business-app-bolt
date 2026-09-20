import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { UserRound, Store } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { DeliveryPayer, DELIVERY_PAYERS } from '@/src/utils/deliveryPayer';

interface DeliveryPayerSelectorProps {
  value: DeliveryPayer;
  onChange: (value: DeliveryPayer) => void;
  disabled?: boolean;
}

/**
 * Two tabs above the delivery fee: "Customer pays" (the fee is charged on the receipt) or
 * "Shop pays" (free delivery, the fee comes out of the shop's money). Used by the cart
 * screen and quick checkout so both behave the same.
 */
export function DeliveryPayerSelector({ value, onChange, disabled }: DeliveryPayerSelectorProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  return (
    <View>
      <View style={[styles.tabs, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]} accessibilityRole="tablist">
        {DELIVERY_PAYERS.map(payer => {
          const selected = value === payer;
          const tone = payer === 'customer' ? '#2563eb' : '#ea580c';
          const Icon = payer === 'customer' ? UserRound : Store;
          return (
            <TouchableOpacity
              key={payer}
              style={[styles.tab, selected && { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: tone }]}
              onPress={() => onChange(payer)}
              disabled={disabled}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(`delivery.${payer}Pays`)}. ${t(`delivery.${payer}PaysTag`)}`}
            >
              <View style={styles.tabHeader}>
                <Icon size={15} color={selected ? tone : isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={[styles.tabTitle, { color: selected ? tone : isDark ? '#d1d5db' : '#374151' }]} numberOfLines={1}>
                  {t(`delivery.${payer}Pays`)}
                </Text>
              </View>
              <Text style={[styles.tabTag, { color: isDark ? '#9ca3af' : '#6b7280' }]} numberOfLines={1}>
                {t(`delivery.${payer}PaysTag`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{t(`delivery.${value}PaysHint`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  tabHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabTitle: { fontSize: 14, fontWeight: '700' },
  tabTag: { fontSize: 11, marginTop: 1 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});
