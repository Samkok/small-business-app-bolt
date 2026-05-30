import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import Input from '../ui/Input';
import { Button } from '../ui/Button';
import { UserPlus } from 'lucide-react-native';

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'line', label: 'Line' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
];

interface InlineCustomerFormProps {
  onCustomerCreate: (name: string, phone?: string, platform?: string) => Promise<void>;
  onCancel: () => void;
}

export function InlineCustomerForm({ onCustomerCreate, onCancel }: InlineCustomerFormProps) {
  const { isDark } = useTheme();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    setLoading(true);
    try {
      await onCustomerCreate(
        customerName.trim(),
        customerPhone.trim() || undefined,
        selectedPlatform || undefined
      );
      setCustomerName('');
      setCustomerPhone('');
      setSelectedPlatform('');
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

      <View style={styles.platformSection}>
        <Text style={[styles.platformLabel, { color: isDark ? '#d1d5db' : '#374151' }]}>
          Channel (Optional)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformScroll}>
          <View style={styles.platformRow}>
            {PLATFORMS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.platformChip,
                  {
                    backgroundColor: selectedPlatform === p.value
                      ? '#2563eb'
                      : (isDark ? '#374151' : '#e5e7eb'),
                  },
                ]}
                onPress={() => setSelectedPlatform(selectedPlatform === p.value ? '' : p.value)}
              >
                <Text
                  style={[
                    styles.platformChipText,
                    {
                      color: selectedPlatform === p.value
                        ? '#ffffff'
                        : (isDark ? '#d1d5db' : '#374151'),
                    },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

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
  platformSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  platformLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  platformScroll: {
    marginBottom: 4,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  platformChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  platformChipText: {
    fontSize: 13,
    fontWeight: '500',
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
