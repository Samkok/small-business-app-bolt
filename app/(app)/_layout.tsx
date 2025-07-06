import React, { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { Alert, AppState } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';

// Timeout duration for profile loading (in milliseconds)
const PROFILE_LOADING_TIMEOUT = 10000;

export default function AppLayout() {
  const { session, profile, loading, signedOutDueToInactivity, resetInactivitySignOutFlag } = useAuth();
  const { refreshCarts } = useCart();
  console.log('AppLayout rendering with auth loading:', loading, 'session:', session ? `exists (${session.user.id})` : 'null');
  console.log('AppLayout profile status:', profile ? `loaded (${profile.id})` : 'not loaded');

  // Set up a timeout to prevent getting stuck in loading state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (loading && session) {
      console.log('AppLayout: Setting up profile loading timeout');
      timeoutId = setTimeout(() => {
        console.log('AppLayout: Profile loading timeout reached');
        Alert.alert(
          'Profile Loading Error',
          'Unable to load your profile. Please sign out and try again.',
          [
            {
              text: 'Sign Out',
              onPress: async () => {
                try {
                  const { signOut } = useAuth();
                  await signOut();
                } catch (error) {
                  console.error('Error signing out:', error);
                }
              }
            }
          ]
        );
      }, PROFILE_LOADING_TIMEOUT);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, session]);

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
  
  // Check if session exists but profile failed to load
  if (session && !profile) {
    console.log('AppLayout: Session exists but profile failed to load, redirecting to signin');
    return <Redirect href="/(auth)/signin" />;
  }

  if (!session) {
    console.log('AppLayout: No session available, redirecting to signin');
    return <Redirect href="/(auth)/signin" />;
  }

  console.log('AppLayout: Rendering tabs layout with valid session for user:', session.user.id);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}