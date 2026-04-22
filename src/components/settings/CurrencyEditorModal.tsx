import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { currencyService, Currency } from '@/src/services/currencies';

interface CurrencyEditorModalProps {
  visible: boolean;
  businessId: string;
  currency?: Currency | null;
  onClose: () => void;
  onSaved: (currency: Currency) => void;
}

export function CurrencyEditorModal({
  visible,
  businessId,
  currency,
  onClose,
  onSaved,
}: CurrencyEditorModalProps) {
  const { isDark } = useTheme();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [rate, setRate] = useState('1');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (currency) {
      setCode(currency.code);
      setName(currency.name);
      setSymbol(currency.symbol);
      setRate(String(currency.exchange_rate_to_usd));
    } else {
      setCode('');
      setName('');
      setSymbol('');
      setRate('1');
    }
    setFormError('');
  }, [visible, currency]);

  const handleSave = async () => {
    const codeTrim = code.trim().toUpperCase();
    const nameTrim = name.trim();
    const symTrim = symbol.trim();
    const rateNum = parseFloat(rate);

    if (!currency && (!codeTrim || codeTrim.length < 3)) {
      setFormError('Currency code must be at least 3 characters (e.g. USD, KHR).');
      return;
    }
    if (!nameTrim) {
      setFormError('Currency name is required.');
      return;
    }
    if (!symTrim) {
      setFormError('Currency symbol is required.');
      return;
    }
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setFormError('Exchange rate must be a positive number.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const saved = currency
        ? await currencyService.updateCurrency(currency.id, {
            name: nameTrim,
            symbol: symTrim,
            exchange_rate_to_usd: rateNum,
          })
        : await currencyService.createCurrency({
            business_id: businessId,
            code: codeTrim,
            name: nameTrim,
            symbol: symTrim,
            exchange_rate_to_usd: rateNum,
          });
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save currency');
    } finally {
      setSaving(false);
    }
  };

  const cardText = isDark ? '#f9fafb' : '#111827';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: cardText }]}>
              {currency ? 'Edit currency' : 'New currency'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={cardText} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input
              label="Code"
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              placeholder="e.g. KHR"
              autoCapitalize="characters"
              editable={!currency}
            />
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Khmer Riel" />
            <Input label="Symbol" value={symbol} onChangeText={setSymbol} placeholder="e.g. " />
            <Input
              label="Exchange rate (1 USD = ? this currency)"
              value={rate}
              onChangeText={setRate}
              placeholder="4100"
              keyboardType="decimal-pad"
            />
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={styles.btn} />
            <Button
              title={currency ? 'Save' : 'Create'}
              loading={saving}
              onPress={handleSave}
              style={styles.btn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1 },
  errorText: { color: '#dc2626', fontSize: 13, marginTop: 8 },
});
