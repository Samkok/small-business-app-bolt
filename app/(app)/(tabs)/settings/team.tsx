import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, Users, UserPlus, User, Mail, ChevronDown, X, Shield, ShieldAlert } from 'lucide-react-native';
import { supabase } from '@/src/config/supabase';

interface TeamMember {
  user_id: string;
  business_id: string;
  role: 'admin' | 'staff';
  user_email?: string;
  user_name?: string;
}

export default function TeamScreen() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<string | null>(null);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();

  useEffect(() => {
    if (currentBusiness) {
      loadTeamMembers();
    } else {
      setLoading(false);
    }
  }, [currentBusiness]);

  const loadTeamMembers = async () => {
    if (!currentBusiness) return;
    
    setLoading(true);
    try {
      // Get all user roles for this business
      const { data: roles, error: rolesError } = await supabase
        .from('user_business_roles')
        .select(`
          user_id,
          business_id,
          role,
          businesses (
            business_name
          )
        `)
        .eq('business_id', currentBusiness.id);
        
      if (rolesError) throw rolesError;
      
      // Get user emails (requires additional query)
      const userIds = roles.map(role => role.user_id);
      const { data: users, error: usersError } = await supabase
        .from('auth.users')
        .select('id, email')
        .in('id', userIds);

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('full_name')
        .in('user_id', userIds);
      
      if (usersError) {
        console.warn('Could not fetch user emails:', usersError);
      }
      
      // Combine the data
      const members: TeamMember[] = roles.map(role => ({
        user_id: role.user_id,
        business_id: role.business_id,
        role: role.role as 'admin' | 'staff',
        user_name: role.user_profiles?.full_name,
        user_email: users?.find(u => u.id === role.user_id)?.email
      }));
      
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
      Alert.alert('Error', 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    
    if (!currentBusiness) {
      Alert.alert('Error', 'No business selected');
      return;
    }
    
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc('invite_user_to_business', {
        business_id_param: currentBusiness.id,
        user_email_param: inviteEmail.trim(),
        role_param: inviteRole
      });
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to invite user');
      } else {
        Alert.alert('Success', 'User invited successfully');
        setInviteEmail('');
        setInviteRole('staff');
        setShowInviteModal(false);
        loadTeamMembers();
      }
    } catch (error) {
      console.error('Error inviting user:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'admin' | 'staff') => {
    if (!currentBusiness) return;
    
    setChangingRole(userId);
    try {
      const { data, error } = await supabase.rpc('change_user_business_role', {
        business_id_param: currentBusiness.id,
        user_id_param: userId,
        new_role_param: newRole
      });
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to change user role');
      } else {
        // Update local state
        setTeamMembers(prev => 
          prev.map(member => 
            member.user_id === userId ? { ...member, role: newRole } : member
          )
        );
      }
    } catch (error) {
      console.error('Error changing user role:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentBusiness) return;
    
    // Prevent removing yourself
    if (userId === user?.id) {
      Alert.alert('Error', 'You cannot remove yourself from the business');
      return;
    }
    
    Alert.alert(
      'Remove User',
      'Are you sure you want to remove this user from the business?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            setRemovingUser(userId);
            try {
              const { data, error } = await supabase.rpc('remove_user_from_business', {
                business_id_param: currentBusiness.id,
                user_id_param: userId
              });
              
              if (error) {
                Alert.alert('Error', error.message || 'Failed to remove user');
              } else {
                // Update local state
                setTeamMembers(prev => prev.filter(member => member.user_id !== userId));
              }
            } catch (error) {
              console.error('Error removing user:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setRemovingUser(null);
            }
          }
        }
      ]
    );
  };

  const renderTeamMember = ({ item }: { item: TeamMember }) => {
    const isCurrentUser = item.user_id === user?.id;
    const isOwner = currentBusiness?.owner_user_id === item.user_id;
    
    return (
      <Card style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
            <Text style={styles.avatarText}>
              {item.user_name?.charAt(0).toUpperCase() || item.user_email?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={[styles.memberName, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {item.user_name || 'Unnamed User'}
              {isCurrentUser && <Text style={styles.currentUserTag}> (You)</Text>}
              {isOwner && <Text style={styles.ownerTag}> (Owner)</Text>}
            </Text>
            <Text style={[styles.memberEmail, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {item.user_email || 'No email'}
            </Text>
            <View style={styles.roleContainer}>
              {item.role === 'admin' ? (
                <View style={styles.adminBadge}>
                  <ShieldAlert size={12} color="#ffffff" />
                  <Text style={styles.adminText}>Admin</Text>
                </View>
              ) : (
                <View style={styles.staffBadge}>
                  <Shield size={12} color="#ffffff" />
                  <Text style={styles.staffText}>Staff</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        {!isOwner && (
          <View style={styles.memberActions}>
            {changingRole === item.user_id ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                onPress={() => {
                  // Toggle role between admin and staff
                  const newRole = item.role === 'admin' ? 'staff' : 'admin';
                  handleChangeRole(item.user_id, newRole);
                }}
                disabled={isOwner || isCurrentUser}
              >
                <Shield size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
            
            {removingUser === item.user_id ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                onPress={() => handleRemoveUser(item.user_id)}
                disabled={isOwner || isCurrentUser}
              >
                <X size={16} color="#dc2626" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    );
  };

  if (!currentBusiness) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Team Members
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            No business selected. Please select a business first.
          </Text>
          <Button
            title="Go to Business Selection"
            onPress={() => router.push('/business-selection')}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Team Members
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <LoadingSpinner text="Loading team members..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Team Members
        </Text>
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => setShowInviteModal(true)}
        >
          <UserPlus size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.businessHeader}>
        <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {currentBusiness.business_name}
        </Text>
        <Text style={[styles.teamCount, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
        </Text>
      </View>

      <FlatList
        data={teamMembers}
        renderItem={renderTeamMember}
        keyExtractor={(item) => item.user_id}
        style={styles.membersList}
        contentContainerStyle={styles.membersListContent}
        ListEmptyComponent={() => (
          <Card style={styles.emptyState}>
            <Users size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              No Team Members
            </Text>
            <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Invite team members to collaborate on your business
            </Text>
            <Button
              title="Invite Team Member"
              onPress={() => setShowInviteModal(true)}
              style={styles.emptyButton}
            />
          </Card>
        )}
      />

      {/* Invite User Modal */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Invite Team Member
              </Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <X size={20} color={isDark ? '#f9fafb' : '#111827'} />
              </TouchableOpacity>
            </View>
            
            <Input
              label="Email Address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />
            
            <Text style={[styles.roleLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
              Role
            </Text>
            <TouchableOpacity
              style={[
                styles.roleSelector,
                { 
                  backgroundColor: isDark ? '#374151' : '#f9fafb',
                  borderColor: isDark ? '#4b5563' : '#d1d5db'
                }
              ]}
              onPress={() => setShowRoleSelector(!showRoleSelector)}
            >
              <View style={styles.selectedRole}>
                {inviteRole === 'admin' ? (
                  <ShieldAlert size={16} color="#2563eb" />
                ) : (
                  <Shield size={16} color="#059669" />
                )}
                <Text style={[styles.selectedRoleText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {inviteRole === 'admin' ? 'Admin' : 'Staff'}
                </Text>
              </View>
              <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
            
            {showRoleSelector && (
              <View style={[
                styles.roleOptions,
                { 
                  backgroundColor: isDark ? '#374151' : '#ffffff',
                  borderColor: isDark ? '#4b5563' : '#d1d5db'
                }
              ]}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    inviteRole === 'admin' && styles.selectedRoleOption
                  ]}
                  onPress={() => {
                    setInviteRole('admin');
                    setShowRoleSelector(false);
                  }}
                >
                  <ShieldAlert size={16} color="#2563eb" />
                  <Text style={[
                    styles.roleOptionText,
                    { color: isDark ? '#f9fafb' : '#111827' }
                  ]}>
                    Admin
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    inviteRole === 'staff' && styles.selectedRoleOption
                  ]}
                  onPress={() => {
                    setInviteRole('staff');
                    setShowRoleSelector(false);
                  }}
                >
                  <Shield size={16} color="#059669" />
                  <Text style={[
                    styles.roleOptionText,
                    { color: isDark ? '#f9fafb' : '#111827' }
                  ]}>
                    Staff
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            <Text style={[styles.roleDescription, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {inviteRole === 'admin' 
                ? 'Admins can manage team members, business settings, and all data.'
                : 'Staff can manage products, customers, sales, and expenses, but cannot manage team members or business settings.'}
            </Text>
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteRole('staff');
                  setShowRoleSelector(false);
                }}
                style={styles.modalButton}
              />
              <Button
                title="Invite"
                onPress={handleInviteUser}
                loading={inviting}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  inviteButton: {
    backgroundColor: '#2563eb',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 44,
  },
  businessHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  teamCount: {
    fontSize: 14,
  },
  membersList: {
    flex: 1,
  },
  membersListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  currentUserTag: {
    fontWeight: '400',
    fontStyle: 'italic',
  },
  ownerTag: {
    fontWeight: '400',
    color: '#f59e0b',
  },
  memberEmail: {
    fontSize: 14,
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  adminText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  staffText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyButton: {
    marginTop: 16,
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
  roleLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectedRole: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedRoleText: {
    fontSize: 16,
    marginLeft: 8,
  },
  roleOptions: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  selectedRoleOption: {
    backgroundColor: '#2563eb20',
  },
  roleOptionText: {
    fontSize: 16,
    marginLeft: 8,
  },
  roleDescription: {
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 200,
  },
});