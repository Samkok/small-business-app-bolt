import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bug } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { debugSubscription } from '@/src/utils/debugSubscription';
import { iapService } from '@/src/services/iapService';

export default function DebugSubscriptionScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { user, currentBusiness } = useAuth();
  const { salesCountData, subscriptionStatus, tierInfo, ownedBusinessCount, refreshSubscriptionStatus, refreshSalesCount, refreshTierInfo } = useSubscription();
  const [processing, setProcessing] = useState(false);
  const iapDiagnostics = iapService.getDiagnosticInfo();

  if (!__DEV__) {
    router.back();
    return null;
  }

  const handleAction = async (action: () => Promise<void>, successMessage: string) => {
    if (!user?.id || !currentBusiness?.id) {
      Alert.alert('Error', 'User or business not available');
      return;
    }

    try {
      setProcessing(true);
      await action();
      await Promise.all([refreshSubscriptionStatus(), refreshSalesCount(), refreshTierInfo()]);
      Alert.alert('Success', successMessage);
    } catch (error) {
      Alert.alert('Error', 'Failed to execute action');
    } finally {
      setProcessing(false);
    }
  };

  const simulate49Sales = () => {
    handleAction(
      () => debugSubscription.simulateSalesCount(user!.id, currentBusiness!.id, 49),
      'Simulated 49 sales'
    );
  };

  const simulate50Sales = () => {
    handleAction(
      () => debugSubscription.simulateSalesCount(user!.id, currentBusiness!.id, 50),
      'Simulated 50 sales (limit reached)'
    );
  };

  const simulateProMonthly = () => {
    handleAction(
      () => debugSubscription.simulateSubscription(user!.id, 'active', 'bizmanage.pro.month'),
      'Simulated Pro tier (1 business)'
    );
  };

  const simulateProYearly = () => {
    handleAction(
      () => debugSubscription.simulateSubscription(user!.id, 'active', 'bizmanage.pro.yearly'),
      'Simulated Pro tier (1 business) - Yearly'
    );
  };

  const simulateProPlusMonthly = () => {
    handleAction(
      () => debugSubscription.simulateSubscription(user!.id, 'active', 'bizmanage.pro_plus.month'),
      'Simulated Pro Plus tier (3 businesses)'
    );
  };

  const simulateProPlusYearly = () => {
    handleAction(
      () => debugSubscription.simulateSubscription(user!.id, 'active', 'bizmanage.pro_plus.yearly'),
      'Simulated Pro Plus tier (3 businesses) - Yearly'
    );
  };

  const simulateMaxMonthly = () => {
    handleAction(
      () => debugSubscription.simulateSubscription(user!.id, 'active', 'bizmanage.max.month'),
      'Simulated Max tier (unlimited businesses)'
    );
  };

  const simulateMaxYearly = () => {
    handleAction(
      () => debugSubscription.simulateSubscription(user!.id, 'active', 'bizmanage.max.yearly'),
      'Simulated Max tier (unlimited businesses) - Yearly'
    );
  };

  const simulateExpired = () => {
    handleAction(
      () => debugSubscription.simulateSubscription(user!.id, 'expired'),
      'Simulated expired subscription'
    );
  };

  const resetAllData = () => {
    Alert.alert(
      'Confirm Reset',
      'This will clear all subscription and sales count data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => handleAction(
            () => debugSubscription.resetAllData(user!.id, currentBusiness!.id),
            'All data reset'
          )
        }
      ]
    );
  };

  const logState = async () => {
    if (!user?.id || !currentBusiness?.id) return;
    await debugSubscription.logSubscriptionState(user.id, currentBusiness.id);
    Alert.alert('State Logged', 'Check console for details');
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={isDark ? '#ffffff' : '#000000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          Debug Subscription
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <Bug size={24} color="#ef4444" />
            <Text style={[styles.warningTitle, isDark && styles.warningTitleDark]}>
              Development Only
            </Text>
          </View>
          <Text style={[styles.warningText, isDark && styles.warningTextDark]}>
            These tools are only available in development mode. They will not appear in production builds.
          </Text>
        </Card>

        <Card style={styles.stateCard}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Current State
          </Text>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Sales Count (Current):
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {salesCountData.salesCount}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Total Sales (All):
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {salesCountData.totalSalesAllBusinesses || 0}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Subscription Tier:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {tierInfo.tier}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Subscription Status:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {subscriptionStatus.subscriptionStatus}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Owned Businesses:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {ownedBusinessCount} / {tierInfo.maxOwnedBusinesses === 999999 ? '∞' : (tierInfo.maxOwnedBusinesses || '∞')}
            </Text>
          </View>
          {subscriptionStatus.productId && (
            <View style={styles.stateItem}>
              <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
                Product ID:
              </Text>
              <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
                {subscriptionStatus.productId}
              </Text>
            </View>
          )}
          {subscriptionStatus.revenueCatAppUserId && (
            <View style={styles.stateItem}>
              <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
                RevenueCat App User ID:
              </Text>
              <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
                {subscriptionStatus.revenueCatAppUserId}
              </Text>
            </View>
          )}
        </Card>

        <Card style={[styles.stateCard, !iapDiagnostics.isAvailable ? styles.iapUnavailableCard : styles.iapAvailableCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            IAP Configuration
          </Text>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              IAP Status:
            </Text>
            <Text style={[
              styles.stateValue,
              isDark && styles.stateValueDark,
              !iapDiagnostics.isAvailable ? styles.unavailableText : styles.availableText
            ]}>
              {iapDiagnostics.isAvailable ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              App Ownership:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {iapDiagnostics.appOwnership || 'N/A'}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Execution Context:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {iapDiagnostics.executionContext}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Platform:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {iapDiagnostics.platform}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              Dev Mode:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {iapDiagnostics.isDev ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.stateItem}>
            <Text style={[styles.stateLabel, isDark && styles.stateLabelDark]}>
              react-native-iap loaded:
            </Text>
            <Text style={[styles.stateValue, isDark && styles.stateValueDark]}>
              {iapDiagnostics.isRealIAPAvailable ? 'Yes' : 'No'}
            </Text>
          </View>
          {!iapDiagnostics.isAvailable && (
            <View style={styles.iapWarning}>
              <Text style={[styles.iapWarningText, isDark && styles.iapWarningTextDark]}>
                IAP not available. Build with EAS and install on a device to enable subscriptions.
              </Text>
            </View>
          )}
          {iapDiagnostics.isAvailable && (
            <View style={styles.iapSuccess}>
              <Text style={[styles.iapSuccessText, isDark && styles.iapSuccessTextDark]}>
                IAP is available. Purchases will connect to App Store/Play Store.
              </Text>
            </View>
          )}
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Simulate Sales Count
          </Text>
          <Button
            title="Simulate 49 Sales"
            onPress={simulate49Sales}
            disabled={processing}
            style={styles.button}
          />
          <Button
            title="Simulate 50 Sales (Limit)"
            onPress={simulate50Sales}
            disabled={processing}
            style={styles.button}
          />
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Pro Tier (1 Business)
          </Text>
          <Button
            title="Pro Monthly"
            onPress={simulateProMonthly}
            disabled={processing}
            style={styles.button}
          />
          <Button
            title="Pro Yearly"
            onPress={simulateProYearly}
            disabled={processing}
            style={styles.button}
          />
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Pro Plus Tier (3 Businesses)
          </Text>
          <Button
            title="Pro Plus Monthly"
            onPress={simulateProPlusMonthly}
            disabled={processing}
            style={styles.button}
          />
          <Button
            title="Pro Plus Yearly"
            onPress={simulateProPlusYearly}
            disabled={processing}
            style={styles.button}
          />
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Max Tier (Unlimited Businesses)
          </Text>
          <Button
            title="Max Monthly"
            onPress={simulateMaxMonthly}
            disabled={processing}
            style={styles.button}
          />
          <Button
            title="Max Yearly"
            onPress={simulateMaxYearly}
            disabled={processing}
            style={styles.button}
          />
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Other States
          </Text>
          <Button
            title="Expired Subscription"
            onPress={simulateExpired}
            disabled={processing}
            style={styles.button}
          />
        </Card>

        <Card style={styles.actionsCard}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Debug Actions
          </Text>
          <Button
            title="Log Current State"
            onPress={logState}
            disabled={processing}
            style={styles.button}
          />
          <Button
            title="Reset All Data"
            onPress={resetAllData}
            disabled={processing}
            style={styles.dangerButton}
          />
        </Card>
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
  warningCard: {
    marginBottom: 16,
    backgroundColor: '#fef2f2',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
  },
  warningTitleDark: {
    color: '#fca5a5',
  },
  warningText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  warningTextDark: {
    color: '#fca5a5',
  },
  stateCard: {
    marginBottom: 16,
  },
  actionsCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#ffffff',
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stateLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  stateLabelDark: {
    color: '#9ca3af',
  },
  stateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  stateValueDark: {
    color: '#ffffff',
  },
  button: {
    marginBottom: 12,
  },
  dangerButton: {
    marginBottom: 0,
    backgroundColor: '#ef4444',
  },
  iapUnavailableCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  iapAvailableCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  unavailableText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  availableText: {
    color: '#10b981',
    fontWeight: '700',
  },
  iapWarning: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  iapWarningText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  iapWarningTextDark: {
    color: '#fbbf24',
  },
  iapSuccess: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
  },
  iapSuccessText: {
    fontSize: 13,
    color: '#065f46',
    lineHeight: 18,
  },
  iapSuccessTextDark: {
    color: '#34d399',
  },
});
