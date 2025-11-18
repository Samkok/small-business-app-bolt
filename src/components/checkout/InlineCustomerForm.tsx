import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import Input from '../ui/Input';
import { Button } from '../ui/Button';
import { UserPlus } from 'lucide-react-native';

interface InlineCustomerFormProps {
  onCustomerCreate: (name: string, phone?: string) => Promise<void>;
  onCancel: () => void;
}

export function InlineCustomerForm({ onCustomerCreate, onCancel }: InlineCustomerFormProps) {
  const { isDark } = useTheme();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    setLoading(true);
    try {
      await onCustomerCreate(customerName.trim(), customerPhone.trim() || undefined);
      setCustomerName('');
      setCustomerPhone('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1f2937' : '#f9fafb' }]}>
      <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
        Create New Customer
      </Text>

      <Input
        label="Customer Name"
        value={customerName}
        onChangeText={setCustomerName}
        placeholder="Enter customer name"
        autoCapitalize="words"
        required
      />

      <Input
        label="Phone Number (Optional)"
        value={customerPhone}
        onChangeText={setCustomerPhone}
        placeholder="Enter phone number"
        keyboardType="phone-pad"
      />

      <View style={styles.buttonRow}>
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="secondary"
          style={styles.button}
        />
        <Button
          title="Create"
          onPress={handleCreate}
          loading={loading}
          icon={<UserPlus size={18} color="#ffffff" />}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
  },
});
