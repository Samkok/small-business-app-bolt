import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onConfirm: (startDate: Date, endDate: Date) => void;
  onCancel: () => void;
}

export default function DateRangePicker({ 
  startDate: initialStartDate, 
  endDate: initialEndDate, 
  onConfirm, 
  onCancel 
}: DateRangePickerProps) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [currentMonth, setCurrentMonth] = useState(new Date(initialStartDate));
  const [selectingStart, setSelectingStart] = useState(true);
  
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
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, date: null });
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      // Set time to beginning of day for consistent comparison
      date.setHours(0, 0, 0, 0);
      days.push({ day: i, date });
    }
    
    return days;
  };

  const isDateInRange = (date: Date) => {
    // Create copies with time set to beginning of day for consistent comparison
    const compareStart = new Date(startDate);
    compareStart.setHours(0, 0, 0, 0);
    
    const compareEnd = new Date(endDate);
    compareEnd.setHours(0, 0, 0, 0);
    
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    return compareDate >= compareStart && compareDate <= compareEnd;
  };

  const isStartDate = (date: Date) => {
    // Compare only year, month, and day
    return date.getDate() === startDate.getDate() && 
           date.getMonth() === startDate.getMonth() && 
           date.getFullYear() === startDate.getFullYear();
  };

  const isEndDate = (date: Date) => {
    // Compare only year, month, and day
    return date.getDate() === endDate.getDate() && 
           date.getMonth() === endDate.getMonth() && 
           date.getFullYear() === endDate.getFullYear();
  };

  const handleDatePress = (date: Date) => {
    if (selectingStart) {
      // If selecting start date, set it and prepare to select end date
      // Create a new date object with time set to beginning of day
      const newStartDate = new Date(date);
      newStartDate.setHours(0, 0, 0, 0);
      
      setStartDate(newStartDate);
      setEndDate(newStartDate); // Initially set end date same as start date
      setSelectingStart(false);
    } else {
      // If selecting end date
      if (date < startDate) {
        // If selected date is before start date, swap them
        const newEndDate = new Date(startDate);
        newEndDate.setHours(0, 0, 0, 0);
        
        const newStartDate = new Date(date);
        newStartDate.setHours(0, 0, 0, 0);
        
        setEndDate(newEndDate);
        setStartDate(newStartDate);
      } else {
        // Create a new date object with time set to beginning of day
        const newEndDate = new Date(date);
        newEndDate.setHours(0, 0, 0, 0);
        
        setEndDate(newEndDate);
      }
      setSelectingStart(true); // Reset to selecting start date for next time
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calendarDays = generateCalendarDays();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.container}>
      <View style={styles.dateDisplay}>
        <View style={[
          styles.dateBox, 
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
        ]}>
          <Text style={[styles.dateLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            Start Date
          </Text>
          <Text style={[styles.dateValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {formatDate(startDate)}
          </Text>
        </View>
        
        <View style={styles.dateArrow}>
          <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        </View>
        
        <View style={[
          styles.dateBox, 
          { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
        ]}>
          <Text style={[styles.dateLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            End Date
          </Text>
          <Text style={[styles.dateValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {formatDate(endDate)}
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
        
        <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
          <ChevronRight size={20} color={isDark ? '#f9fafb' : '#111827'} />
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
          const isStart = isStartDate(date);
          const isEnd = isEndDate(date);
          const isInRange = isDateInRange(date);
          
          return (
            <TouchableOpacity
              key={`day-${item.day}`}
              style={[
                styles.dayButton,
                isStart && [styles.startDate, { backgroundColor: '#2563eb' }],
                isEnd && [styles.endDate, { backgroundColor: '#2563eb' }],
                isInRange && !isStart && !isEnd && [styles.inRangeDate, { backgroundColor: '#2563eb20' }]
              ]}
              onPress={() => handleDatePress(date)}
            >
              <Text style={[
                styles.dayText,
                { color: isDark ? '#f9fafb' : '#111827' },
                (isStart || isEnd) && { color: '#ffffff' }
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
