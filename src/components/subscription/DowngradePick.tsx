import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AlertCircle, Check, Building2, Users, Calendar, TrendingUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { supabase } from '@/src/config/supabase';
import { format } from 'date-fns';

interface Business {
  id: string;
  name: string;
  created_at: string;
  access_state: 'active' | 'read_only_sales';
  sales_count?: number;
  team_member_count?: number;
  last_activity?: string;
}

interface DowngradePickProps {
  visible: boolean;
  ownedBusinesses: Business[];
  tierLimit: number;
  onComplete: () => void;
}

export function DowngradePick({
  visible,
  ownedBusinesses,
  tierLimit,
  onComplete,
}: DowngradePickProps) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const colors = {
    background: isDark ? '#121212' : '#FFFFFF',
    text: isDark ? '#E0E0E0' : '#1F2937',
    textSecondary: isDark ? '#9CA3AF' : '#6B7280',
    card: isDark ? '#1E1E1E' : '#F9FAFB',
    border: isDark ? '#374151' : '#E5E7EB',
    primary: isDark ? '#3B82F6' : '#2563EB',
    warning: isDark ? '#F59E0B' : '#D97706',
  };

  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>(ownedBusinesses);

  useEffect(() => {
    if (visible) {
      loadBusinessDetails();
    }
  }, [visible]);

  const loadBusinessDetails = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const businessIds = ownedBusinesses.map(b => b.id);

      const [salesResult, teamResult] = await Promise.all([
        supabase
          .from('user_sales_counts')
          .select('business_id, sales_count')
          .eq('user_id', user.id)
          .in('business_id', businessIds),
        supabase
          .from('user_business_roles')
          .select('business_id')
          .in('business_id', businessIds)
      ]);

      const salesCount = (salesResult.data || []).reduce((acc, item) => {
        acc[item.business_id] = item.sales_count;
        return acc;
      }, {} as Record<string, number>);

      const teamCount = (teamResult.data || []).reduce((acc, member) => {
        acc[member.business_id] = (acc[member.business_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const enrichedBusinesses = ownedBusinesses.map(business => ({
        ...business,
        sales_count: salesCount[business.id] || 0,
        team_member_count: teamCount[business.id] || 0,
      }));

      enrichedBusinesses.sort((a, b) => {
        if (a.sales_count !== b.sales_count) {
          return (b.sales_count || 0) - (a.sales_count || 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setBusinesses(enrichedBusinesses);
    } catch (error) {
      console.error('Error loading business details:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBusinessSelection = (businessId: string) => {
    if (selectedBusinessIds.includes(businessId)) {
      setSelectedBusinessIds(selectedBusinessIds.filter(id => id !== businessId));
    } else {
      if (selectedBusinessIds.length < tierLimit) {
        setSelectedBusinessIds([...selectedBusinessIds, businessId]);
      } else {
        setSelectedBusinessIds([businessId]);
      }
    }
  };

  const handleConfirm = async () => {
    if (selectedBusinessIds.length !== tierLimit) {
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase.functions.invoke('choose-businesses', {
        body: {
          userId: user.id,
          selectedBusinessIds,
        },
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        `${tierLimit} ${tierLimit === 1 ? 'business' : 'businesses'} activated successfully`,
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (error: any) {
      console.error('Error confirming business selection:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update business selection. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  var isConfirmDisabled = selectedBusinessIds.length < tierLimit || submitting;
  if (tierLimit === 999999) {
    isConfirmDisabled = selectedBusinessIds.length == 0 ;
  }
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: Math.max(60, insets.top + 24) }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <AlertCircle size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Select Active {tierLimit === 1 ? 'Business' : 'Businesses'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your subscription tier includes {tierLimit} {tierLimit === 1 ? 'business' : 'businesses'}.
            {'\n'}Select which {tierLimit === 1 ? 'one' : 'ones'} to keep active.
          </Text>
          <View style={[styles.warningBox, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}>
            <AlertCircle size={20} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              Other businesses will be read-only. You can view data and manage products/team, but cannot create sales.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading your businesses...
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.businessList} contentContainerStyle={styles.businessListContent}>
              {businesses.map((business) => {
                const isSelected = selectedBusinessIds.includes(business.id);
                return (
                  <TouchableOpacity
                    key={business.id}
                    style={[
                      styles.businessCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => toggleBusinessSelection(business.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.businessCardHeader}>
                      <View style={styles.businessCardTitle}>
                        <Building2 size={24} color={colors.primary} />
                        <Text style={[styles.businessName, { color: colors.text }]} numberOfLines={2}>
                          {business.name || business.business_name || 'Unnamed Business'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.selectionIndicator,
                          {
                            backgroundColor: isSelected ? colors.primary : 'transparent',
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </View>

                    <View style={styles.businessStats}>
                      <View style={styles.statItem}>
                        <TrendingUp size={16} color={colors.textSecondary} />
                        <Text style={[styles.statText, { color: colors.textSecondary }]}>
                          {business.sales_count || 0} sales
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Users size={16} color={colors.textSecondary} />
                        <Text style={[styles.statText, { color: colors.textSecondary }]}>
                          {business.team_member_count || 0} members
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Calendar size={16} color={colors.textSecondary} />
                        <Text style={[styles.statText, { color: colors.textSecondary }]}>
                          Created {format(new Date(business.created_at), 'MMM yyyy')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[
              styles.footer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: Math.max(16, insets.bottom + 16)
              }
            ]}>
              <Text style={[styles.selectionCount, { color: colors.textSecondary }]}>
                {selectedBusinessIds.length} of {tierLimit} selected
              </Text>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: isConfirmDisabled ? colors.border : colors.primary,
                  },
                ]}
                onPress={handleConfirm}
                disabled={isConfirmDisabled}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Confirm Selection
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  businessList: {
    flex: 1,
  },
  businessListContent: {
    padding: 16,
    gap: 12,
  },
  businessCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  businessCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  selectionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessStats: {
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  selectionCount: {
    fontSize: 14,
    textAlign: 'center',
  },
  confirmButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
