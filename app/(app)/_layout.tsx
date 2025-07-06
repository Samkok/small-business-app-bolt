import React, { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';

export default function AppLayout() {
  const { session, loading, signedOutDueToInactivity, resetInactivitySignOutFlag } = useAuth();
  const { refreshCarts } = useCart();
  console.log('AppLayout rendering with auth loading:', loading, 'session:', session ? 'exists' : 'null');

  // Refresh carts when the app screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('AppLayout: Focus effect triggered');
      if (session) {
        console.log('AppLayout: Refreshing carts for session');
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
    return <LoadingSpinner text="Loading..." />;
  }

  if (!session) {
    console.log('AppLayout: Redirecting to signin due to no session');
    return <Redirect href="/(auth)/signin" />;
  }

  console.log('AppLayout: Rendering tabs layout with valid session');
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}