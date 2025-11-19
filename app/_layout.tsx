import 'react-native-get-random-values';
import React from 'react';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { CartProvider } from '@/src/context/CartContext';
import { InstantCheckoutProvider } from '@/src/context/InstantCheckoutContext';
import '@/src/locales';

export default function RootLayout() {
  console.log('RootLayout rendering');
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <InstantCheckoutProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </InstantCheckoutProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}