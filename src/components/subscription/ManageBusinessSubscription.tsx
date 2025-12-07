import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  Platform,
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
import { X, Building2, CheckSquare, Square, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import { supabase } from '@/src/config/supabase';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT * 0.75;

interface Business {
  id: string;
  business_name: string;
  business_image_url?: string;
  access_state: 'active' | 'read_only_sales';
}

interface ManageBusinessSubscriptionProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const ManageBusinessSubscription: React.FC<ManageBusinessSubscriptionProps> = ({
  visible,
  onClose,
  onComplete,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { userBusinesses, userProfile } = useAuth();
  const { tierInfo } = useSubscription();

  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const businesses = useMemo(() => {
    return userBusinesses.map(b => ({
      id: b.id,
      business_name: b.business_name,
      business_image_url: b.business_image_url,
      access_state: (b as any).access_state || 'active',
    })) as Business[];
  }, [userBusinesses]);

  const activeBusinesses = useMemo(() =>
    businesses.filter(b => b.access_state === 'active'),
    [businesses]
  );

  const maxActiveBusinesses = tierInfo.maxOwnedBusinesses || 1;
  const currentActiveCount = activeBusinesses.length;
  const availableSlots = Math.max(0, maxActiveBusinesses - selectedBusinessIds.size);

  useEffect(() => {
    if (visible) {
      const initialActive = new Set(activeBusinesses.map(b => b.id));
      setSelectedBusinessIds(initialActive);
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

  const toggleBusinessSelection = (businessId: string, currentlyActive: boolean) => {
    const newSelection = new Set(selectedBusinessIds);

    if (newSelection.has(businessId)) {
      if (newSelection.size <= 1) {
        Alert.alert('Cannot Deactivate', 'You must have at least one active business.');
        return;
      }
      newSelection.delete(businessId);
    } else {
      if (newSelection.size >= maxActiveBusinesses) {
        Alert.alert(
          'Tier Limit Reached',
          'To activate another business, please deactivate one first or upgrade your subscription plan.'
        );
        return;
      }
      newSelection.add(businessId);
    }

    setSelectedBusinessIds(newSelection);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleApplyChanges = async () => {
    const initialActiveIds = new Set(activeBusinesses.map(b => b.id));
    const hasChanges =
      selectedBusinessIds.size !== initialActiveIds.size ||
      Array.from(selectedBusinessIds).some(id => !initialActiveIds.has(id));

    if (!hasChanges) {
      handleClose();
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('choose-businesses', {
        body: {
          userId: userProfile?.user_id,
          selectedBusinessIds: Array.from(selectedBusinessIds),
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', 'Business access settings updated successfully.');

      handleClose();
      onComplete();
    } catch (error: any) {
      console.error('Error updating business selection:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update business settings. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const getStatusText = () => {
    if (selectedBusinessIds.size < maxActiveBusinesses) {
      const remaining = maxActiveBusinesses - selectedBusinessIds.size;
      return `You can activate ${remaining} more business(es)`;
    } else if (selectedBusinessIds.size === maxActiveBusinesses) {
      return 'Tier limit reached. To activate another, please deactivate one first.';
    }
    return '';
  };

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
            <View style={[styles.bottomSheet, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
              <View style={styles.dragIndicatorContainer}>
                <View style={[styles.dragIndicator, { backgroundColor: isDark ? '#4b5563' : '#d1d5db' }]} />
              </View>

              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                onPress={handleClose}
              >
                <X size={20} color={isDark ? '#ffffff' : '#000000'} />
              </TouchableOpacity>

              <View style={[
                styles.content,
                { paddingBottom: Math.max(24, insets.bottom + 24) }
              ]}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? '#1e3a8a' : '#dbeafe' }]}>
                  <Building2 size={36} color={isDark ? '#60a5fa' : '#2563eb'} />
                </View>

                <Text style={[styles.title, { color: isDark ? '#ffffff' : '#111827' }]}>
                  Manage Businesses Subscription
                </Text>

                <View style={[styles.infoCard, {
                  backgroundColor: isDark ? '#111827' : '#f9fafb',
                  borderColor: isDark ? '#374151' : '#e5e7eb',
                }]}>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      Subscription Tier:
                    </Text>
                    <Text style={[styles.infoValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {tierInfo.tier === 'free' ? 'Free' : tierInfo.tier === 'basic' ? 'Basic' : 'Premium'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      Max Active Businesses:
                    </Text>
                    <Text style={[styles.infoValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {maxActiveBusinesses}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      Currently Active:
                    </Text>
                    <Text style={[styles.infoValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {selectedBusinessIds.size}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      Available Slots:
                    </Text>
                    <Text style={[styles.infoValue, { color: availableSlots > 0 ? '#22c55e' : '#ef4444' }]}>
                      {availableSlots}
                    </Text>
                  </View>
                </View>

                {getStatusText() && (
                  <View style={[styles.statusBox, {
                    backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
                    borderColor: isDark ? '#2563eb' : '#60a5fa',
                  }]}>
                    <AlertCircle size={16} color={isDark ? '#60a5fa' : '#2563eb'} />
                    <Text style={[styles.statusText, { color: isDark ? '#93c5fd' : '#1e40af' }]}>
                      {getStatusText()}
                    </Text>
                  </View>
                )}

                <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Select Active Businesses
                </Text>

                <ScrollView
                  style={styles.businessList}
                  showsVerticalScrollIndicator={false}
                >
                  {businesses.map((business) => {
                    const isSelected = selectedBusinessIds.has(business.id);
                    return (
                      <TouchableOpacity
                        key={business.id}
                        style={[
                          styles.businessItem,
                          {
                            backgroundColor: isDark ? '#374151' : '#ffffff',
                            borderColor: isSelected ? '#2563eb' : (isDark ? '#4b5563' : '#e5e7eb'),
                          }
                        ]}
                        onPress={() => toggleBusinessSelection(business.id, business.access_state === 'active')}
                      >
                        <View style={styles.businessLeft}>
                          <View style={styles.businessIconContainer}>
                            {business.business_image_url ? (
                              <OptimizedImage
                                source={{ uri: business.business_image_url }}
                                style={styles.businessImage}
                                resizeMode="cover"
                                alt={business.business_name}
                              />
                            ) : (
                              <View style={[styles.businessIconPlaceholder, { backgroundColor: '#2563eb20' }]}>
                                <Building2 size={20} color="#2563eb" />
                              </View>
                            )}
                          </View>
                          <View style={styles.businessInfo}>
                            <Text style={[styles.businessName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                              {business.business_name}
                            </Text>
                            <View style={[
                              styles.statusBadge,
                              {
                                backgroundColor: isSelected
                                  ? (isDark ? '#065f46' : '#d1fae5')
                                  : (isDark ? '#78350f' : '#fef3c7')
                              }
                            ]}>
                              <Text style={[
                                styles.statusBadgeText,
                                {
                                  color: isSelected
                                    ? (isDark ? '#6ee7b7' : '#047857')
                                    : (isDark ? '#fbbf24' : '#92400e')
                                }
                              ]}>
                                {isSelected ? 'Active' : 'Read Only'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.businessRight}>
                          {isSelected ? (
                            <CheckSquare size={24} color="#2563eb" />
                          ) : (
                            <Square size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={[styles.infoNote, {
                  backgroundColor: isDark ? '#111827' : '#f9fafb',
                  borderLeftColor: isDark ? '#60a5fa' : '#3b82f6',
                }]}>
                  <Text style={[styles.infoNoteText, { color: isDark ? '#d1d5db' : '#374151' }]}>
                    <Text style={{ fontWeight: '600' }}>Active:</Text> Full access to create sales, expenses, and manage inventory.{'\n\n'}
                    <Text style={{ fontWeight: '600' }}>Read Only:</Text> Can view data but cannot create new records.
                  </Text>
                </View>

                <Button
                  title={saving ? 'Applying Changes...' : 'Apply Changes'}
                  onPress={handleApplyChanges}
                  loading={saving}
                  disabled={saving}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    padding: 24,
    paddingTop: 8,
    flex: 1,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  businessList: {
    maxHeight: SCREEN_HEIGHT * 0.3,
    marginBottom: 16,
  },
  businessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  businessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  businessImage: {
    width: '100%',
    height: '100%',
  },
  businessIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  businessRight: {
    marginLeft: 12,
  },
  infoNote: {
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 20,
  },
  infoNoteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    marginBottom: 0,
  },
});
