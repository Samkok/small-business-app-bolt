import 'react-native-get-random-values'; // Add this at the very top
import React from 'react';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/src/context/AuthContext';
import { useAuth } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { CartProvider } from '@/src/context/CartContext';
import { SplashScreen } from '@/src/components/ui/SplashScreen';
import '@/src/locales';

function RootLayoutContent() {
  const { splashLoading } = useAuth();
  
  if (splashLoading) {
    return <SplashScreen />;
  }
  
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  console.log('RootLayout rendering');
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <RootLayoutContent />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}