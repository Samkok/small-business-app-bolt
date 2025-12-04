import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X, Check, Zap, TrendingUp, Users, BarChart3, Cloud, Headphones } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Button } from '@/src/components/ui/Button';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.9;

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  canClose?: boolean;
}

export const Paywall: React.FC<PaywallProps> = ({ visible, onClose, canClose = true }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { products, purchaseSubscription, restorePurchases, isLoading } = useSubscription();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const monthlyProduct = products.find(p => p.type === 'monthly');
  const yearlyProduct = products.find(p => p.type === 'yearly');

  const features = [
    { icon: Zap, title: t('subscription.features.unlimitedSales'), description: t('subscription.features.unlimitedSalesDesc') },
    { icon: TrendingUp, title: t('subscription.features.unlimitedBusinesses'), description: t('subscription.features.unlimitedBusinessesDesc') },
    { icon: Users, title: t('subscription.features.unlimitedUsers'), description: t('subscription.features.unlimitedUsersDesc') },
    { icon: BarChart3, title: t('subscription.features.advancedReporting'), description: t('subscription.features.advancedReportingDesc') },
    { icon: Cloud, title: t('subscription.features.cloudSync'), description: t('subscription.features.cloudSyncDesc') },
    { icon: Headphones, title: t('subscription.features.prioritySupport'), description: t('subscription.features.prioritySupportDesc') }
  ];

  useEffect(() => {
    if (visible) {
      setIsSheetVisible(true);
      translateY.value = withSpring(MAX_TRANSLATE_Y, {
        damping: 50,
        stiffness: 400
      });
    } else {
      translateY.value = withTiming(0, { duration: 250 }, () => {
        runOnJS(setIsSheetVisible)(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    if (!canClose) return;
    translateY.value = withTiming(0, { duration: 250 });
    setTimeout(onClose, 250);
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const newTranslateY = context.value.y + event.translationY;
      translateY.value = Math.min(0, Math.max(newTranslateY, MAX_TRANSLATE_Y));
    })
    .onEnd((event) => {
      if (event.translationY > 100 && canClose) {
        translateY.value = withTiming(0, { duration: 250 });
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(MAX_TRANSLATE_Y, {
          damping: 50,
          stiffness: 400
        });
      }
    });

  const rBottomSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const rBackdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [MAX_TRANSLATE_Y, 0],
      [1, 0],
      Extrapolate.CLAMP
    );
    return {
      opacity,
    };
  });

  const handlePurchase = async (productId: string) => {
    try {
      setPurchasing(true);
      const success = await purchaseSubscription(productId);

      if (success) {
        Alert.alert(
          t('subscription.alerts.purchaseSuccessTitle'),
          t('subscription.alerts.purchaseSuccessMessage'),
          [
            {
              text: t('common.done'),
              onPress: onClose
            }
          ]
        );
      } else {
        Alert.alert(
          t('subscription.alerts.purchaseFailedTitle'),
          t('subscription.alerts.purchaseFailedMessage'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert(
        t('subscription.alerts.purchaseErrorTitle'),
        t('subscription.alerts.purchaseErrorMessage'),
        [{ text: t('common.ok') }]
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
          t('subscription.alerts.restoreSuccessTitle'),
          t('subscription.alerts.restoreSuccessMessage'),
          [
            {
              text: t('common.done'),
              onPress: onClose
            }
          ]
        );
      } else {
        Alert.alert(
          t('subscription.alerts.noPurchasesFoundTitle'),
          t('subscription.alerts.noPurchasesFoundMessage'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert(
        t('subscription.alerts.restoreErrorTitle'),
        t('subscription.alerts.restoreErrorMessage'),
        [{ text: t('common.ok') }]
      );
    } finally {
      setRestoring(false);
    }
  };

  if (!isSheetVisible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={canClose ? handleClose : undefined}
    >
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={canClose ? handleClose : undefined}>
          <Animated.View style={[styles.backdrop, rBackdropStyle]} />
        </TouchableWithoutFeedback>

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.bottomSheetContainer, rBottomSheetStyle]}>
            <View style={[styles.bottomSheet, isDark && styles.bottomSheetDark]}>
              <View style={styles.dragIndicatorContainer}>
                <View style={[styles.dragIndicator, isDark && styles.dragIndicatorDark]} />
              </View>

              {canClose && (
                <TouchableOpacity
                  style={[styles.closeButton, isDark && styles.closeButtonDark]}
                  onPress={handleClose}
                >
                  <X size={20} color={isDark ? '#ffffff' : '#000000'} />
                </TouchableOpacity>
              )}

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                  styles.contentContainer,
                  { paddingBottom: Math.max(24, insets.bottom + 24) }
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.header}>
                  <View style={[styles.badge, isDark && styles.badgeDark]}>
                    <Zap size={18} color="#f59e0b" />
                    <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{t('subscription.premium')}</Text>
                  </View>

                  <Text style={[styles.title, isDark && styles.titleDark]}>
                    {t('subscription.upgradeToBizManagePro')}
                  </Text>
                  <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                    {t('subscription.unlockUnlimitedSales')}
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
                  <Text style={[styles.planType, isDark && styles.planTypeDark]}>{t('subscription.monthly')}</Text>
                  <Text style={[styles.planPrice, isDark && styles.planPriceDark]}>
                    {monthlyProduct.localizedPrice}
                  </Text>
                  <Text style={[styles.planPeriod, isDark && styles.planPeriodDark]}>{t('subscription.perMonth')}</Text>
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
                <Text style={styles.bestValueText}>{t('subscription.bestValue')}</Text>
              </View>
              {yearlyProduct && (
                <>
                  <Text style={[styles.planType, isDark && styles.planTypeDark]}>{t('subscription.yearly')}</Text>
                  <Text style={[styles.planPrice, isDark && styles.planPriceDark]}>
                    {yearlyProduct.localizedPrice}
                  </Text>
                  <Text style={[styles.planPeriod, isDark && styles.planPeriodDark]}>{t('subscription.perYear')}</Text>
                  <Text style={styles.savings}>{t('subscription.saveUpTo20')}</Text>
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
              {t('subscription.whatsIncluded')}
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
                  ? t('subscription.processing')
                  : selectedPlan === 'monthly' ? t('subscription.subscribingMonthly') : t('subscription.subscribingYearly')
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
                  {t('subscription.restorePurchase')}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.legalText, isDark && styles.legalTextDark]}>
              {t('subscription.autoRenewable')}
            </Text>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheetContainer: {
    height: SCREEN_HEIGHT,
    width: '100%',
    position: 'absolute',
    top: SCREEN_HEIGHT,
  },
  bottomSheet: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  bottomSheetDark: {
    backgroundColor: '#1f2937',
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  dragIndicatorDark: {
    backgroundColor: '#4b5563',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonDark: {
    backgroundColor: '#374151',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleDark: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  subtitleDark: {
    color: '#9ca3af',
  },
  plansContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  featuresTitleDark: {
    color: '#ffffff',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  featureIconDark: {
    backgroundColor: '#064e3b',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  featureTitleDark: {
    color: '#ffffff',
  },
  featureDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  featureDescriptionDark: {
    color: '#9ca3af',
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
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
