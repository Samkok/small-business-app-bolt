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
import { AlertCircle, CheckCircle, Building2, Users, Calendar, TrendingUp } from 'lucide-react-native';
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
  const { theme } = useTheme();
  const { t } = useLanguage();

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
      const businessIds = ownedBusinesses.map(b => b.id);

      const [salesResult, teamResult] = await Promise.all([
        supabase
          .from('sales')
          .select('business_id')
          .in('business_id', businessIds)
          .neq('status', 'voided'),
        supabase
          .from('user_business_roles')
          .select('business_id')
          .in('business_id', businessIds)
      ]);

      const salesCount = (salesResult.data || []).reduce((acc, sale) => {
        acc[sale.business_id] = (acc[sale.business_id] || 0) + 1;
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

  const isConfirmDisabled = selectedBusinessIds.length !== tierLimit || submitting;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
            <AlertCircle size={32} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            Select Active {tierLimit === 1 ? 'Business' : 'Businesses'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your subscription tier includes {tierLimit} {tierLimit === 1 ? 'business' : 'businesses'}.
            {'\n'}Select which {tierLimit === 1 ? 'one' : 'ones'} to keep active.
          </Text>
          <View style={[styles.warningBox, { backgroundColor: theme.warning + '15', borderColor: theme.warning + '40' }]}>
            <AlertCircle size={20} color={theme.warning} />
            <Text style={[styles.warningText, { color: theme.warning }]}>
              Other businesses will be read-only. You can view data and manage products/team, but cannot create sales.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
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
                        backgroundColor: theme.card,
                        borderColor: isSelected ? theme.primary : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => toggleBusinessSelection(business.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.businessCardHeader}>
                      <View style={styles.businessCardTitle}>
                        <Building2 size={24} color={theme.primary} />
                        <Text style={[styles.businessName, { color: theme.text }]}>
                          {business.name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.selectionIndicator,
                          {
                            backgroundColor: isSelected ? theme.primary : 'transparent',
                            borderColor: isSelected ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        {isSelected && <CheckCircle size={20} color="#FFFFFF" />}
                      </View>
                    </View>

                    <View style={styles.businessStats}>
                      <View style={styles.statItem}>
                        <TrendingUp size={16} color={theme.textSecondary} />
                        <Text style={[styles.statText, { color: theme.textSecondary }]}>
                          {business.sales_count || 0} sales
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Users size={16} color={theme.textSecondary} />
                        <Text style={[styles.statText, { color: theme.textSecondary }]}>
                          {business.team_member_count || 0} members
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Calendar size={16} color={theme.textSecondary} />
                        <Text style={[styles.statText, { color: theme.textSecondary }]}>
                          Created {format(new Date(business.created_at), 'MMM yyyy')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
              <Text style={[styles.selectionCount, { color: theme.textSecondary }]}>
                {selectedBusinessIds.length} of {tierLimit} selected
              </Text>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: isConfirmDisabled ? theme.border : theme.primary,
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
    paddingTop: 60,
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
    padding: 16,
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
