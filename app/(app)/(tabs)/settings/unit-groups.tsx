import React, { useCallback, useEffect, useState } from 'react';
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
import { ArrowLeft, Plus, Trash2, X, Barcode } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { unitService, UnitGroup, Unit } from '@/src/services/units';
import BarcodeScanner from '@/src/components/inventory/BarcodeScanner';

type UnitDraft = { name: string; conversion: string; barcode: string };

export default function UnitGroupsScreen() {
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<UnitGroup[]>([]);
  const [unitsByGroup, setUnitsByGroup] = useState<Record<string, Unit[]>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [draftUnits, setDraftUnits] = useState<UnitDraft[]>([
    { name: 'Box', conversion: '24', barcode: '' },
    { name: 'Bottle', conversion: '1', barcode: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [scanTarget, setScanTarget] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!currentBusiness?.id) return;
    setLoading(true);
    try {
      const list = await unitService.getUnitGroups(currentBusiness.id);
      setGroups(list);
      const entries = await Promise.all(
        list.map(async g => [g.id, await unitService.getUnits(g.id)] as const),
      );
      const map: Record<string, Unit[]> = {};
      for (const [id, units] of entries) map[id] = units;
      setUnitsByGroup(map);
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
    setGroupName('');
    setDraftUnits([
      { name: 'Box', conversion: '24', barcode: '' },
      { name: 'Bottle', conversion: '1', barcode: '' },
    ]);
    setFormError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const addDraftUnit = () => {
    setDraftUnits(prev => [...prev, { name: '', conversion: '1', barcode: '' }]);
  };

  const removeDraftUnit = (idx: number) => {
    if (draftUnits.length <= 1) return;
    setDraftUnits(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDraftUnit = (idx: number, patch: Partial<UnitDraft>) => {
    setDraftUnits(prev => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  };

  const handleSave = async () => {
    if (!currentBusiness?.id) return;
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
      barcode: u.barcode.trim(),
      idx,
    }));

    for (const u of cleaned) {
      if (!u.name) {
        setFormError(`Unit ${u.idx + 1}: name is required`);
        return;
      }
      if (u.idx !== cleaned.length - 1 && (!Number.isFinite(u.conversion) || u.conversion <= 1)) {
        setFormError(
          `Unit ${u.idx + 1}: conversion to base must be a whole number greater than 1 (how many of the next unit down it contains)`,
        );
        return;
      }
    }

    let runningFactor = 1;
    const unitsForApi: Array<{ name: string; conversion_factor_to_base: number; barcode?: string | null }> = [];
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
        barcode: u.barcode || null,
      });
    }

    setSaving(true);
    setFormError('');
    try {
      await unitService.createUnitGroupWithUnits({
        business_id: currentBusiness.id,
        name: groupName.trim(),
        units: unitsForApi,
      });
      setShowForm(false);
      resetForm();
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create unit group');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = (group: UnitGroup) => {
    Alert.alert(
      'Delete unit group',
      `Delete ${group.name}? Products using this group will be unlinked. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await unitService.deleteUnitGroup(group.id);
              await load();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete');
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
        <Text style={[styles.title, { color: cardText }]}>Unit Groups</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Plus size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.description, { color: cardMuted }]}>
          Define packaging hierarchies for your products. List units from largest to smallest. The last unit is the
          base unit that stock is tracked in. Each unit can have its own barcode.
        </Text>

        {loading ? (
          <Text style={[styles.emptyText, { color: cardMuted }]}>Loading...</Text>
        ) : groups.length === 0 ? (
          <Text style={[styles.emptyText, { color: cardMuted }]}>No unit groups yet.</Text>
        ) : (
          groups.map(g => (
            <Card key={g.id} style={styles.itemCard}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupName, { color: cardText }]}>{g.name}</Text>
                <TouchableOpacity onPress={() => handleDeleteGroup(g)} style={styles.iconButton}>
                  <Trash2 size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
              {(unitsByGroup[g.id] || []).map(u => (
                <View key={u.id} style={styles.unitRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unitName, { color: cardText }]}>
                      {u.name} {u.is_base_unit ? <Text style={styles.baseBadge}>(base)</Text> : null}
                    </Text>
                    <Text style={[styles.unitDetail, { color: cardMuted }]}>
                      1 {u.name} = {u.conversion_factor_to_base} base unit{u.conversion_factor_to_base === 1 ? '' : 's'}
                      {u.barcode ? `  -  ${u.barcode}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
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
              <Text style={[styles.modalTitle, { color: cardText }]}>New unit group</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
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
                Units - largest first. For each unit except the last, enter how many of the next unit down it contains.
              </Text>

              {draftUnits.map((u, idx) => {
                const isBase = idx === draftUnits.length - 1;
                return (
                  <View key={idx} style={[styles.draftCard, { backgroundColor: isDark ? '#111827' : '#f3f4f6' }]}>
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
                    <View style={styles.barcodeRow}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="Barcode (optional)"
                          value={u.barcode}
                          onChangeText={v => updateDraftUnit(idx, { barcode: v })}
                          placeholder="Scan or enter"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.scanBtn}
                        onPress={() => setScanTarget(idx)}
                        accessibilityLabel="Scan barcode"
                      >
                        <Barcode size={20} color="#2563eb" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity onPress={addDraftUnit} style={styles.addUnitBtn}>
                <Plus size={18} color="#2563eb" />
                <Text style={styles.addUnitText}>Add unit below</Text>
              </TouchableOpacity>

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button title="Cancel" variant="outline" onPress={() => setShowForm(false)} style={styles.modalBtn} />
              <Button title="Create" loading={saving} onPress={handleSave} style={styles.modalBtn} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={scanTarget !== null}
        animationType="slide"
        onRequestClose={() => setScanTarget(null)}
      >
        <BarcodeScanner
          onBarcodeScan={code => {
            if (scanTarget !== null) {
              updateDraftUnit(scanTarget, { barcode: code });
            }
            setScanTarget(null);
          }}
          onClose={() => setScanTarget(null)}
        />
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
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  groupName: { fontSize: 16, fontWeight: '700' },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  unitName: { fontSize: 14, fontWeight: '600' },
  baseBadge: { color: '#059669', fontSize: 12, fontWeight: '600' },
  unitDetail: { fontSize: 12, marginTop: 2 },
  iconButton: { padding: 8, borderRadius: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalBtn: { flex: 1 },
  sectionLabel: { fontSize: 12, marginTop: 12, marginBottom: 8, lineHeight: 16 },
  draftCard: { padding: 12, borderRadius: 12, marginBottom: 10 },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  draftTitle: { fontSize: 14, fontWeight: '600' },
  barcodeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  scanBtn: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    marginBottom: 4,
  },
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
