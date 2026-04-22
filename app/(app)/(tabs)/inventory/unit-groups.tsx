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
import { ArrowLeft, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { unitService, UnitGroup, Unit } from '@/src/services/units';
import { UnitGroupEditorModal } from '@/src/components/inventory/UnitGroupEditorModal';

export default function UnitGroupsScreen() {
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<UnitGroup[]>([]);
  const [unitsByGroup, setUnitsByGroup] = useState<Record<string, Unit[]>>({});
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

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
        <TouchableOpacity onPress={() => setShowEditor(true)} style={styles.addButton}>
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

      <UnitGroupEditorModal
        visible={showEditor}
        businessId={currentBusiness?.id || ''}
        onClose={() => setShowEditor(false)}
        onSaved={() => load()}
      />
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
  unitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  unitName: { fontSize: 14, fontWeight: '600' },
  baseBadge: { color: '#059669', fontSize: 12, fontWeight: '600' },
  unitDetail: { fontSize: 12, marginTop: 2 },
  iconButton: { padding: 8, borderRadius: 8 },
});
