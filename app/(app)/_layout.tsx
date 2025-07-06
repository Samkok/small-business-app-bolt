import React, { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';
import { SplashScreen } from '@/src/components/ui/SplashScreen';

export default function AppLayout() {
  const { session, profile, loading, signedOutDueToInactivity, resetInactivitySignOutFlag, splashLoading } = useAuth();
  const { refreshCarts } = useCart();
  console.log('AppLayout rendering with auth loading:', loading, 'session:', session ? `exists (${session.user.id})` : 'null', 'profile:', profile ? `exists (${profile.id})` : 'null');

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

  if (splashLoading) {
    return <SplashScreen />;
  }

  if (loading) {
    console.log('AppLayout: Showing loading spinner due to auth loading state');
    return <LoadingSpinner text="Loading your account..." />;
  }

  if (!session || (session && !profile && !loading)) {
    console.log('AppLayout: No session or session exists but no profile, redirecting to signin');
    return <Redirect href="/(auth)/signin" />;
  }

  console.log('AppLayout: Rendering tabs layout with valid session for user:', session.user.id);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}