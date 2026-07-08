import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Gift, Users, TrendingUp, Copy, Share2, Coins, Clock, CheckCircle } from 'lucide-react-native';
import { useReferral } from '@/src/context/ReferralContext';
import { useTheme } from '@/src/context/ThemeContext';
import * as Clipboard from 'expo-linking';
import { Platform, Alert } from 'react-native';

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark } = useTheme();
  const { isLoading, dashboardData, referralCode, creditBalance, stats, refreshDashboard, shareReferralLink } = useReferral();
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    card: isDark ? '#1f2937' : '#ffffff',
    text: isDark ? '#f9fafb' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    primary: '#2563eb',
    primaryLight: isDark ? '#1e3a5f' : '#eff6ff',
    success: '#10b981',
    successLight: isDark ? '#064e3b' : '#ecfdf5',
    warning: '#f59e0b',
    warningLight: isDark ? '#78350f' : '#fffbeb',
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDashboard();
    setRefreshing(false);
  }, [refreshDashboard]);

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(referralCode);
      } else {
        const { default: ClipboardRN } = await import('react-native/Libraries/Components/Clipboard/Clipboard');
        ClipboardRN?.setString?.(referralCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Referral Code', referralCode);
    }
  };

  const handleShare = async () => {
    await shareReferralLink();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'rewarded': return colors.success;
      case 'subscribed': return colors.primary;
      case 'signed_up': return colors.warning;
      case 'clicked': return colors.textSecondary;
      case 'expired':
      case 'fraudulent': return '#ef4444';
      default: return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'rewarded': return 'Rewarded';
      case 'subscribed': return 'Subscribed';
      case 'signed_up': return 'Signed Up';
      case 'clicked': return 'Clicked';
      case 'expired': return 'Expired';
      case 'fraudulent': return 'Invalid';
      default: return status;
    }
  };

  if (isLoading && !dashboardData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Refer & Earn</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Refer & Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Credit Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <View style={styles.balanceHeader}>
            <Coins size={20} color="#ffffff" />
            <Text style={styles.balanceLabel}>Your Credits</Text>
          </View>
          <Text style={styles.balanceAmount}>{creditBalance}</Text>
          <Text style={styles.balanceSubtext}>
            {creditBalance > 0 ? `${creditBalance} extra sales available` : 'Invite friends to earn credits'}
          </Text>
        </View>

        {/* Share Card */}
        <View style={[styles.shareCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.shareTitle, { color: colors.text }]}>Invite Friends, Earn Credits</Text>
          <Text style={[styles.shareDescription, { color: colors.textSecondary }]}>
            Share your code and earn up to 100 credits when friends subscribe. Each credit = 1 extra sale.
          </Text>

          {referralCode ? (
            <>
              <View style={[styles.codeContainer, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Text style={[styles.codeText, { color: colors.primary }]}>{referralCode}</Text>
                <TouchableOpacity onPress={handleCopyCode} style={styles.copyButton}>
                  {copied ? (
                    <CheckCircle size={20} color={colors.success} />
                  ) : (
                    <Copy size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primary }]} onPress={handleShare}>
                <Share2 size={18} color="#ffffff" />
                <Text style={styles.shareButtonText}>Share Referral Link</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Users size={18} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.total_clicks || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Link Clicks</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TrendingUp size={18} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.total_signups || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sign Ups</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Gift size={18} color={colors.warning} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.total_conversions || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Subscribed</Text>
          </View>
        </View>

        {/* Reward Rules */}
        {dashboardData?.reward_rules && dashboardData.reward_rules.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Reward Tiers</Text>
            {dashboardData.reward_rules.map((rule, index) => (
              <View key={rule.rule_name} style={[styles.ruleRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.ruleTier, { color: colors.text }]}>
                  {rule.applies_to_tiers.map(t => t.replace('_', ' ')).join(', ').toUpperCase()}
                </Text>
                <View style={styles.ruleCredits}>
                  <Text style={[styles.ruleValue, { color: colors.primary }]}>You: +{rule.referrer_credits}</Text>
                  <Text style={[styles.ruleValue, { color: colors.success }]}>Friend: +{rule.referee_credits}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Referral History */}
        {dashboardData?.history && dashboardData.history.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Referral History</Text>
            {dashboardData.history.map((event, index) => (
              <View key={event.id} style={[styles.historyRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyName, { color: colors.text }]}>
                    {event.referee_name || 'Anonymous'}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                    {new Date(event.clicked_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(event.status) }]}>
                    {getStatusLabel(event.status)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Credit History */}
        {dashboardData?.credit_history && dashboardData.credit_history.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Credit History</Text>
            {dashboardData.credit_history.map((tx, index) => (
              <View key={tx.id} style={[styles.historyRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyName, { color: colors.text }]}>{tx.description}</Text>
                  <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                    {new Date(tx.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.creditAmount, { color: tx.amount > 0 ? colors.success : '#ef4444' }]}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  balanceCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { fontSize: 14, color: '#ffffffcc', fontWeight: '500' },
  balanceAmount: { fontSize: 48, fontWeight: '700', color: '#ffffff', marginTop: 8 },
  balanceSubtext: { fontSize: 13, color: '#ffffffaa', marginTop: 4 },

  shareCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  shareTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  shareDescription: { fontSize: 14, lineHeight: 20 },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
  },
  codeText: { fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  copyButton: { padding: 8 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  shareButtonText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500' },

  section: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },

  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  ruleTier: { fontSize: 13, fontWeight: '600' },
  ruleCredits: { flexDirection: 'row', gap: 12 },
  ruleValue: { fontSize: 13, fontWeight: '600' },

  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  historyInfo: { flex: 1, marginRight: 12 },
  historyName: { fontSize: 14, fontWeight: '500' },
  historyDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  creditAmount: { fontSize: 15, fontWeight: '700' },
});
