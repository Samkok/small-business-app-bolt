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
import { useTranslation } from 'react-i18next';
import { X, ShieldAlert } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.55;

interface UnauthorizedUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UnauthorizedUpgradeModal: React.FC<UnauthorizedUpgradeModalProps> = ({
  visible,
  onClose
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const [isSheetVisible, setIsSheetVisible] = useState(false);

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
                  <ShieldAlert size={36} color="#ef4444" />
                </View>

                <Text style={[styles.title, isDark && styles.titleDark]}>
                  {t('subscription.unauthorizedUpgrade.title')}
                </Text>

                <Text style={[styles.message, isDark && styles.messageDark]}>
                  {t('subscription.unauthorizedUpgrade.message')}
                </Text>

                <View style={[styles.infoBox, isDark && styles.infoBoxDark]}>
                  <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
                    {t('subscription.unauthorizedUpgrade.info')}
                  </Text>
                </View>

                <Button
                  title={t('common.understood')}
                  onPress={handleClose}
                  style={styles.button}
                />
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
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconContainerDark: {
    backgroundColor: '#7f1d1d',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  titleDark: {
    color: '#ffffff',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  messageDark: {
    color: '#9ca3af',
  },
  infoBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoBoxDark: {
    backgroundColor: '#111827',
    borderLeftColor: '#60a5fa',
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  infoTextDark: {
    color: '#d1d5db',
  },
  button: {
    marginBottom: 0,
  },
});
