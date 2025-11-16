import React, { useEffect } from 'react';
import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';

export default function AppLayout() {
  const { session, loading, signedOutDueToInactivity, resetInactivitySignOutFlag, userBusinesses, currentBusiness } = useAuth();
  const { refreshCarts } = useCart();
  const router = useRouter();
  const segments = useSegments();

  const currentRoute = segments[segments.length - 1];
  const isInAppGroup = segments.includes('(app)');

  console.log('AppLayout rendering with auth loading:', loading,
              'session:', session ? `exists (${session.user.id})` : 'null',
              'businesses:', userBusinesses.length,
              'current business:', currentBusiness ? currentBusiness.id : 'none',
              'current route:', currentRoute,
              'segments:', segments);

  // Refresh carts when the app screen comes into focus


  // Show inactivity alert when session expires
  useEffect(() => {
    if (!loading && !session && signedOutDueToInactivity) {
      Alert.alert(
        'Session Expired',
        'Your session has expired due to inactivity. Please sign in again.',
        [
          {
            text: 'OK',
            onPress: resetInactivitySignOutFlag
          }
        ]
      );
    }
  }, [loading, session, signedOutDueToInactivity, resetInactivitySignOutFlag]);

  // Handle business context navigation
  useEffect(() => {
    if (loading || !session) return;

    // Skip navigation if we're not in the app group yet
    if (!isInAppGroup) return;

    // If user has no businesses and not already on business-onboarding
    if (userBusinesses.length === 0 && currentRoute !== 'business-onboarding') {
      console.log('AppLayout: User has no businesses, navigating to business onboarding');
      router.replace('/(app)/business-onboarding');
      return;
    }

    // If user has businesses but no current business is set, and not on business-selection or business-onboarding
    if (userBusinesses.length > 0 && !currentBusiness &&
        currentRoute !== 'business-selection' && currentRoute !== 'business-onboarding') {
      console.log('AppLayout: No current business set, navigating to business selection');
      router.replace('/(app)/business-selection');
      return;
    }

    // If user has businesses and current business is set, ensure they're directed to tabs
    // Only redirect if they're on onboarding/selection screens or the base (app) route
    if (userBusinesses.length > 0 && currentBusiness) {
      if (currentRoute === 'business-onboarding' || currentRoute === 'business-selection' ||
          currentRoute === '(app)' || !currentRoute) {
        console.log('AppLayout: User has business context, navigating to main tabs');
        router.replace('/(app)/(tabs)');
        return;
      }
    }
  }, [loading, session, userBusinesses.length, currentBusiness, currentRoute, isInAppGroup, router]);

  if (loading) {
    console.log('AppLayout: Showing loading spinner due to auth loading state');
    return <LoadingSpinner text="Loading your account..." />;
  }

  if (!session) {
    console.log('AppLayout: No session available, redirecting to sign in');
    return <Redirect href="/(auth)/signin" />;
  }

  console.log('AppLayout: Rendering stack layout');
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="business-onboarding" />
      <Stack.Screen name="business-selection" />
      <Stack.Screen name="top-customers" />
      <Stack.Screen name="top-products" />
      <Stack.Screen name="customer-orders/[customerId]" />
    </Stack>
  );
}