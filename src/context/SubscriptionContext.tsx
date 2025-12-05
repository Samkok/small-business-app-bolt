import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT, TierInfo, SubscriptionTier } from '@/src/services/subscriptionService';
import { supabase } from '@/src/config/supabase';
import { useAuth } from './AuthContext';
import { Paywall } from '@/src/components/subscription/Paywall';
import { UnauthorizedUpgradeModal } from '@/src/components/subscription/UnauthorizedUpgradeModal';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { productIdMapper } from '@/src/utils/productIdMapper';
import { iapService } from '@/src/services/iapService';

const IOS_PRODUCT_IDS = [
  'bizmanage.pro.month',
  'bizmanage.pro.year',
  'bizmanage.pro_plus.month',
  'bizmanage.pro_plus.year',
  'bizmanage.max.month',
  'bizmanage.max.year'
];
const ANDROID_PRODUCT_IDS = [
  'bizmanage.pro.month',
  'bizmanage.pro.year',
  'bizmanage.pro_plus.month',
  'bizmanage.pro_plus.year',
  'bizmanage.max.month',
  'bizmanage.max.year'
];

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
  tierInfo: TierInfo;
  ownedBusinessCount: number;
  isIAPAvailable: boolean;

  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshSubscriptionStatus: () => Promise<void>;
  refreshSalesCount: () => Promise<void>;
  refreshTierInfo: () => Promise<void>;
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
  const [tierInfo, setTierInfo] = useState<TierInfo>({
    tier: 'free',
    maxOwnedBusinesses: null,
    subscriptionStatus: 'trial',
    expirationDate: null
  });
  const [ownedBusinessCount, setOwnedBusinessCount] = useState(0);
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [isUnauthorizedModalVisible, setIsUnauthorizedModalVisible] = useState(false);
  const [canAccessFeature, setCanAccessFeature] = useState(true);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const salesCountChannelRef = useRef<RealtimeChannel | null>(null);
  const isAppActiveRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const isReconnectingRef = useRef(false);
  const realtimeDisabledRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const initializeIAP = useCallback(async () => {
    console.log("[SubscriptionContext] InitializeIAP Start Here");
    if (Platform.OS === 'web') {
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    try {
      const connectionResult = await iapService.initConnection();
      console.log('[SubscriptionContext] IAP connection result:', connectionResult);

      if (Platform.OS === 'android') {
        await iapService.flushFailedPurchasesCachedAsPendingAndroid();
      }

      const productIds = Platform.OS === 'ios' ? IOS_PRODUCT_IDS : ANDROID_PRODUCT_IDS;
      const productsData = await iapService.getSubscriptions({ skus: productIds });

      const formattedProducts: SubscriptionProduct[] = productsData.map(product => ({
        productId: product.productId,
        title: product.title || '',
        description: product.description || '',
        price: product.price || '',
        localizedPrice: product.localizedPrice || '',
        currency: product.currency || 'USD',
        type: productIdMapper.detectPeriod(product.productId),
      }));

      setProducts(formattedProducts);
      setIsInitialized(true);

      if (!iapService.isAvailable()) {
        console.log('[SubscriptionContext] IAP not available - subscription features disabled');
      } else {
        console.log('[SubscriptionContext] Real IAP initialized with', formattedProducts.length, 'products');
      }
    } catch (error) {
      console.error('[SubscriptionContext] Error initializing IAP:', error);
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

  const refreshTierInfo = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [tierData, ownedCount] = await Promise.all([
        subscriptionService.getTierInfo(user.id),
        subscriptionService.getOwnedBusinessCount(user.id)
      ]);
      setTierInfo(tierData);
      setOwnedBusinessCount(ownedCount);
    } catch (error) {
      console.error('Error refreshing tier info:', error);
    }
  }, [user?.id]);

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

    pollingIntervalRef.current = setInterval(async () => {
      if (isAppActiveRef.current && user?.id) {
        await refreshSubscriptionStatus(true);
        await refreshTierInfo();
        if (currentBusiness?.id) {
          await refreshSalesCount();
          await checkFeatureAccess(true);
        }
      }
    }, 30000);
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshTierInfo, refreshSalesCount, checkFeatureAccess]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id || !isAppActiveRef.current || realtimeDisabledRef.current) {
      return;
    }

    if (realtimeChannelRef.current) {
      try {
        realtimeChannelRef.current.unsubscribe();
      } catch (error) {
      }
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`subscription-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.new) {
            const newStatus = payload.new as any;
            const isExpired = newStatus.subscription_expiration_date &&
              new Date(newStatus.subscription_expiration_date) < new Date();
            const actuallySubscribed = newStatus.subscription_status === 'active' && !isExpired;

            setSubscriptionStatus({
              isSubscribed: actuallySubscribed,
              subscriptionStatus: isExpired ? 'expired' : newStatus.subscription_status,
              productId: newStatus.subscription_product_id,
              expirationDate: newStatus.subscription_expiration_date,
              platform: newStatus.platform
            });
            setIsSubscribed(actuallySubscribed);
          }

          await subscriptionService.clearSubscriptionCache();
          await refreshSubscriptionStatus(true);
          await refreshTierInfo();
          if (currentBusiness?.id) {
            await checkFeatureAccess(true);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'subscription_updated' },
        async () => {
          await refreshSubscriptionStatus(true);
          await refreshTierInfo();
          if (currentBusiness?.id) {
            await checkFeatureAccess(true);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
          isReconnectingRef.current = false;
          stopPolling();
        } else if (status === 'CHANNEL_ERROR') {
          if (!isReconnectingRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
            isReconnectingRef.current = true;
            reconnectAttemptsRef.current += 1;

            const backoffDelay = Math.min(2000 * reconnectAttemptsRef.current, 8000);

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = setTimeout(() => {
              if (isAppActiveRef.current && user?.id && !realtimeDisabledRef.current) {
                isReconnectingRef.current = false;
                setupRealtimeSubscription();
              }
            }, backoffDelay);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            realtimeDisabledRef.current = true;
            startPolling();
          }
        }
      });

    realtimeChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess, startPolling, stopPolling]);

  const setupSalesCountRealtime = useCallback(() => {
    if (!user?.id || !currentBusiness?.id || !isAppActiveRef.current || realtimeDisabledRef.current) {
      return;
    }

    if (salesCountChannelRef.current) {
      try {
        salesCountChannelRef.current.unsubscribe();
      } catch (error) {
      }
      salesCountChannelRef.current = null;
    }

    const channel = supabase
      .channel(`sales-count-${user.id}-${currentBusiness.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sales_counts',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.new && (payload.new as any).business_id === currentBusiness.id) {
            await refreshSalesCount();
            await refreshTierInfo();
            await checkFeatureAccess(true);
          }
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' && status !== 'CHANNEL_ERROR') {
        }
      });

    salesCountChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, checkFeatureAccess, refreshSalesCount, refreshTierInfo]);

  const cleanupRealtimeSubscription = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (realtimeChannelRef.current) {
      try {
        realtimeChannelRef.current.unsubscribe();
      } catch (error) {
      }
      realtimeChannelRef.current = null;
    }

    stopPolling();
    isReconnectingRef.current = false;
  }, [stopPolling]);

  const cleanupSalesCountRealtime = useCallback(() => {
    if (salesCountChannelRef.current) {
      try {
        salesCountChannelRef.current.unsubscribe();
      } catch (error) {
      }
      salesCountChannelRef.current = null;
    }
  }, []);

  const purchaseSubscription = useCallback(async (productId: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[SubscriptionContext] IAP not supported on web');
      return false;
    }

    try {
      setIsLoading(true);

      const purchase = await iapService.requestSubscription({ sku: productId });

      if (purchase && purchase.transactionReceipt) {
        const validation = await iapService.validateReceipt(
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
            await refreshTierInfo();
            await checkFeatureAccess();

            if (realtimeChannelRef.current) {
              await realtimeChannelRef.current.send({
                type: 'broadcast',
                event: 'subscription_updated',
                payload: { userId: user!.id, status: 'active' }
              });
            }

            return true;
          }
        }
      }

      return false;
    } catch (error: any) {
      console.error('[SubscriptionContext] Error purchasing subscription:', error);
      if (error.code === 'E_USER_CANCELLED') {
        console.log('[SubscriptionContext] User cancelled purchase');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[SubscriptionContext] IAP not supported on web');
      return false;
    }

    try {
      setIsLoading(true);

      const purchases = await iapService.getAvailablePurchases();

      if (purchases && purchases.length > 0) {
        const latestPurchase = purchases.sort((a, b) =>
          (b.transactionDate || 0) - (a.transactionDate || 0)
        )[0];

        if (latestPurchase.transactionReceipt) {
          const validation = await iapService.validateReceipt(
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
              await refreshTierInfo();
              await checkFeatureAccess();

              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('[SubscriptionContext] Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess]);

  const showPaywall = useCallback(() => {
    if (!currentBusiness) {
      return;
    }

    const isOwner = user?.id === currentBusiness.owner_user_id;

    if (isOwner) {
      setIsPaywallVisible(true);
    } else {
      setIsUnauthorizedModalVisible(true);
    }
  }, [user?.id, currentBusiness]);

  const hidePaywall = useCallback(() => {
    setIsPaywallVisible(false);
  }, []);

  const hideUnauthorizedModal = useCallback(() => {
    setIsUnauthorizedModalVisible(false);
  }, []);

  useEffect(() => {
    initializeIAP();

    return () => {
      stopPolling();
      if (Platform.OS !== 'web') {
        try {
          iapService.endConnection();
        } catch (error) {
          console.warn('Error ending IAP connection:', error);
        }
      }
    };
  }, [initializeIAP, stopPolling]);

  useEffect(() => {
    if (user?.id) {
      refreshSubscriptionStatus();
      refreshTierInfo();
    }
  }, [user?.id, refreshSubscriptionStatus, refreshTierInfo]);

  useEffect(() => {
    if (user?.id && currentBusiness?.id) {
      refreshSalesCount();
      checkFeatureAccess();
    }
  }, [user?.id, currentBusiness?.id, refreshSalesCount, checkFeatureAccess]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const isActive = nextAppState === 'active';
      const wasActive = isAppActiveRef.current;
      isAppActiveRef.current = isActive;

      if (isActive && !wasActive && user?.id) {
        reconnectAttemptsRef.current = 0;
        realtimeDisabledRef.current = false;

        refreshSubscriptionStatus(true);
        refreshTierInfo();
        if (currentBusiness?.id) {
          refreshSalesCount();
          checkFeatureAccess(true);
        }

        setTimeout(() => {
          if (isAppActiveRef.current) {
            setupRealtimeSubscription();
            if (currentBusiness?.id) {
              setupSalesCountRealtime();
            }
          }
        }, 500);
      } else if (!isActive && wasActive) {
        cleanupRealtimeSubscription();
        cleanupSalesCountRealtime();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshTierInfo, refreshSalesCount, checkFeatureAccess, setupRealtimeSubscription, setupSalesCountRealtime, cleanupRealtimeSubscription, cleanupSalesCountRealtime]);

  useEffect(() => {
    if (user?.id && isAppActiveRef.current) {
      setupRealtimeSubscription();

      if (currentBusiness?.id) {
        setupSalesCountRealtime();
      }
    }

    return () => {
      cleanupRealtimeSubscription();
      cleanupSalesCountRealtime();
    };
  }, [user?.id, currentBusiness?.id, setupRealtimeSubscription, setupSalesCountRealtime, cleanupRealtimeSubscription, cleanupSalesCountRealtime]);

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
    tierInfo,
    ownedBusinessCount,
    isIAPAvailable: iapService.isAvailable(),
    purchaseSubscription,
    restorePurchases,
    refreshSubscriptionStatus,
    refreshSalesCount,
    refreshTierInfo,
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
      <UnauthorizedUpgradeModal
        visible={isUnauthorizedModalVisible}
        onClose={hideUnauthorizedModal}
      />
    </SubscriptionContext.Provider>
  );
};
