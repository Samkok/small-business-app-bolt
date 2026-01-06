import 'react-native-get-random-values';
import React from 'react';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { LanguageProvider } from '@/src/context/LanguageContext';
import { CartProvider } from '@/src/context/CartContext';
import { InstantCheckoutProvider } from '@/src/context/InstantCheckoutContext';
import { NotificationProvider } from '@/src/context/NotificationContext';
import { BusinessSwitchProvider } from '@/src/context/BusinessSwitchContext';
import { SaleDetailsModalProvider } from '@/src/context/SaleDetailsModalContext';
import { RevenueCatSubscriptionProvider } from '@/src/context/RevenueCatSubscriptionContext';
import '@/src/locales';

export default function RootLayout() {
  console.log('RootLayout rendering');
  useFrameworkReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RevenueCatSubscriptionProvider>
              <BusinessSwitchProvider>
                <SaleDetailsModalProvider>
                  <NotificationProvider>
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
                  </NotificationProvider>
                </SaleDetailsModalProvider>
              </BusinessSwitchProvider>
            </RevenueCatSubscriptionProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}