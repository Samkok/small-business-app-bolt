import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Plus, Star, Pencil, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { currencyService, Currency } from '@/src/services/currencies';

export default function CurrenciesScreen() {
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const router = useRouter();

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [rate, setRate] = useState('1');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!currentBusiness?.id) return;
    setLoading(true);
    try {
      const list = await currencyService.getCurrencies(currentBusiness.id);
      setCurrencies(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setCode('');
    setName('');
    setSymbol('');
    setRate('1');
    setFormError('');
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (currency: Currency) => {
    setEditing(currency);
    setCode(currency.code);
    setName(currency.name);
    setSymbol(currency.symbol);
    setRate(String(currency.exchange_rate_to_usd));
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentBusiness?.id) return;
    const codeTrim = code.trim().toUpperCase();
    const nameTrim = name.trim();
    const symTrim = symbol.trim();
    const rateNum = parseFloat(rate);

    if (!codeTrim || codeTrim.length < 3) {
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
      if (editing) {
        await currencyService.updateCurrency(editing.id, {
          name: nameTrim,
          symbol: symTrim,
          exchange_rate_to_usd: rateNum,
        });
      } else {
        await currencyService.createCurrency({
          business_id: currentBusiness.id,
          code: codeTrim,
          name: nameTrim,
          symbol: symTrim,
          exchange_rate_to_usd: rateNum,
        });
      }
      setShowForm(false);
      resetForm();
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save currency');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (c: Currency) => {
    if (!currentBusiness?.id || c.is_default) return;
    try {
      await currencyService.setDefaultCurrency(currentBusiness.id, c.id);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to set default currency');
    }
  };

  const handleDelete = (c: Currency) => {
    if (c.is_default) {
      Alert.alert('Cannot delete', 'The default currency cannot be deleted. Set another currency as default first.');
      return;
    }
    Alert.alert('Delete currency', `Delete ${c.code}? Products priced in this currency will lose their currency reference.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await currencyService.deleteCurrency(c.id);
            await load();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete currency');
          }
        },
      },
    ]);
  };

  const headerBg = isDark ? '#111827' : '#f9fafb';
  const cardText = isDark ? '#f9fafb' : '#111827';
  const cardMuted = isDark ? '#9ca3af' : '#6b7280';

  const sortedCurrencies = useMemo(() => currencies, [currencies]);

  return (
    <View style={[styles.container, { backgroundColor: headerBg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={cardText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: cardText }]}>Currencies</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Plus size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.description, { color: cardMuted }]}>
          Exchange rates are relative to 1 USD. Editing a rate affects future sales only; past sales keep their
          snapshot.
        </Text>

        {loading ? (
          <Text style={[styles.emptyText, { color: cardMuted }]}>Loading...</Text>
        ) : sortedCurrencies.length === 0 ? (
          <Text style={[styles.emptyText, { color: cardMuted }]}>No currencies yet.</Text>
        ) : (
          sortedCurrencies.map(c => (
            <Card key={c.id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemTitleRow}>
                    <Text style={[styles.itemCode, { color: cardText }]}>{c.code}</Text>
                    <Text style={[styles.itemSymbol, { color: cardMuted }]}>{c.symbol}</Text>
                    {c.is_default && (
                      <View style={styles.defaultBadge}>
                        <Star size={10} color="#f59e0b" fill="#f59e0b" />
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.itemName, { color: cardMuted }]}>{c.name}</Text>
                  <Text style={[styles.itemRate, { color: cardMuted }]}>
                    1 USD = {Number(c.exchange_rate_to_usd).toLocaleString()} {c.code}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  {!c.is_default && (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleSetDefault(c)}
                      accessibilityLabel="Set as default"
                    >
                      <Star size={18} color={cardMuted} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEdit(c)}
                    accessibilityLabel="Edit"
                  >
                    <Pencil size={18} color="#2563eb" />
                  </TouchableOpacity>
                  {!c.is_default && (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleDelete(c)}
                      accessibilityLabel="Delete"
                    >
                      <Trash2 size={18} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: cardText }]}>
                {editing ? 'Edit currency' : 'New currency'}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
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
                editable={!editing}
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

            <View style={styles.modalFooter}>
              <Button title="Cancel" variant="outline" onPress={() => setShowForm(false)} style={styles.modalBtn} />
              <Button title={editing ? 'Save' : 'Create'} loading={saving} onPress={handleSave} style={styles.modalBtn} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: { padding: 8 },
  addButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 80 },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  emptyText: { textAlign: 'center', paddingVertical: 32 },
  itemCard: { marginBottom: 12, padding: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemCode: { fontSize: 16, fontWeight: '700' },
  itemSymbol: { fontSize: 14 },
  itemName: { fontSize: 13, marginBottom: 2 },
  itemRate: { fontSize: 12 },
  itemActions: { flexDirection: 'row', gap: 6 },
  iconButton: { padding: 8, borderRadius: 8 },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: { color: '#92400e', fontSize: 10, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalBtn: { flex: 1 },
  errorText: { color: '#dc2626', fontSize: 13, marginTop: 8 },
});
