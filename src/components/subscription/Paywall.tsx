import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { X, Check, Zap, TrendingUp, Users, BarChart3, Cloud, Headphones } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Button } from '@/src/components/ui/Button';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  canClose?: boolean;
}

export const Paywall: React.FC<PaywallProps> = ({ visible, onClose, canClose = true }) => {
  const { isDark } = useTheme();
  const { products, purchaseSubscription, restorePurchases, isLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const monthlyProduct = products.find(p => p.type === 'monthly');
  const yearlyProduct = products.find(p => p.type === 'yearly');

  const features = [
    { icon: Zap, title: 'Unlimited Sales', description: 'Create unlimited sales transactions' },
    { icon: TrendingUp, title: 'Unlimited Businesses', description: 'Manage multiple businesses' },
    { icon: Users, title: 'Unlimited Team Members', description: 'Invite unlimited users' },
    { icon: BarChart3, title: 'Advanced Reporting', description: 'Full access to reports and analytics' },
    { icon: Cloud, title: 'Cloud Sync & Backup', description: 'Automatic data backup and sync' },
    { icon: Headphones, title: 'Priority Support', description: 'Get help when you need it' }
  ];

  const handlePurchase = async (productId: string) => {
    try {
      setPurchasing(true);
      const success = await purchaseSubscription(productId);

      if (success) {
        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy unlimited access to BizManage Pro!',
          [
            {
              text: 'Continue',
              onPress: onClose
            }
          ]
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          'Unable to complete your purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert(
        'Error',
        'An error occurred during purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const success = await restorePurchases();

      if (success) {
        Alert.alert(
          'Purchases Restored',
          'Your subscription has been restored successfully!',
          [
            {
              text: 'Continue',
              onPress: onClose
            }
          ]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert(
        'Error',
        'An error occurred while restoring purchases. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={canClose ? onClose : undefined}
    >
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e'] : ['#ffffff', '#f0f4f8']}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {canClose && (
            <TouchableOpacity
              style={[styles.closeButton, isDark && styles.closeButtonDark]}
              onPress={onClose}
            >
              <X size={24} color={isDark ? '#ffffff' : '#000000'} />
            </TouchableOpacity>
          )}

          <View style={styles.header}>
            <View style={[styles.badge, isDark && styles.badgeDark]}>
              <Zap size={20} color="#f59e0b" />
              <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>PREMIUM</Text>
            </View>

            <Text style={[styles.title, isDark && styles.titleDark]}>
              Upgrade to BizManage Pro
            </Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Unlock unlimited sales and full access to all features
            </Text>
          </View>

          <View style={styles.plansContainer}>
            <TouchableOpacity
              style={[
                styles.planCard,
                isDark && styles.planCardDark,
                selectedPlan === 'monthly' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              {monthlyProduct && (
                <>
                  <Text style={[styles.planType, isDark && styles.planTypeDark]}>Monthly</Text>
                  <Text style={[styles.planPrice, isDark && styles.planPriceDark]}>
                    {monthlyProduct.localizedPrice}
                  </Text>
                  <Text style={[styles.planPeriod, isDark && styles.planPeriodDark]}>per month</Text>
                </>
              )}
              {selectedPlan === 'monthly' && (
                <View style={styles.checkmark}>
                  <Check size={20} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.planCard,
                isDark && styles.planCardDark,
                selectedPlan === 'yearly' && styles.planCardSelected,
                styles.planCardBest
              ]}
              onPress={() => setSelectedPlan('yearly')}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>BEST VALUE</Text>
              </View>
              {yearlyProduct && (
                <>
                  <Text style={[styles.planType, isDark && styles.planTypeDark]}>Yearly</Text>
                  <Text style={[styles.planPrice, isDark && styles.planPriceDark]}>
                    {yearlyProduct.localizedPrice}
                  </Text>
                  <Text style={[styles.planPeriod, isDark && styles.planPeriodDark]}>per year</Text>
                  <Text style={styles.savings}>Save up to 20%</Text>
                </>
              )}
              {selectedPlan === 'yearly' && (
                <View style={styles.checkmark}>
                  <Check size={20} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.featuresContainer}>
            <Text style={[styles.featuresTitle, isDark && styles.featuresTitleDark]}>
              What's Included
            </Text>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={[styles.featureIcon, isDark && styles.featureIconDark]}>
                  <feature.icon size={20} color="#10b981" />
                </View>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureTitle, isDark && styles.featureTitleDark]}>
                    {feature.title}
                  </Text>
                  <Text style={[styles.featureDescription, isDark && styles.featureDescriptionDark]}>
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actionsContainer}>
            <Button
              title={
                purchasing
                  ? 'Processing...'
                  : `Subscribe ${selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'}`
              }
              onPress={() => {
                const productId = selectedPlan === 'monthly'
                  ? monthlyProduct?.productId
                  : yearlyProduct?.productId;
                if (productId) {
                  handlePurchase(productId);
                }
              }}
              disabled={purchasing || restoring || isLoading || !products.length}
              style={styles.subscribeButton}
            />

            <TouchableOpacity
              onPress={handleRestore}
              disabled={purchasing || restoring || isLoading}
              style={styles.restoreButton}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#000000'} />
              ) : (
                <Text style={[styles.restoreText, isDark && styles.restoreTextDark]}>
                  Restore Purchase
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.legalText, isDark && styles.legalTextDark]}>
              Auto-renewable. Cancel anytime. Terms apply.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonDark: {
    backgroundColor: '#374151',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
  },
  badgeDark: {
    backgroundColor: '#78350f',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    letterSpacing: 1,
  },
  badgeTextDark: {
    color: '#fcd34d',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleDark: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  subtitleDark: {
    color: '#9ca3af',
  },
  plansContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  planCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  planCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  planCardBest: {
    position: 'relative',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  planTypeDark: {
    color: '#ffffff',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  planPriceDark: {
    color: '#ffffff',
  },
  planPeriod: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  planPeriodDark: {
    color: '#9ca3af',
  },
  savings: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 8,
  },
  featuresContainer: {
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  featuresTitleDark: {
    color: '#ffffff',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIconDark: {
    backgroundColor: '#064e3b',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  featureTitleDark: {
    color: '#ffffff',
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  featureDescriptionDark: {
    color: '#9ca3af',
  },
  actionsContainer: {
    gap: 16,
  },
  subscribeButton: {
    marginBottom: 0,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  restoreTextDark: {
    color: '#60a5fa',
  },
  legalText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  legalTextDark: {
    color: '#6b7280',
  },
});
