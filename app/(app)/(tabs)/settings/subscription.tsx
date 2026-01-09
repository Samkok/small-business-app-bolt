import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Crown, Calendar, CreditCard, RefreshCw, TrendingUp, Zap, Info } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { FREE_TIER_LIMIT } from '@/src/services/subscriptionService';
import { CustomerCenterButton } from '@/src/components/subscription/CustomerCenter';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, currentBusiness } = useAuth();
  const {
    isSubscribed,
    subscriptionStatus,
    salesCountData,
    isLoading,
    restorePurchases,
    showPaywall,
    tierInfo,
    ownedBusinessCount,
    refreshTierInfo,
    refreshSubscriptionStatus,
    isIAPAvailable
  } = useSubscription();

  const [restoring, setRestoring] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        try {
          console.log('[SubscriptionScreen] Screen focused, refreshing subscription state');
          await Promise.all([
            refreshTierInfo(),
            refreshSubscriptionStatus()
          ]);
        } catch (error) {
          console.error('[SubscriptionScreen] Error refreshing subscription data:', error);
        }
      };

      refreshData();
    }, [refreshTierInfo, refreshSubscriptionStatus])
  );

  const isOwner = user?.id === currentBusiness?.owner_user_id;

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const success = await restorePurchases();

      if (success) {
        Alert.alert(
          t('common.success'),
          t('subscription.alerts.restoreSuccessMessage'),
          [{ text: t('common.ok') }]
        );
      } else {
        Alert.alert(
          t('subscription.alerts.noSubscriptionFoundTitle'),
          t('subscription.alerts.noSubscriptionFoundMessage'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      Alert.alert(
        t('subscription.alerts.restoreErrorTitle'),
        t('subscription.alerts.restoreErrorMessage'),
        [{ text: t('common.ok') }]
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const progressPercentage = salesCountData?.salesCount
    ? Math.min((salesCountData.salesCount / FREE_TIER_LIMIT) * 100, 100)
    : 0;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={isDark ? '#ffffff' : '#000000'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            {t('subscription.title')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={isDark ? '#ffffff' : '#000000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          {t('subscription.title')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isSubscribed ? (
          <>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.proCard}
            >
              <View style={styles.proHeader}>
                <View style={styles.proBadge}>
                  <Crown size={20} color="#fbbf24" />
                  <Text style={styles.proText}>
                    {tierInfo.tier === 'pro' && t('subscription.proPlan')}
                    {tierInfo.tier === 'pro_plus' && 'Pro Plus Plan'}
                    {tierInfo.tier === 'max' && 'Max Plan'}
                  </Text>
                </View>
                <Text style={styles.activeText}>{t('subscription.active')}</Text>
              </View>
              <Text style={styles.proDescription}>
                {t('subscription.unlimitedAccess')}
              </Text>
              {tierInfo.maxOwnedBusinesses && (
                <Text style={styles.proLimitInfo}>
                  {ownedBusinessCount} / {tierInfo.maxOwnedBusinesses === 999999 ? '∞' : tierInfo.maxOwnedBusinesses} businesses owned
                </Text>
              )}
            </LinearGradient>

            <Card style={styles.detailsCard}>
              {isOwner && (
                <>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Calendar size={20} color="#3b82f6" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, isDark && styles.detailLabelDark]}>
                        {t('subscription.subscriptionType')}
                      </Text>
                      <Text style={[styles.detailValue, isDark && styles.detailValueDark]}>
                        {subscriptionStatus.productId?.includes('year') ? t('subscription.yearly') : t('subscription.monthly')}
                      </Text>
                    </View>
                  </View>

                  {subscriptionStatus.expirationDate && (
                    <View style={[styles.detailRow, styles.detailRowBorder]}>
                      <View style={styles.detailIcon}>
                        <CreditCard size={20} color="#3b82f6" />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={[styles.detailLabel, isDark && styles.detailLabelDark]}>
                          {t('subscription.renewsOn')}
                        </Text>
                        <Text style={[styles.detailValue, isDark && styles.detailValueDark]}>
                          {new Date(subscriptionStatus.expirationDate).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              <View style={[styles.detailRow, isOwner && subscriptionStatus.expirationDate && styles.detailRowBorder]}>
                <View style={styles.detailIcon}>
                  <TrendingUp size={20} color="#10b981" />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, isDark && styles.detailLabelDark]}>
                    {t('subscription.totalSales')}
                  </Text>
                  <Text style={[styles.detailValue, isDark && styles.detailValueDark]}>
                    {t('subscription.salesCount', { count: salesCountData?.totalSalesAllBusinesses || salesCountData?.salesCount || 0 })}
                  </Text>
                </View>
              </View>
            </Card>

            {isOwner ? (
              <>
                {isIAPAvailable ? (
                  <CustomerCenterButton />
                ) : (
                  <Button
                    title={t('subscription.manageSubscription')}
                    onPress={handleManageSubscription}
                    style={styles.manageButton}
                  />
                )}
              </>
            ) : (
              <Card style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <Info size={20} color={isDark ? '#60a5fa' : '#3b82f6'} />
                  <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>
                    {t('subscription.ownerOnly.title')}
                  </Text>
                </View>
                <Text style={[styles.infoDescription, isDark && styles.infoDescriptionDark]}>
                  {t('subscription.ownerOnly.managementMessage')}
                </Text>
              </Card>
            )}
          </>
        ) : (
          <>
            <Card style={styles.freeCard}>
              <View style={styles.freeHeader}>
                <Text style={[styles.freeTitle, isDark && styles.freeTitleDark]}>
                  {t('subscription.freePlan')}
                </Text>
                <View style={[styles.freeBadge, isDark && styles.freeBadgeDark]}>
                  <Text style={[styles.freeBadgeText, isDark && styles.freeBadgeTextDark]}>
                    {t('subscription.active')}
                  </Text>
                </View>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, isDark && styles.progressLabelDark]}>
                    {t('subscription.salesUsage')}
                  </Text>
                  <Text style={[styles.progressCount, isDark && styles.progressCountDark]}>
                    {salesCountData?.totalSalesAllBusinesses || salesCountData?.salesCount || 0} / {FREE_TIER_LIMIT}
                  </Text>
                </View>
                <View style={[styles.progressBar, isDark && styles.progressBarDark]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercentage}%`,
                        backgroundColor: salesCountData?.isAtLimit ? '#ef4444' : '#3b82f6'
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, isDark && styles.progressTextDark]}>
                  {salesCountData?.isAtLimit
                    ? t('subscription.limitReached')
                    : t('subscription.salesRemaining', { count: salesCountData?.remainingSales || FREE_TIER_LIMIT })}
                </Text>
                <Text style={[styles.progressNote, isDark && styles.progressNoteDark]}>
                  Total across all businesses
                </Text>
              </View>
            </Card>

            {isOwner ? (
              <>
                <Card style={styles.upgradeCard}>
                  <View style={styles.upgradeHeader}>
                    <Zap size={24} color="#f59e0b" />
                    <Text style={[styles.upgradeTitle, isDark && styles.upgradeTitleDark]}>
                      {t('subscription.upgradeToPro')}
                    </Text>
                  </View>
                  <Text style={[styles.upgradeDescription, isDark && styles.upgradeDescriptionDark]}>
                    {t('subscription.upgradeToProFullDescription')}
                  </Text>
                  <Button
                    title={t('subscription.seePlans')}
                    onPress={showPaywall}
                    style={styles.upgradeButton}
                  />
                </Card>

                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={handleRestore}
                  disabled={restoring}
                >
                  {restoring ? (
                    <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#3b82f6'} />
                  ) : (
                    <>
                      <RefreshCw size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                      <Text style={[styles.restoreText, isDark && styles.restoreTextDark]}>
                        {t('subscription.restorePurchases')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Card style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <Info size={20} color={isDark ? '#60a5fa' : '#3b82f6'} />
                  <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>
                    {t('subscription.ownerOnly.title')}
                  </Text>
                </View>
                <Text style={[styles.infoDescription, isDark && styles.infoDescriptionDark]}>
                  {t('subscription.ownerOnly.upgradeMessage')}
                </Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerTitleDark: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  proCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  activeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proDescription: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  proLimitInfo: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
    marginTop: 8,
  },
  detailsCard: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailLabelDark: {
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  detailValueDark: {
    color: '#ffffff',
  },
  manageButton: {
    marginTop: 8,
  },
  freeCard: {
    marginBottom: 16,
  },
  freeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  freeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  freeTitleDark: {
    color: '#ffffff',
  },
  freeBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeBadgeDark: {
    backgroundColor: '#374151',
  },
  freeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  freeBadgeTextDark: {
    color: '#9ca3af',
  },
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  progressLabelDark: {
    color: '#9ca3af',
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  progressCountDark: {
    color: '#ffffff',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: '#374151',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressTextDark: {
    color: '#9ca3af',
  },
  progressNote: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 4,
  },
  progressNoteDark: {
    color: '#6b7280',
  },
  upgradeCard: {
    marginBottom: 16,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  upgradeTitleDark: {
    color: '#ffffff',
  },
  upgradeDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  upgradeDescriptionDark: {
    color: '#9ca3af',
  },
  upgradeButton: {
    marginBottom: 0,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  restoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  restoreTextDark: {
    color: '#60a5fa',
  },
  infoCard: {
    marginTop: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  infoTitleDark: {
    color: '#ffffff',
  },
  infoDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  infoDescriptionDark: {
    color: '#9ca3af',
  },
});
