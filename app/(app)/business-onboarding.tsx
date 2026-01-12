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
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { ImageUpload } from '@/src/components/ui/ImageUpload';
import { storageService } from '@/src/services/storage';
import { Building2, Briefcase, ArrowRight, LogOut, UserPlus, RefreshCw } from 'lucide-react-native';
import { useSubscription } from '@/src/context/SubscriptionContext';

export default function BusinessOnboardingScreen() {
  const [businessName, setBusinessName] = useState('');
  const [businessImageUrl, setBusinessImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const { t } = useTranslation();
  const subscription = useSubscription();
  const { isDark } = useTheme();
  const { createBusiness, userProfile, signOut, userBusinesses, currentBusiness, refreshUserBusinesses } = useAuth();
  const hasRedirectedRef = useRef(false);

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
      console.log('BusinessOnboarding: Manual refresh triggered');
      const [businesses] = await Promise.all([
        refreshUserBusinesses(),
        subscription.refreshTierInfo(),
        subscription.refreshSubscriptionStatus()
      ]);

      // Check if user has been added to any businesses
      if (businesses.length > 0) {
        console.log('BusinessOnboarding: Businesses found after refresh:', businesses.length);

        // Redirect to business selection page
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
      } else {
        console.log('BusinessOnboarding: No businesses found after refresh');
      }
    } catch (error) {
      console.error('BusinessOnboarding: Error refreshing businesses:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-redirect when user is added to a business
  useEffect(() => {
    // Prevent duplicate redirects
    if (hasRedirectedRef.current) {
      return;
    }

    // If user has businesses and a current business is set, redirect to main app
    if (userBusinesses.length > 0 && currentBusiness) {
      console.log('BusinessOnboarding: User has been added to a business, auto-redirecting to main app');
      console.log('BusinessOnboarding: Business details:', {
        businessCount: userBusinesses.length,
        currentBusinessId: currentBusiness.id,
        currentBusinessName: currentBusiness.business_name,
      });

      hasRedirectedRef.current = true;

      // Show alert to notify user
      Alert.alert(
        'Welcome!',
        `You've been added to ${currentBusiness.business_name}`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(app)/(tabs)');
            }
          }
        ]
      );
    }
  }, [userBusinesses, currentBusiness, router]);

  const handleCreateBusiness = async () => {
    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter a business name');
      return;
    }

    // Check business limit before attempting creation
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
        // Check if it's a business limit error from server
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

      // If image was selected, upload it
      if (imageFile && business) {
        setImageLoading(true);
        try {
          const uploadResult = await storageService.updateBusinessImage(
            null,
            imageFile,
            business.id
          );

          // Update business with image URL (this will be handled by the context)
          console.log('Business image uploaded:', uploadResult.url);
        } catch (imageError) {
          console.error('Error uploading image:', imageError);
          // Don't block the flow if image upload fails
        } finally {
          setImageLoading(false);
        }
      }

      // Refresh subscription data to update owned business count
      await subscription.refreshTierInfo();

      // Navigate to the main app
      router.replace('/(app)/(tabs)');
    } catch (error) {
      console.error('Error creating business:', error);
      Alert.alert('Error', 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out and return to login?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
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
      'Coming Soon',
      'The ability to join an existing business will be available soon. For now, please create a new business or contact your business administrator.',
      [{ text: 'OK' }]
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
            Welcome to BizManage
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Hello {userProfile?.full_name}! Let's set up your first business
          </Text>

          <View style={[styles.refreshHint, { backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }]}>
            <RefreshCw size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.refreshHintText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Pull down to check if you've been added to a business
            </Text>
          </View>
        </View>

        <Card style={styles.card}>
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

          <View style={styles.divider} />

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
            onChangeText={setBusinessName}
            placeholder="Enter your business name"
            autoCapitalize="words"
            required
          />

          <Button
            title="Create Business"
            onPress={handleCreateBusiness}
            loading={loading}
            disabled={refreshing}
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
                Request to Join a Business
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
    backgroundColor: '#e5e7eb',
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
