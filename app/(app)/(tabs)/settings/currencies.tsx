import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Plus, Star, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { currencyService, Currency } from '@/src/services/currencies';
import { CurrencyEditorModal } from '@/src/components/settings/CurrencyEditorModal';

export default function CurrenciesScreen() {
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const router = useRouter();

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);

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

  const openCreate = () => {
    setEditing(null);
    setShowEditor(true);
  };

  const openEdit = (currency: Currency) => {
    setEditing(currency);
    setShowEditor(true);
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
    Alert.alert(
      'Delete currency',
      `Delete ${c.code}? Products priced in this currency will lose their currency reference.`,
      [
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
      ],
    );
  };

  const headerBg = isDark ? '#111827' : '#f9fafb';
  const cardText = isDark ? '#f9fafb' : '#111827';
  const cardMuted = isDark ? '#9ca3af' : '#6b7280';

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
        ) : currencies.length === 0 ? (
          <Text style={[styles.emptyText, { color: cardMuted }]}>No currencies yet.</Text>
        ) : (
          currencies.map(c => (
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

      <CurrencyEditorModal
        visible={showEditor}
        businessId={currentBusiness?.id || ''}
        currency={editing}
        onClose={() => setShowEditor(false)}
        onSaved={() => load()}
      />
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
});
