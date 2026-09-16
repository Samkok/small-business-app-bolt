import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { X, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { Button } from '@/src/components/ui/Button';
import { Unit } from '@/src/services/units';
import {
  stockAdjustmentService,
  ADJUSTMENT_REASONS,
  AdjustmentReason,
  StockAdjustment,
} from '@/src/services/stockAdjustments';

interface Props {
  visible: boolean;
  product: { id: string; name: string; current_stock: number; cost_per_unit?: number | null; currency_id?: string | null } | null;
  units?: Unit[];
  onClose: () => void;
  onPosted: (adjustment: StockAdjustment) => void;
}

/**
 * Post one stock adjustment for a product. The reason decides the direction
 * (damaged always removes, found always adds, count/other let the user pick),
 * the quantity is entered in the chosen unit, and the preview shows the stock
 * after the change and the cost written off or recovered.
 */
export default function StockAdjustmentModal({ visible, product, units = [], onClose, onPosted }: Props) {
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { formatPrice } = useCurrencyContext();

  const [reason, setReason] = useState<AdjustmentReason>('damaged');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [quantity, setQuantity] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason('damaged');
      setDirection('out');
      setQuantity('');
      setUnitId(null);
      setNotes('');
      setPosting(false);
    }
  }, [visible, product?.id]);

  const reasonInfo = ADJUSTMENT_REASONS.find(r => r.key === reason)!;
  const effectiveDirection: 'out' | 'in' = reasonInfo.direction === 'either' ? direction : reasonInfo.direction;

  const sortedUnits = useMemo(() => units.slice().sort((a, b) => a.conversion_factor_to_base - b.conversion_factor_to_base), [units]);
  const factor = unitId ? (units.find(u => u.id === unitId)?.conversion_factor_to_base || 1) : 1;
  const qtyNum = Math.max(0, parseFloat(quantity) || 0);
  const baseQty = Math.round(qtyNum * factor);
  const signedBase = effectiveDirection === 'out' ? -baseQty : baseQty;
  const stockAfter = (product?.current_stock || 0) + signedBase;
  const unitCost = Number(product?.cost_per_unit) || 0;
  const costImpact = baseQty * unitCost;
  const belowZero = stockAfter < 0;

  const colors = {
    text: isDark ? '#f9fafb' : '#111827',
    subtext: isDark ? '#9ca3af' : '#6b7280',
    bg: isDark ? '#111827' : '#f9fafb',
    card: isDark ? '#1f2937' : '#ffffff',
    border: isDark ? '#374151' : '#e5e7eb',
    input: isDark ? '#374151' : '#f3f4f6',
    accent: effectiveDirection === 'out' ? '#dc2626' : '#059669',
  };

  const handlePost = async () => {
    if (!product || !currentBusiness?.id) return;
    if (baseQty <= 0) {
      Alert.alert('Quantity needed', 'Enter how many units to adjust.');
      return;
    }
    if (belowZero) {
      Alert.alert('Not enough stock', `Only ${product.current_stock} in stock; you cannot remove ${baseQty}.`);
      return;
    }
    if (reason === 'other' && !notes.trim()) {
      Alert.alert('Note needed', 'Describe the reason in the note so the history makes sense later.');
      return;
    }
    setPosting(true);
    try {
      const row = await stockAdjustmentService.adjust({
        businessId: currentBusiness.id,
        productId: product.id,
        quantity: effectiveDirection === 'out' ? -qtyNum : qtyNum,
        reason,
        unitId,
        notes: notes.trim() || undefined,
      });
      onPosted(row);
      onClose();
    } catch (error: any) {
      Alert.alert('Could not post adjustment', error?.message || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  if (!product) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={colors.bg}
      header={
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Adjust Stock</Text>
            <Text style={[styles.subtitle, { color: colors.subtext }]} numberOfLines={1}>
              {product.name} · {product.current_stock} in stock
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      }
    >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.subtext }]}>Reason</Text>
            <View style={styles.chipRow}>
              {ADJUSTMENT_REASONS.map(r => {
                const active = r.key === reason;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.chip, { backgroundColor: active ? '#2563eb' : colors.input, borderColor: active ? '#2563eb' : colors.border }]}
                    onPress={() => setReason(r.key)}
                  >
                    <Text style={[styles.chipText, { color: active ? '#ffffff' : colors.text }]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.hint, { color: colors.subtext }]}>{reasonInfo.hint}</Text>

            {reasonInfo.direction === 'either' && (
              <View style={styles.directionRow}>
                <TouchableOpacity
                  style={[styles.directionButton, { borderColor: direction === 'out' ? '#dc2626' : colors.border, backgroundColor: direction === 'out' ? '#dc262615' : colors.card }]}
                  onPress={() => setDirection('out')}
                >
                  <Minus size={16} color={direction === 'out' ? '#dc2626' : colors.subtext} />
                  <Text style={[styles.directionText, { color: direction === 'out' ? '#dc2626' : colors.subtext }]}>Remove stock</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.directionButton, { borderColor: direction === 'in' ? '#059669' : colors.border, backgroundColor: direction === 'in' ? '#05966915' : colors.card }]}
                  onPress={() => setDirection('in')}
                >
                  <Plus size={16} color={direction === 'in' ? '#059669' : colors.subtext} />
                  <Text style={[styles.directionText, { color: direction === 'in' ? '#059669' : colors.subtext }]}>Add stock</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.label, { color: colors.subtext }]}>Quantity</Text>
            <View style={styles.quantityRow}>
              <TextInput
                style={[styles.quantityInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.subtext}
                autoFocus
              />
              {sortedUnits.length > 0 && (
                <View style={styles.unitChips}>
                  <TouchableOpacity
                    style={[styles.unitChip, { backgroundColor: !unitId ? '#2563eb' : colors.input, borderColor: !unitId ? '#2563eb' : colors.border }]}
                    onPress={() => setUnitId(null)}
                  >
                    <Text style={[styles.unitChipText, { color: !unitId ? '#ffffff' : colors.text }]}>base</Text>
                  </TouchableOpacity>
                  {sortedUnits.filter(u => u.conversion_factor_to_base > 1).map(u => {
                    const active = unitId === u.id;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.unitChip, { backgroundColor: active ? '#2563eb' : colors.input, borderColor: active ? '#2563eb' : colors.border }]}
                        onPress={() => setUnitId(u.id)}
                      >
                        <Text style={[styles.unitChipText, { color: active ? '#ffffff' : colors.text }]}>{u.name} ×{u.conversion_factor_to_base}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={[styles.label, { color: colors.subtext }]}>Note {reason === 'other' ? '(required)' : '(optional)'}</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. box crushed in delivery"
              placeholderTextColor={colors.subtext}
              multiline
            />

            <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.subtext }]}>Stock after</Text>
                <Text style={[styles.previewValue, { color: belowZero ? '#dc2626' : colors.text }]}>
                  {product.current_stock} → {stockAfter}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.subtext }]}>
                  {effectiveDirection === 'out' ? 'Written off at cost' : 'Added at cost'}
                </Text>
                <Text style={[styles.previewValue, { color: colors.accent }]}>
                  {effectiveDirection === 'out' ? '-' : '+'}{formatPrice(costImpact, product.currency_id ?? undefined)}
                </Text>
              </View>
              {unitCost === 0 && (
                <Text style={[styles.previewWarn, { color: '#ea580c' }]}>
                  This product has no cost per unit, so the loss will show as 0 in reports.
                </Text>
              )}
            </View>

            <Button
              title={posting ? 'Posting…' : effectiveDirection === 'out' ? `Remove ${baseQty || ''} units` : `Add ${baseQty || ''} units`}
              onPress={handlePost}
              disabled={posting || baseQty <= 0 || belowZero}
              loading={posting}
              variant={effectiveDirection === 'out' ? 'danger' : 'primary'}
            />
          </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeButton: { padding: 6 },
  body: { padding: 16, paddingBottom: 32, gap: 6 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  hint: { fontSize: 12, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  directionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  directionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  directionText: { fontSize: 13, fontWeight: '600' },
  quantityRow: { gap: 8 },
  quantityInput: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 20, fontWeight: '700' },
  unitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  unitChipText: { fontSize: 12, fontWeight: '600' },
  notesInput: { minHeight: 64, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: 'top' },
  preview: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 14, marginBottom: 14, gap: 6 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel: { fontSize: 13 },
  previewValue: { fontSize: 14, fontWeight: '700' },
  previewWarn: { fontSize: 12, marginTop: 4 },
});
