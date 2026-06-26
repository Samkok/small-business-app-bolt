import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onConfirm: (startDate: Date, endDate: Date) => void;
  onCancel: () => void;
}

type PickerView = 'calendar' | 'month' | 'year';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function DateRangePicker({
  startDate: initialStartDate,
  endDate: initialEndDate,
  onConfirm,
  onCancel,
}: DateRangePickerProps) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [startDate, setStartDate] = useState(
    initialStartDate.getTime() < new Date(2001, 0, 1).getTime() ? defaultStart : initialStartDate
  );
  const [endDate, setEndDate] = useState(
    initialEndDate.getTime() < new Date(2001, 0, 1).getTime() ? now : initialEndDate
  );
  const [currentMonth, setCurrentMonth] = useState(
    new Date(
      (initialStartDate.getTime() < new Date(2001, 0, 1).getTime() ? defaultStart : initialStartDate).getFullYear(),
      (initialStartDate.getTime() < new Date(2001, 0, 1).getTime() ? defaultStart : initialStartDate).getMonth(),
      1
    )
  );
  const [selectingStart, setSelectingStart] = useState(true);
  const [pickerView, setPickerView] = useState<PickerView>('calendar');
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(now.getFullYear() / 12) * 12
  );

  const { isDark } = useTheme();

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: { day: number; date: Date | null }[] = [];

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

  const isDateInRange = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDate);
    e.setHours(0, 0, 0, 0);
    return d >= s && d <= e;
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  const handleDatePress = (date: Date) => {
    if (selectingStart) {
      const newStart = new Date(date);
      newStart.setHours(0, 0, 0, 0);
      setStartDate(newStart);
      setEndDate(newStart);
      setSelectingStart(false);
    } else {
      if (date < startDate) {
        const newEnd = new Date(startDate);
        newEnd.setHours(0, 0, 0, 0);
        const newStart = new Date(date);
        newStart.setHours(0, 0, 0, 0);
        setEndDate(newEnd);
        setStartDate(newStart);
      } else {
        const newEnd = new Date(date);
        newEnd.setHours(0, 0, 0, 0);
        setEndDate(newEnd);
      }
      setSelectingStart(true);
    }
  };

  const handlePrevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  const handleNextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleMonthYearPress = () =>
    setPickerView('month');

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
    setPickerView('calendar');
  };

  const handleYearHeaderPress = () =>
    setPickerView('year');

  const handleYearSelect = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setPickerView('month');
  };

  const formatMonthYear = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const calendarDays = generateCalendarDays();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderYearView = () => {
    const years: number[] = [];
    for (let i = yearPageStart; i < yearPageStart + 12; i++) {
      years.push(i);
    }
    const currentYear = currentMonth.getFullYear();

    return (
      <View>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => setYearPageStart(yearPageStart - 12)}
            style={styles.monthButton}
          >
            <ChevronLeft size={20} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {yearPageStart} - {yearPageStart + 11}
          </Text>
          <TouchableOpacity
            onPress={() => setYearPageStart(yearPageStart + 12)}
            style={styles.monthButton}
          >
            <ChevronRight size={20} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>
        <View style={styles.gridContainer}>
          {years.map((year) => {
            const isSelected = year === currentYear;
            return (
              <TouchableOpacity
                key={year}
                style={[
                  styles.gridCell,
                  isSelected && { backgroundColor: '#2563eb' },
                ]}
                onPress={() => handleYearSelect(year)}
              >
                <Text
                  style={[
                    styles.gridCellText,
                    { color: isDark ? '#f9fafb' : '#111827' },
                    isSelected && { color: '#ffffff' },
                  ]}
                >
                  {year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMonthView = () => {
    const currentMonthIndex = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    return (
      <View>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(year - 1, currentMonthIndex, 1))}
            style={styles.monthButton}
          >
            <ChevronLeft size={20} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleYearHeaderPress}>
            <Text style={[styles.monthTitle, styles.tappableHeader, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {year}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(year + 1, currentMonthIndex, 1))}
            style={styles.monthButton}
          >
            <ChevronRight size={20} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>
        <View style={styles.gridContainer}>
          {MONTHS.map((monthName, index) => {
            const isSelected = index === currentMonthIndex;
            return (
              <TouchableOpacity
                key={monthName}
                style={[
                  styles.gridCell,
                  isSelected && { backgroundColor: '#2563eb' },
                ]}
                onPress={() => handleMonthSelect(index)}
              >
                <Text
                  style={[
                    styles.gridCellText,
                    { color: isDark ? '#f9fafb' : '#111827' },
                    isSelected && { color: '#ffffff' },
                  ]}
                >
                  {monthName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderCalendarView = () => (
    <View>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthButton}>
          <ChevronLeft size={20} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMonthYearPress}>
          <Text style={[styles.monthTitle, styles.tappableHeader, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {formatMonthYear(currentMonth)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
          <ChevronRight size={20} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <View style={styles.dayNamesRow}>
        {dayNames.map((day) => (
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
          const isStart = isSameDay(date, startDate);
          const isEnd = isSameDay(date, endDate);
          const isInRange = isDateInRange(date);

          return (
            <TouchableOpacity
              key={`day-${item.day}`}
              style={[
                styles.dayButton,
                isStart && [styles.startDate, { backgroundColor: '#2563eb' }],
                isEnd && [styles.endDate, { backgroundColor: '#2563eb' }],
                isInRange && !isStart && !isEnd && [styles.inRangeDate, { backgroundColor: '#2563eb20' }],
              ]}
              onPress={() => handleDatePress(date)}
            >
              <Text
                style={[
                  styles.dayText,
                  { color: isDark ? '#f9fafb' : '#111827' },
                  (isStart || isEnd) && { color: '#ffffff' },
                ]}
              >
                {item.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.dateDisplay}>
        <TouchableOpacity
          style={[
            styles.dateBox,
            { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
            !selectingStart && styles.dateBoxInactive,
          ]}
          onPress={() => setSelectingStart(true)}
        >
          <Text style={[styles.dateLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Start Date
          </Text>
          <Text style={[styles.dateValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {formatDate(startDate)}
          </Text>
        </TouchableOpacity>

        <View style={styles.dateArrow}>
          <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        </View>

        <TouchableOpacity
          style={[
            styles.dateBox,
            { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
            selectingStart && styles.dateBoxInactive,
          ]}
          onPress={() => setSelectingStart(false)}
        >
          <Text style={[styles.dateLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            End Date
          </Text>
          <Text style={[styles.dateValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {formatDate(endDate)}
          </Text>
        </TouchableOpacity>
      </View>

      {pickerView === 'year' && renderYearView()}
      {pickerView === 'month' && renderMonthView()}
      {pickerView === 'calendar' && renderCalendarView()}

      <View style={styles.actionButtons}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onCancel}
          style={styles.actionButton}
        />
        <Button
          title="Apply"
          onPress={() => onConfirm(startDate, endDate)}
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
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateBoxInactive: {
    opacity: 0.6,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateArrow: {
    paddingHorizontal: 8,
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
  tappableHeader: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
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
  startDate: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  endDate: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  inRangeDate: {
    borderRadius: 0,
  },
  dayText: {
    fontSize: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  gridCell: {
    width: '25%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  gridCellText: {
    fontSize: 14,
    fontWeight: '500',
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
