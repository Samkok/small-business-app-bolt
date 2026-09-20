import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, FlatList, Alert } from 'react-native';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { useRouter } from 'expo-router';
import { ArrowLeft, PackageMinus, ClipboardList, Plus, Search, X } from 'lucide-react-native';
import StockAdjustmentModal from '@/src/components/inventory/StockAdjustmentModal';
import { productService } from '@/src/services/products';
import { unitService, Unit } from '@/src/services/units';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ScanBarcodeButton, findScannedProduct, searchTextForProduct } from '@/src/components/inventory/ScanBarcodeButton';
import {
  stockAdjustmentService,
  summarizeAdjustments,
  ADJUSTMENT_REASONS,
  AdjustmentReason,
  StockAdjustment,
  reasonLabel,
} from '@/src/services/stockAdjustments';

type Period = '30d' | '90d' | 'year' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

function periodStart(p: Period): Date | undefined {
  const d = new Date();
  if (p === '30d') { d.setDate(d.getDate() - 30); return d; }
  if (p === '90d') { d.setDate(d.getDate() - 90); return d; }
  if (p === 'year') return new Date(d.getFullYear(), 0, 1);
  return undefined;
}

/**
 * Every manual stock adjustment for the business, with what it cost. Read-only:
 * adjustments are posted from a product's page or from a stock count and are
 * never edited, so a mistake is corrected with an opposite entry.
 */
