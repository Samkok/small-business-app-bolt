import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { X, Bug, RefreshCw, Play, Zap } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/config/supabase';
import { businessService } from '@/src/services/business';

interface SubscriptionDebugProps {
  visible: boolean;
  onClose: () => void;
}

export function SubscriptionDebug({ visible, onClose }: SubscriptionDebugProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const subscription = useSubscription();

  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      loadDebugData();
    }
  }, [visible]);

  const loadDebugData = async () => {
    setLoading(true);
    addLog('Loading debug data...');
    try {
      if (!user?.id) return;

      const [profileResult, businessesResult, salesCountResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
        businessService.getUserOwnedBusinessesWithState(user.id),
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', subscription.currentBusiness?.id || '')
          .eq('is_voided', false)
      ]);

      setDebugData({
        profile: profileResult.data,
        businesses: businessesResult,
        salesCount: salesCountResult.count || 0,
      });

      addLog('Debug data loaded successfully');
    } catch (error) {
      console.error('Error loading debug data:', error);
      addLog(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const simulateSetSalesCount = async (count: number) => {
    addLog(`Simulating ${count} sales...`);
    Alert.alert(
      'Simulation',
      `This would set sales count to ${count}. In production, use actual sales data.`,
      [{ text: 'OK' }]
    );
  };

  const simulateTriggerDowngradeModal = async () => {
    if (!user?.id) return;

    addLog('Triggering downgrade modal...');
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ must_choose_businesses: true })
        .eq('id', user.id);

      if (error) throw error;

      addLog('Downgrade modal triggered');
      Alert.alert('Success', 'Downgrade modal flag set. Close and reopen app to see modal.', [
        { text: 'OK', onPress: onClose }
      ]);
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', 'Failed to trigger downgrade modal');
    }
  };

  const simulateChangeTier = async (tier: 'free' | 'pro' | 'pro_plus' | 'max') => {
    if (!user?.id) return;

    const tierLimits = {
      free: { max_owned_businesses: 1, display: 'Free' },
      pro: { max_owned_businesses: 1, display: 'Pro' },
      pro_plus: { max_owned_businesses: 3, display: 'Pro Plus' },
      max: { max_owned_businesses: null, display: 'Max' },
    };

    addLog(`Changing tier to ${tierLimits[tier].display}...`);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: tier,
          max_owned_businesses: tierLimits[tier].max_owned_businesses,
        })
        .eq('id', user.id);

      if (error) throw error;

      addLog(`Tier changed to ${tierLimits[tier].display}`);
      Alert.alert('Success', `Tier changed to ${tierLimits[tier].display}`, [
        { text: 'OK', onPress: loadDebugData }
      ]);
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', 'Failed to change tier');
    }
  };

  const simulateExpireSubscription = async () => {
    if (!user?.id) return;

    addLog('Expiring subscription...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_status: 'expired',
          subscription_expiration_date: yesterday.toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      addLog('Subscription expired');
      Alert.alert('Success', 'Subscription marked as expired', [
        { text: 'OK', onPress: loadDebugData }
      ]);
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', 'Failed to expire subscription');
    }
  };

  const testSubscriptionStatus = async () => {
    if (!user?.id) return;

    addLog('Testing subscription-status endpoint...');
    try {
      const { data, error } = await supabase.functions.invoke('subscription-status', {
        body: { userId: user.id }
      });

      if (error) throw error;

      addLog('Response: ' + JSON.stringify(data, null, 2));
      Alert.alert('API Response', JSON.stringify(data, null, 2));
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', 'Failed to call subscription-status');
    }
  };

  const testValidateSubscription = async () => {
    if (!user?.id) return;

    addLog('Testing validate-subscription endpoint...');
    try {
      const { data, error } = await supabase.functions.invoke('validate-subscription', {
        body: { userId: user.id }
      });

      if (error) throw error;

      addLog('Response: ' + JSON.stringify(data, null, 2));
      Alert.alert('API Response', JSON.stringify(data, null, 2));
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', 'Failed to call validate-subscription');
    }
  };

  const testChooseBusinesses = async () => {
    if (!user?.id || !debugData?.businesses?.length) return;

    const selectedIds = [debugData.businesses[0].id];

    addLog('Testing choose-businesses endpoint...');
    try {
      const { data, error } = await supabase.functions.invoke('choose-businesses', {
        body: { userId: user.id, selectedBusinessIds: selectedIds }
      });

      if (error) throw error;

      addLog('Response: ' + JSON.stringify(data, null, 2));
      Alert.alert('API Response', JSON.stringify(data, null, 2));
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', 'Failed to call choose-businesses');
    }
  };

  const toggleBusinessReadOnly = async (businessId: string, currentState: string) => {
    const newState = currentState === 'active' ? 'read_only_sales' : 'active';

    addLog(`Setting business to ${newState}...`);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ access_state: newState })
        .eq('id', businessId);

      if (error) throw error;

      addLog(`Business state changed to ${newState}`);
      Alert.alert('Success', `Business is now ${newState}`, [
        { text: 'OK', onPress: loadDebugData }
      ]);
    } catch (error) {
      addLog(`Error: ${error}`);
      Alert.alert('Error', 'Failed to update business state');
    }
  };

  const renderSection = (title: string, content: React.ReactNode) => (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
      {content}
    </View>
  );

  const renderRow = (label: string, value: any) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}:</Text>
      <Text style={[styles.value, { color: theme.text }]}>{String(value)}</Text>
    </View>
  );

  if (loading && !debugData) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading debug data...
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <Bug size={24} color={theme.primary} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Subscription Debug
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {renderSection('Subscription State', (
            <>
              {renderRow('Tier', debugData?.profile?.subscription_tier || 'free')}
              {renderRow('Status', debugData?.profile?.subscription_status || 'N/A')}
              {renderRow('Expiration', debugData?.profile?.subscription_expiration_date
                ? new Date(debugData.profile.subscription_expiration_date).toLocaleDateString()
                : 'N/A')}
              {renderRow('Product ID', debugData?.profile?.subscription_product_id || 'N/A')}
              {renderRow('Must Choose', String(debugData?.profile?.must_choose_businesses || false))}
              {renderRow('Max Businesses', debugData?.profile?.max_owned_businesses || 1)}
            </>
          ))}

          {renderSection('Sales & Limits', (
            <>
              {renderRow('Current Sales', debugData?.salesCount || 0)}
              {renderRow('Free Tier Limit', 50)}
              {renderRow('Remaining', Math.max(0, 50 - (debugData?.salesCount || 0)))}
              {renderRow('Can Create Sale', subscription.canAccessFeature('SALES_CREATION') ? 'Yes' : 'No')}
            </>
          ))}

          {renderSection('Business States', (
            <>
              {debugData?.businesses?.map((business: any) => (
                <View key={business.id} style={styles.businessItem}>
                  <Text style={[styles.businessName, { color: theme.text }]}>
                    {business.name}
                  </Text>
                  <Text style={[styles.businessState, { color: theme.textSecondary }]}>
                    State: {business.access_state || 'active'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.simulateButton, { backgroundColor: theme.primary + '20' }]}
                    onPress={() => toggleBusinessReadOnly(business.id, business.access_state || 'active')}
                  >
                    <Text style={[styles.simulateButtonText, { color: theme.primary }]}>
                      Toggle State
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ))}

          {renderSection('Simulation Controls', (
            <>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={() => simulateSetSalesCount(48)}
              >
                <Text style={styles.buttonText}>Set Sales to 48</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={() => simulateSetSalesCount(49)}
              >
                <Text style={styles.buttonText}>Set Sales to 49</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={() => simulateSetSalesCount(50)}
              >
                <Text style={styles.buttonText}>Set Sales to 50</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={simulateTriggerDowngradeModal}
              >
                <Text style={styles.buttonText}>Trigger Downgrade Modal</Text>
              </TouchableOpacity>
            </>
          ))}

          {renderSection('Tier Selector', (
            <>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.success }]}
                onPress={() => simulateChangeTier('free')}
              >
                <Text style={styles.buttonText}>Switch to Free</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.success }]}
                onPress={() => simulateChangeTier('pro')}
              >
                <Text style={styles.buttonText}>Switch to Pro</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.success }]}
                onPress={() => simulateChangeTier('pro_plus')}
              >
                <Text style={styles.buttonText}>Switch to Pro Plus</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.success }]}
                onPress={() => simulateChangeTier('max')}
              >
                <Text style={styles.buttonText}>Switch to Max</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.error }]}
                onPress={simulateExpireSubscription}
              >
                <Text style={styles.buttonText}>Expire Subscription Now</Text>
              </TouchableOpacity>
            </>
          ))}

          {renderSection('API Testing', (
            <>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.accent }]}
                onPress={testSubscriptionStatus}
              >
                <Text style={styles.buttonText}>Test subscription-status</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.accent }]}
                onPress={testValidateSubscription}
              >
                <Text style={styles.buttonText}>Test validate-subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.accent }]}
                onPress={testChooseBusinesses}
              >
                <Text style={styles.buttonText}>Test choose-businesses</Text>
              </TouchableOpacity>
            </>
          ))}

          {renderSection('Logs', (
            <ScrollView style={styles.logsContainer} nestedScrollEnabled>
              {logs.map((log, index) => (
                <Text key={index} style={[styles.logText, { color: theme.textSecondary }]}>
                  {log}
                </Text>
              ))}
            </ScrollView>
          ))}

          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: theme.primary }]}
            onPress={loadDebugData}
          >
            <RefreshCw size={20} color="#FFFFFF" />
            <Text style={styles.refreshButtonText}>Refresh Data</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
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
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  businessItem: {
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
  },
  businessState: {
    fontSize: 14,
  },
  button: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  simulateButton: {
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  simulateButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logsContainer: {
    maxHeight: 200,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
