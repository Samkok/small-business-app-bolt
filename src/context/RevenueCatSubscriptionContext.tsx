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

let Purchases: any = null;
let revenueCatService: any = null;
let isRevenueCatAvailable = false;

console.log('[RevenueCatSubscriptionContext Loading] Platform.OS:', Platform.OS);

if (Platform.OS !== 'web') {
  try {
    console.log('[RevenueCatSubscriptionContext Loading] Loading revenueCatService...');
    const rcServiceModule = require('@/src/services/revenueCatService');
    revenueCatService = rcServiceModule.revenueCatService;
    console.log('[RevenueCatSubscriptionContext Loading] Service loaded:', !!revenueCatService);
    console.log('[RevenueCatSubscriptionContext Loading] Service has isAvailable:', typeof revenueCatService?.isAvailable);

    if (revenueCatService && typeof revenueCatService.isAvailable === 'function') {
      const available = revenueCatService.isAvailable();
      console.log('[RevenueCatSubscriptionContext Loading] isAvailable() returned:', available);

      if (available) {
        try {
          console.log('[RevenueCatSubscriptionContext Loading] Loading react-native-purchases...');
          Purchases = require('react-native-purchases').default;
          console.log('[RevenueCatSubscriptionContext Loading] Purchases loaded:', !!Purchases);
          isRevenueCatAvailable = true;
          console.log('[RevenueCatSubscriptionContext] RevenueCat native module loaded and available');
        } catch (purchasesError) {
          console.log('[RevenueCatSubscriptionContext] Error loading Purchases module:', purchasesError);
          isRevenueCatAvailable = false;
          Purchases = null;
        }
      } else {
        isRevenueCatAvailable = false;
        console.log('[RevenueCatSubscriptionContext] RevenueCat module loaded but native functionality not available');
        console.log('[RevenueCatSubscriptionContext] Check revenueCatService.ts logs for why native module is unavailable');
      }
    } else {
      isRevenueCatAvailable = false;
      console.log('[RevenueCatSubscriptionContext] Service does not have isAvailable method');
    }
  } catch (error) {
    console.log('[RevenueCatSubscriptionContext] Error loading RevenueCat service:', error);
    console.log('[RevenueCatSubscriptionContext] RevenueCat native module not available - using Supabase-only mode');
    isRevenueCatAvailable = false;
    revenueCatService = null;
    Purchases = null;
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
  const isAppActiveRef = useRef(true);

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
  }, [user?.id, refreshCustomerInfo, customerInfo]);

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
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('must_choose_businesses')
        .eq('user_id', user.id)
        .maybeSingle() as { data: { must_choose_businesses: boolean } | null };

      const mustChoose = profile?.must_choose_businesses || false;

      if (mustChoose) {
        const businesses = await businessService.getUserOwnedBusinessesWithState(user.id);
        setOwnedBusinesses(businesses);

        const readOnlyIds = businesses
          .filter((b: any) => b.access_state === 'read_only_sales')
          .map((b: any) => b.id);
        setReadOnlyBusinessIds(readOnlyIds);
        setMustChooseBusinesses(true);
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

  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id || !isAppActiveRef.current) {
      return;
    }

    if (realtimeChannelRef.current) {
      try {
        realtimeChannelRef.current.unsubscribe();
      } catch (error) {}
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
          if (isRevenueCatAvailable) {
            await refreshCustomerInfo();
          }
          await refreshSubscriptionStatus(true);
          await refreshTierInfo();
          if (currentBusiness?.id) {
            await checkFeatureAccess(true);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, refreshCustomerInfo, refreshSubscriptionStatus, refreshTierInfo, checkFeatureAccess]);

  const setupCustomerInfoListener = useCallback(() => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id || !Purchases) return;

    try {
      Purchases.addCustomerInfoUpdateListener(async (info: any) => {
        console.log('[RevenueCatSubscriptionContext] Customer info updated via listener');
        setCustomerInfo(info);
        await refreshCustomerInfo();
      });
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
    if (user?.id && isAppActiveRef.current) {
      setupRealtimeSubscription();
    }

    return () => {
      if (realtimeChannelRef.current) {
        try {
          realtimeChannelRef.current.unsubscribe();
        } catch (error) {}
        realtimeChannelRef.current = null;
      }
    };
  }, [user?.id, setupRealtimeSubscription]);

  const isBusinessReadOnly = useCallback((businessId: string) => {
    return readOnlyBusinessIds.includes(businessId);
  }, [readOnlyBusinessIds]);

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
        />
      )}
    </SubscriptionContext.Provider>
  );
};
