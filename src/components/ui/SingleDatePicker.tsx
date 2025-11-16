import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface SingleDatePickerProps {
  selectedDate: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  maxDate?: Date;
}

export default function SingleDatePicker({
  selectedDate: initialDate,
  onConfirm,
  onCancel,
  maxDate = new Date()
}: SingleDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate));

  const { isDark } = useTheme();

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, date: null });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      date.setHours(0, 0, 0, 0);
      days.push({ day: i, date });
    }

    return days;
  };

  const isSelectedDate = (date: Date) => {
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  const isFutureDate = (date: Date) => {
    const today = new Date(maxDate);
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const handleDatePress = (date: Date) => {
    if (isFutureDate(date)) {
      return;
    }

    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    setSelectedDate(newDate);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const currentMaxDate = new Date(maxDate);

    if (nextMonth.getFullYear() < currentMaxDate.getFullYear() ||
        (nextMonth.getFullYear() === currentMaxDate.getFullYear() &&
         nextMonth.getMonth() <= currentMaxDate.getMonth())) {
      setCurrentMonth(nextMonth);
    }
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const canGoNext = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const currentMaxDate = new Date(maxDate);
    return nextMonth.getFullYear() < currentMaxDate.getFullYear() ||
           (nextMonth.getFullYear() === currentMaxDate.getFullYear() &&
            nextMonth.getMonth() <= currentMaxDate.getMonth());
  };

  const calendarDays = generateCalendarDays();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.container}>
      <View style={styles.selectedDateDisplay}>
        <View style={[
          styles.dateBox,
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
        ]}>
          <Text style={[styles.dateLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Selected Date
          </Text>
          <Text style={[styles.dateValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {formatDate(selectedDate)}
          </Text>
        </View>
      </View>

      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthButton}>
          <ChevronLeft size={20} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>

        <Text style={[styles.monthTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {formatMonthYear(currentMonth)}
        </Text>

        <TouchableOpacity
          onPress={handleNextMonth}
          style={styles.monthButton}
          disabled={!canGoNext()}
        >
          <ChevronRight
            size={20}
            color={canGoNext() ? (isDark ? '#f9fafb' : '#111827') : '#9ca3af'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.dayNamesRow}>
        {dayNames.map(day => (
          <Text key={day} style={[styles.dayName, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {calendarDays.map((item, index) => {
          if (item.day === 0) {
            return <View key={`empty-${index}`} style={styles.emptyDay} />;
          }

          const date = item.date as Date;
          const isSelected = isSelectedDate(date);
          const isFuture = isFutureDate(date);

          return (
            <TouchableOpacity
              key={`day-${item.day}`}
              style={[
                styles.dayButton,
                isSelected && [styles.selectedDate, { backgroundColor: '#2563eb' }],
                isFuture && styles.disabledDate
              ]}
              onPress={() => handleDatePress(date)}
              disabled={isFuture}
            >
              <Text style={[
                styles.dayText,
                { color: isDark ? '#f9fafb' : '#111827' },
                isSelected && { color: '#ffffff', fontWeight: '700' },
                isFuture && { color: '#9ca3af' }
              ]}>
                {item.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actionButtons}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onCancel}
          style={styles.actionButton}
        />
        <Button
          title="Confirm"
          onPress={() => onConfirm(selectedDate)}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  selectedDateDisplay: {
    marginBottom: 20,
  },
  dateBox: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  emptyDay: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayButton: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  selectedDate: {
    borderRadius: 20,
  },
  disabledDate: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
