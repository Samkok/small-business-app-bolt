import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Platform } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT, TierInfo, SubscriptionTier } from '@/src/services/subscriptionService';
import { supabase } from '@/src/config/supabase';
import { useAuth } from './AuthContext';
import { UnauthorizedUpgradeModal } from '@/src/components/subscription/UnauthorizedUpgradeModal';
import { DowngradePick } from '@/src/components/subscription/DowngradePick';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { businessService } from '@/src/services/business';
import { Paywall } from '@/src/components/subscription/Paywall';

let revenueCatService: any = null;
let isRevenueCatAvailable = false;

console.log('[RevenueCatSubscriptionContext Loading] Platform.OS:', Platform.OS);

if (Platform.OS !== 'web') {
  try {
    console.log('[RevenueCatSubscriptionContext Loading] Loading revenueCatService...');
    const rcServiceModule = require('@/src/services/revenueCatService');
    revenueCatService = rcServiceModule.revenueCatService;
    console.log('[RevenueCatSubscriptionContext Loading] Service loaded:', !!revenueCatService);

    if (revenueCatService && typeof revenueCatService.isAvailable === 'function') {
      isRevenueCatAvailable = revenueCatService.isAvailable();
      console.log('[RevenueCatSubscriptionContext Loading] isAvailable() returned:', isRevenueCatAvailable);

      if (isRevenueCatAvailable) {
        console.log('[RevenueCatSubscriptionContext] RevenueCat is available and ready');
      } else {
        console.log('[RevenueCatSubscriptionContext] RevenueCat not available - using Supabase-only mode');
      }
    } else {
      isRevenueCatAvailable = false;
      console.log('[RevenueCatSubscriptionContext] Service does not have isAvailable method');
    }
  } catch (error) {
    console.log('[RevenueCatSubscriptionContext] Error loading RevenueCat service:', error instanceof Error ? error.message : 'Unknown error');
    console.log('[RevenueCatSubscriptionContext] Using Supabase-only mode');
    isRevenueCatAvailable = false;
    revenueCatService = null;
  }
} else {
  console.log('[RevenueCatSubscriptionContext Loading] Skipping - running on web');
}

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
  mustChooseBusinesses: boolean;
  ownedBusinesses: any[];
  readOnlyBusinessIds: string[];
  isBusinessReadOnly: (businessId: string) => boolean;
  offerings: any | null;
  customerInfo: any | null;

  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshSubscriptionStatus: () => Promise<void>;
  refreshSalesCount: () => Promise<void>;
  refreshTierInfo: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
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

type RevenueCatTier = 'free' | 'pro' | 'pro_plus' | 'max';

