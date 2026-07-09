import { useFrameworkReady } from '@/hooks/useFrameworkReady'import 'react-native-get-random-values';
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
import { SubscriptionProvider } from '@/src/context/SubscriptionContext';
import { NetworkProvider } from '@/src/context/NetworkContext';
import { CurrencyProvider } from '@/src/context/CurrencyContext';
import { ReferralProvider } from '@/src/context/ReferralContext';
import { NetworkBanner } from '@/src/components/ui/NetworkBanner';
import { PendingSalesSyncModal } from '@/src/components/sales/PendingSalesSyncModal';
import '@/src/locales';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <NetworkProvider>
            <AuthProvider>
              <CurrencyProvider>
              <ReferralProvider>
              <SubscriptionProvider>
                <BusinessSwitchProvider>
                  <SaleDetailsModalProvider>
                    <NotificationProvider>
                      <CartProvider>
                        <InstantCheckoutProvider>
                          <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="(auth)" />
                            <Stack.Screen name="(app)" />
                            <Stack.Screen name="refer/[code]" />
                            <Stack.Screen name="+not-found" />
                          </Stack>
                          <NetworkBanner />
                          <PendingSalesSyncModal />
                          <StatusBar style="auto" />
                        </InstantCheckoutProvider>
                      </CartProvider>
                    </NotificationProvider>
                  </SaleDetailsModalProvider>
                </BusinessSwitchProvider>
              </SubscriptionProvider>
              </ReferralProvider>
              </CurrencyProvider>
            </AuthProvider>
          </NetworkProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}