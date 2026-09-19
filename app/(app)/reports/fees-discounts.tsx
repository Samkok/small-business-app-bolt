import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BarChart as BarChartKit } from 'react-native-chart-kit';
import { ArrowLeft, Download, Calendar, Percent, Truck, Tag } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, endOfDay, startOfYear, subMonths, differenceInCalendarDays } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { reportsService } from '@/src/services/reports';
import { exportService } from '@/src/services/exportService';

type Preset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'this_year', label: 'This year' },
  { key: 'custom', label: 'Custom' },
];

function presetRange(preset: Exclude<Preset, 'custom'>): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'last_month': {
      const d = subMonths(now, 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
    case 'last_3_months':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfDay(now) };
    case 'this_year':
      return { start: startOfYear(now), end: endOfDay(now) };
    case 'this_month':
    default:
      return { start: startOfMonth(now), end: endOfDay(now) };
  }
}

const screenWidth = Dimensions.get('window').width;

/**
 * Fees & Discounts: courier fees the business absorbed and discounts it gave,
 * for any date range. Opened from the Reports overview with that screen's range;
 * the range can then be changed here with presets or a custom date range.
 * "By month" rows are clipped to the chosen dates, so they add up to the totals.
 */
export default function FeesDiscountsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { formatPrice } = useCurrencyContext();

  const reportCurrencyId = typeof params.currencyId === 'string' && params.currencyId ? params.currencyId : undefined;
  const fmt = (amount: number) => formatPrice(amount, reportCurrencyId);

  // Start from the range the overview was showing, when it passed one
  const initial = useMemo(() => {
    const s = typeof params.startDate === 'string' ? new Date(params.startDate) : null;
    const e = typeof params.endDate === 'string' ? new Date(params.endDate) : null;
    if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) return { start: s, end: e, fromOverview: true };
    return { ...presetRange('this_month'), fromOverview: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [startDate, setStartDate] = useState<Date>(initial.start);
  const [endDate, setEndDate] = useState<Date>(initial.end);
  const [preset, setPreset] = useState<Preset>(() => {
    if (!initial.fromOverview) return 'this_month';
    // Highlight a preset when the overview's range happens to be one
    const same = (a: Date, b: Date) => format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd');
    for (const p of ['this_month', 'last_month', 'last_3_months', 'this_year'] as const) {
      const r = presetRange(p);
      if (same(r.start, initial.start) && same(r.end, initial.end)) return p;
    }
    return 'custom';
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    chip: isDark ? '#374151' : '#f3f4f6',
    accent: '#db2777',
  };

  const load = useCallback(async (isRefresh = false) => {
    if (!currentBusiness?.id) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      setData(await reportsService.getFeesAndDiscounts(currentBusiness.id, startDate, endDate, reportCurrencyId));
    } catch (error) {
      console.error('Error loading fees and discounts:', error);
      Alert.alert('Error', 'Failed to load fees and discounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentBusiness?.id, startDate, endDate, reportCurrencyId]);

  useEffect(() => { load(); }, [load]);

  const choosePreset = (p: Preset) => {
    if (p === 'custom') { setPickerVisible(true); return; }
    const r = presetRange(p);
    setPreset(p);
    setStartDate(r.start);
    setEndDate(r.end);
  };

  const confirmCustomRange = (s: Date, e: Date) => {
    const start = new Date(s); start.setHours(0, 0, 0, 0);
    const end = endOfDay(e);
    setPreset('custom');
    setStartDate(start);
    setEndDate(end);
    setPickerVisible(false);
  };

  const rangeLabel = `${format(startDate, 'd MMM yyyy')} – ${format(endDate, 'd MMM yyyy')}`;
  const days = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);

  const handleExport = async () => {
    if (!currentBusiness?.id || exporting) return;
    setExporting(true);
    try {
      const csv = await exportService.exportFeesAndDiscountsToCsv(currentBusiness.id, startDate.toISOString(), endDate.toISOString(), reportCurrencyId);
      const name = `fees_and_discounts_${format(startDate, 'yyyyMMdd')}_to_${format(endDate, 'yyyyMMdd')}.csv`;
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${name}`;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType?.UTF8 || 'utf8' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Fees & Discounts', UTI: 'public.comma-separated-values-text' });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (error) {
      console.error('Error exporting fees and discounts:', error);
      Alert.alert('Error', 'Failed to export fees and discounts');
    } finally {
      setExporting(false);
    }
  };

  const range = data?.range;
  const rangeMonths: any[] = data?.rangeMonths || [];
  const trendMonths: any[] = (data?.months || []).slice(-6);
  // With two or more months selected the chart follows the selection; for a shorter
  // range a single bar says nothing, so it shows the six-month trend instead.
  const chartFollowsRange = rangeMonths.length >= 2;
  const chartMonths = chartFollowsRange ? rangeMonths.slice(-12) : trendMonths;
  const hasAnything = !!range && (range.total > 0 || chartMonths.some(m => m.total > 0));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Fees & Discounts</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleExport} disabled={exporting || !hasAnything}>
          <Download size={22} color={exporting || !hasAnything ? colors.subtext : '#059669'} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll} contentContainerStyle={styles.presetRow}>
        {PRESETS.map(p => {
          const active = p.key === preset;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, { backgroundColor: active ? colors.accent : colors.chip }]}
              onPress={() => choosePreset(p.key)}
            >
              {p.key === 'custom' && <Calendar size={13} color={active ? '#ffffff' : colors.text} />}
              <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.rangeLine} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
        <Calendar size={14} color={colors.subtext} />
        <Text style={[styles.rangeText, { color: colors.text }]}>{rangeLabel}</Text>
        <Text style={[styles.rangeMeta, { color: colors.subtext }]}>{days} {days === 1 ? 'day' : 'days'} · change</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.report}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading ? (
          <LoadingSpinner />
        ) : !hasAnything ? (
          <Card style={StyleSheet.flatten([styles.card, { backgroundColor: colors.card, borderColor: colors.border }])}>
            <View style={styles.empty}>
              <Percent size={28} color={colors.subtext} />
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                No courier fees or discounts between these dates. Try a wider range.
              </Text>
            </View>
          </Card>
        ) : (
          <>
            <Card style={StyleSheet.flatten([styles.card, { backgroundColor: colors.card, borderColor: colors.border }])}>
              <Text style={[styles.heroLabel, { color: colors.subtext }]}>Given up in this period</Text>
              <Text style={[styles.heroValue, { color: colors.accent }]}>{fmt(range.total)}</Text>
              <Text style={[styles.heroMeta, { color: colors.subtext }]}>
                {range.shareOfRevenue.toFixed(1)}% of full-price revenue · {fmt(range.total / days)} a day
              </Text>

              <View style={styles.tiles}>
                <View style={[styles.tile, { backgroundColor: colors.chip }]}>
                  <Truck size={16} color="#2563eb" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(range.deliveryFees)}</Text>
                  <Text style={[styles.tileLabel, { color: colors.subtext }]}>Delivery fees</Text>
                  <Text style={[styles.tileMeta, { color: colors.subtext }]}>{range.salesWithDelivery} of {range.sales} sales</Text>
                </View>
                <View style={[styles.tile, { backgroundColor: colors.chip }]}>
                  <Tag size={16} color="#ea580c" />
                  <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(range.discounts)}</Text>
                  <Text style={[styles.tileLabel, { color: colors.subtext }]}>Discounts</Text>
                  <Text style={[styles.tileMeta, { color: colors.subtext }]}>{range.salesWithDiscount} of {range.sales} sales</Text>
                </View>
              </View>

              <View style={[styles.row, { borderTopColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.subtext }]}>Whole-cart discounts</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{fmt(range.cartDiscounts)}</Text>
              </View>
              <View style={[styles.row, { borderTopColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.subtext }]}>Per-item discounts</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{fmt(range.itemDiscounts)}</Text>
              </View>
              <View style={[styles.row, { borderTopColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.subtext }]}>Average courier fee per delivered sale</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {fmt(range.salesWithDelivery > 0 ? range.deliveryFees / range.salesWithDelivery : 0)}
                </Text>
              </View>
              <View style={[styles.row, { borderTopColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.subtext }]}>Average discount per discounted sale</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>
                  {fmt(range.salesWithDiscount > 0 ? range.discounts / range.salesWithDiscount : 0)}
                </Text>
              </View>
              <View style={[styles.row, { borderTopColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.subtext }]}>Revenue in this period</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{fmt(range.revenue)}</Text>
              </View>
            </Card>

            {chartMonths.some(m => m.total > 0) && (
              <Card style={StyleSheet.flatten([styles.card, { backgroundColor: colors.card, borderColor: colors.border }])}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {chartFollowsRange ? 'By month' : 'Last six months'}
                </Text>
                {!chartFollowsRange && (
                  <Text style={[styles.cardHint, { color: colors.subtext }]}>
                    Whole months, for comparison. Your selected dates cover less than two months.
                  </Text>
                )}
                <BarChartKit
                  data={{
                    labels: chartMonths.map(m => m.label.slice(0, 3)),
                    datasets: [{ data: chartMonths.map(m => m.total) }],
                  }}
                  width={screenWidth - 64}
                  height={190}
                  yAxisLabel=""
                  yAxisSuffix=""
                  fromZero
                  withInnerLines={false}
                  chartConfig={{
                    backgroundColor: colors.card,
                    backgroundGradientFrom: colors.card,
                    backgroundGradientTo: colors.card,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(219, 39, 119, ${opacity})`,
                    labelColor: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
                    barPercentage: chartMonths.length > 8 ? 0.35 : 0.6,
                  }}
                  style={{ marginTop: 8, borderRadius: 12 }}
                />
              </Card>
            )}

            <Card style={StyleSheet.flatten([styles.card, { backgroundColor: colors.card, borderColor: colors.border }])}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Month by month</Text>
              <Text style={[styles.cardHint, { color: colors.subtext }]}>
                Only your selected dates are counted, so a partly covered month shows just those days.
              </Text>
              <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.cellMonth, styles.headerText, { color: colors.subtext }]}>Month</Text>
                <Text style={[styles.cell, styles.headerText, { color: colors.subtext }]}>Delivery</Text>
                <Text style={[styles.cell, styles.headerText, { color: colors.subtext }]}>Discounts</Text>
                <Text style={[styles.cell, styles.headerText, { color: colors.subtext }]}>Total</Text>
              </View>
              {rangeMonths.slice().reverse().map(m => (
                <View key={m.key} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.cellMonth}>
                    <Text style={[styles.monthText, { color: colors.text }]}>{m.label}</Text>
                    <Text style={[styles.monthMeta, { color: colors.subtext }]}>
                      {m.sales} {m.sales === 1 ? 'sale' : 'sales'} · {m.shareOfRevenue.toFixed(1)}%
                    </Text>
                  </View>
                  <Text style={[styles.cell, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(m.deliveryFees)}</Text>
                  <Text style={[styles.cell, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(m.discounts)}</Text>
                  <Text style={[styles.cell, styles.totalText, { color: colors.accent }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(m.total)}</Text>
                </View>
              ))}
              <View style={styles.tableRow}>
                <View style={styles.cellMonth}>
                  <Text style={[styles.monthText, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.monthMeta, { color: colors.subtext }]}>{range.sales} {range.sales === 1 ? 'sale' : 'sales'}</Text>
                </View>
                <Text style={[styles.cell, styles.totalText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(range.deliveryFees)}</Text>
                <Text style={[styles.cell, styles.totalText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(range.discounts)}</Text>
                <Text style={[styles.cell, styles.totalText, { color: colors.accent }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(range.total)}</Text>
              </View>
            </Card>

            <Text style={[styles.footnote, { color: colors.subtext }]}>
              Counts completed and partially returned sales, at the amounts given when the sale was made. These are not
              included in Expenses; courier fees also appear as Delivery Fees on the income statement.
            </Text>
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        backgroundColor={colors.bg}
        header={
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select date range</Text>
          </View>
        }
      >
        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onConfirm={confirmCustomRange}
            onCancel={() => setPickerVisible(false)}
          />
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8 },
  headerButton: { padding: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  // A ScrollView shrinks by default; without this the tall report below squeezes the chips and clips their text
  presetScroll: { flexGrow: 0, flexShrink: 0 },
  presetRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '600' },
  rangeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 6 },
  rangeText: { fontSize: 13, fontWeight: '600' },
  rangeMeta: { fontSize: 12, flex: 1, textAlign: 'right' },
  report: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
  card: { padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  heroLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroValue: { fontSize: 30, fontWeight: '800', marginTop: 2 },
  heroMeta: { fontSize: 12, marginTop: 2 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 8 },
  tile: { flex: 1, padding: 12, borderRadius: 10, gap: 2 },
  tileValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileMeta: { fontSize: 11 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 1 },
  rowLabel: { fontSize: 13, flex: 1 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardHint: { fontSize: 12, marginTop: 2 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, marginTop: 8 },
  headerText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  cellMonth: { flex: 1.5 },
  cell: { flex: 1, textAlign: 'right', fontSize: 13 },
  monthText: { fontSize: 14, fontWeight: '600' },
  monthMeta: { fontSize: 11, marginTop: 1 },
  totalText: { fontWeight: '700' },
  footnote: { fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  sheetHeader: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sheetBody: { padding: 12, paddingBottom: 28 },
});
