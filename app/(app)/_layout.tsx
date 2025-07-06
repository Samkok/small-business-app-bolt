import React, { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';

export default function AppLayout() {
  const { session, loading, signedOutDueToInactivity, resetInactivitySignOutFlag } = useAuth();
  const { refreshCarts, loading: cartsLoading } = useCart();
  console.log('AppLayout rendering with auth loading:', loading, 'session:', session ? `exists (${session?.user?.id})` : 'null');

  // Refresh carts when the app screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('AppLayout: Focus effect triggered');
      if (session) {
        console.log('AppLayout: Refreshing carts for user:', session?.user?.id);
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

  if (!session) {
    console.log('AppLayout: No session available, redirecting to signin');
    return <Redirect href="/(auth)/signin" />;
  }

  // Show loading spinner if carts are still loading
  if (cartsLoading) {
    console.log('AppLayout: Showing loading spinner due to carts loading state');
    return <LoadingSpinner text="Loading your data..." />;
  }

  console.log('AppLayout: Rendering tabs layout with valid session for user:', session.user.id);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}