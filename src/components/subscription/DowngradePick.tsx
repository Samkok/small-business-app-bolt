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
import { AlertCircle, Check, Building2, Users, Calendar, TrendingUp, X } from 'lucide-react-native';
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
  onDismiss?: () => void;
}

export function DowngradePick({
  visible,
  ownedBusinesses,
  tierLimit,
  onComplete,
  onDismiss,
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
  const [dismissing, setDismissing] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>(ownedBusinesses);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (visible) {
      console.log('[DowngradePick] Modal visible, loading business details');
      console.log('[DowngradePick] ownedBusinesses prop:', ownedBusinesses.length);
      loadBusinessDetails();
    }
  }, [visible, retryCount]);

  useEffect(() => {
    console.log('[DowngradePick] ownedBusinesses prop changed:', ownedBusinesses.length);
    if (ownedBusinesses.length > 0) {
      setBusinesses(ownedBusinesses);
    }
  }, [ownedBusinesses]);

  const loadBusinessDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[DowngradePick] Loading business details...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No user found');
      }

      console.log('[DowngradePick] User found:', user.id);

      if (ownedBusinesses.length === 0) {
        console.warn('[DowngradePick] ownedBusinesses is empty, cannot load details');
        setError('No businesses found. Please try refreshing.');
        setLoading(false);
        return;
      }

      const businessIds = ownedBusinesses.map(b => b.id);
      console.log('[DowngradePick] Loading details for', businessIds.length, 'businesses');

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

      if (salesResult.error) {
        console.error('[DowngradePick] Error loading sales counts:', salesResult.error);
      }
      if (teamResult.error) {
        console.error('[DowngradePick] Error loading team members:', teamResult.error);
      }

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

      console.log('[DowngradePick] Successfully loaded', enrichedBusinesses.length, 'enriched businesses');
      setBusinesses(enrichedBusinesses);
      setError(null);
    } catch (error) {
      console.error('[DowngradePick] Error loading business details:', error);
      setError(error instanceof Error ? error.message : 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    console.log('[DowngradePick] Retrying business load, attempt:', retryCount + 1);
    setRetryCount(prev => prev + 1);
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
    if (isConfirmDisabled) {
      console.log('[DowngradePick] Confirm disabled, cannot proceed');
      return;
    }

    console.log('[DowngradePick] Confirming selection:', selectedBusinessIds);
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No user found');
      }

      console.log('[DowngradePick] Calling choose-businesses function...');
      const { data, error } = await supabase.functions.invoke('choose-businesses', {
        body: {
          userId: user.id,
          selectedBusinessIds,
        },
      });

      if (error) {
        console.error('[DowngradePick] Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('[DowngradePick] Business selection error:', data.error);
        throw new Error(data.error);
      }

      console.log('[DowngradePick] Business selection successful:', data);

      Alert.alert(
        'Success',
        `${tierLimit} ${tierLimit === 1 ? 'business' : 'businesses'} activated successfully`,
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (error: any) {
      console.error('[DowngradePick] Error confirming business selection:', error);
      const errorMessage = error.message || error.error || 'Failed to update business selection. Please try again.';
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss || dismissing) return;

    console.log('[DowngradePick] User dismissing modal, will auto-select oldest businesses');
    setDismissing(true);

    try {
      await onDismiss();
    } catch (error) {
      console.error('[DowngradePick] Error during dismiss:', error);
    } finally {
      setDismissing(false);
    }
  };

  var isConfirmDisabled = selectedBusinessIds.length < tierLimit || submitting || dismissing;
  if (tierLimit === 999999) {
    isConfirmDisabled = selectedBusinessIds.length == 0 || submitting || dismissing;
  } else if (tierLimit === 3) {
    isConfirmDisabled = selectedBusinessIds.length > 3 || selectedBusinessIds <= 0 || submitting || dismissing;
  } else if (tierLimit === 1) {
    isConfirmDisabled = selectedBusinessIds.length > 1 || selectedBusinessIds <= 0 || submitting || dismissing;
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
          {onDismiss && (
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.card }]}
              onPress={handleDismiss}
              disabled={dismissing || submitting}
              activeOpacity={0.7}
            >
              {dismissing ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <X size={24} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          )}
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
          {onDismiss && (
            <Text style={[styles.dismissHint, { color: colors.textSecondary }]}>
              Tap X to skip - oldest {tierLimit === 1 ? 'business' : 'businesses'} will be selected automatically.
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading your businesses...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color={colors.warning} />
            <Text style={[styles.errorTitle, { color: colors.text }]}>
              Failed to Load Businesses
            </Text>
            <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : businesses.length === 0 ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color={colors.warning} />
            <Text style={[styles.errorTitle, { color: colors.text }]}>
              No Businesses Found
            </Text>
            <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
              We couldn't find any businesses for your account. Please try refreshing.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Refresh</Text>
            </TouchableOpacity>
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
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dismissHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
