import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

export interface DeliveryFeeCurrency {
  id: string;
  code: string;
  symbol: string;
}

interface DeliveryFeeInputProps {
  value: string;
  onChangeText: (value: string) => void;
  currencies: DeliveryFeeCurrency[];
  /** the currency the amount is typed in */
  currencyId: string | null | undefined;
  onCurrencyChange: (currencyId: string) => void;
  /** e.g. "= ៛6,000 on this order", shown when the typed currency is not the order's */
  convertedHint?: string | null;
  autoFocus?: boolean;
}

/**
 * Delivery fee box whose leading symbol is a currency picker. The order is kept in one
 * currency, so a fee typed in another one is converted by the caller; this component only
 * collects the amount and the currency it was typed in. The list opens inline (no modal),
 * because this input also lives inside quick checkout's popup.
 */
export function DeliveryFeeInput({ value, onChangeText, currencies, currencyId, onCurrencyChange, convertedHint, autoFocus }: DeliveryFeeInputProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);

  const selected = currencies.find(c => c.id === currencyId) || currencies[0];
  const canChoose = currencies.length > 1;
  const border = isDark ? '#4b5563' : '#d1d5db';
  const text = isDark ? '#f9fafb' : '#111827';
  const subtext = isDark ? '#9ca3af' : '#6b7280';

  return (
    <View>
      <View style={[styles.box, { backgroundColor: isDark ? '#374151' : '#f9fafb', borderColor: border }]}>
        <TouchableOpacity
          style={[styles.currencyButton, { borderRightColor: border }]}
          onPress={() => canChoose && setOpen(o => !o)}
          disabled={!canChoose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${t('delivery.feeCurrency')}: ${selected?.code || ''}`}
        >
          <Text style={[styles.symbol, { color: text }]}>{selected?.symbol || '$'}</Text>
          {canChoose && <Text style={[styles.code, { color: subtext }]}>{selected?.code}</Text>}
          {canChoose && <ChevronDown size={14} color={subtext} />}
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder="0.00"
          placeholderTextColor={subtext}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          accessibilityLabel={t('delivery.fee')}
        />
      </View>

      {open && (
        <View style={[styles.menu, { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: border }]}>
          {currencies.map((c, index) => {
            const isSelected = c.id === selected?.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.menuRow, index > 0 && { borderTopWidth: 1, borderTopColor: border }]}
                onPress={() => { onCurrencyChange(c.id); setOpen(false); }}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.menuSymbol, { color: text }]}>{c.symbol}</Text>
                <Text style={[styles.menuCode, { color: text }]}>{c.code}</Text>
                {isSelected && <Check size={16} color="#2563eb" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!!convertedHint && <Text style={[styles.hint, { color: subtext }]}>{convertedHint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, minHeight: 48 },
  currencyButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, alignSelf: 'stretch', borderRightWidth: 1 },
  symbol: { fontSize: 16, fontWeight: '700' },
  code: { fontSize: 12, fontWeight: '600' },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10 },
  menu: { borderWidth: 1, borderRadius: 8, marginTop: 6, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  menuSymbol: { fontSize: 15, fontWeight: '700', width: 24 },
  menuCode: { flex: 1, fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 6 },
});
