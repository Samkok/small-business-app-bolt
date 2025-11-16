import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { X, DollarSign, FileText, Calendar, Tag } from 'lucide-react-native';
import { expenseService } from '@/src/services/expenses';
import SingleDatePicker from '@/src/components/ui/SingleDatePicker';

interface ExpenseFormProps {
  expense?: any;
  categories: any[];
  onSave: () => void;
  onCancel: () => void;
}

export default function ExpenseForm({ expense, categories, onSave, onCancel }: ExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();

  useEffect(() => {
    if (expense) {
      setAmount(expense.amount.toString());
      setDescription(expense.description || '');
      setCategoryId(expense.category_id || '');
      setExpenseDate(expense.expense_date?.split('T')[0] || '');
      setNotes(expense.notes || '');
    } else {
      // Set today's date as default
      const today = new Date();
      setExpenseDate(today.toISOString().split('T')[0]);
    }
  }, [expense]);

  const handleDateConfirm = (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    setExpenseDate(formattedDate);
    setShowDatePicker(false);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSave = async () => {
    if (!amount.trim() || !description.trim() || !categoryId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business currentBusiness found');
      return;
    }

    setLoading(true);
    try {
      const expenseData = {
        amount: amountValue,
        description: description.trim(),
        category_id: categoryId,
        expense_date: expenseDate || new Date().toISOString(),
        notes: notes.trim() || null,
        business_id: currentBusiness.id,
        created_by: user.id,
      };

      if (expense) {
        await expenseService.updateExpense(expense.id, expenseData);
      } else {
        await expenseService.createExpense(expenseData);
      }

      Alert.alert('Success', `Expense ${expense ? 'updated' : 'created'} successfully`);
      onSave();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', `Failed to ${expense ? 'update' : 'create'} expense`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {expense ? 'Edit Expense' : 'Add Expense'}
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={20} color="#dc2626" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Expense Details
              </Text>
            </View>
            
            <Input
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              required
            />
            
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What was this expense for?"
              required
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Tag size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Category
              </Text>
            </View>
            
            <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
              Select Category *
            </Text>
            <View style={styles.categoryGrid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    {
                      backgroundColor: categoryId === category.id 
                        ? '#8b5cf6' 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      borderColor: categoryId === category.id 
                        ? '#8b5cf6' 
                        : (isDark ? '#4b5563' : '#d1d5db'),
                    }
                  ]}
                  onPress={() => setCategoryId(category.id)}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    { 
                      color: categoryId === category.id 
                        ? '#ffffff' 
                        : (isDark ? '#f9fafb' : '#374151') 
                    }
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color="#059669" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Date
              </Text>
            </View>

            <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
              Expense Date
            </Text>
            <TouchableOpacity
              style={[
                styles.datePickerButton,
                {
                  backgroundColor: isDark ? '#374151' : '#ffffff',
                  borderColor: isDark ? '#4b5563' : '#d1d5db'
                }
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[
                styles.datePickerText,
                { color: isDark ? '#f9fafb' : '#111827' }
              ]}>
                {formatDisplayDate(expenseDate)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText size={20} color="#ea580c" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Additional Notes
              </Text>
            </View>
            
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional details about this expense"
              multiline
              numberOfLines={4}
            />
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onCancel}
          style={styles.footerButton}
        />
        <Button
          title={expense ? 'Update Expense' : 'Add Expense'}
          onPress={handleSave}
          loading={loading}
          style={styles.footerButton}
        />
      </View>

      <Modal
        visible={showDatePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.datePickerModal,
            { backgroundColor: isDark ? '#1f2937' : '#ffffff' }
          ]}>
            <SingleDatePicker
              selectedDate={expenseDate ? new Date(expenseDate + 'T00:00:00') : new Date()}
              onConfirm={handleDateConfirm}
              onCancel={() => setShowDatePicker(false)}
              maxDate={new Date()}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  datePickerText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});