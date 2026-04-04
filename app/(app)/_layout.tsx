import React, { useEffect, useRef } from 'react';
import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '@/src/locales';
import { useNetwork } from '@/src/context/NetworkContext';

export default function AppLayout() {
  const { session, loading, initialDataLoaded, signedOutDueToInactivity, resetInactivitySignOutFlag, userBusinesses, currentBusiness } = useAuth();
  const { refreshCarts } = useCart();
  const { isConnected } = useNetwork();
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();
  const alertShownRef = useRef(false);
  const hadBusinessRef = useRef(false);

  const currentRoute = segments[segments.length - 1];
  const isInAppGroup = segments.includes('(app)');

  useEffect(() => {
    if (userBusinesses.length > 0) {
      hadBusinessRef.current = true;
    }
  }, [userBusinesses]);

  useEffect(() => {
    if (!loading && !session && signedOutDueToInactivity && !alertShownRef.current) {
      alertShownRef.current = true;

      Alert.alert(
        t('alerts.sessionExpired'),
        t('alerts.sessionExpiredMessage'),
        [
          {
            text: 'OK',
            onPress: () => {
              resetInactivitySignOutFlag();
              alertShownRef.current = false;
            }
          }
        ]
      );
    }

    if (session) {
      alertShownRef.current = false;
    }
  }, [loading, session, signedOutDueToInactivity, resetInactivitySignOutFlag]);

  useEffect(() => {
    if (loading || !session || !initialDataLoaded) return;
    if (!isInAppGroup) return;

    if (!isConnected && hadBusinessRef.current && userBusinesses.length === 0) {
      console.log('AppLayout: Offline with previously known businesses, skipping redirect');
      return;
    }

    if (userBusinesses.length === 0 && currentRoute !== 'business-onboarding') {
      router.replace('/(app)/business-onboarding');
      return;
    }

    if (userBusinesses.length > 0 && !currentBusiness &&
        currentRoute !== 'business-selection' && currentRoute !== 'business-onboarding') {
      router.replace('/(app)/business-selection');
      return;
    }

    if (userBusinesses.length > 0 && currentBusiness) {
      if (currentRoute === 'business-onboarding' ||
          currentRoute === '(app)' || !currentRoute) {
        router.replace('/(app)/(tabs)');
        return;
      }
    }
  }, [loading, session, initialDataLoaded, userBusinesses, currentBusiness, currentRoute, isInAppGroup, router, isConnected]);

  if (loading || (session && !initialDataLoaded)) {
    return <LoadingSpinner text="Loading your account..." />;
  }

  if (!session) {
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