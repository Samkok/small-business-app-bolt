import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CircleCheck as CheckCircle2, Truck } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { PaymentStatus, PAYMENT_STATUS_OPTIONS } from '@/src/utils/paymentStatus';

interface PaymentStatusSelectorProps {
  value: PaymentStatus | null | undefined;
  onChange: (value: PaymentStatus) => void;
  /** Highlights the pair in red when nothing is chosen (used after a failed submit) */
  showError?: boolean;
  disabled?: boolean;
}

/**
 * PAID or COD. Deliberately has no default: the seller must choose one for every
 * sale, so a COD order is never recorded as paid by accident. Used at both
 * checkouts and in the sale edit form.
 */
export function PaymentStatusSelector({ value, onChange, showError, disabled }: PaymentStatusSelectorProps) {
  const { isDark } = useTheme();
  const missing = showError && !value;

  return (
    <View>
      <View style={styles.row}>
        {PAYMENT_STATUS_OPTIONS.map(option => {
          const selected = value === option.value;
          const tone = option.value === 'paid' ? '#059669' : '#d97706';
          const Icon = option.value === 'paid' ? CheckCircle2 : Truck;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? `${tone}18` : isDark ? '#374151' : '#f9fafb',
                  borderColor: selected ? tone : missing ? '#dc2626' : isDark ? '#4b5563' : '#d1d5db',
                  borderWidth: selected ? 2 : 1,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}, ${option.hint}`}
            >
              <View style={styles.optionHeader}>
                <Icon size={18} color={selected ? tone : isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={[styles.optionLabel, { color: selected ? tone : isDark ? '#f9fafb' : '#111827' }]}>{option.label}</Text>
              </View>
              <Text style={[styles.optionHint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{option.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {missing && <Text style={styles.error}>Choose PAID or COD to continue</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, borderRadius: 10, padding: 12, gap: 4 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  optionHint: { fontSize: 12, lineHeight: 16 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 6 },
});
