import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT } from '@/src/services/subscriptionService';
import { supabase } from '@/src/config/supabase';
import { useAuth } from './AuthContext';
import { Paywall } from '@/src/components/subscription/Paywall';
import type { RealtimeChannel } from '@supabase/supabase-js';

let IAP: any = null;
if (Platform.OS !== 'web') {
  try {
    IAP = require('react-native-iap');
  } catch (error) {
    console.warn('react-native-iap not available:', error);
  }
}

const IOS_PRODUCT_IDS = ['bizmanage.pro.month', 'bizmanage.pro.yearly'];
const ANDROID_PRODUCT_IDS = ['bizmanage.pro.month', 'bizmanage.pro.yearly'];
const POLLING_INTERVAL_MS = 3 * 60 * 1000;

export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
  type: 'monthly' | 'yearly';
}

interface SubscriptionContextType {
  isSubscribed: boolean;
  subscriptionStatus: SubscriptionStatus;
  salesCountData: SalesCountData;
  products: SubscriptionProduct[];
  isLoading: boolean;
  isInitialized: boolean;
  canAccessFeature: boolean;

  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshSubscriptionStatus: () => Promise<void>;
  refreshSalesCount: () => Promise<void>;
  showPaywall: () => void;
  hidePaywall: () => void;
  isPaywallVisible: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, currentBusiness } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isSubscribed: false,
    subscriptionStatus: 'trial',
  });
  const [salesCountData, setSalesCountData] = useState<SalesCountData>({
    salesCount: 0,
    remainingSales: FREE_TIER_LIMIT,
    isAtLimit: false,
  });
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [canAccessFeature, setCanAccessFeature] = useState(true);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const isAppActiveRef = useRef(true);

  const initializeIAP = useCallback(async () => {
    if (Platform.OS === 'web' || !IAP) {
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    try {
      const connectionResult = await IAP.initConnection();
      console.log('IAP connection result:', connectionResult);

      if (Platform.OS === 'android') {
        await IAP.flushFailedPurchasesCachedAsPendingAndroid();
      }

      const productIds = Platform.OS === 'ios' ? IOS_PRODUCT_IDS : ANDROID_PRODUCT_IDS;
      const productsData = await IAP.getSubscriptions({ skus: productIds });

      const formattedProducts: SubscriptionProduct[] = productsData.map(product => ({
        productId: product.productId,
        title: product.title || '',
        description: product.description || '',
        price: product.price || '',
        localizedPrice: product.localizedPrice || '',
        currency: product.currency || 'USD',
        type: product.productId.includes('yearly') ? 'yearly' : 'monthly',
      }));

      setProducts(formattedProducts);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing IAP:', error);
      setIsInitialized(true);
    }
  }, []);

  const refreshSubscriptionStatus = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      const status = await subscriptionService.getSubscriptionStatus(user.id, forceRefresh);

      const isExpired = subscriptionService.isSubscriptionExpired(status);
      const actuallySubscribed = status.isSubscribed && !isExpired;

      setSubscriptionStatus({
        ...status,
        isSubscribed: actuallySubscribed,
        subscriptionStatus: isExpired ? 'expired' : status.subscriptionStatus
      });
      setIsSubscribed(actuallySubscribed);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
    }
  }, [user?.id]);

  const refreshSalesCount = useCallback(async () => {
    if (!user?.id || !currentBusiness?.id) return;

    try {
      const countData = await subscriptionService.getSalesCountData(user.id, currentBusiness.id);
      setSalesCountData(countData);
    } catch (error) {
      console.error('Error refreshing sales count:', error);
    }
  }, [user?.id, currentBusiness?.id]);

  const checkFeatureAccess = useCallback(async (forceRefresh = false) => {
    if (!user?.id || !currentBusiness?.id) {
      setCanAccessFeature(false);
      return;
    }

    try {
      const hasAccess = await subscriptionService.canAccessFeature(user.id, currentBusiness.id, forceRefresh);
      setCanAccessFeature(hasAccess);
    } catch (error) {
      console.error('Error checking feature access:', error);
      setCanAccessFeature(false);
    }
  }, [user?.id, currentBusiness?.id]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    if (!user?.id || !isAppActiveRef.current) {
      return;
    }

    console.log('[SubscriptionContext] Starting polling for subscription status');

    pollingIntervalRef.current = setInterval(async () => {
      if (!isAppActiveRef.current) {
        return;
      }

      console.log('[SubscriptionContext] Polling subscription status');
      await refreshSubscriptionStatus(true);
      if (currentBusiness?.id) {
        await refreshSalesCount();
        await checkFeatureAccess(true);
      }
    }, POLLING_INTERVAL_MS);
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshSalesCount, checkFeatureAccess]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[SubscriptionContext] Stopping polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id || Platform.OS === 'web') {
      return;
    }

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
    }

    console.log('[SubscriptionContext] Setting up realtime subscription');

    const channel = supabase
      .channel(`subscription-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('[SubscriptionContext] Received realtime update:', payload);
          await subscriptionService.clearSubscriptionCache();
          await refreshSubscriptionStatus(true);
          if (currentBusiness?.id) {
            await checkFeatureAccess(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('[SubscriptionContext] Realtime subscription status:', status);
      });

    realtimeChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, checkFeatureAccess]);

  const cleanupRealtimeSubscription = useCallback(() => {
    if (realtimeChannelRef.current) {
      console.log('[SubscriptionContext] Cleaning up realtime subscription');
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }
  }, []);

  const purchaseSubscription = useCallback(async (productId: string): Promise<boolean> => {
    if (Platform.OS === 'web' || !IAP) {
      console.log('IAP not supported on this platform');
      return false;
    }

    try {
      setIsLoading(true);

      const purchase = await IAP.requestSubscription({ sku: productId });

      if (purchase && purchase.transactionReceipt) {
        const validation = await subscriptionService.validateReceiptWithBackend(
          purchase.transactionReceipt,
          Platform.OS as 'ios' | 'android'
        );

        if (validation.isValid) {
          const success = await subscriptionService.updateSubscription(
            user!.id,
            'active',
            productId,
            validation.expiresDate || undefined,
            purchase.transactionReceipt
          );

          if (success) {
            await refreshSubscriptionStatus();
            await checkFeatureAccess();
            return true;
          }
        }
      }

      return false;
    } catch (error: any) {
      console.error('Error purchasing subscription:', error);
      if (error.code === 'E_USER_CANCELLED') {
        console.log('User cancelled purchase');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSubscriptionStatus, checkFeatureAccess]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !IAP) {
      console.log('IAP not supported on this platform');
      return false;
    }

    try {
      setIsLoading(true);

      const purchases = await IAP.getAvailablePurchases();

      if (purchases && purchases.length > 0) {
        const latestPurchase = purchases.sort((a, b) =>
          (b.transactionDate || 0) - (a.transactionDate || 0)
        )[0];

        if (latestPurchase.transactionReceipt) {
          const validation = await subscriptionService.validateReceiptWithBackend(
            latestPurchase.transactionReceipt,
            Platform.OS as 'ios' | 'android'
          );

          if (validation.isValid) {
            const success = await subscriptionService.updateSubscription(
              user!.id,
              'active',
              latestPurchase.productId,
              validation.expiresDate || undefined,
              latestPurchase.transactionReceipt
            );

            if (success) {
              await refreshSubscriptionStatus();
              await checkFeatureAccess();
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSubscriptionStatus, checkFeatureAccess]);

  const showPaywall = useCallback(() => {
    setIsPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setIsPaywallVisible(false);
  }, []);

  useEffect(() => {
    initializeIAP();

    return () => {
      if (Platform.OS !== 'web' && IAP) {
        try {
          IAP.endConnection();
        } catch (error) {
          console.warn('Error ending IAP connection:', error);
        }
      }
    };
  }, [initializeIAP]);

  useEffect(() => {
    if (user?.id) {
      refreshSubscriptionStatus();
    }
  }, [user?.id, refreshSubscriptionStatus]);

  useEffect(() => {
    if (user?.id && currentBusiness?.id) {
      refreshSalesCount();
      checkFeatureAccess();
    }
  }, [user?.id, currentBusiness?.id, refreshSalesCount, checkFeatureAccess]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const isActive = nextAppState === 'active';
      isAppActiveRef.current = isActive;

      if (isActive && user?.id) {
        console.log('[SubscriptionContext] App became active, refreshing data');
        refreshSubscriptionStatus(true);
        if (currentBusiness?.id) {
          refreshSalesCount();
          checkFeatureAccess(true);
        }
        startPolling();
      } else {
        console.log('[SubscriptionContext] App became inactive, stopping polling');
        stopPolling();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshSalesCount, checkFeatureAccess, startPolling, stopPolling]);

  useEffect(() => {
    if (user?.id && isAppActiveRef.current) {
      startPolling();
      setupRealtimeSubscription();
    }

    return () => {
      stopPolling();
      cleanupRealtimeSubscription();
    };
  }, [user?.id, startPolling, stopPolling, setupRealtimeSubscription, cleanupRealtimeSubscription]);

  useEffect(() => {
    if (isInitialized) {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const value: SubscriptionContextType = {
    isSubscribed,
    subscriptionStatus,
    salesCountData,
    products,
    isLoading,
    isInitialized,
    canAccessFeature,
    purchaseSubscription,
    restorePurchases,
    refreshSubscriptionStatus,
    refreshSalesCount,
    showPaywall,
    hidePaywall,
    isPaywallVisible,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <Paywall
        visible={isPaywallVisible}
        onClose={hidePaywall}
        canClose={true}
      />
    </SubscriptionContext.Provider>
  );
};
