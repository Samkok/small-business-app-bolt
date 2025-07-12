import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { Briefcase, Plus, ChevronRight, LogOut, Building } from 'lucide-react-native';

export default function BusinessSelectionScreen() {
  const [showCreateBusinessModal, setShowCreateBusinessModal] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { userProfile, userBusinesses, currentBusiness, switchBusiness, createBusiness, signOut } = useAuth();

  const handleSelectBusiness = async (businessId: string) => {
    await switchBusiness(businessId);
    router.replace('/(app)/(tabs)');
  };

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim()) {
      Alert.alert('Error', 'Please enter a business name');
      return;
    }

    setCreatingBusiness(true);
    try {
      const { error, business } = await createBusiness(newBusinessName.trim());
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to create business');
      } else {
        setShowCreateBusinessModal(false);
        setNewBusinessName('');
        
        // If this is the first business, navigate to the main app
        if (userBusinesses.length === 0) {
          router.replace('/(app)/(tabs)');
        }
      }
    } catch (error) {
      console.error('Error creating business:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setCreatingBusiness(false);
    }
  };

  const renderBusinessItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.businessCard,
        currentBusiness?.id === item.id && styles.selectedBusinessCard,
        { backgroundColor: isDark ? '#374151' : '#ffffff' }
      ]}
      onPress={() => handleSelectBusiness(item.id)}
    >
      <View style={styles.businessInfo}>
        <View style={[styles.businessIcon, { backgroundColor: '#2563eb20' }]}>
          <Briefcase size={24} color="#2563eb" />
        </View>
        <View style={styles.businessDetails}>
          <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {item.business_name}
          </Text>
          <Text style={[styles.businessRole, { color: '#2563eb' }]}>
            Admin
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Select Business
        </Text>
      </View>

      <View style={styles.welcomeSection}>
        <Text style={[styles.welcomeText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Welcome back,
        </Text>
        <Text style={[styles.userName, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {userProfile?.full_name || 'User'}
        </Text>
        <Text style={[styles.selectPrompt, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Please select a business to continue
        </Text>
      </View>

      <FlatList
        data={userBusinesses}
        renderItem={renderBusinessItem}
        keyExtractor={(item) => item.id}
        style={styles.businessList}
        contentContainerStyle={styles.businessListContent}
        ListEmptyComponent={() => (
          <Card style={styles.emptyState}>
            <Building size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              No Businesses Yet
            </Text>
            <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Create your first business to get started
            </Text>
          </Card>
        )}
      />

      <View style={styles.footer}>
        <Button
          title="Create New Business"
          onPress={() => setShowCreateBusinessModal(true)}
          style={styles.createButton}
        />
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
              ]
            );
          }}
        >
          <LogOut size={16} color={isDark ? '#d1d5db' : '#6b7280'} />
          <Text style={[styles.signOutText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Create Business Modal */}
      <Modal
        visible={showCreateBusinessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateBusinessModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Card style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Create New Business
            </Text>
            
            <Input
              label="Business Name"
              value={newBusinessName}
              onChangeText={setNewBusinessName}
              placeholder="Enter business name"
              required
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowCreateBusinessModal(false);
                  setNewBusinessName('');
                }}
                style={styles.modalButton}
              />
              <Button
                title="Create"
                onPress={handleCreateBusiness}
                loading={creatingBusiness}
                style={styles.modalButton}
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  welcomeText: {
    fontSize: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectPrompt: {
    fontSize: 14,
  },
  businessList: {
    flex: 1,
  },
  businessListContent: {
    paddingHorizontal: 16,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedBusinessCard: {
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  businessRole: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  createButton: {
    marginBottom: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 14,
    marginLeft: 8,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});