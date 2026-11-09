import React from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { X, Barcode, Package, Plus, Minus, Layers, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

/**
 * The one product picker. Quick Checkout, receiving and stock adjustments used to carry four
 * different pickers; this is the shared sheet. Two modes:
 *  - quantity mode (pass `quantities`): every row has a stepper and the sheet stays open, so a
 *    five-item sale is five taps, not five round trips;
 *  - single mode (pass `onPick`): tapping a row chooses it.
 * Search is controlled by the caller so each screen keeps its own filtering rules.
 */
export interface ProductPickerRow {
  key: string;
  product: any;
  /** unit variant shown after the name ("Box"); undefined for the base line */
  unitLabel?: string;
  priceText?: string;
  stockText?: string;
  disabled?: boolean;
  /** single mode: the product has unit variants chosen on the next step */
  multiUnit?: boolean;
  /** anything the caller needs back on pick / increment (variant, unit) */
  extra?: any;
}

interface Props {
  visible: boolean;
  title?: string;
  onClose: () => void;
  /** iOS: fires after the sheet has animated away; callers that open another sheet next use it */
  onDismissed?: () => void;
  rows: ProductPickerRow[];
  loading?: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  quantities?: Record<string, number>;
  onIncrement?: (row: ProductPickerRow) => void;
  onDecrement?: (row: ProductPickerRow) => void;
  onPick?: (row: ProductPickerRow) => void;
  onScan?: () => void;
  headerExtra?: React.ReactNode;
  footerLabel?: string;
  onFooterPress?: () => void;
}

export function ProductPickerSheet({
  visible, title = 'Select product', onClose, onDismissed, rows, loading, query, onQueryChange,
  quantities, onIncrement, onDecrement, onPick, onScan, headerExtra, footerLabel, onFooterPress,
}: Props) {
  const { isDark } = useTheme();
  const quantityMode = !!quantities;
  const text = isDark ? '#f9fafb' : '#111827';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const card = isDark ? '#1f2937' : '#ffffff';
  const border = isDark ? '#374151' : '#e5e7eb';

  const renderRow = ({ item: row }: { item: ProductPickerRow }) => {
    const p = row.product;
    const qty = quantities?.[row.key] || 0;
    const body = (
      <>
        {p.image_url ? (
          <Image source={{ uri: p.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
            <Package size={22} color={muted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={[styles.name, { color: text }]} numberOfLines={2}>
            {p.name}
            {row.unitLabel ? <Text style={{ color: muted, fontWeight: '500' }}> · {row.unitLabel}</Text> : null}
          </Text>
          {row.priceText ? <Text style={[styles.price, { color: '#059669' }]}>{row.priceText}</Text> : null}
          <View style={styles.metaRow}>
            {row.stockText ? <Text style={[styles.stock, { color: muted }]}>{row.stockText}</Text> : null}
            {row.multiUnit && (
              <View style={[styles.badge, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
                <Layers size={10} color="#2563eb" />
                <Text style={styles.badgeText}>Multi-unit</Text>
              </View>
            )}
          </View>
        </View>
      </>
    );

    if (!quantityMode) {
      return (
        <TouchableOpacity
          style={[styles.row, { backgroundColor: card, borderColor: border }, row.disabled && styles.disabled]}
          onPress={() => onPick?.(row)}
          disabled={row.disabled}
          activeOpacity={0.7}
        >
          {body}
          <ChevronRight size={20} color={muted} />
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.row, { backgroundColor: card, borderColor: qty > 0 ? '#2563eb' : border }, row.disabled && styles.disabled]}>
        {body}
        {qty > 0 ? (
          <View style={styles.stepper}>
            <TouchableOpacity style={[styles.stepButton, { backgroundColor: '#fee2e2' }]} onPress={() => onDecrement?.(row)} hitSlop={8}>
              <Minus size={16} color="#dc2626" />
            </TouchableOpacity>
            <Text style={[styles.qty, { color: text }]}>{qty}</Text>
            <TouchableOpacity style={[styles.stepButton, { backgroundColor: '#dbeafe' }]} onPress={() => onIncrement?.(row)} disabled={row.disabled} hitSlop={8}>
              <Plus size={16} color="#2563eb" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.stepButton, { backgroundColor: row.disabled ? (isDark ? '#374151' : '#f3f4f6') : '#2563eb' }]} onPress={() => onIncrement?.(row)} disabled={row.disabled} hitSlop={8}>
            <Plus size={18} color={row.disabled ? muted : '#ffffff'} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={onDismissed}>
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Text style={[styles.title, { color: text }]}>{title}</Text>
          <View style={styles.headerActions}>
            {headerExtra}
            {onScan && (
              <TouchableOpacity onPress={onScan} style={styles.headerButton} hitSlop={10} accessibilityLabel="Scan barcode">
                <Barcode size={24} color={text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={10} accessibilityLabel="Close">
              <X size={24} color={text} />
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={[styles.search, { backgroundColor: isDark ? '#1f2937' : '#ffffff', color: text, borderColor: border }]}
          placeholder="Search name or barcode"
          placeholderTextColor={muted}
          value={query}
          onChangeText={onQueryChange}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: footerLabel ? 96 : 24 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: muted }]}>{loading ? 'Loading products...' : 'No products match'}</Text>}
        />
        {footerLabel && (
          <View style={[styles.footer, { backgroundColor: isDark ? '#111827' : '#f9fafb', borderTopColor: border }]}>
            <TouchableOpacity style={styles.footerButton} onPress={onFooterPress ?? onClose}>
              <Text style={styles.footerButtonText}>{footerLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 20 : 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerButton: { padding: 4 },
  search: { margin: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 10, borderWidth: 1, gap: 12 },
  disabled: { opacity: 0.55 },
  image: { width: 52, height: 52, borderRadius: 8 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  price: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stock: { fontSize: 12.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#2563eb' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  empty: { textAlign: 'center', padding: 32, fontSize: 15 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16, borderTopWidth: 1 },
  footerButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  footerButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
