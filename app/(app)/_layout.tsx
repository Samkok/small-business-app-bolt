import React, { useEffect } from 'react';
import { Redirect, Stack, useRouter } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';

export default function AppLayout() {
  const { session, loading, signedOutDueToInactivity, resetInactivitySignOutFlag, userBusinesses, currentBusiness } = useAuth();
  const { refreshCarts } = useCart();
  const router = useRouter();
  
  console.log('AppLayout rendering with auth loading:', loading, 
              'session:', session ? `exists (${session.user.id})` : 'null',
              'businesses:', userBusinesses.length,
              'current business:', currentBusiness ? currentBusiness.id : 'none');

  // Refresh carts when the app screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('AppLayout: Focus effect triggered');
      if (session) {
        console.log('AppLayout: Refreshing carts for user:', session.user.id);
        refreshCarts();
      } else {
        console.log('AppLayout: Not refreshing carts, no session');
      }
      return () => {}; // Cleanup function
    }, [session, refreshCarts])
  );

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

  if (loading) {
    console.log('AppLayout: Showing loading spinner due to auth loading state');
    return <LoadingSpinner text="Loading your account..." />;
  }

  if (!session) {
    console.log('AppLayout: No session available, redirecting to sign in');
    return <Redirect href="/(auth)/signin" />;
  }

  // If user has no businesses, redirect to business selection to create one
  if (session && userBusinesses.length === 0) {
    console.log('AppLayout: No businesses available, redirecting to business selection');
    return <Redirect href="/business-selection" />;
  }

  // If user has multiple businesses but no current business is selected, redirect to business selection
  if (session && userBusinesses.length > 1 && !currentBusiness) {
    console.log('AppLayout: Multiple businesses available but no current business selected, redirecting to business selection');
    return <Redirect href="/business-selection" />;
  }

  // If user has exactly one business, set it as current and proceed to dashboard
  if (session && userBusinesses.length === 1 && !currentBusiness) {
    console.log('AppLayout: Single business available, setting as current business and proceeding to dashboard');
    // Set the single business as current business
    const singleBusiness = userBusinesses[0];
    // This will be handled by the AuthContext's determineCurrentBusiness logic
    // Just proceed to tabs since the business will be set automatically
  }
  console.log('AppLayout: Rendering tabs layout with valid session for user:', session.user.id, 'and business:', currentBusiness?.id);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="business-selection" />
    </Stack>
  );
}