import React, { useState, useEffect, useRef } from 'react';
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
import { X, Check, Zap, Building2, Users, TrendingUp, Headphones, Crown } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Button } from '@/src/components/ui/Button';
import { productIdMapper, type TierType, type BillingPeriod } from '@/src/utils/productIdMapper';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.9;
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_SPACING = 16;

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  canClose?: boolean;
}

interface TierConfig {
  id: TierType;
  name: string;
  tagline: string;
  businessLimit: string;
  features: string[];
  icon: typeof Building2;
}

export const Paywall: React.FC<PaywallProps> = ({ visible, onClose, canClose = true }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { products, purchaseSubscription, restorePurchases, isLoading } = useSubscription();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [selectedTier, setSelectedTier] = useState<TierType>('pro_plus');
  const [billingPeriods, setBillingPeriods] = useState<Record<TierType, BillingPeriod>>({
    pro: 'yearly',
    pro_plus: 'yearly',
    max: 'yearly'
  });
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(1);

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const tiers: TierConfig[] = [
    {
      id: 'pro',
      name: t('subscription.tiers.pro.name'),
      tagline: t('subscription.tiers.pro.tagline'),
      businessLimit: t('subscription.tiers.pro.businessLimit'),
      features: [
        t('subscription.features.oneBusinessOwned'),
        t('subscription.features.unlimitedSales'),
        t('subscription.features.basicReporting'),
        t('subscription.features.teamCollaboration')
      ],
      icon: Building2,
    },
    {
      id: 'pro_plus',
      name: t('subscription.tiers.proPlus.name'),
      tagline: t('subscription.tiers.proPlus.tagline'),
      businessLimit: t('subscription.tiers.proPlus.businessLimit'),
      features: [
        t('subscription.features.threeBusinessesOwned'),
        t('subscription.features.unlimitedSales'),
        t('subscription.features.advancedReporting'),
        t('subscription.features.teamCollaboration'),
      ],
      icon: TrendingUp,
    },
    {
      id: 'max',
      name: t('subscription.tiers.max.name'),
      tagline: t('subscription.tiers.max.tagline'),
      businessLimit: t('subscription.tiers.max.businessLimit'),
      features: [
        t('subscription.features.unlimitedBusinessesOwned'),
        t('subscription.features.unlimitedSales'),
        t('subscription.features.advancedReporting'),
        t('subscription.features.teamCollaboration'),
      ],
      icon: Crown,
    },
  ];

  useEffect(() => {
    if (visible) {
      setIsSheetVisible(true);
      translateY.value = withSpring(MAX_TRANSLATE_Y, {
        damping: 50,
        stiffness: 400
      });
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: (CARD_WIDTH + CARD_SPACING) * 1,
          animated: true
        });
      }, 300);
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

  const handleScroll = (event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollX / (CARD_WIDTH + CARD_SPACING));
    if (index !== currentIndex && index >= 0 && index < tiers.length) {
      setCurrentIndex(index);
      setSelectedTier(tiers[index].id);
    }
  };

  const setBillingPeriod = (tierId: TierType, period: BillingPeriod) => {
    setBillingPeriods(prev => ({
      ...prev,
      [tierId]: period
    }));
  };

  const handlePurchase = async () => {
    if (purchasing || restoring || isLoading) {
      return;
    }

    const billingPeriod = billingPeriods[selectedTier];
    const productId = productIdMapper.toAppStoreFormat(selectedTier, billingPeriod);
    const product = products.find(p => p.productId === productId);

    if (!product) {
      Alert.alert(
        t('subscription.alerts.purchaseErrorTitle'),
        'Product not found. Please try again.',
        [{ text: t('common.ok') }]
      );
      return;
    }

    setPurchasing(true);

    try {
      const success = await purchaseSubscription(product.productId);

      setPurchasing(false);

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
      setPurchasing(false);
      Alert.alert(
        t('subscription.alerts.purchaseErrorTitle'),
        t('subscription.alerts.purchaseErrorMessage'),
        [{ text: t('common.ok') }]
      );
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

  const renderTierCard = (tier: TierConfig, index: number) => {
    const isSelected = selectedTier === tier.id;
    const isCentered = currentIndex === index;
    const billingPeriod = billingPeriods[tier.id];
    const Icon = tier.icon;

    const monthlyProductId = productIdMapper.toAppStoreFormat(tier.id, 'monthly');
    const yearlyProductId = productIdMapper.toAppStoreFormat(tier.id, 'yearly');
    const monthlyProduct = products.find(p => p.productId === monthlyProductId);
    const yearlyProduct = products.find(p => p.productId === yearlyProductId);
    const currentProduct = billingPeriod === 'monthly' ? monthlyProduct : yearlyProduct;

    return (
      <View
        key={tier.id}
        style={[
          styles.tierCard,
          isDark && styles.tierCardDark,
          isCentered && styles.tierCardCentered,
          isCentered && isDark && styles.tierCardCenteredDark,
        ]}
      >
        {tier.id === 'pro_plus' && (
          <View style={styles.mostPopularBadge}>
            <Zap size={14} color="#ffffff" />
            <Text style={styles.mostPopularText}>{t('subscription.mostPopular')}</Text>
          </View>
        )}

        <View style={[styles.tierIconContainer, isDark && styles.tierIconContainerDark]}>
          <Icon size={32} color={tier.id === 'pro_plus' ? '#f59e0b' : '#3b82f6'} />
        </View>

        <Text style={[styles.tierName, isDark && styles.tierNameDark]}>
          {tier.name}
        </Text>
        <Text style={[styles.tierTagline, isDark && styles.tierTaglineDark]}>
          {tier.tagline}
        </Text>

        <View style={[styles.businessLimitBadge, isDark && styles.businessLimitBadgeDark]}>
          <Building2 size={16} color={isDark ? '#60a5fa' : '#3b82f6'} />
          <Text style={[styles.businessLimitText, isDark && styles.businessLimitTextDark]}>
            {tier.businessLimit}
          </Text>
        </View>

        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              isDark && styles.billingOptionDark,
              billingPeriod === 'monthly' && styles.billingOptionSelected,
              billingPeriod === 'monthly' && isDark && styles.billingOptionSelectedDark
            ]}
            onPress={() => setBillingPeriod(tier.id, 'monthly')}
          >
            <Text style={[
              styles.billingOptionText,
              isDark && styles.billingOptionTextDark,
              billingPeriod === 'monthly' && styles.billingOptionTextSelected
            ]}>
              {t('subscription.monthly')}
            </Text>
            {monthlyProduct && (
              <Text style={[
                styles.billingPrice,
                isDark && styles.billingPriceDark,
                billingPeriod === 'monthly' && styles.billingPriceSelected
              ]}>
                {monthlyProduct.localizedPrice}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.billingOption,
              isDark && styles.billingOptionDark,
              billingPeriod === 'yearly' && styles.billingOptionSelected,
              billingPeriod === 'yearly' && isDark && styles.billingOptionSelectedDark
            ]}
            onPress={() => setBillingPeriod(tier.id, 'yearly')}
          >
            <View style={styles.billingOptionHeader}>
              <Text style={[
                styles.billingOptionText,
                isDark && styles.billingOptionTextDark,
                billingPeriod === 'yearly' && styles.billingOptionTextSelected
              ]}>
                {t('subscription.yearly')}
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveText}>{t('subscription.saveUpTo20')}</Text>
              </View>
            </View>
            {yearlyProduct && (
              <Text style={[
                styles.billingPrice,
                isDark && styles.billingPriceDark,
                billingPeriod === 'yearly' && styles.billingPriceSelected
              ]}>
                {yearlyProduct.localizedPrice}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.featuresSection}>
          {tier.features.map((feature, idx) => (
            <View key={idx} style={styles.featureItem}>
              <Check size={16} color="#10b981" strokeWidth={3} />
              <Text style={[styles.featureText, isDark && styles.featureTextDark]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
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

              <View style={styles.header}>
                <View style={[styles.badge, isDark && styles.badgeDark]}>
                  <Zap size={18} color="#f59e0b" />
                  <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
                    {t('subscription.premium')}
                  </Text>
                </View>

                <Text style={[styles.title, isDark && styles.titleDark]}>
                  {t('subscription.choosePlan')}
                </Text>
                <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                  {t('subscription.unlockUnlimitedSales')}
                </Text>
              </View>

              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled={false}
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + CARD_SPACING}
                decelerationRate="fast"
                contentContainerStyle={[
                  styles.carouselContainer,
                  { paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2 }
                ]}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {tiers.map((tier, index) => renderTierCard(tier, index))}
              </ScrollView>

              <View style={styles.dotsContainer}>
                {tiers.map((tier, index) => (
                  <View
                    key={tier.id}
                    style={[
                      styles.dot,
                      isDark && styles.dotDark,
                      currentIndex === index && styles.dotActive
                    ]}
                  />
                ))}
              </View>

              <View style={[
                styles.actionsContainer,
                { paddingBottom: Math.max(24, insets.bottom + 24) }
              ]}>
                <Button
                  title={
                    purchasing
                      ? t('subscription.processing')
                      : t('subscription.selectPlan')
                  }
                  onPress={handlePurchase}
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
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
  carouselContainer: {
    gap: CARD_SPACING,
    paddingVertical: 20,
  },
  tierCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tierCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  tierCardCentered: {
    transform: [{ scale: 1.05 }],
    borderColor: '#3b82f6',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  tierCardCenteredDark: {
    borderColor: '#60a5fa',
  },
  mostPopularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  mostPopularText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  tierIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  tierIconContainerDark: {
    backgroundColor: '#1e3a8a',
  },
  tierName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  tierNameDark: {
    color: '#ffffff',
  },
  tierTagline: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  tierTaglineDark: {
    color: '#9ca3af',
  },
  businessLimitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 20,
  },
  businessLimitBadgeDark: {
    backgroundColor: '#1e3a8a',
  },
  businessLimitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  businessLimitTextDark: {
    color: '#93c5fd',
  },
  billingToggle: {
    gap: 8,
    marginBottom: 20,
  },
  billingOption: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  billingOptionDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  billingOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  billingOptionSelectedDark: {
    backgroundColor: '#1e3a8a',
    borderColor: '#60a5fa',
  },
  billingOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  billingOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  billingOptionTextDark: {
    color: '#9ca3af',
  },
  billingOptionTextSelected: {
    color: '#1e40af',
  },
  saveBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  billingPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  billingPriceDark: {
    color: '#ffffff',
  },
  billingPriceSelected: {
    color: '#1e40af',
  },
  featuresSection: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  featureTextDark: {
    color: '#d1d5db',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
  dotDark: {
    backgroundColor: '#4b5563',
  },
  dotActive: {
    backgroundColor: '#3b82f6',
    width: 24,
  },
  actionsContainer: {
    gap: 12,
    paddingHorizontal: 20,
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