export default function StockAdjustmentsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { currentBusiness, isStaff } = useAuth();
  const { formatPrice } = useCurrencyContext();

  const [period, setPeriod] = useState<Period>('30d');
  const [reason, setReason] = useState<AdjustmentReason | 'all'>('all');
  const [rows, setRows] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // "New adjustment" from this screen: pick any product, then the same form as on product details
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerProducts, setPickerProducts] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [target, setTarget] = useState<any | null>(null);
  const [targetUnits, setTargetUnits] = useState<Unit[]>([]);
  // Product chosen in the picker; the form opens only after the picker has fully dismissed,
  // because iOS cannot present a second modal while the first is still animating out.
  const pendingProduct = useRef<any | null>(null);
  // The record being corrected or deleted (tap a row); null when posting a new one
  const [editing, setEditing] = useState<StockAdjustment | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Tapping a record opens it for editing. The product is read fresh so the form
  // works from today's stock, not from what the list loaded earlier.
  const openEdit = async (adjustment: StockAdjustment) => {
    if (isStaff || openingId) return;
    setOpeningId(adjustment.id);
    try {
      const product: any = await productService.getProduct(adjustment.product_id);
      if (!product) {
        Alert.alert('Product not found', 'This product no longer exists, so the adjustment cannot be changed.');
        return;
      }
      let units: Unit[] = [];
      if (product.unit_group_id) {
        try { units = await unitService.getUnits(product.unit_group_id); } catch { units = []; }
      }
      setTargetUnits(units);
      setEditing(adjustment);
      setTarget(product);
    } catch (error) {
      console.error('Error opening adjustment:', error);
      Alert.alert('Could not open', 'Please try again.');
    } finally {
      setOpeningId(null);
    }
  };

  const openPicker = async () => {
    if (!currentBusiness?.id) return;
    setPickerVisible(true);
    setPickerQuery('');
    if (pickerProducts.length === 0) {
      setPickerLoading(true);
      try {
        const list = await productService.getProducts(currentBusiness.id);
        setPickerProducts((list || []).filter((p: any) => !p.is_archived));
      } catch (error) {
        console.error('Error loading products for adjustment:', error);
      } finally {
        setPickerLoading(false);
      }
    }
  };

  const chooseProduct = (p: any) => {
    pendingProduct.current = p;
    setPickerVisible(false);
  };

  const openAdjustmentForPending = async () => {
    const p = pendingProduct.current;
    if (!p) return;
    pendingProduct.current = null;
    let units: Unit[] = [];
    if (p.unit_group_id) {
      try { units = await unitService.getUnits(p.unit_group_id); } catch { units = []; }
    }
    setTargetUnits(units);
    // Give the native modal a beat to finish tearing down before presenting the next one
    setEditing(null);
    setTimeout(() => setTarget(p), 120);
  };

  const handlePickerScanned = useCallback(async (barcode: string) => {
    if (!currentBusiness?.id || !barcode) return;
    try {
      const product = await findScannedProduct(barcode, pickerProducts, currentBusiness.id);
      if (product) {
        setPickerQuery(searchTextForProduct(product, barcode));
        return;
      }
    } catch (error) {
      console.error('Error looking up scanned barcode:', error);
    }
    setPickerQuery(barcode);
  }, [currentBusiness?.id, pickerProducts]);

  const pickerVisibleProducts = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return pickerProducts;
    return pickerProducts.filter(p => String(p.name || '').toLowerCase().includes(q) || String(p.barcode || '').includes(q));
  }, [pickerProducts, pickerQuery]);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    chip: isDark ? '#374151' : '#f3f4f6',
  };

  const load = useCallback(async (refresh = false) => {
    if (!currentBusiness?.id) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await stockAdjustmentService.getForBusiness(currentBusiness.id, {
        startDate: periodStart(period),
        limit: 500,
      });
      setRows(data);
    } catch (error) {
      console.error('Error loading stock adjustments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentBusiness?.id, period]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (reason === 'all' ? rows : rows.filter(r => r.reason === reason)), [rows, reason]);
  const totals = useMemo(() => summarizeAdjustments(filtered), [filtered]);
  const usedReasons = useMemo(() => ADJUSTMENT_REASONS.filter(r => rows.some(x => x.reason === r.key)), [rows]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Stock Adjustments</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/inventory/stock-count')}>
          <ClipboardList size={22} color="#d97706" />
        </TouchableOpacity>
      </View>

      {!isStaff && (
        <TouchableOpacity style={styles.newButton} onPress={openPicker} activeOpacity={0.8}>
          <Plus size={18} color="#ffffff" />
          <Text style={styles.newButtonText}>New adjustment</Text>
          <Text style={styles.newButtonHint}>any product · damaged, expired, lost, found…</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PERIODS.map(p => {
            const active = p.key === period;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.chip, { backgroundColor: active ? '#2563eb' : colors.chip }]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {usedReasons.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: reason === 'all' ? '#374151' : colors.chip }]}
              onPress={() => setReason('all')}
            >
              <Text style={[styles.chipText, { color: reason === 'all' ? '#ffffff' : colors.text }]}>All reasons</Text>
            </TouchableOpacity>
            {usedReasons.map(r => {
              const active = r.key === reason;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.chip, { backgroundColor: active ? '#374151' : colors.chip }]}
                  onPress={() => setReason(r.key)}
                >
                  <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <View style={styles.statsRow}>
              <Card style={StyleSheet.flatten([styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }])}>
                <Text style={[styles.statValue, { color: '#dc2626' }]}>{formatPrice(totals.writeOffs.cost)}</Text>
                <Text style={[styles.statLabel, { color: colors.subtext }]}>Written off at cost</Text>
                <Text style={[styles.statHint, { color: colors.subtext }]}>{totals.writeOffs.units} units removed</Text>
              </Card>
              <Card style={StyleSheet.flatten([styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }])}>
                <Text style={[styles.statValue, { color: '#059669' }]}>{formatPrice(totals.found.cost)}</Text>
                <Text style={[styles.statLabel, { color: colors.subtext }]}>Found stock at cost</Text>
                <Text style={[styles.statHint, { color: colors.subtext }]}>{totals.found.units} units added</Text>
              </Card>
            </View>

            {Object.keys(totals.byReason).length > 1 && (
              <Card style={StyleSheet.flatten([styles.reasonCard, { backgroundColor: colors.card, borderColor: colors.border }])}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>By reason</Text>
                {Object.entries(totals.byReason)
                  .sort((a, b) => Math.abs(b[1].cost) - Math.abs(a[1].cost))
                  .map(([key, v]) => (
                    <View key={key} style={styles.reasonRow}>
                      <Text style={[styles.reasonName, { color: colors.text }]}>{reasonLabel(key)}</Text>
                      <Text style={[styles.reasonMeta, { color: colors.subtext }]}>{v.count} × · {v.units > 0 ? '+' : ''}{v.units} units</Text>
                      <Text style={[styles.reasonCost, { color: v.cost < 0 ? '#dc2626' : '#059669' }]}>{formatPrice(Math.abs(v.cost))}</Text>
                    </View>
                  ))}
              </Card>
            )}

            <Card style={StyleSheet.flatten([styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }])}>
              {filtered.length === 0 ? (
                <View style={styles.empty}>
                  <PackageMinus size={28} color={colors.subtext} />
                  <Text style={[styles.emptyText, { color: colors.subtext }]}>
                    No adjustments in this period.
                  </Text>
                  {!isStaff && (
                    <TouchableOpacity style={styles.emptyButton} onPress={openPicker} activeOpacity={0.8}>
                      <Plus size={16} color="#ffffff" />
                      <Text style={styles.emptyButtonText}>New adjustment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                filtered.map((a, i) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.row, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                    onPress={() => openEdit(a)}
                    disabled={isStaff}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.products?.name || 'Product'}, ${reasonLabel(a.reason)}. Edit or delete`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{a.products?.name || 'Product'}</Text>
                      <Text style={[styles.rowMeta, { color: colors.subtext }]}>
                        {reasonLabel(a.reason)} · {formatDate(a.adjustment_date)} · {a.stock_before} → {a.stock_after}
                        {a.adjusted_by_name ? ` · ${a.adjusted_by_name}` : ''}
                      </Text>
                      {a.notes ? <Text style={[styles.rowNote, { color: colors.subtext }]} numberOfLines={2}>{a.notes}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.rowQty, { color: a.quantity < 0 ? '#dc2626' : '#059669' }]}>{a.quantity > 0 ? '+' : ''}{a.quantity}</Text>
                      <Text style={[styles.rowCost, { color: colors.subtext }]}>{formatPrice(Math.abs(Number(a.total_cost)), a.currency_id ?? undefined)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onDismissed={openAdjustmentForPending}
        backgroundColor={colors.bg}
        heightPercent={85}
        contentStyle={{ flex: 1 }}
        header={
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Which product?</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.backButton}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
      >
            <View style={styles.pickerSearchRow}>
            <View style={[styles.pickerSearch, { backgroundColor: colors.chip, borderColor: colors.border }]}>
              <Search size={16} color={colors.subtext} />
              <TextInput
                style={[styles.pickerSearchInput, { color: colors.text }]}
                value={pickerQuery}
                onChangeText={setPickerQuery}
                placeholder="Search name or barcode"
                placeholderTextColor={colors.subtext}
                autoFocus
              />
            </View>
            <ScanBarcodeButton onScanned={handlePickerScanned} backgroundColor={colors.chip} borderColor={colors.border} />
            </View>
            {pickerLoading ? (
              <LoadingSpinner />
            ) : (
              <FlatList
                data={pickerVisibleProducts}
                keyExtractor={p => p.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 24 }}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.subtext, paddingVertical: 24 }]}>No products match.</Text>}
                renderItem={({ item: p }) => (
                  <TouchableOpacity style={[styles.pickerRow, { borderBottomColor: colors.border }]} onPress={() => chooseProduct(p)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[styles.rowMeta, { color: colors.subtext }]}>
                        {p.current_stock ?? 0} in stock · cost {formatPrice(Number(p.cost_per_unit) || 0, p.currency_id ?? undefined)}
                      </Text>
                    </View>
                    <Text style={[styles.rowMeta, { color: colors.subtext }]}>›</Text>
                  </TouchableOpacity>
                )}
              />
            )}
      </BottomSheet>

      <StockAdjustmentModal
        visible={!!target}
        product={target}
        units={targetUnits}
        editing={editing}
        onClose={() => { setTarget(null); setEditing(null); }}
        onPosted={() => {
          setPickerProducts([]);
          load(true);
        }}
        onDeleted={() => {
          setPickerProducts([]);
          load(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
  backButton: { padding: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  chipRow: { gap: 8, paddingVertical: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statCard: { flex: 1, padding: 14, borderWidth: 1, borderRadius: 12 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4 },
  statHint: { fontSize: 11, marginTop: 2 },
  reasonCard: { padding: 14, borderWidth: 1, borderRadius: 12, marginTop: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  reasonName: { flex: 1, fontSize: 14, fontWeight: '600' },
  reasonMeta: { fontSize: 12 },
  reasonCost: { fontSize: 14, fontWeight: '700', minWidth: 70, textAlign: 'right' },
  listCard: { padding: 4, borderWidth: 1, borderRadius: 12, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 12 },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowNote: { fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  rowQty: { fontSize: 16, fontWeight: '700' },
  rowCost: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 10, paddingHorizontal: 16 },
  newButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#2563eb' },
  newButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  newButtonHint: { flex: 1, color: '#dbeafe', fontSize: 11, textAlign: 'right' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  emptyButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 18, fontWeight: '700' },
  pickerSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12 },
  pickerSearch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10 },
  pickerSearchInput: { flex: 1, fontSize: 14 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
