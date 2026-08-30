import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface Currency {
  id: string;
  code: string;
  symbol: string;
}

interface CurrencyDropdownProps {
  currencies: Currency[];
  selectedCurrencyId: string | null;
  onSelect: (currencyId: string) => void;
}

export function CurrencyDropdown({ currencies, selectedCurrencyId, onSelect }: CurrencyDropdownProps) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = currencies.find(c => c.id === selectedCurrencyId) || currencies[0];

  if (!selected) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, {
          backgroundColor: isDark ? '#374151' : '#ffffff',
          borderColor: isDark ? '#4b5563' : '#d1d5db',
        }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {selected.symbol} {selected.code}
        </Text>
        <ChevronDown size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }]}>
            <Text style={[styles.menuTitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Select Currency</Text>
            {currencies.map((currency) => {
              const isActive = currency.id === selectedCurrencyId;
              return (
                <TouchableOpacity
                  key={currency.id}
                  style={[styles.menuItem, isActive && { backgroundColor: isDark ? '#374151' : '#f0f9ff' }]}
                  onPress={() => { onSelect(currency.id); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <Text style={[styles.menuItemSymbol, { color: isDark ? '#f9fafb' : '#111827' }]}>{currency.symbol}</Text>
                    <Text style={[styles.menuItemCode, { color: isDark ? '#f9fafb' : '#111827' }]}>{currency.code}</Text>
                  </View>
                  {isActive && <Check size={16} color="#2563eb" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  menu: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemSymbol: {
    fontSize: 16,
    fontWeight: '700',
    width: 28,
  },
  menuItemCode: {
    fontSize: 14,
    fontWeight: '600',
  },
});
