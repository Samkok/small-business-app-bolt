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
import { Plus, X } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { unitService, UnitGroup } from '@/src/services/units';

type UnitDraft = { name: string; conversion: string };

interface UnitGroupEditorModalProps {
  visible: boolean;
  businessId: string;
  onClose: () => void;
  onSaved: (group: UnitGroup) => void;
}

export function UnitGroupEditorModal({
  visible,
  businessId,
  onClose,
  onSaved,
}: UnitGroupEditorModalProps) {
  const { isDark } = useTheme();
  const [groupName, setGroupName] = useState('');
  const [draftUnits, setDraftUnits] = useState<UnitDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (visible) {
      setGroupName('');
      setDraftUnits([
        { name: 'Box', conversion: '24' },
        { name: 'Bottle', conversion: '1' },
      ]);
      setFormError('');
    }
  }, [visible]);

  const addDraftUnit = () => {
    setDraftUnits(prev => [...prev, { name: '', conversion: '1' }]);
  };

  const removeDraftUnit = (idx: number) => {
    if (draftUnits.length <= 1) return;
    setDraftUnits(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDraftUnit = (idx: number, patch: Partial<UnitDraft>) => {
    setDraftUnits(prev => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      setFormError('Group name is required');
      return;
    }
    if (draftUnits.length < 1) {
      setFormError('Add at least one unit');
      return;
    }

    const cleaned = draftUnits.map((u, idx) => ({
      name: u.name.trim(),
      conversion: idx === draftUnits.length - 1 ? 1 : parseInt(u.conversion, 10),
      idx,
    }));

    for (const u of cleaned) {
      if (!u.name) {
        setFormError(`Unit ${u.idx + 1}: name is required`);
        return;
      }
      if (u.idx !== cleaned.length - 1 && (!Number.isFinite(u.conversion) || u.conversion <= 1)) {
        setFormError(
          `Unit ${u.idx + 1}: conversion must be a whole number greater than 1`,
        );
        return;
      }
    }

    let runningFactor = 1;
    const unitsForApi: Array<{ name: string; conversion_factor_to_base: number }> = [];
    for (let i = cleaned.length - 1; i >= 0; i--) {
      const u = cleaned[i];
      if (i === cleaned.length - 1) {
        runningFactor = 1;
      } else {
        runningFactor = runningFactor * u.conversion;
      }
      unitsForApi.unshift({
        name: u.name,
        conversion_factor_to_base: runningFactor,
      });
    }

    setSaving(true);
    setFormError('');
    try {
      const { group } = await unitService.createUnitGroupWithUnits({
        business_id: businessId,
        name: groupName.trim(),
        units: unitsForApi,
      });
      onSaved(group);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create unit group');
    } finally {
      setSaving(false);
    }
  };

  const cardText = isDark ? '#f9fafb' : '#111827';
  const cardMuted = isDark ? '#9ca3af' : '#6b7280';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: cardText }]}>New unit group</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={cardText} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Input
              label="Group name"
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g. Beverage packaging"
            />

            <Text style={[styles.sectionLabel, { color: cardMuted }]}>
              List units largest to smallest. For each unit (except the last), enter how many of the next unit down it contains. The last unit becomes the base unit stock is tracked in. Barcodes are set per product, not on the unit group itself.
            </Text>

            {draftUnits.map((u, idx) => {
              const isBase = idx === draftUnits.length - 1;
              return (
                <View
                  key={idx}
                  style={[styles.draftCard, { backgroundColor: isDark ? '#111827' : '#f3f4f6' }]}
                >
                  <View style={styles.draftHeader}>
                    <Text style={[styles.draftTitle, { color: cardText }]}>
                      Unit {idx + 1} {isBase ? '(base unit)' : ''}
                    </Text>
                    {draftUnits.length > 1 && (
                      <TouchableOpacity onPress={() => removeDraftUnit(idx)} style={styles.iconButton}>
                        <X size={18} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Input
                    label="Name"
                    value={u.name}
                    onChangeText={v => updateDraftUnit(idx, { name: v })}
                    placeholder={isBase ? 'Bottle' : 'Box'}
                  />
                  {!isBase && (
                    <Input
                      label={`How many ${draftUnits[idx + 1]?.name || 'base unit'}s per ${u.name || 'this unit'}`}
                      value={u.conversion}
                      onChangeText={v => updateDraftUnit(idx, { conversion: v.replace(/[^\d]/g, '') })}
                      placeholder="24"
                      keyboardType="number-pad"
                    />
                  )}
                </View>
              );
            })}

            <TouchableOpacity onPress={addDraftUnit} style={styles.addUnitBtn}>
              <Plus size={18} color="#2563eb" />
              <Text style={styles.addUnitText}>Add unit below</Text>
            </TouchableOpacity>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={styles.btn} />
            <Button title="Create" loading={saving} onPress={handleSave} style={styles.btn} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1 },
  sectionLabel: { fontSize: 12, marginTop: 12, marginBottom: 8, lineHeight: 16 },
  draftCard: { padding: 12, borderRadius: 12, marginBottom: 10 },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  draftTitle: { fontSize: 14, fontWeight: '600' },
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
  },
  addUnitText: { color: '#2563eb', fontWeight: '600' },
  errorText: { color: '#dc2626', fontSize: 13, marginTop: 8 },
});
