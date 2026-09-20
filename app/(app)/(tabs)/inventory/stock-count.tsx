import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, EyeOff, ClipboardList } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ScanBarcodeButton, findScannedProduct, searchTextForProduct } from '@/src/components/inventory/ScanBarcodeButton';
import { productService } from '@/src/services/products';
import { productInsightService, AbcClass } from '@/src/services/productInsight';
import { PlanningSettings } from '@/src/utils/inventoryPlanning';
import { stockAdjustmentService } from '@/src/services/stockAdjustments';

type Filter = 'all' | 'uncounted' | 'A' | 'B' | 'C';

const CADENCE: Record<AbcClass, string> = {
  A: 'count monthly',
  B: 'count quarterly',
  C: 'count twice a year',
};

/**
 * Stock count: type what is on the shelf for each product and post every
 * difference as a 'count' adjustment in one go. Blind mode hides the system
 * quantity so the counter is not tempted to confirm it. A/B/C tags come from
 * Product Insight so the most valuable products can be counted most often.
 */
export default function StockCountScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { currentBusiness, isStaff } = useAuth();
  const { formatPrice } = useCurrencyContext();

  const [products, setProducts] = useState<any[]>([]);
  const [abcByProduct, setAbcByProduct] = useState<Record<string, AbcClass>>({});
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [blind, setBlind] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    input: isDark ? '#374151' : '#f3f4f6',
  };

  const load = useCallback(async () => {
    if (!currentBusiness?.id) return;
    setLoading(true);
    try {
      const list = await productService.getProducts(currentBusiness.id);
      setProducts((list || []).filter((p: any) => !p.is_archived));
      // ABC classes are a nice-to-have: never block the count on them
      try {
        const saved = await productInsightService.getSettings(currentBusiness.id);
        const settings = { ...productInsightService.getDefaultSettings(), ...(saved || {}) };
        const { startDate, endDate, lookbackDays } = productInsightService.getDateRange(settings);
        const { products: insightProducts, demandByProduct, windowStart } = await productInsightService.fetchProductsAndSales(
          currentBusiness.id, startDate, endDate
        );
        const summary = productInsightService.classifyProducts(insightProducts, demandByProduct, settings as unknown as PlanningSettings, lookbackDays, windowStart);
        const map: Record<string, AbcClass> = {};
        for (const p of summary.classifiedProducts) map[p.id] = p.abcClass;
        setAbcByProduct(map);
      } catch {
        setAbcByProduct({});
      }
    } catch (error) {
      console.error('Error loading products for stock count:', error);
      Alert.alert('Could not load products', 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id]);

  useEffect(() => { load(); }, [load]);

  const handleScanned = useCallback(async (barcode: string) => {
    if (!currentBusiness?.id || !barcode) return;
    try {
      const product = await findScannedProduct(barcode, products, currentBusiness.id);
      if (product) {
        // Show it even if it was already counted or is outside the current class filter
        setFilter('all');
        setSearch(searchTextForProduct(product, barcode));
        return;
      }
    } catch (error) {
      console.error('Error looking up scanned barcode:', error);
    }
    // Wait for the scanner to finish closing, or iOS drops the alert
    setTimeout(() => Alert.alert('No product found', `Nothing in this count has the barcode ${barcode}.`), 400);
  }, [currentBusiness?.id, products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (q && !String(p.name || '').toLowerCase().includes(q) && !String(p.barcode || '').includes(q)) return false;
      if (filter === 'uncounted') return counts[p.id] === undefined || counts[p.id] === '';
      if (filter === 'A' || filter === 'B' || filter === 'C') return abcByProduct[p.id] === filter;
      return true;
    });
  }, [products, search, filter, counts, abcByProduct]);

  const review = useMemo(() => {
    let counted = 0, changed = 0, unitsShort = 0, unitsOver = 0, costLost = 0, costFound = 0;
    const items: { productId: string; counted: number }[] = [];
    for (const p of products) {
      const raw = counts[p.id];
      if (raw === undefined || raw === '') continue;
      const n = Math.max(0, Math.round(parseFloat(raw) || 0));
      counted++;
      items.push({ productId: p.id, counted: n });
      const delta = n - (Number(p.current_stock) || 0);
      if (delta === 0) continue;
      changed++;
      const cost = Math.abs(delta) * (Number(p.cost_per_unit) || 0);
      if (delta < 0) { unitsShort -= delta; costLost += cost; } else { unitsOver += delta; costFound += cost; }
    }
    return { counted, changed, unitsShort, unitsOver, costLost, costFound, items };
  }, [products, counts]);

  const hasAbc = Object.keys(abcByProduct).length > 0;

  const handleReview = () => {
    if (review.counted === 0) {
      Alert.alert('Nothing counted', 'Enter the counted quantity for at least one product.');
      return;
    }
    if (review.changed === 0) {
      Alert.alert('All counts match', `${review.counted} product${review.counted === 1 ? '' : 's'} counted and every quantity matches the system. Nothing to post.`);
      return;
    }
    Alert.alert(
      'Post stock count?',
      `${review.counted} counted, ${review.changed} differ from the system.\n\n` +
        `Short: ${review.unitsShort} units (${formatPrice(review.costLost)} written off)\n` +
        `Over: ${review.unitsOver} units (${formatPrice(review.costFound)} found)\n\n` +
        'Each difference is posted as a count correction and cannot be edited afterwards.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Post', style: 'destructive', onPress: post },
      ]
    );
  };

  const post = async () => {
    if (!currentBusiness?.id) return;
    setPosting(true);
    try {
      const result = await stockAdjustmentService.postCount({
        businessId: currentBusiness.id,
        items: review.items,
        notes: notes.trim() || undefined,
      });
      setCounts({});
      setNotes('');
      Alert.alert(
        'Stock count posted',
        `${result.adjusted} product${result.adjusted === 1 ? '' : 's'} adjusted, ${result.unchanged} unchanged.\n` +
          `Written off: ${result.units_lost} units (${formatPrice(Number(result.cost_lost) || 0)})\n` +
          `Found: ${result.units_found} units (${formatPrice(Number(result.cost_found) || 0)})`,
        [
          { text: 'View adjustments', onPress: () => router.push('/inventory/stock-adjustments') },
          { text: 'Done', onPress: () => load() },
        ]
      );
    } catch (error: any) {
      Alert.alert('Could not post count', error?.message || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const renderItem = ({ item: p }: { item: any }) => {
    const raw = counts[p.id];
    const entered = raw !== undefined && raw !== '';
    const system = Number(p.current_stock) || 0;
    const delta = entered ? Math.round(parseFloat(raw) || 0) - system : 0;
    const abc = abcByProduct[p.id];
    return (
      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
          <View style={styles.rowMetaLine}>
            {abc && (
              <View style={[styles.abcTag, { backgroundColor: abc === 'A' ? '#05966918' : abc === 'B' ? '#2563eb18' : colors.input }]}>
                <Text style={[styles.abcTagText, { color: abc === 'A' ? '#059669' : abc === 'B' ? '#2563eb' : colors.subtext }]}>{abc} · {CADENCE[abc]}</Text>
              </View>
            )}
            {!blind && (
              <Text style={[styles.rowMeta, { color: colors.subtext }]}>System: {system}</Text>
            )}
          </View>
          {entered && !blind && delta !== 0 && (
            <Text style={[styles.variance, { color: delta < 0 ? '#dc2626' : '#059669' }]}>
              {delta > 0 ? '+' : ''}{delta} · {formatPrice(Math.abs(delta) * (Number(p.cost_per_unit) || 0), p.currency_id ?? undefined)}
            </Text>
          )}
          {entered && !blind && delta === 0 && (
            <Text style={[styles.variance, { color: colors.subtext }]}>matches</Text>
          )}
        </View>
        <TextInput
          style={[styles.countInput, { backgroundColor: colors.input, color: colors.text, borderColor: entered ? (delta === 0 || blind ? colors.border : delta < 0 ? '#dc2626' : '#059669') : colors.border }]}
          value={raw ?? ''}
          onChangeText={v => setCounts(c => ({ ...c, [p.id]: v.replace(/[^0-9]/g, '') }))}
          keyboardType="number-pad"
          placeholder="count"
          placeholderTextColor={colors.subtext}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Stock Count</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/inventory/stock-adjustments')}>
          <ClipboardList size={22} color={colors.subtext} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Search size={16} color={colors.subtext} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or barcode"
            placeholderTextColor={colors.subtext}
          />
        </View>
        <ScanBarcodeButton onScanned={handleScanned} backgroundColor={colors.input} borderColor={colors.border} />
        <View style={styles.blindToggle}>
          <EyeOff size={14} color={colors.subtext} />
          <Text style={[styles.blindLabel, { color: colors.subtext }]}>Blind</Text>
          <Switch value={blind} onValueChange={setBlind} />
        </View>
      </View>

      <View style={styles.chipRow}>
        {(['all', 'uncounted', ...(hasAbc ? ['A', 'B', 'C'] : [])] as Filter[]).map(f => {
          const active = f === filter;
          const label = f === 'all' ? 'All' : f === 'uncounted' ? 'Uncounted' : `Class ${f}`;
          return (
            <TouchableOpacity key={f} style={[styles.chip, { backgroundColor: active ? '#2563eb' : colors.input }]} onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.subtext }]}>No products match.</Text>
          }
          ListHeaderComponent={
            <Text style={[styles.intro, { color: colors.subtext }]}>
              {blind
                ? 'Blind count: system quantities are hidden until you review.'
                : hasAbc
                  ? 'A products earn most of the profit, so count them every month. B quarterly, C twice a year.'
                  : 'Type what is on the shelf. Leave a product blank to skip it.'}
            </Text>
          }
        />
      )}

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.notesInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Note for this count (optional)"
          placeholderTextColor={colors.subtext}
        />
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.footerStat, { color: colors.text }]}>{review.counted} of {products.length} counted</Text>
            <Text style={[styles.footerHint, { color: colors.subtext }]}>
              {isStaff ? 'Only an owner or admin can post' : review.changed > 0 ? `${review.changed} differ · ${formatPrice(review.costLost)} short` : 'No differences yet'}
            </Text>
          </View>
          <Button
            title={posting ? 'Posting…' : 'Review & Post'}
            onPress={handleReview}
            disabled={posting || isStaff || review.counted === 0}
            loading={posting}
            size="small"
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8 },
  backButton: { padding: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  blindToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  blindLabel: { fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chipText: { fontSize: 12, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  intro: { fontSize: 12, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  rowMeta: { fontSize: 12 },
  abcTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  abcTagText: { fontSize: 10, fontWeight: '700' },
  variance: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  countInput: { width: 84, height: 44, borderRadius: 10, borderWidth: 1.5, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 13 },
  footer: { padding: 12, paddingBottom: 28, borderTopWidth: 1, gap: 8 },
  notesInput: { height: 38, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, fontSize: 13 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerStat: { fontSize: 14, fontWeight: '700' },
  footerHint: { fontSize: 12, marginTop: 2 },
});
