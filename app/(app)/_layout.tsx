import React, { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useCart } from '@/src/context/CartContext';
import { useFocusEffect } from '@react-navigation/native';

export default function AppLayout() {
  const { session, loading } = useAuth();
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