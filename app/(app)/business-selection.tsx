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
  Platform,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import { Briefcase, Plus, ChevronRight, LogOut, Building, RefreshCw, Sliders } from 'lucide-react-native';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { ManageBusinessSubscription } from '@/src/components/subscription/ManageBusinessSubscription';
import { supabase } from '@/src/config/supabase';

export default function BusinessSelectionScreen() {
  const [showCreateBusinessModal, setShowCreateBusinessModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [businessesWithAccess, setBusinessesWithAccess] = useState<any[]>([]);

  const router = useRouter();
  const { t } = useTranslation();
  const subscription = useSubscription();
  const { isDark } = useTheme();
  const { user, userProfile, userBusinesses, currentBusiness, switchBusiness, createBusiness, signOut, refreshUserBusinesses, getUserRole } = useAuth();

  // Fetch accurate business data with access_state from database
  useEffect(() => {
    const fetchBusinessData = async () => {
      if (!user?.id || !userBusinesses.length) {
        setBusinessesWithAccess([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('id, business_name, business_image_url, owner_user_id, access_state, created_at')
          .in('id', userBusinesses.map(b => b.id))
          .order('created_at', { ascending: true });

        if (error) throw error;

        setBusinessesWithAccess(data || []);
      } catch (error) {
        setBusinessesWithAccess(userBusinesses);
      }
    };

    fetchBusinessData();
  }, [user?.id, userBusinesses]);

  const handleSelectBusiness = async (businessId: string) => {
    await switchBusiness(businessId);
    await subscription.refreshTierInfo();
    await subscription.refreshSalesCount();
    router.replace('/(app)/(tabs)');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshUserBusinesses(),
        subscription.refreshTierInfo(),
        subscription.refreshSubscriptionStatus()
      ]);

      // Fetch fresh business data with accurate access_state
      if (user?.id && userBusinesses.length) {
        const { data, error } = await supabase
          .from('businesses')
          .select('id, business_name, business_image_url, owner_user_id, access_state, created_at')
          .in('id', userBusinesses.map(b => b.id))
          .order('created_at', { ascending: true });

        if (!error && data) {
          setBusinessesWithAccess(data);
        }
      }
    } catch (error) {
      console.error('Error refreshing businesses:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleManageComplete = async () => {
    await Promise.all([
      refreshUserBusinesses(),
      subscription.refreshTierInfo()
    ]);
  };

  const handleOpenCreateModal = () => {
    // Check if user has reached their business limit
    if (subscription.tierInfo.maxOwnedBusinesses !== null && subscription.ownedBusinessCount >= subscription.tierInfo.maxOwnedBusinesses) {
      Alert.alert(
        'Business Limit Reached',
        `You've reached your business limit of ${subscription.tierInfo.maxOwnedBusinesses} ${subscription.tierInfo.maxOwnedBusinesses === 1 ? 'business' : 'businesses'}. Upgrade your plan to create more businesses.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => subscription.showPaywall() }
        ]
      );
      return;
    }

    setShowCreateBusinessModal(true);
  };

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim()) {
      Alert.alert('Error', 'Please enter a business name');
      return;
    }

    // Double-check limit before creating (server-side will also check)
    if (subscription.tierInfo.maxOwnedBusinesses !== null && subscription.ownedBusinessCount >= subscription.tierInfo.maxOwnedBusinesses) {
      Alert.alert(
        'Business Limit Reached',
        `You've reached your business limit of ${subscription.tierInfo.maxOwnedBusinesses} ${subscription.tierInfo.maxOwnedBusinesses === 1 ? 'business' : 'businesses'}. Upgrade your plan to create more businesses.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => subscription.showPaywall() }
        ]
      );
      return;
    }

    setCreatingBusiness(true);
    try {
      const { error, business } = await createBusiness(newBusinessName.trim());

      if (error) {
        // Check if it's a business limit error
        if (error.message?.includes('BUSINESS_LIMIT_REACHED') || error.message?.includes('maximum number of businesses')) {
          Alert.alert(
            'Business Limit Reached',
            'You\'ve reached your business limit. Please upgrade your plan to create more businesses.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => subscription.showPaywall() }
            ]
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to create business');
        }
      } else {
        setShowCreateBusinessModal(false);
        setNewBusinessName('');

        await subscription.refreshTierInfo();

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

  const renderBusinessItem = ({ item }: { item: any }) => {
    const isOwner = item.owner_user_id === user?.id;
    const accessState = item.access_state || 'active';

    return (
      <TouchableOpacity
        style={[
          styles.businessCard,
          currentBusiness?.id === item.id && styles.selectedBusinessCard,
          { backgroundColor: isDark ? '#374151' : '#ffffff' }
        ]}
        onPress={() => handleSelectBusiness(item.id)}
      >
        <View style={styles.businessInfo}>
          <View style={styles.businessIconContainer}>
            {item.business_image_url ? (
              <OptimizedImage
                source={{ uri: item.business_image_url }}
                style={styles.businessImage}
                resizeMode="cover"
                alt={item.business_name}
              />
            ) : (
              <View style={[styles.businessIcon, { backgroundColor: '#2563eb20' }]}>
                <Briefcase size={24} color="#2563eb" />
              </View>
            )}
          </View>
          <View style={styles.businessDetails}>
            <View style={styles.businessNameRow}>
              <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {item.business_name}
              </Text>
              {isOwner && (
                <View style={[styles.ownerBadge, { backgroundColor: isDark ? '#1e3a8a' : '#dbeafe' }]}>
                  <Text style={[styles.ownerBadgeText, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
                    Owner
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.businessRole, { color: '#2563eb' }]}>
              {getUserRole(item.id) === 'admin' ? 'Admin' : 'Staff'}
            </Text>
            <View style={[
              styles.statusBadge,
              {
                backgroundColor: accessState === 'active'
                  ? (isDark ? '#065f46' : '#d1fae5')
                  : (isDark ? '#78350f' : '#fef3c7')
              }
            ]}>
              <Text style={[
                styles.statusBadgeText,
                {
                  color: accessState === 'active'
                    ? (isDark ? '#6ee7b7' : '#047857')
                    : (isDark ? '#fbbf24' : '#92400e')
                }
              ]}>
                {accessState === 'active' ? 'Active' : 'Read Only'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.businessArrow}>
          <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Select Business
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={20}
            color={isDark ? '#f9fafb' : '#111827'}
            style={refreshing ? styles.refreshingIcon : undefined}
          />
        </TouchableOpacity>
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
        {subscription.tierInfo.maxOwnedBusinesses !== null && (
          <View style={[
            styles.limitBadge,
            {
              backgroundColor: subscription.ownedBusinessCount >= subscription.tierInfo.maxOwnedBusinesses
                ? (isDark ? '#7f1d1d' : '#fee2e2')
                : subscription.ownedBusinessCount >= subscription.tierInfo.maxOwnedBusinesses * 0.8
                ? (isDark ? '#78350f' : '#fef3c7')
                : (isDark ? '#065f46' : '#d1fae5')
            }
          ]}>
            <Text style={[
              styles.limitBadgeText,
              {
                color: subscription.ownedBusinessCount >= subscription.tierInfo.maxOwnedBusinesses
                  ? (isDark ? '#fca5a5' : '#991b1b')
                  : subscription.ownedBusinessCount >= subscription.tierInfo.maxOwnedBusinesses * 0.8
                  ? (isDark ? '#fbbf24' : '#92400e')
                  : (isDark ? '#6ee7b7' : '#047857')
              }
            ]}>
              {subscription.ownedBusinessCount} / {subscription.tierInfo.maxOwnedBusinesses === 999999 ? '∞' : subscription.tierInfo.maxOwnedBusinesses} businesses owned
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={businessesWithAccess}
        renderItem={renderBusinessItem}
        keyExtractor={(item) => item.id}
        style={styles.businessList}
        contentContainerStyle={styles.businessListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={isDark ? '#f9fafb' : '#111827'}
            colors={['#2563eb']}
          />
        }
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
          onPress={handleOpenCreateModal}
          style={styles.createButton}
        />
        {businessesWithAccess.filter(b => b.owner_user_id === user?.id).length > 1 && (
          <TouchableOpacity
            style={[
              styles.manageButton,
              {
                backgroundColor: isDark ? '#374151' : '#f3f4f6',
                borderColor: isDark ? '#4b5563' : '#d1d5db',
              }
            ]}
            onPress={() => setShowManageModal(true)}
          >
            <Sliders size={16} color={isDark ? '#d1d5db' : '#6b7280'} />
            <Text style={[styles.manageButtonText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Manage Business Subscription
            </Text>
          </TouchableOpacity>
        )}
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

      {/* Manage Business Subscription Modal */}
      <ManageBusinessSubscription
        visible={showManageModal}
        onClose={() => setShowManageModal(false)}
        onComplete={handleManageComplete}
      />
    </View>
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
  headerLeft: {
    width: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshingIcon: {
    transform: [{ rotate: '180deg' }],
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
    marginBottom: 8,
  },
  limitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  limitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
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
    flex: 1,
  },
  businessArrow: {
    padding: 8,
    marginLeft: 8,
  },
  businessIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  businessImage: {
    width: '100%',
    height: '100%',
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
  businessNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
  },
  ownerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  businessRole: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
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
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '500',
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