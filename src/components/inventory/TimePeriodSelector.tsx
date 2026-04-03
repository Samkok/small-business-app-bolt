import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import DateRangePicker from '@/src/components/sales/DateRangePicker';

interface TimePeriodSelectorProps {
  selectedDays: number;
  useCustomRange: boolean;
  customStartDate?: Date;
  customEndDate?: Date;
  onSelectPreset: (days: number) => void;
  onSelectCustomRange: (start: Date, end: Date) => void;
}

const PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

export default function TimePeriodSelector({
  selectedDays,
  useCustomRange,
  customStartDate,
  customEndDate,
  onSelectPreset,
  onSelectCustomRange,
}: TimePeriodSelectorProps) {
  const { isDark } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const colors = {
    bg: isDark ? '#1f2937' : '#f3f4f6',
    activeBg: '#2563eb',
    activeText: '#ffffff',
    text: isDark ? '#d1d5db' : '#4b5563',
    border: isDark ? '#374151' : '#e5e7eb',
    card: isDark ? '#1f2937' : '#ffffff',
  };

  const formatCustomLabel = () => {
    if (!customStartDate || !customEndDate) return 'Custom';
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(customStartDate)} - ${fmt(customEndDate)}`;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.pillRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        {PRESETS.map((preset) => {
          const isActive = !useCustomRange && selectedDays === preset.days;
          return (
            <TouchableOpacity
              key={preset.days}
              style={[styles.pill, isActive && { backgroundColor: colors.activeBg }]}
              onPress={() => onSelectPreset(preset.days)}
            >
              <Text style={[styles.pillText, { color: isActive ? colors.activeText : colors.text }]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.pill, styles.customPill, useCustomRange && { backgroundColor: colors.activeBg }]}
          onPress={() => setShowPicker(true)}
        >
          <Calendar size={14} color={useCustomRange ? colors.activeText : colors.text} />
          <Text
            style={[styles.pillText, { color: useCustomRange ? colors.activeText : colors.text }]}
            numberOfLines={1}
          >
            {useCustomRange ? formatCustomLabel() : 'Custom'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <DateRangePicker
              startDate={customStartDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
              endDate={customEndDate || new Date()}
              onConfirm={(start, end) => {
                onSelectCustomRange(start, end);
                setShowPicker(false);
              }}
              onCancel={() => setShowPicker(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customPill: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 400,
  },
});
