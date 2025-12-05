import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT, TierInfo, SubscriptionTier } from '@/src/services/subscriptionService';
import { supabase } from '@/src/config/supabase';
import { useAuth } from './AuthContext';
import { Paywall } from '@/src/components/subscription/Paywall';
import { UnauthorizedUpgradeModal } from '@/src/components/subscription/UnauthorizedUpgradeModal';
import type { RealtimeChannel } from '@supabase/supabase-js';

let IAP: any = null;
if (Platform.OS !== 'web') {
  try {
    IAP = require('react-native-iap');
  } catch (error) {
    console.warn('react-native-iap not available:', error);
  }
}

const IOS_PRODUCT_IDS = [
  'bizmanage.pro.month',
  'bizmanage.pro.yearly',
  'bizmanage.pro_plus.month',
  'bizmanage.pro_plus.yearly',
  'bizmanage.max.month',
  'bizmanage.max.yearly'
];
const ANDROID_PRODUCT_IDS = [
  'bizmanage.pro.month',
  'bizmanage.pro.yearly',
  'bizmanage.pro_plus.month',
  'bizmanage.pro_plus.yearly',
  'bizmanage.max.month',
  'bizmanage.max.yearly'
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
  const maxReconnectAttempts = 5;
  const isReconnectingRef = useRef(false);

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

  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id || !isAppActiveRef.current) {
      return;
    }

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }

    console.log('[SubscriptionContext] Setting up realtime subscription');

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
          console.log('[SubscriptionContext] Received realtime update:', payload);

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
        async (payload) => {
          console.log('[SubscriptionContext] Received broadcast:', payload);
          await refreshSubscriptionStatus(true);
          await refreshTierInfo();
          if (currentBusiness?.id) {
            await checkFeatureAccess(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('[SubscriptionContext] Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[SubscriptionContext] ✓ Connected to realtime');
          reconnectAttemptsRef.current = 0;
          isReconnectingRef.current = false;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[SubscriptionContext] ✗ Realtime connection error');

          if (!isReconnectingRef.current && isAppActiveRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
            isReconnectingRef.current = true;
            reconnectAttemptsRef.current += 1;

            const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
            console.log(`[SubscriptionContext] Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${backoffDelay}ms`);

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = setTimeout(() => {
              if (isAppActiveRef.current && user?.id) {
                console.log('[SubscriptionContext] Reconnecting realtime subscription...');
                isReconnectingRef.current = false;
                setupRealtimeSubscription();
              }
            }, backoffDelay);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.error('[SubscriptionContext] Max reconnection attempts reached');
          }
        } else if (status === 'CLOSED') {
          console.log('[SubscriptionContext] Realtime connection closed');
        }
      });

    realtimeChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess]);

  const setupSalesCountRealtime = useCallback(() => {
    if (!user?.id || !currentBusiness?.id || !isAppActiveRef.current) {
      return;
    }

    if (salesCountChannelRef.current) {
      salesCountChannelRef.current.unsubscribe();
      salesCountChannelRef.current = null;
    }

    console.log('[SubscriptionContext] Setting up sales count realtime');

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
          console.log('[SubscriptionContext] Sales count changed:', payload);
          if (payload.new && (payload.new as any).business_id === currentBusiness.id) {
            const newCount = (payload.new as any).sales_count;
            setSalesCountData({
              salesCount: newCount,
              remainingSales: Math.max(0, FREE_TIER_LIMIT - newCount),
              isAtLimit: newCount >= FREE_TIER_LIMIT
            });
            await checkFeatureAccess(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('[SubscriptionContext] Sales count realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[SubscriptionContext] ✓ Sales count connected to realtime');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[SubscriptionContext] ✗ Sales count realtime connection error');

          if (isAppActiveRef.current && user?.id && currentBusiness?.id) {
            const backoffDelay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttemptsRef.current, 4)), 30000);
            console.log(`[SubscriptionContext] Reconnecting sales count in ${backoffDelay}ms`);

            setTimeout(() => {
              if (isAppActiveRef.current && user?.id && currentBusiness?.id) {
                console.log('[SubscriptionContext] Reconnecting sales count realtime...');
                setupSalesCountRealtime();
              }
            }, backoffDelay);
          }
        } else if (status === 'CLOSED') {
          console.log('[SubscriptionContext] Sales count realtime connection closed');
        }
      });

    salesCountChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, checkFeatureAccess]);

  const cleanupRealtimeSubscription = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (realtimeChannelRef.current) {
      console.log('[SubscriptionContext] Cleaning up realtime subscription');
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }

    isReconnectingRef.current = false;
  }, []);

  const cleanupSalesCountRealtime = useCallback(() => {
    if (salesCountChannelRef.current) {
      console.log('[SubscriptionContext] Cleaning up sales count realtime');
      salesCountChannelRef.current.unsubscribe();
      salesCountChannelRef.current = null;
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
      console.error('Error purchasing subscription:', error);
      if (error.code === 'E_USER_CANCELLED') {
        console.log('User cancelled purchase');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess]);

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
              await refreshTierInfo();
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
        console.log('[SubscriptionContext] App became active, refreshing data and reconnecting realtime');

        reconnectAttemptsRef.current = 0;

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
        console.log('[SubscriptionContext] App became inactive, cleaning up realtime connections');
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
