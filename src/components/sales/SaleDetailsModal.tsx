import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { X, ArrowLeft } from 'lucide-react-native';
import { salesService } from '@/src/services/sales';
import SaleDetailsContent from './SaleDetailsContent';

interface SaleDetailsModalProps {
  visible: boolean;
  saleId: string | null;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 100;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.5,
  overshootClamping: false,
  restSpeedThreshold: 0.01,
  restDisplacementThreshold: 0.01,
};

const TIMING_CONFIG = {
  duration: 250,
};

export default function SaleDetailsModal({ visible, saleId, onClose }: SaleDetailsModalProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentBusiness, userProfile } = useAuth();

  const [sale, setSale] = useState<any>(null);
  const [saleDetails, setSaleDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voidingInProgress, setVoidingInProgress] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);

  const isMountedRef = useRef(true);

  const MODAL_HEIGHT = SCREEN_HEIGHT - insets.top - 20;

  const translateY = useSharedValue(MODAL_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      isMountedRef.current = true;
      translateY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, TIMING_CONFIG);
      if (saleId) {
        loadSaleDetails();
      }
    } else {
      isMountedRef.current = false;
      translateY.value = withTiming(MODAL_HEIGHT, TIMING_CONFIG);
      backdropOpacity.value = withTiming(0, TIMING_CONFIG);
      // Reset state when modal closes
      setTimeout(() => {
        setSale(null);
        setSaleDetails(null);
        setLoading(true);
        setShowReturnForm(false);
        setShowVoidModal(false);
      }, 300);
    }
  }, [visible, saleId]);

  const loadSaleDetails = async () => {
    if (!saleId) return;

    setLoading(true);
    try {
      const [saleData, detailsData] = await Promise.all([
        salesService.getSale(saleId),
        salesService.getSaleWithDiscountBreakdown(saleId)
      ]);

      // Only update state if modal is still visible
      if (isMountedRef.current) {
        setSale(saleData);
        setSaleDetails(detailsData);
      }
    } catch (error) {
      console.error('Error loading sale details:', error);
      if (isMountedRef.current) {
        Alert.alert('Error', 'Failed to load sale details');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    translateY.value = withTiming(MODAL_HEIGHT, TIMING_CONFIG, () => {
      runOnJS(onClose)();
    });
    backdropOpacity.value = withTiming(0, TIMING_CONFIG);
  }, [onClose, translateY, backdropOpacity]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        translateY.value = withTiming(MODAL_HEIGHT, TIMING_CONFIG, () => {
          runOnJS(handleClose)();
        });
        backdropOpacity.value = withTiming(0, TIMING_CONFIG);
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.value,
    };
  });

  const handleBackdropPress = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleVoidSale = () => {
    if (!currentBusiness?.id || !sale) return;
    setShowVoidModal(true);
  };

  const handleVoidSaleConfirm = async (options: {
    reason: string;
    includeDeliveryCost: boolean;
    lossAmount?: number;
    lossPercentage?: number;
    lossType?: 'fixed' | 'percentage';
  }) => {
    if (!sale || !userProfile) return;

    setVoidingInProgress(true);
    try {
      await salesService.voidSale(
        sale.id,
        options.reason,
        userProfile.user_id,
        currentBusiness || undefined,
        currentBusiness ? [currentBusiness] : undefined,
        {
          includeDeliveryCost: options.includeDeliveryCost,
          lossAmount: options.lossAmount,
          lossPercentage: options.lossPercentage,
          lossType: options.lossType,
        }
      );
      setShowVoidModal(false);
      Alert.alert('Success', 'Sale voided successfully');
      await loadSaleDetails();
    } catch (error) {
      console.error('Error voiding sale:', error);
      Alert.alert('Error', 'Failed to void sale');
    } finally {
      setVoidingInProgress(false);
    }
  };

  const handleReturnItems = () => {
    setShowReturnForm(true);
  };

  const handleReturnComplete = () => {
    setShowReturnForm(false);
    loadSaleDetails();
  };

  const handleCancelReturn = () => {
    setShowReturnForm(false);
  };

  const handleCancelVoid = () => {
    setShowVoidModal(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#111827' : '#f9fafb',
                height: MODAL_HEIGHT,
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom
              },
              modalAnimatedStyle
            ]}
          >
            {/* Modal Header */}
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: isDark ? '#4b5563' : '#d1d5db' }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleClose}
                activeOpacity={0.6}
              >
                <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Sale Details
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                activeOpacity={0.6}
              >
                <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
              </TouchableOpacity>
            </View>

            {/* Sale Details Content */}
            <SaleDetailsContent
              sale={sale}
              saleDetails={saleDetails}
              loading={loading}
              voidingInProgress={voidingInProgress}
              showReturnForm={showReturnForm}
              showVoidModal={showVoidModal}
              onVoidSale={handleVoidSale}
              onVoidSaleConfirm={handleVoidSaleConfirm}
              onReturnItems={handleReturnItems}
              onReturnComplete={handleReturnComplete}
              onCancelReturn={handleCancelReturn}
              onCancelVoid={handleCancelVoid}
              userProfile={userProfile}
              currentBusiness={currentBusiness}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  closeButton: {
    padding: 4,
  },
});