export const RevenueCatSubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
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
  const [offerings, setOfferings] = useState<any | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [isUnauthorizedModalVisible, setIsUnauthorizedModalVisible] = useState(false);
  const [canAccessFeature, setCanAccessFeature] = useState(true);
  const [mustChooseBusinesses, setMustChooseBusinesses] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState<any[]>([]);
  const [readOnlyBusinessIds, setReadOnlyBusinessIds] = useState<string[]>([]);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const businessCountChannelRef = useRef<RealtimeChannel | null>(null);
  const userProfileChannelRef = useRef<RealtimeChannel | null>(null);
  const isAppActiveRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const initializeRevenueCat = useCallback(async () => {
    console.log("[RevenueCatSubscriptionContext] Initializing subscription system");
    console.log("[RevenueCatSubscriptionContext] Platform:", Platform.OS);
    console.log("[RevenueCatSubscriptionContext] isRevenueCatAvailable:", isRevenueCatAvailable);
    console.log("[RevenueCatSubscriptionContext] revenueCatService exists:", !!revenueCatService);

    if (Platform.OS === 'web' || !isRevenueCatAvailable) {
      console.log('[RevenueCatSubscriptionContext] Using Supabase-only mode');
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    if (!revenueCatService) {
      console.error('[RevenueCatSubscriptionContext] RevenueCat service is null!');
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    try {
      console.log('[RevenueCatSubscriptionContext] Configuring RevenueCat with user ID:', user?.id);
      await revenueCatService.configure(user?.id);

      if (user?.id) {
        console.log('[RevenueCatSubscriptionContext] Setting user attributes');
        await revenueCatService.setAttributes({
          'user_id': user.id,
          'email': user.email || null,
        });
      }

      console.log('[RevenueCatSubscriptionContext] Calling getOfferings...');
      const offeringsData = await revenueCatService.getOfferings();
      console.log('[RevenueCatSubscriptionContext] Offerings received:', !!offeringsData);
      setOfferings(offeringsData);

      if (offeringsData?.current) {
        const formattedProducts: SubscriptionProduct[] = offeringsData.current.availablePackages.map((pkg: any) => ({
          productId: pkg.product.identifier,
          title: pkg.product.title,
          description: pkg.product.description,
          price: pkg.product.price.toString(),
          localizedPrice: pkg.product.priceString,
          currency: pkg.product.currencyCode,
          type: pkg.product.subscriptionPeriod?.includes('Y') ? 'yearly' : 'monthly',
        }));
        setProducts(formattedProducts);
      }

      const info = await revenueCatService.getCustomerInfo();
      setCustomerInfo(info);

      setIsInitialized(true);
      console.log('[RevenueCatSubscriptionContext] RevenueCat initialized successfully');
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error initializing RevenueCat:', error);
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.email]);

  const refreshCustomerInfo = useCallback(async () => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id) return;

    try {
      const info = await revenueCatService.getCustomerInfo();
      setCustomerInfo(info);

      const tier = await revenueCatService.getCurrentTier();
      const maxBusinesses = await revenueCatService.getMaxBusinesses();

      const hasActiveSubscription = tier !== 'free';
      setIsSubscribed(hasActiveSubscription);

      setTierInfo({
        tier: tier as SubscriptionTier,
        maxOwnedBusinesses: maxBusinesses,
        subscriptionStatus: hasActiveSubscription ? 'active' : 'trial',
        expirationDate: null
      });

      await syncWithSupabase(info, tier);
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error refreshing customer info:', error);
    }
  }, [user?.id]);

  const syncWithSupabase = async (info: any, tier: RevenueCatTier) => {
    if (!user?.id) return;

    try {
      const { data: existingSubscription } = await supabase
        .from('user_subscriptions')
        .select('subscription_status, subscription_expiration_date')
        .eq('user_id', user.id)
        .maybeSingle() as { data: { subscription_status: string; subscription_expiration_date: string | null } | null };

      const existingIsActive = existingSubscription?.subscription_status === 'active';
      const existingNotExpired = existingSubscription?.subscription_expiration_date
        ? new Date(existingSubscription.subscription_expiration_date) > new Date()
        : true;
      const hasValidExistingSubscription = existingIsActive && existingNotExpired;

      if (tier === 'free' && hasValidExistingSubscription) {
        console.log('[RevenueCatSubscriptionContext] Protecting existing subscription during migration - skipping sync');
        return;
      }

      const activeEntitlement = info?.entitlements?.active ? Object.values(info.entitlements.active)[0] as any : null;
      const expirationDate = activeEntitlement?.expirationDate;

      const maxBusinesses = isRevenueCatAvailable ? await revenueCatService.getMaxBusinesses() : null;
      const revenueCatAppUserId = info?.originalAppUserId || user.id;

      await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          subscription_status: tier !== 'free' ? 'active' : 'trial',
          subscription_product_id: activeEntitlement?.productIdentifier || null,
          subscription_expiration_date: expirationDate || null,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          tier: tier,
          max_owned_businesses: maxBusinesses,
          revenuecat_app_user_id: revenueCatAppUserId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      console.log('[RevenueCatSubscriptionContext] Synced with Supabase');
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error syncing with Supabase:', error);
    }
  };

  const refreshSubscriptionStatus = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      const status = await subscriptionService.getSubscriptionStatus(user.id, forceRefresh);
      const isExpired = subscriptionService.isSubscriptionExpired(status);
      const supabaseSubscribed = status.isSubscribed && !isExpired;

      if (Platform.OS !== 'web' && isRevenueCatAvailable) {
        await refreshCustomerInfo();
      }

      const revenueCatSubscribed = customerInfo?.entitlements?.active
        ? Object.keys(customerInfo.entitlements.active).length > 0
        : false;

      const actuallySubscribed = supabaseSubscribed || revenueCatSubscribed;

      setSubscriptionStatus({
        ...status,
        isSubscribed: actuallySubscribed,
        subscriptionStatus: actuallySubscribed ? 'active' : (isExpired ? 'expired' : status.subscriptionStatus)
      });
      setIsSubscribed(actuallySubscribed);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
    }
  }, [user?.id, refreshCustomerInfo]);

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

  const loadDowngradeData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [profileResult, tierData, ownedCount] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('must_choose_businesses')
          .eq('user_id', user.id)
          .maybeSingle() as Promise<{ data: { must_choose_businesses: boolean } | null }>,
        subscriptionService.getTierInfo(user.id),
        subscriptionService.getOwnedBusinessCount(user.id)
      ]);

      const profile = profileResult.data;
      const mustChooseFromDb = profile?.must_choose_businesses || false;

      const maxAllowed = tierData.maxOwnedBusinesses;
      const limitExceeded = maxAllowed !== null && maxAllowed !== 999999 && ownedCount > maxAllowed;

      console.log('[RevenueCatSubscriptionContext] loadDowngradeData check:', {
        mustChooseFromDb,
        maxAllowed,
        ownedCount,
        limitExceeded
      });

      const mustChoose = mustChooseFromDb || limitExceeded;

      if (mustChoose) {
        if (limitExceeded && !mustChooseFromDb) {
          console.log('[RevenueCatSubscriptionContext] Setting must_choose_businesses flag in DB');
          await supabase
            .from('user_profiles')
            .update({ must_choose_businesses: true })
            .eq('user_id', user.id);
        }

        const businesses = await businessService.getUserOwnedBusinessesWithState(user.id);
        setOwnedBusinesses(businesses);

        const readOnlyIds = businesses
          .filter((b: any) => b.access_state === 'read_only_sales')
          .map((b: any) => b.id);
        setReadOnlyBusinessIds(readOnlyIds);
        setMustChooseBusinesses(true);

        setTierInfo(tierData);
        setOwnedBusinessCount(ownedCount);
      } else {
        setMustChooseBusinesses(false);
        setOwnedBusinesses([]);
        setReadOnlyBusinessIds([]);
      }
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error loading downgrade data:', error);
      setMustChooseBusinesses(false);
      setOwnedBusinesses([]);
      setReadOnlyBusinessIds([]);
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

  const purchaseSubscription = useCallback(async (productId: string): Promise<boolean> => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable) {
      console.log('[RevenueCatSubscriptionContext] Purchases not supported in this environment');
      return false;
    }

    try {
      setIsLoading(true);

      const pkg = offerings?.current?.availablePackages.find(
        (p: any) => p.product.identifier === productId
      );

      if (!pkg) {
        console.error('[RevenueCatSubscriptionContext] Package not found for product:', productId);
        return false;
      }

      const { customerInfo: newCustomerInfo, cancelled } = await revenueCatService.purchasePackage(pkg);

      if (cancelled) {
        return false;
      }

      setCustomerInfo(newCustomerInfo);
      await refreshCustomerInfo();
      await refreshSubscriptionStatus();
      await refreshTierInfo();
      await checkFeatureAccess();

      return true;
    } catch (error: any) {
      console.error('[RevenueCatSubscriptionContext] Error purchasing subscription:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [offerings, refreshCustomerInfo, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable) {
      console.log('[RevenueCatSubscriptionContext] Restore not supported in this environment');
      return false;
    }

    try {
      setIsLoading(true);

      const restoredInfo = await revenueCatService.restorePurchases();
      setCustomerInfo(restoredInfo);

      const hasActiveEntitlements = Object.keys(restoredInfo.entitlements.active).length > 0;

      if (hasActiveEntitlements) {
        await refreshCustomerInfo();
        await refreshSubscriptionStatus();
        await refreshTierInfo();
        await checkFeatureAccess();
        return true;
      }

      return false;
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCustomerInfo, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess]);

  const showPaywall = useCallback(() => {
    if (!currentBusiness) return;

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

  const handleReconnect = useCallback((channelType: 'subscription' | 'business', setupFn: () => void) => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('[RevenueCatSubscriptionContext] Max reconnect attempts reached for', channelType);
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current += 1;

    console.log(`[RevenueCatSubscriptionContext] Reconnecting ${channelType} channel in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      setupFn();
    }, delay);
  }, []);

  const setupBusinessCountSubscription = useCallback(() => {
    if (!user?.id || !isAppActiveRef.current) {
      return;
    }

    if (businessCountChannelRef.current) {
      try {
        businessCountChannelRef.current.unsubscribe();
      } catch (error) {
        console.error('[RevenueCatSubscriptionContext] Error unsubscribing business count channel:', error);
      }
      businessCountChannelRef.current = null;
    }

    const channel = supabase
      .channel(`business-count-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `owner_user_id=eq.${user.id}`
        },
        async () => {
          console.log('[RevenueCatSubscriptionContext] Business count change detected');

          try {
            const count = await subscriptionService.getOwnedBusinessCount(user.id);
            setOwnedBusinessCount(count);
          } catch (error) {
            console.error('[RevenueCatSubscriptionContext] Error updating business count:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('[RevenueCatSubscriptionContext] Business count channel status:', status);

        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[RevenueCatSubscriptionContext] Business count channel error, attempting reconnect');
          handleReconnect('business', setupBusinessCountSubscription);
        }
      });

    businessCountChannelRef.current = channel;
  }, [user?.id, handleReconnect]);

  const setupUserProfileSubscription = useCallback(() => {
    if (!user?.id || !isAppActiveRef.current) {
      return;
    }

    if (userProfileChannelRef.current) {
      try {
        userProfileChannelRef.current.unsubscribe();
      } catch (error) {
        console.error('[RevenueCatSubscriptionContext] Error unsubscribing user profile channel:', error);
      }
      userProfileChannelRef.current = null;
    }

    const channel = supabase
      .channel(`user-profile-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`
        },
        async (payload: any) => {
          console.log('[RevenueCatSubscriptionContext] User profile change detected:', payload);

          const newMustChoose = payload.new?.must_choose_businesses;
          const oldMustChoose = payload.old?.must_choose_businesses;

          if (newMustChoose !== oldMustChoose) {
            console.log('[RevenueCatSubscriptionContext] must_choose_businesses changed, reloading downgrade data');
            await loadDowngradeData();
          }
        }
      )
      .subscribe((status) => {
        console.log('[RevenueCatSubscriptionContext] User profile channel status:', status);

        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[RevenueCatSubscriptionContext] User profile channel error, attempting reconnect');
          handleReconnect('subscription', setupUserProfileSubscription);
        }
      });

    userProfileChannelRef.current = channel;
  }, [user?.id, handleReconnect, loadDowngradeData]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id || !isAppActiveRef.current) {
      return;
    }

    if (realtimeChannelRef.current) {
      try {
        realtimeChannelRef.current.unsubscribe();
      } catch (error) {
        console.error('[RevenueCatSubscriptionContext] Error unsubscribing subscription channel:', error);
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
        async () => {
          console.log('[RevenueCatSubscriptionContext] Subscription change detected, refreshing state');

          try {
            if (isRevenueCatAvailable) {
              await refreshCustomerInfo();
            }

            const fullState = await subscriptionService.getFullSubscriptionState(
              user.id,
              currentBusiness?.id
            );

            setSubscriptionStatus(fullState.subscriptionStatus);
            setIsSubscribed(fullState.subscriptionStatus.isSubscribed);
            setTierInfo(fullState.tierInfo);
            setOwnedBusinessCount(fullState.ownedBusinessCount);

            if (fullState.salesCountData) {
              setSalesCountData(fullState.salesCountData);
            }

            if (fullState.canAccessFeature !== null) {
              setCanAccessFeature(fullState.canAccessFeature);
            }
          } catch (error) {
            console.error('[RevenueCatSubscriptionContext] Error processing subscription change:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('[RevenueCatSubscriptionContext] Subscription channel status:', status);

        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[RevenueCatSubscriptionContext] Subscription channel error, attempting reconnect');
          handleReconnect('subscription', setupRealtimeSubscription);
        }
      });

    realtimeChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, refreshCustomerInfo, handleReconnect]);

  const setupCustomerInfoListener = useCallback(() => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id || !revenueCatService) return;

    try {
      if (revenueCatService.addCustomerInfoUpdateListener) {
        revenueCatService.addCustomerInfoUpdateListener(async (info: any) => {
          console.log('[RevenueCatSubscriptionContext] Customer info updated via listener');
          setCustomerInfo(info);
          await refreshCustomerInfo();
        });
      }
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error setting up customer info listener:', error);
    }
  }, [user?.id, refreshCustomerInfo]);

  useEffect(() => {
    if (user?.id) {
      initializeRevenueCat();
      if (isRevenueCatAvailable) {
        setupCustomerInfoListener();
      }
    }
  }, [user?.id, initializeRevenueCat, setupCustomerInfoListener]);

  useEffect(() => {
    if (user?.id) {
      refreshSubscriptionStatus();
      refreshTierInfo();
      loadDowngradeData();
    }
  }, [user?.id, refreshSubscriptionStatus, refreshTierInfo, loadDowngradeData]);

  useEffect(() => {
    if (user?.id && currentBusiness?.id) {
      refreshSalesCount();
      checkFeatureAccess();
    }
  }, [user?.id, currentBusiness?.id, refreshSalesCount, checkFeatureAccess]);

  useEffect(() => {
    if (!user?.id || !isInitialized) return;

    const maxAllowed = tierInfo.maxOwnedBusinesses;
    if (maxAllowed !== null && maxAllowed !== 999999 && ownedBusinessCount > maxAllowed) {
      console.log('[RevenueCatSubscriptionContext] Business limit exceeded detected via state change, triggering downgrade check');
      loadDowngradeData();
    }
  }, [user?.id, tierInfo.maxOwnedBusinesses, ownedBusinessCount, isInitialized, loadDowngradeData]);

  useEffect(() => {
    if (user?.id && isAppActiveRef.current) {
      setupRealtimeSubscription();
      setupBusinessCountSubscription();
      setupUserProfileSubscription();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (realtimeChannelRef.current) {
        try {
          realtimeChannelRef.current.unsubscribe();
        } catch (error) {
          console.error('[RevenueCatSubscriptionContext] Error cleaning up subscription channel:', error);
        }
        realtimeChannelRef.current = null;
      }

      if (businessCountChannelRef.current) {
        try {
          businessCountChannelRef.current.unsubscribe();
        } catch (error) {
          console.error('[RevenueCatSubscriptionContext] Error cleaning up business count channel:', error);
        }
        businessCountChannelRef.current = null;
      }

      if (userProfileChannelRef.current) {
        try {
          userProfileChannelRef.current.unsubscribe();
        } catch (error) {
          console.error('[RevenueCatSubscriptionContext] Error cleaning up user profile channel:', error);
        }
        userProfileChannelRef.current = null;
      }
    };
  }, [user?.id, setupRealtimeSubscription, setupBusinessCountSubscription, setupUserProfileSubscription]);

  const isBusinessReadOnly = useCallback((businessId: string) => {
    return readOnlyBusinessIds.includes(businessId);
  }, [readOnlyBusinessIds]);

  const handleDowngradeModalDismiss = useCallback(async () => {
    if (!user?.id || ownedBusinesses.length === 0) return;

    try {
      console.log('[RevenueCatSubscriptionContext] Modal dismissed, auto-selecting oldest businesses');

      const { data, error } = await supabase.functions.invoke('choose-businesses', {
        body: {
          userId: user.id,
          selectOldest: true,
          tierLimit: tierInfo.maxOwnedBusinesses || 1,
        },
      });

      if (error) {
        console.error('[RevenueCatSubscriptionContext] Error auto-selecting businesses:', error);
        throw error;
      }

      console.log('[RevenueCatSubscriptionContext] Auto-selection complete:', data);
      await loadDowngradeData();
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Failed to auto-select businesses:', error);
      await loadDowngradeData();
    }
  }, [user?.id, ownedBusinesses, tierInfo.maxOwnedBusinesses, loadDowngradeData]);

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
    isIAPAvailable: Platform.OS !== 'web' && isRevenueCatAvailable,
    mustChooseBusinesses,
    ownedBusinesses,
    readOnlyBusinessIds,
    isBusinessReadOnly,
    offerings,
    customerInfo,
    purchaseSubscription,
    restorePurchases,
    refreshSubscriptionStatus,
    refreshSalesCount,
    refreshTierInfo,
    refreshCustomerInfo,
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
      {mustChooseBusinesses && ownedBusinesses.length > 0 && (
        <DowngradePick
          visible={mustChooseBusinesses}
          ownedBusinesses={ownedBusinesses}
          tierLimit={tierInfo.maxOwnedBusinesses || 1}
          onComplete={loadDowngradeData}
          onDismiss={handleDowngradeModalDismiss}
        />
      )}
    </SubscriptionContext.Provider>
  );
};
