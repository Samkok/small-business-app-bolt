import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { X, User, Phone, MapPin, MessageCircle, FileText } from 'lucide-react-native';
import { customerService } from '@/src/services/customers';

interface CustomerFormProps {
  customer?: any;
  onSave: () => void;
  onCancel: () => void;
}

export default function CustomerForm({ customer, onSave, onCancel }: CustomerFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [platform, setPlatform] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { isDark } = useTheme();
  const { profile } = useAuth();

  const platforms = [
    { value: '', label: 'Select Platform' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
      setPlatform(customer.platform || '');
      setNotes(customer.notes || '');
    }
  }, [customer]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
      return;
    }

    setLoading(true);
    try {
      const customerData = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        platform: platform || null,
        notes: notes.trim() || null,
        business_id: profile.id,
      };

      if (customer) {
        await customerService.updateCustomer(customer.id, customerData);
      } else {
        await customerService.createCustomer(customerData);
      }

      Alert.alert('Success', `Customer ${customer ? 'updated' : 'created'} successfully`);
      onSave();
    } catch (error) {
      console.error('Error saving customer:', error);
      Alert.alert('Error', `Failed to ${customer ? 'update' : 'create'} customer`);
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
          {customer ? 'Edit Customer' : 'Add Customer'}
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={20} color="#2563eb" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Basic Information
              </Text>
            </View>
            
            <Input
              label="Customer Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter customer name"
              required
            />
            
            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color="#059669" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Location
              </Text>
            </View>
            
            <Input
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="Enter customer address"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MessageCircle size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Platform
              </Text>
            </View>
            
            <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
              How did they find you?
            </Text>
            <View style={styles.platformGrid}>
              {platforms.slice(1).map((platformOption) => (
                <TouchableOpacity
                  key={platformOption.value}
                  style={[
                    styles.platformButton,
                    {
                      backgroundColor: platform === platformOption.value 
                        ? '#2563eb' 
                        : (isDark ? '#374151' : '#f3f4f6'),
                      borderColor: platform === platformOption.value 
                        ? '#2563eb' 
                        : (isDark ? '#4b5563' : '#d1d5db'),
                    }
                  ]}
                  onPress={() => setPlatform(platformOption.value)}
                >
                  <Text style={[
                    styles.platformButtonText,
                    { 
                      color: platform === platformOption.value 
                        ? '#ffffff' 
                        : (isDark ? '#f9fafb' : '#374151') 
                    }
                  ]}>
                    {platformOption.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
              placeholder="Any additional information about the customer"
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
          title={customer ? 'Update Customer' : 'Add Customer'}
          onPress={handleSave}
          loading={loading}
          style={styles.footerButton}
        />
      </View>
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
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  platformButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  platformButtonText: {
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
});