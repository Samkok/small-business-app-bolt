import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { ImageUpload } from '@/src/components/ui/ImageUpload';
import { FormSuccessMessage } from '@/src/components/ui/FormSuccessMessage';
import { storageService } from '@/src/services/storage';
import { Building2, Briefcase, LogOut, UserPlus, RefreshCw, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { businessNameSchema } from '@/src/lib/validation';
import { FieldStatus } from '@/src/hooks/useFormValidation';

export default function BusinessOnboardingScreen() {
  const [businessName, setBusinessName] = useState('');
  const [businessNameError, setBusinessNameError] = useState<string | null>(null);
  const [businessNameStatus, setBusinessNameStatus] = useState<FieldStatus>('idle');
  const [businessNameTouched, setBusinessNameTouched] = useState(false);
  const [businessImageUrl, setBusinessImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;

  const router = useRouter();
  const { t } = useTranslation();
  const subscription = useSubscription();
  const { isDark } = useTheme();
  const { createBusiness, userProfile, signOut, userBusinesses, currentBusiness, refreshUserBusinesses } = useAuth();
  const hasRedirectedRef = useRef(false);

  const validateBusinessName = (value: string) => {
    if (!value.trim()) {
      setBusinessNameError('Please enter a business name');
      setBusinessNameStatus('error');
      return false;
    }
    const result = businessNameSchema.safeParse(value);
    if (!result.success) {
      setBusinessNameError(result.error.errors[0]?.message || 'Invalid business name');
      setBusinessNameStatus('error');
      return false;
    }
    setBusinessNameError(null);
    setBusinessNameStatus('valid');
    return true;
  };

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    if (businessNameTouched) {
      validateBusinessName(value);
    }
  };

  const handleBusinessNameBlur = () => {
    setBusinessNameTouched(true);
    if (businessName) {
      validateBusinessName(businessName);
    }
  };

  const handleImageSelect = (file: any) => {
    if (Platform.OS === 'web') {
      setImageFile(file);
      setBusinessImageUrl(URL.createObjectURL(file));
    } else {
      setImageFile(file);
      setBusinessImageUrl(file.uri);
    }
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setBusinessImageUrl('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [businesses] = await Promise.all([
        refreshUserBusinesses(),
        subscription.refreshTierInfo(),
        subscription.refreshSubscriptionStatus()
      ]);

      if (businesses.length > 0) {
        Alert.alert(
          'Welcome!',
          businesses.length === 1
            ? `You've been added to ${businesses[0].business_name}`
            : `You've been added to ${businesses.length} businesses`,
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(app)/business-selection');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('BusinessOnboarding: Error refreshing businesses:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (userBusinesses.length > 0 && currentBusiness) {
      hasRedirectedRef.current = true;
      Alert.alert(
        'Welcome!',
        `You've been added to ${currentBusiness.business_name}`,
        [{ text: 'OK', onPress: () => { router.replace('/(app)/(tabs)'); } }]
      );
    }
  }, [userBusinesses, currentBusiness, router]);

  const handleCreateBusiness = async () => {
    if (!validateBusinessName(businessName)) {
      setBusinessNameTouched(true);
      return;
    }

    if (subscription.tierInfo.maxOwnedBusinesses !== null && subscription.ownedBusinessCount >= subscription.tierInfo.maxOwnedBusinesses) {
      Alert.alert(
        'Business Limit Reached',
        `You've reached your business limit of ${subscription.tierInfo.maxOwnedBusinesses} ${subscription.tierInfo.maxOwnedBusinesses === 1 ? 'business' : 'businesses'}. Upgrade your plan to create more businesses.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => subscription.showPaywall() }
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const { error, business } = await createBusiness(businessName.trim());

      if (error) {
        if (error.message?.includes('BUSINESS_LIMIT_REACHED') || error.message?.includes('maximum number of businesses')) {
          Alert.alert(
            'Business Limit Reached',
            'You\'ve reached your business limit. Please upgrade your plan to create more businesses.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => subscription.showPaywall() }
            ]
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to create business');
        }
        setLoading(false);
        return;
      }

      setCreateSuccess(true);
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }).start();

      if (imageFile && business) {
        setImageLoading(true);
        try {
          await storageService.updateBusinessImage(null, imageFile, business.id);
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
        } finally {
          setImageLoading(false);
        }
      }

      await subscription.refreshTierInfo();

      setTimeout(() => {
        router.replace('/(app)/(tabs)');
      }, 800);
    } catch (error) {
      console.error('Error creating business:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    Alert.alert(
      t('common.signOut', 'Sign Out'),
      t('onboarding.signOutConfirm', 'Are you sure you want to sign out and return to login?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.signOut', 'Sign Out'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/signin');
          }
        }
      ]
    );
  };

  const handleJoinBusiness = () => {
    Alert.alert(
      t('onboarding.joinBusinessTitle', 'Waiting for an Invite?'),
      t('onboarding.joinBusinessMessage', 'Ask your business admin to add you as a team member using your email address. Once added, pull down to refresh and the business will appear automatically.'),
      [{ text: t('common.ok', 'OK') }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={isDark ? '#f9fafb' : '#111827'}
            colors={['#2563eb']}
          />
        }
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: '#2563eb20' }]}>
            <Building2 size={48} color="#2563eb" />
          </View>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('onboarding.welcome', 'Welcome to BizManage')}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('onboarding.greeting', { name: userProfile?.full_name || '' })}
          </Text>

          <View style={[styles.refreshHint, { backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }]}>
            <RefreshCw size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.refreshHintText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {t('onboarding.pullToRefresh', 'Pull down to check if you\'ve been added to a business')}
            </Text>
          </View>
        </View>

        <Card style={styles.card}>
          <FormSuccessMessage
            visible={createSuccess}
            message="Business created successfully! Taking you to your dashboard..."
          />

          {!createSuccess && (
            <>
              <View style={styles.infoSection}>
                <Briefcase size={24} color="#2563eb" style={styles.infoIcon} />
                <View style={styles.infoText}>
                  <Text style={[styles.infoTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Create Your Business
                  </Text>
                  <Text style={[styles.infoDescription, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    A business represents your company or store in the app. You can manage products, sales, customers, and more within each business.
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]} />

              <ImageUpload
                value={businessImageUrl}
                onImageSelect={handleImageSelect}
                onImageRemove={handleImageRemove}
                loading={imageLoading}
                placeholder="Upload business logo (optional)"
                label="Business Logo"
              />

              <Input
                label="Business Name"
                value={businessName}
                onChangeText={handleBusinessNameChange}
                onBlur={handleBusinessNameBlur}
                placeholder="e.g. My Shop, Fresh Bakery"
                autoCapitalize="words"
                required
                error={businessNameTouched ? businessNameError || undefined : undefined}
                validationStatus={businessNameTouched ? businessNameStatus : 'idle'}
                hint="This is how your business will appear in the app"
                successMessage="Great name!"
              />

              <Button
                title="Create Business"
                onPress={handleCreateBusiness}
                loading={loading}
                disabled={refreshing || loading}
                style={styles.createButton}
              />

              <View style={styles.alternativeActions}>
                <Text style={[styles.orText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  or
                </Text>

                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#e5e7eb' }]}
                  onPress={handleJoinBusiness}
                >
                  <UserPlus size={20} color={isDark ? '#d1d5db' : '#6b7280'} />
                  <Text style={[styles.secondaryButtonText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    {t('onboarding.requestJoin', 'Request to Join a Business')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: isDark ? '#374151' : '#e5e7eb' }]}
                  onPress={handleBackToLogin}
                >
                  <LogOut size={20} color={isDark ? '#d1d5db' : '#6b7280'} />
                  <Text style={[styles.secondaryButtonText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Back to Login
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  You can create additional businesses later from the settings.
                </Text>
              </View>
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  refreshHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
    gap: 8,
  },
  refreshHintText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  card: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
  },
  infoSection: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginBottom: 24,
  },
  createButton: {
    marginTop: 8,
  },
  alternativeActions: {
    marginTop: 24,
    alignItems: 'center',
  },
  orText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
