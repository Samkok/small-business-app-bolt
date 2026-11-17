import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Camera, X } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { ReceiptViewer } from '@/src/components/receipts/ReceiptViewer';
import {
  MAX_RECEIPTS_PER_EXPENSE,
  ReceiptDraft,
  getReceiptUrls,
  pickReceipt,
} from '@/src/services/expenseReceipts';

interface ReceiptPickerProps {
  value: ReceiptDraft;
  onChange: (draft: ReceiptDraft) => void;
  /** Viewer title, e.g. the expense description. */
  title?: string;
  /** Shows a spinner on the add tile and blocks changes while a save is running. */
  busy?: boolean;
}

/**
 * Thumbnails of a record's receipts (stored ones signed on demand, new ones from the device),
 * an add tile (camera or photos) and a remove button on each. Changes are reported through
 * onChange; the parent decides when to save them (syncReceipts).
 */
export function ReceiptPicker({ value, onChange, title, busy = false }: ReceiptPickerProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewer, setViewer] = useState<{ paths: string[]; localUris: string[]; index: number } | null>(null);

  const keptKey = value.kept.join('|');
  useEffect(() => {
    if (!value.kept.length) return;
    let cancelled = false;
    getReceiptUrls(value.kept)
      .then((map) => !cancelled && setUrls((prev) => ({ ...prev, ...map })))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keptKey]);

  const total = value.kept.length + value.added.length;
  const border = { borderColor: isDark ? '#4b5563' : '#d1d5db' };

  const add = (source: 'camera' | 'library') => async () => {
    try {
      const receipt = await pickReceipt(source);
      if (receipt) onChange({ kept: value.kept, added: [...value.added, receipt] });
    } catch (error) {
      console.error('Receipt photo error:', error);
      Alert.alert(t('common.error'), t('expenses.receiptPhotoFailed'));
    }
  };

  const handleAdd = () => {
    if (busy) return;
    if (total >= MAX_RECEIPTS_PER_EXPENSE) {
      Alert.alert(t('expenses.receipts'), t('expenses.receiptLimit', { max: MAX_RECEIPTS_PER_EXPENSE }));
      return;
    }
    Alert.alert(t('expenses.addReceipt'), undefined, [
      { text: t('expenses.takePhoto'), onPress: add('camera') },
      { text: t('expenses.chooseFromLibrary'), onPress: add('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View>
      <Text style={[styles.hint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
        {t('expenses.receiptsHint', { max: MAX_RECEIPTS_PER_EXPENSE })}
      </Text>
      <View style={styles.row}>
        {value.kept.map((path, i) => (
          <View key={path}>
            <TouchableOpacity
              onPress={() => setViewer({ paths: value.kept, localUris: [], index: i })}
              style={[styles.thumb, border]}
            >
              {urls[path] ? <Image source={{ uri: urls[path] }} style={styles.image} /> : <ActivityIndicator />}
            </TouchableOpacity>
            {!busy && (
              <TouchableOpacity
                style={styles.remove}
                onPress={() => onChange({ kept: value.kept.filter((p) => p !== path), added: value.added })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Remove receipt"
              >
                <X size={12} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {value.added.map((receipt, i) => (
          <View key={receipt.uri}>
            <TouchableOpacity
              onPress={() => setViewer({ paths: [], localUris: value.added.map((r) => r.uri), index: i })}
              style={[styles.thumb, border]}
            >
              <Image source={{ uri: receipt.uri }} style={styles.image} />
            </TouchableOpacity>
            {!busy && (
              <TouchableOpacity
                style={styles.remove}
                onPress={() => onChange({ kept: value.kept, added: value.added.filter((r) => r.uri !== receipt.uri) })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Remove receipt"
              >
                <X size={12} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {total < MAX_RECEIPTS_PER_EXPENSE && (
          <TouchableOpacity
            style={[
              styles.thumb,
              styles.addTile,
              { borderColor: isDark ? '#4b5563' : '#93c5fd', backgroundColor: isDark ? '#1f2937' : '#eff6ff' },
            ]}
            onPress={handleAdd}
            disabled={busy}
            accessibilityLabel={t('expenses.addReceipt')}
          >
            {busy ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <>
                <Camera size={22} color="#2563eb" />
                <Text style={styles.addText}>{t('expenses.addReceipt')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ReceiptViewer
        visible={!!viewer}
        paths={viewer?.paths}
        localUris={viewer?.localUris}
        initialIndex={viewer?.index ?? 0}
        title={title || t('expenses.receipts')}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: {
    width: 76,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: { borderStyle: 'dashed', gap: 4, paddingHorizontal: 4 },
  addText: { fontSize: 11, fontWeight: '600', color: '#2563eb', textAlign: 'center' },
});
