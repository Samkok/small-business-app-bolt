import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback
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
import { X, Lock, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Button } from '@/src/components/ui/Button';
import { FREE_TIER_LIMIT } from '@/src/services/subscriptionService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.75;

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

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const monthlyProduct = products.find(p => p.type === 'monthly');
  const yearlyProduct = products.find(p => p.type === 'yearly');

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
      if (event.translationY > 100) {
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

  if (!isSheetVisible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, rBackdropStyle]} />
        </TouchableWithoutFeedback>

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.bottomSheetContainer, rBottomSheetStyle]}>
            <View style={[styles.bottomSheet, isDark && styles.bottomSheetDark]}>
              <View style={styles.dragIndicatorContainer}>
                <View style={[styles.dragIndicator, isDark && styles.dragIndicatorDark]} />
              </View>

              <TouchableOpacity
                style={[styles.closeButton, isDark && styles.closeButtonDark]}
                onPress={handleClose}
              >
                <X size={20} color={isDark ? '#ffffff' : '#000000'} />
              </TouchableOpacity>

              <View style={[
                styles.content,
                { paddingBottom: Math.max(24, insets.bottom + 24) }
              ]}>
                <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
                  <Lock size={36} color="#f59e0b" />
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

                <TouchableOpacity onPress={handleClose} style={styles.laterButton}>
                  <Text style={[styles.laterText, isDark && styles.laterTextDark]}>
                    Maybe Later
                  </Text>
                </TouchableOpacity>
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
  content: {
    padding: 24,
    paddingTop: 8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
