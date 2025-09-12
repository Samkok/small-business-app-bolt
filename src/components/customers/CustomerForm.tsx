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
  Modal,
  TextInput
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { X, User, Phone, MapPin, MessageCircle, FileText, Plus, CreditCard as Edit, Trash2 } from 'lucide-react-native';
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
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [availablePlatforms, setAvailablePlatforms] = useState<Array<{value: string, label: string, canDelete: boolean}>>([
    { value: 'facebook', label: 'Facebook', canDelete: false },
    { value: 'instagram', label: 'Instagram', canDelete: false },
    { value: 'telegram', label: 'Telegram', canDelete: false },
    { value: 'walk_in', label: 'Walk-in', canDelete: false },
    { value: 'tiktok', label: 'TikTok', canDelete: true },
    { value: 'wechat', label: 'WeChat', canDelete: true },
    { value: 'line', label: 'Line', canDelete: true },
    { value: 'other', label: 'Other', canDelete: false },
  ]);
  
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  // List of built-in platforms that cannot be modified
  const builtInPlatforms = ['facebook', 'instagram', 'telegram', 'walk_in', 'other'];

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
      setPlatform(customer.platform || '');
      setNotes(customer.notes || '');
    }
    
    loadPlatformUsage();
  }, [customer]);

  const loadPlatformUsage = async () => {
    if (!currentBusiness?.id) return;
    
    try {
      const platformUsage = await customerService.getPlatformUsage(currentBusiness.id);
      
      // Update available platforms with usage information
      const updatedPlatforms = availablePlatforms.map(platform => ({
        ...platform,
        canDelete: builtInPlatforms.includes(platform.value) ? false : 
                  !platformUsage[platform.value] || platformUsage[platform.value] === 0
      }));
      
      setAvailablePlatforms(updatedPlatforms);
    } catch (error) {
      console.error('Error loading platform usage:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }

    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business currentBusiness found');
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
        business_id: currentBusiness.id,
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
      Alert.alert('Error', `Failed to ${customer ? 'update' : 'create'} customer. ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlatform = () => {
    setNewPlatformName('');
    setEditingPlatform(null);
    setShowPlatformModal(true);
  };

  const handleEditPlatform = (platformValue: string) => {
    const platform = availablePlatforms.find(p => p.value === platformValue);
    if (platform) {
      if (builtInPlatforms.includes(platformValue)) {
        Alert.alert('Cannot Edit', 'This is a built-in platform and cannot be modified.');
        return;
      }
      
      setNewPlatformName(platform.label);
      setEditingPlatform(platformValue);
      setShowPlatformModal(true);
    }
  };

  const handleDeletePlatform = (platformValue: string) => {
    const platform = availablePlatforms.find(p => p.value === platformValue);
    if (!platform) return;
    
    if (builtInPlatforms.includes(platformValue)) {
      Alert.alert('Cannot Delete', 'This is a built-in platform and cannot be deleted.');
      return;
    }
    
    if (!platform.canDelete) {
      Alert.alert(
        'Cannot Delete Platform',
        'This platform has customers associated with it. Please reassign those customers to another platform first.'
      );
      return;
    }
    
    Alert.alert(
      'Delete Platform',
      `Are you sure you want to delete the "${platform.label}" platform?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // Remove from available platforms
            const updatedPlatforms = availablePlatforms.filter(p => p.value !== platformValue);
            setAvailablePlatforms(updatedPlatforms);
            
            // If the current customer has this platform, reset it
            if (platform === platformValue) {
              setPlatform('');
            }
          }
        },
      ]
    );
  };

  const handleSavePlatform = () => {
    if (!newPlatformName.trim()) {
      Alert.alert('Error', 'Platform name is required');
      return;
    }
    
    // Convert to snake_case for value
    const platformValue = editingPlatform || newPlatformName.toLowerCase().replace(/\s+/g, '_');
    
    if (!editingPlatform && availablePlatforms.some(p => p.value === platformValue)) {
      Alert.alert('Error', 'A platform with this name already exists');
      return;
    }
    
    if (editingPlatform) {
      // Update existing platform
      const updatedPlatforms = availablePlatforms.map(p => 
        p.value === editingPlatform ? { ...p, label: newPlatformName } : p
      );
      setAvailablePlatforms(updatedPlatforms);
    } else {
      // Add new platform
      setAvailablePlatforms([
        ...availablePlatforms,
        { value: platformValue, label: newPlatformName, canDelete: true }
      ]);
    }
    
    setShowPlatformModal(false);
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
              <TouchableOpacity
                style={[styles.addPlatformButton, { backgroundColor: '#8b5cf6' }]}
                onPress={handleAddPlatform}
              >
                <Plus size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
              How did they find you?
            </Text>
            <View style={styles.platformGrid}>
              {availablePlatforms.map((platformOption) => (
                <View key={platformOption.value} style={styles.platformButtonContainer}>
                  <TouchableOpacity
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
                  
                  <View style={styles.platformActions}>
                    <TouchableOpacity
                      style={[
                        styles.platformActionButton,
                        builtInPlatforms.includes(platformOption.value) && { opacity: 0.5 }
                      ]}
                      onPress={() => handleEditPlatform(platformOption.value)}
                      disabled={builtInPlatforms.includes(platformOption.value)}
                    >
                      <Edit size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.platformActionButton,
                        (builtInPlatforms.includes(platformOption.value) || !platformOption.canDelete) && { opacity: 0.5 }
                      ]}
                      onPress={() => handleDeletePlatform(platformOption.value)}
                      disabled={builtInPlatforms.includes(platformOption.value) || !platformOption.canDelete}
                    >
                      <Trash2 size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
                    </TouchableOpacity>
                  </View>
                </View>
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

      {/* Platform Modal */}
      <Modal
        visible={showPlatformModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlatformModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {editingPlatform ? 'Edit Platform' : 'Add Platform'}
              </Text>
              <TouchableOpacity onPress={() => setShowPlatformModal(false)}>
                <X size={20} color={isDark ? '#f9fafb' : '#111827'} />
              </TouchableOpacity>
            </View>
            
            <Input
              label="Platform Name"
              value={newPlatformName}
              onChangeText={setNewPlatformName}
              placeholder="e.g., TikTok, WeChat, Line"
              required
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowPlatformModal(false)}
                style={styles.modalButton}
              />
              <Button
                title="Save"
                onPress={handleSavePlatform}
                style={styles.modalButton}
              />
            </View>
          </Card>
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
    flex: 1,
  },
  addPlatformButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  platformButtonContainer: {
    minWidth: 120,
  },
  platformButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  platformButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  platformActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
    gap: 8,
  },
  platformActionButton: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    minWidth: 100,
  },
});