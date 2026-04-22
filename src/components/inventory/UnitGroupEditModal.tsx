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
  Alert,
} from 'react-native';
import { Plus, X, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { unitService, UnitGroup, Unit } from '@/src/services/units';

type ExistingUnitDraft = {
  kind: 'existing';
  unit: Unit;
  name: string;
  conversion: string;
  pendingDelete: boolean;
};

type NewUnitDraft = {
  kind: 'new';
  name: string;
  conversion: string;
};

type UnitDraft = ExistingUnitDraft | NewUnitDraft;

interface Props {
  visible: boolean;
  group: UnitGroup;
  initialUnits: Unit[];
  onClose: () => void;
  onSaved: () => void;
}

export function UnitGroupEditModal({ visible, group, initialUnits, onClose, onSaved }: Props) {
  const { isDark } = useTheme();

  const [groupName, setGroupName] = useState('');
  const [drafts, setDrafts] = useState<UnitDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [inUseWarning, setInUseWarning] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setGroupName(group.name);
    setDrafts(
      initialUnits.map(u => ({
        kind: 'existing',
        unit: u,
        name: u.name,
        conversion: u.conversion_factor_to_base.toString(),
        pendingDelete: false,
      })),
    );
    setFormError('');
    setInUseWarning(false);
    checkInUse(initialUnits);
  }, [visible]);

  const checkInUse = async (units: Unit[]) => {
    try {
      const results = await Promise.all(units.map(u => unitService.getUnitUsage(u.id)));
      const anyInUse = results.some(r => r.productPriceCount > 0 || r.cartItemCount > 0);
      setInUseWarning(anyInUse);
    } catch {
      // non-critical
    }
  };

  const updateDraft = (idx: number, patch: Partial<Omit<ExistingUnitDraft, 'kind' | 'unit'>> | Partial<Omit<NewUnitDraft, 'kind'>>) => {
    setDrafts(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const addNewUnit = () => {
    const newDraft: NewUnitDraft = { kind: 'new', name: '', conversion: '' };
    setDrafts(prev => {
      const baseIdx = prev.findIndex(d => d.kind === 'existing' && d.unit.is_base_unit);
      if (baseIdx === -1) return [...prev, newDraft];
      const copy = [...prev];
      copy.splice(baseIdx, 0, newDraft);
      return copy;
    });
  };

  const handleRequestDelete = async (idx: number) => {
    const draft = drafts[idx];
    if (draft.kind !== 'existing') {
      setDrafts(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    if (draft.unit.is_base_unit) return;

    try {
      const usage = await unitService.getUnitUsage(draft.unit.id);
      if (usage.productPriceCount > 0 || usage.cartItemCount > 0) {
        const parts: string[] = [];
        if (usage.productPriceCount > 0)
          parts.push(`${usage.productPriceCount} product price${usage.productPriceCount > 1 ? 's' : ''}`);
        if (usage.cartItemCount > 0)
          parts.push(`${usage.cartItemCount} cart item${usage.cartItemCount > 1 ? 's' : ''}`);
        Alert.alert(
          'Cannot delete unit',
          `"${draft.unit.name}" is used by ${parts.join(' and ')}. Remove those references first.`,
        );
        return;
      }
      updateDraft(idx, { pendingDelete: true } as any);
    } catch {
      Alert.alert('Error', 'Could not check unit usage. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      setFormError('Group name is required');
      return;
    }

    const activeDrafts = drafts.filter(d => !(d.kind === 'existing' && d.pendingDelete));
    const baseIdx = activeDrafts.findIndex(d => d.kind === 'existing' && d.unit.is_base_unit);

    for (let i = 0; i < activeDrafts.length; i++) {
      const d = activeDrafts[i];
      const isBase = i === activeDrafts.length - 1 && d.kind === 'existing' && d.unit.is_base_unit;
      if (!d.name.trim()) {
        setFormError(`Unit ${i + 1}: name is required`);
        return;
      }
      if (!isBase) {
        const conv = parseInt(d.conversion, 10);
        if (!Number.isFinite(conv) || conv <= 1) {
          setFormError(`Unit ${i + 1} ("${d.name}"): conversion must be a whole number greater than 1`);
          return;
        }
      }
    }

    if (baseIdx === -1) {
      setFormError('Cannot delete the base unit');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const active = drafts.filter(d => !(d.kind === 'existing' && d.pendingDelete));
      const toDelete = drafts.filter(
        (d): d is ExistingUnitDraft => d.kind === 'existing' && d.pendingDelete,
      );

      let runningFactor = 1;
      const factors: number[] = new Array(active.length);
      for (let i = active.length - 1; i >= 0; i--) {
        if (i === active.length - 1) {
          factors[i] = 1;
        } else {
          runningFactor = runningFactor * parseInt(active[i].conversion, 10);
          factors[i] = runningFactor;
        }
      }

      const ops: Promise<unknown>[] = [];

      if (groupName.trim() !== group.name) {
        ops.push(unitService.updateUnitGroup(group.id, { name: groupName.trim() }));
      }

      for (const d of toDelete) {
        ops.push(unitService.deleteUnit(d.unit.id));
      }

      for (let i = 0; i < active.length; i++) {
        const d = active[i];
        if (d.kind !== 'existing') continue;
        const newFactor = factors[i];
        const changed =
          d.name.trim() !== d.unit.name ||
          newFactor !== d.unit.conversion_factor_to_base ||
          i + 1 !== d.unit.sort_order;
        if (changed) {
          ops.push(
            unitService.updateUnit(d.unit.id, {
              name: d.name.trim(),
              conversion_factor_to_base: newFactor,
              sort_order: i + 1,
            }),
          );
        }
      }

      const survivingExistingCount = initialUnits.filter(
        u => !toDelete.some(td => td.unit.id === u.id),
      ).length;
      let newSortBase = survivingExistingCount + 1;
      for (let i = 0; i < active.length; i++) {
        const d = active[i];
        if (d.kind !== 'new') continue;
        const sortOrder = newSortBase++;
        ops.push(
          unitService.createUnit({
            unit_group_id: group.id,
            name: d.name.trim(),
            conversion_factor_to_base: factors[i],
            sort_order: sortOrder,
            is_base_unit: false,
          }),
        );
      }

      await Promise.all(ops);

      onSaved();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const cardText = isDark ? '#f9fafb' : '#111827';
  const cardMuted = isDark ? '#9ca3af' : '#6b7280';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const draftCardBg = isDark ? '#111827' : '#f3f4f6';

  const activeDrafts = drafts.filter(d => !(d.kind === 'existing' && (d as ExistingUnitDraft).pendingDelete));
  const pendingDeleteDrafts = drafts.filter(
    (d): d is ExistingUnitDraft => d.kind === 'existing' && d.pendingDelete,
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: cardText }]}>Edit unit group</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={cardText} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {inUseWarning && (
              <View style={styles.warningBanner}>
                <AlertTriangle size={16} color="#92400e" />
                <Text style={styles.warningText}>
                  Some units are used by products or active carts. Changing conversion factors may affect pricing calculations.
                </Text>
              </View>
            )}

            <Input
              label="Group name"
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g. Beverage packaging"
            />

            <Text style={[styles.sectionLabel, { color: cardMuted }]}>
              Units (largest to smallest). The base unit cannot be deleted or reordered. Barcodes are set per product, not on the unit group.
            </Text>

            {activeDrafts.map((d, idx) => {
              const isBase = d.kind === 'existing' && d.unit.is_base_unit;
              const nextName = activeDrafts[idx + 1]?.name || 'base unit';

              return (
                <View
                  key={d.kind === 'existing' ? d.unit.id : `new-${idx}`}
                  style={[styles.draftCard, { backgroundColor: draftCardBg }]}
                >
                  <View style={styles.draftHeader}>
                    <View style={styles.draftTitleRow}>
                      <Text style={[styles.draftTitle, { color: cardText }]}>
                        {isBase ? 'Base unit' : `Unit ${idx + 1}`}
                      </Text>
                      {isBase && (
                        <View style={styles.baseTag}>
                          <Text style={styles.baseTagText}>protected</Text>
                        </View>
                      )}
                      {d.kind === 'new' && (
                        <View style={styles.newTag}>
                          <Text style={styles.newTagText}>new</Text>
                        </View>
                      )}
                    </View>
                    {!isBase && (
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                          const realIdx = drafts.indexOf(d as any);
                          handleRequestDelete(realIdx);
                        }}
                      >
                        <X size={18} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Input
                    label="Name"
                    value={d.name}
                    onChangeText={v => {
                      const realIdx = drafts.indexOf(d as any);
                      updateDraft(realIdx, { name: v });
                    }}
                    placeholder={isBase ? 'Bottle' : 'Box'}
                  />

                  {!isBase && (
                    <Input
                      label={`How many "${nextName}" per "${d.name || 'this unit'}"`}
                      value={d.conversion}
                      onChangeText={v => {
                        const realIdx = drafts.indexOf(d as any);
                        updateDraft(realIdx, { conversion: v.replace(/[^\d]/g, '') });
                      }}
                      placeholder="e.g. 24"
                      keyboardType="number-pad"
                    />
                  )}
                </View>
              );
            })}

            {pendingDeleteDrafts.length > 0 && (
              <View style={[styles.deletionPreview, { borderColor: isDark ? '#4b5563' : '#e5e7eb' }]}>
                <Text style={[styles.deletionTitle, { color: '#dc2626' }]}>Will be deleted on save:</Text>
                {pendingDeleteDrafts.map(d => (
                  <View key={d.unit.id} style={styles.deletionRow}>
                    <Text style={[styles.deletionName, { color: cardMuted }]}>{d.unit.name}</Text>
                    <TouchableOpacity onPress={() => updateDraft(drafts.indexOf(d as any), { pendingDelete: false } as any)}>
                      <Text style={styles.undoText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={addNewUnit} style={styles.addUnitBtn}>
              <Plus size={18} color="#2563eb" />
              <Text style={styles.addUnitText}>Add unit above base</Text>
            </TouchableOpacity>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={styles.btn} />
            <Button title="Save changes" loading={saving} onPress={handleSave} style={styles.btn} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700' },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
  sectionLabel: { fontSize: 12, marginTop: 4, marginBottom: 8, lineHeight: 16 },
  draftCard: { padding: 12, borderRadius: 12, marginBottom: 10 },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  draftTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  draftTitle: { fontSize: 14, fontWeight: '600' },
  baseTag: {
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  baseTagText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  newTag: {
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newTagText: { fontSize: 10, fontWeight: '700', color: '#2563eb' },
  iconButton: { padding: 8, borderRadius: 8 },
  addUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2563eb',
    marginTop: 4,
    marginBottom: 8,
  },
  addUnitText: { color: '#2563eb', fontWeight: '600' },
  deletionPreview: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  deletionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  deletionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  deletionName: { fontSize: 13 },
  undoText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  errorText: { color: '#dc2626', fontSize: 13, marginTop: 4 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1 },
});
