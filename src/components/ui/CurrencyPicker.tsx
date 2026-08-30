import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

interface CurrencyPickerProps {
  currencies: Currency[];
  selectedCurrencyId: string | null;
  onSelect: (currencyId: string) => void;
}

export function CurrencyPicker({ currencies, selectedCurrencyId, onSelect }: CurrencyPickerProps) {
  const { isDark } = useTheme();

  if (currencies.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {currencies.map((currency) => {
        const isSelected = currency.id === selectedCurrencyId;
        return (
          <TouchableOpacity
            key={currency.id}
            onPress={() => onSelect(currency.id)}
            style={[
              styles.chip,
              isSelected
                ? styles.chipSelected
                : { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                isSelected
                  ? styles.chipTextSelected
                  : { color: isDark ? '#d1d5db' : '#374151' },
              ]}
            >
              {currency.symbol} {currency.code}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
});
