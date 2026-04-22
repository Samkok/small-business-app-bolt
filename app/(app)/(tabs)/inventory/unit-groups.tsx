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
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { unitService, UnitGroup, Unit } from '@/src/services/units';
import { UnitGroupEditorModal } from '@/src/components/inventory/UnitGroupEditorModal';
import { UnitGroupEditModal } from '@/src/components/inventory/UnitGroupEditModal';

export default function UnitGroupsScreen() {
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<UnitGroup[]>([]);
  const [unitsByGroup, setUnitsByGroup] = useState<Record<string, Unit[]>>({});
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UnitGroup | null>(null);

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

  const handleDeleteGroup = (group: UnitGroup) => {
    Alert.alert(
      'Delete unit group',
      `Delete "${group.name}"? Products using this group will be unlinked. This cannot be undone.`,
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
  const dividerColor = isDark ? '#374151' : '#f3f4f6';

  return (
    <View style={[styles.container, { backgroundColor: headerBg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={cardText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: cardText }]}>Unit Groups</Text>
        <TouchableOpacity onPress={() => setShowCreator(true)} style={styles.addButton}>
          <Plus size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.description, { color: cardMuted }]}>
          Define packaging hierarchies for your products. List units from largest to smallest. The last unit is the base unit that stock is tracked in.
        </Text>

        {loading ? (
          <Text style={[styles.emptyText, { color: cardMuted }]}>Loading...</Text>
        ) : groups.length === 0 ? (
          <Text style={[styles.emptyText, { color: cardMuted }]}>No unit groups yet. Tap + to create one.</Text>
        ) : (
          groups.map(g => {
            const units = unitsByGroup[g.id] || [];
            return (
              <Card key={g.id} style={styles.itemCard}>
                <View style={styles.groupHeader}>
                  <Text style={[styles.groupName, { color: cardText }]}>{g.name}</Text>
                  <View style={styles.groupActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => setEditingGroup(g)}
                      accessibilityLabel={`Edit ${g.name}`}
                    >
                      <Pencil size={16} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleDeleteGroup(g)}
                      accessibilityLabel={`Delete ${g.name}`}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: dividerColor }]} />

                {units.map((u, i) => (
                  <View
                    key={u.id}
                    style={[styles.unitRow, i < units.length - 1 && { borderBottomWidth: 1, borderBottomColor: dividerColor }]}
                  >
                    <View style={styles.unitLeft}>
                      <View style={styles.unitNameRow}>
                        <Text style={[styles.unitName, { color: cardText }]}>{u.name}</Text>
                        {u.is_base_unit && (
                          <View style={styles.baseBadge}>
                            <Text style={styles.baseBadgeText}>base</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.unitDetail, { color: cardMuted }]}>
                        {u.is_base_unit
                          ? 'Stock tracked in this unit'
                          : `1 ${u.name} = ${u.conversion_factor_to_base} base unit${u.conversion_factor_to_base === 1 ? '' : 's'}`}
                        {u.barcode ? `  ·  ${u.barcode}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            );
          })
        )}
      </ScrollView>

      <UnitGroupEditorModal
        visible={showCreator}
        businessId={currentBusiness?.id || ''}
        onClose={() => setShowCreator(false)}
        onSaved={() => { load(); }}
      />

      {editingGroup && (
        <UnitGroupEditModal
          visible={!!editingGroup}
          group={editingGroup}
          initialUnits={unitsByGroup[editingGroup.id] || []}
          onClose={() => setEditingGroup(null)}
          onSaved={async () => {
            setEditingGroup(null);
            await load();
          }}
        />
      )}
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
  itemCard: { marginBottom: 12, padding: 0, overflow: 'hidden' },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  groupName: { fontSize: 15, fontWeight: '700', flex: 1 },
  groupActions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 8, borderRadius: 8 },
  divider: { height: 1, marginHorizontal: 0 },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  unitLeft: { flex: 1 },
  unitNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  unitName: { fontSize: 14, fontWeight: '600' },
  baseBadge: {
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  baseBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  unitDetail: { fontSize: 12 },
});
