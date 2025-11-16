import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';

interface MonthPickerProps {
  selectedMonth: Date;
  onMonthChange: (month: Date) => void;
  maxDate?: Date;
  minDate?: Date;
}

export default function MonthPicker({
  selectedMonth,
  onMonthChange,
  maxDate = new Date(),
  minDate = new Date(2020, 0, 1)
}: MonthPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [viewingYear, setViewingYear] = useState(selectedMonth.getFullYear());
  const { isDark } = useTheme();

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const formatSelectedMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(viewingYear, monthIndex, 1);
    onMonthChange(newDate);
    setShowPicker(false);
  };

  const isMonthDisabled = (monthIndex: number) => {
    const monthDate = new Date(viewingYear, monthIndex, 1);
    const maxMonthDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const minMonthDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

    return monthDate > maxMonthDate || monthDate < minMonthDate;
  };

  const isCurrentMonth = (monthIndex: number) => {
    return selectedMonth.getFullYear() === viewingYear &&
           selectedMonth.getMonth() === monthIndex;
  };

  const canGoPrevYear = () => {
    return viewingYear > minDate.getFullYear();
  };

  const canGoNextYear = () => {
    return viewingYear < maxDate.getFullYear();
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.triggerButton,
          {
            backgroundColor: isDark ? '#374151' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#d1d5db'
          }
        ]}
        onPress={() => setShowPicker(true)}
      >
        <Calendar size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
        <Text style={[
          styles.triggerText,
          { color: isDark ? '#f9fafb' : '#111827' }
        ]}>
          {formatSelectedMonth(selectedMonth)}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[
              styles.pickerContainer,
              { backgroundColor: isDark ? '#1f2937' : '#ffffff' }
            ]}>
              <View style={styles.yearSelector}>
                <TouchableOpacity
                  onPress={() => setViewingYear(viewingYear - 1)}
                  disabled={!canGoPrevYear()}
                  style={styles.yearButton}
                >
                  <ChevronLeft
                    size={20}
                    color={canGoPrevYear() ? (isDark ? '#f9fafb' : '#111827') : '#9ca3af'}
                  />
                </TouchableOpacity>

                <Text style={[
                  styles.yearText,
                  { color: isDark ? '#f9fafb' : '#111827' }
                ]}>
                  {viewingYear}
                </Text>

                <TouchableOpacity
                  onPress={() => setViewingYear(viewingYear + 1)}
                  disabled={!canGoNextYear()}
                  style={styles.yearButton}
                >
                  <ChevronRight
                    size={20}
                    color={canGoNextYear() ? (isDark ? '#f9fafb' : '#111827') : '#9ca3af'}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.monthsGrid}>
                {months.map((month, index) => {
                  const disabled = isMonthDisabled(index);
                  const current = isCurrentMonth(index);

                  return (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.monthButton,
                        {
                          backgroundColor: current
                            ? '#2563eb'
                            : (isDark ? '#374151' : '#f3f4f6'),
                          borderColor: current
                            ? '#2563eb'
                            : (isDark ? '#4b5563' : '#d1d5db')
                        },
                        disabled && styles.disabledMonth
                      ]}
                      onPress={() => handleMonthSelect(index)}
                      disabled={disabled}
                    >
                      <Text style={[
                        styles.monthText,
                        {
                          color: current
                            ? '#ffffff'
                            : (isDark ? '#f9fafb' : '#111827')
                        },
                        disabled && { color: '#9ca3af' }
                      ]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    width: 280,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  yearButton: {
    padding: 8,
  },
  yearText: {
    fontSize: 18,
    fontWeight: '600',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthButton: {
    width: '30%',
    aspectRatio: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '500',
  },
  disabledMonth: {
    opacity: 0.3,
  },
});
