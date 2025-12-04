import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Lock, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Button } from '@/src/components/ui/Button';
import { FREE_TIER_LIMIT } from '@/src/services/subscriptionService';

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  salesCount: number;
  message?: string;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  visible,
  onClose,
  onUpgrade,
  salesCount,
  message
}) => {
  const { isDark } = useTheme();
  const { products } = useSubscription();
  const insets = useSafeAreaInsets();

  const monthlyProduct = products.find(p => p.type === 'monthly');
  const yearlyProduct = products.find(p => p.type === 'yearly');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[
          styles.bottomSheet,
          isDark && styles.bottomSheetDark,
          { paddingBottom: Math.max(24, insets.bottom + 24) }
        ]}>
          <View style={[styles.dragHandle, isDark && styles.dragHandleDark]} />

          <TouchableOpacity
            style={[styles.closeButton, isDark && styles.closeButtonDark]}
            onPress={onClose}
          >
            <X size={20} color={isDark ? '#ffffff' : '#000000'} />
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
              <Lock size={40} color="#f59e0b" />
            </View>

            <Text style={[styles.title, isDark && styles.titleDark]}>
              Upgrade to Continue
            </Text>

            <View style={[styles.statsContainer, isDark && styles.statsContainerDark]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, isDark && styles.statValueDark]}>
                  {salesCount}
                </Text>
                <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                  Sales Created
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, isDark && styles.statValueDark]}>
                  {FREE_TIER_LIMIT}
                </Text>
                <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
                  Free Limit
                </Text>
              </View>
            </View>

            <Text style={[styles.message, isDark && styles.messageDark]}>
              {message || `You've reached the free limit of ${FREE_TIER_LIMIT} sales. Upgrade to BizManage Pro to unlock unlimited sales and full access to all features.`}
            </Text>

            <View style={styles.benefitsContainer}>
              <View style={styles.benefitRow}>
                <TrendingUp size={20} color="#10b981" />
                <Text style={[styles.benefitText, isDark && styles.benefitTextDark]}>
                  Unlimited sales transactions
                </Text>
              </View>
              <View style={styles.benefitRow}>
                <TrendingUp size={20} color="#10b981" />
                <Text style={[styles.benefitText, isDark && styles.benefitTextDark]}>
                  Full access to all features
                </Text>
              </View>
              <View style={styles.benefitRow}>
                <TrendingUp size={20} color="#10b981" />
                <Text style={[styles.benefitText, isDark && styles.benefitTextDark]}>
                  Advanced reporting and analytics
                </Text>
              </View>
            </View>

            {(monthlyProduct || yearlyProduct) && (
              <View style={[styles.pricingContainer, isDark && styles.pricingContainerDark]}>
                {monthlyProduct && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, isDark && styles.priceLabelDark]}>
                      Monthly
                    </Text>
                    <Text style={[styles.priceValue, isDark && styles.priceValueDark]}>
                      {monthlyProduct.localizedPrice || monthlyProduct.price}
                    </Text>
                  </View>
                )}
                {yearlyProduct && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, isDark && styles.priceLabelDark]}>
                      Yearly
                    </Text>
                    <Text style={[styles.priceValue, isDark && styles.priceValueDark]}>
                      {yearlyProduct.localizedPrice || yearlyProduct.price}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Button
              title="Upgrade to Pro"
              onPress={onUpgrade}
              style={styles.upgradeButton}
            />

            <TouchableOpacity onPress={onClose} style={styles.laterButton}>
              <Text style={[styles.laterText, isDark && styles.laterTextDark]}>
                Maybe Later
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSheetDark: {
    backgroundColor: '#1f2937',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dragHandleDark: {
    backgroundColor: '#4b5563',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonDark: {
    backgroundColor: '#374151',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconContainerDark: {
    backgroundColor: '#78350f',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  titleDark: {
    color: '#ffffff',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statsContainerDark: {
    backgroundColor: '#111827',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statValueDark: {
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statLabelDark: {
    color: '#9ca3af',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  messageDark: {
    color: '#9ca3af',
  },
  benefitsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  benefitTextDark: {
    color: '#ffffff',
  },
  pricingContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  pricingContainerDark: {
    backgroundColor: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  priceLabelDark: {
    color: '#ffffff',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f59e0b',
  },
  priceValueDark: {
    color: '#f59e0b',
  },
  upgradeButton: {
    marginBottom: 12,
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  laterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  laterTextDark: {
    color: '#9ca3af',
  },
});
