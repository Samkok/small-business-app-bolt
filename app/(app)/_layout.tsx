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

  // Refresh carts when the app screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (session) {
        refreshCarts();
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
    return <LoadingSpinner text="Loading..." />;
  }

  if (!session) {
    return <Redirect href="/(auth)/signin" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}