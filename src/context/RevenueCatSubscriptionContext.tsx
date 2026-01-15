import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Platform } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT, TierInfo, SubscriptionTier } from '@/src/services/subscriptionService';
import { supabase } from '@/src/config/supabase';
import { useAuth } from './AuthContext';
import { UnauthorizedUpgradeModal } from '@/src/components/subscription/UnauthorizedUpgradeModal';
import { TeamMemberUpgradeInfoModal } from '@/src/components/subscription/TeamMemberUpgradeInfoModal';
import { DowngradePick } from '@/src/components/subscription/DowngradePick';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { businessService } from '@/src/services/business';
import { Paywall } from '@/src/components/subscription/Paywall';
import { accessControl } from '@/src/utils/accessControl';

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
  const [isTeamMemberUpgradeModalVisible, setIsTeamMemberUpgradeModalVisible] = useState(false);
  const [teamMemberOwnedBusinesses, setTeamMemberOwnedBusinesses] = useState<Array<{ id: string; business_name: string }>>([]);
  const [canAccessFeature, setCanAccessFeature] = useState(true);
  const [mustChooseBusinesses, setMustChooseBusinesses] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState<any[]>([]);
  const [readOnlyBusinessIds, setReadOnlyBusinessIds] = useState<string[]>([]);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const businessCountChannelRef = useRef<RealtimeChannel | null>(null);
  const userProfileChannelRef = useRef<RealtimeChannel | null>(null);
  const salesCountChannelRef = useRef<RealtimeChannel | null>(null);
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

  const lastSyncTimeRef = useRef<number>(0);
  const syncCooldownMs = 5000;
  const isSyncingRef = useRef(false);

  const syncWithSupabase = async (info: any, tier: RevenueCatTier) => {
    if (!user?.id) return;

    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;

    if (timeSinceLastSync < syncCooldownMs) {
      console.log(`[RevenueCatSubscriptionContext] Skipping sync - cooldown active (${timeSinceLastSync}ms since last sync)`);
      return;
    }

    if (isSyncingRef.current) {
      console.log('[RevenueCatSubscriptionContext] Skipping sync - sync already in progress');
      return;
    }

    isSyncingRef.current = true;

    try {
      const { data: existingSubscription } = await supabase
        .from('user_subscriptions')
        .select('subscription_status, subscription_expiration_date, tier, subscription_product_id, last_webhook_update, updated_by, max_owned_businesses, sync_version')
        .eq('user_id', user.id)
        .maybeSingle() as { data: {
          subscription_status: string;
          subscription_expiration_date: string | null;
          tier: string;
          subscription_product_id: string | null;
          last_webhook_update: string | null;
          updated_by: string | null;
          max_owned_businesses: number | null;
          sync_version: number | null;
        } | null };

      if (existingSubscription?.last_webhook_update) {
        const webhookUpdateTime = new Date(existingSubscription.last_webhook_update).getTime();
        const timeSinceWebhookUpdate = now - webhookUpdateTime;

        if (timeSinceWebhookUpdate < 300000) {
          console.log('[RevenueCatSubscriptionContext] Skipping sync - webhook updated recently (' + timeSinceWebhookUpdate + 'ms ago)');
          lastSyncTimeRef.current = now;
          return;
        }
      }

      const existingIsActive = existingSubscription?.subscription_status === 'active';
      const existingNotExpired = existingSubscription?.subscription_expiration_date
        ? new Date(existingSubscription.subscription_expiration_date) > new Date()
        : true;
      const hasValidExistingSubscription = existingIsActive && existingNotExpired;

      if (tier === 'free' && hasValidExistingSubscription) {
        console.log('[RevenueCatSubscriptionContext] Protecting existing active subscription - skipping sync');
        lastSyncTimeRef.current = now;
        return;
      }

      const existingIsCancelledOrExpired = existingSubscription?.subscription_status === 'cancelled' ||
                                           existingSubscription?.subscription_status === 'expired' ||
                                           existingSubscription?.subscription_status === 'trial';

      const hasActiveEntitlements = info?.entitlements?.active &&
                                    Object.keys(info.entitlements.active).length > 0;

      if (existingIsCancelledOrExpired && tier === 'free' && existingSubscription?.updated_by === 'webhook') {
        console.log('[RevenueCatSubscriptionContext] CRITICAL: Webhook set status to cancelled/expired/trial. Client shows tier=free. Respecting webhook data to prevent downgrade loop.');
        lastSyncTimeRef.current = now;
        return;
      }

      if (existingIsCancelledOrExpired && !hasActiveEntitlements) {
        console.log('[RevenueCatSubscriptionContext] Protecting cancelled/expired status - no active entitlements in RevenueCat');
        lastSyncTimeRef.current = now;
        return;
      }

      const activeEntitlement = hasActiveEntitlements ? Object.values(info.entitlements.active)[0] as any : null;
      const expirationDate = activeEntitlement?.expirationDate;
      const newProductId = activeEntitlement?.productIdentifier || null;

      const maxBusinesses = isRevenueCatAvailable ? await revenueCatService.getMaxBusinesses() : null;
      const revenueCatAppUserId = info?.originalAppUserId || user.id;

      const dataChanged = !existingSubscription ||
                         existingSubscription.tier !== tier ||
                         existingSubscription.subscription_product_id !== newProductId ||
                         existingSubscription.max_owned_businesses !== maxBusinesses;

      if (!dataChanged) {
        console.log('[RevenueCatSubscriptionContext] No changes detected - skipping sync');
        lastSyncTimeRef.current = now;
        return;
      }

      console.log('[RevenueCatSubscriptionContext] Syncing to Supabase - changes detected');
      console.log('[RevenueCatSubscriptionContext] Client state: tier=' + tier + ', productId=' + newProductId + ', hasActiveEntitlements=' + hasActiveEntitlements);
      console.log('[RevenueCatSubscriptionContext] DB state: tier=' + existingSubscription?.tier + ', productId=' + existingSubscription?.subscription_product_id + ', updated_by=' + existingSubscription?.updated_by);

      const currentSyncVersion = existingSubscription?.sync_version || 0;

      await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          subscription_status: tier !== 'free' ? 'active' : 'trial',
          subscription_product_id: newProductId,
          subscription_expiration_date: expirationDate || null,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          tier: tier,
          max_owned_businesses: maxBusinesses,
          revenuecat_app_user_id: revenueCatAppUserId,
          updated_by: 'client',
          updated_at: new Date().toISOString(),
          sync_version: currentSyncVersion + 1,
        }, {
          onConflict: 'user_id',
        });

      lastSyncTimeRef.current = now;
      console.log('[RevenueCatSubscriptionContext] Synced with Supabase successfully');
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error syncing with Supabase:', error);
    } finally {
      isSyncingRef.current = false;
    }
  };

  const refreshSubscriptionStatus = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      const status = await subscriptionService.getSubscriptionStatus(user.id, forceRefresh);
      const isExpired = subscriptionService.isSubscriptionExpired(status);
      const supabaseSubscribed = status.isSubscribed && !isExpired;

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
  }, [user?.id, customerInfo]);

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
      // Trigger server-side business selection check
      // This will automatically set/clear the must_choose_businesses flag and handle business states
      const { data: selectionResult, error: selectionError } = await supabase
        .rpc('check_business_selection_requirement', { p_user_id: user.id });

      if (selectionError) {
        console.error('[RevenueCatSubscriptionContext] Error checking business selection:', selectionError);
      } else {
        console.log('[RevenueCatSubscriptionContext] Server-side business selection check result:', selectionResult);
      }

      // Now fetch the current state from database
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

      // NOTE: Business selection flag setting logic has been moved to server-side
      // The database function check_business_selection_requirement now handles:
      // - Checking if limit is exceeded
      // - Checking if businesses are already properly configured
      // - Setting/clearing the must_choose_businesses flag
      // - Auto-activating businesses when within limit
      // This client code now only reads the flag and displays the modal

      /* COMMENTED OUT - Logic moved to server-side check_business_selection_requirement function
      if (limitExceeded && !mustChooseFromDb) {
        const businesses = await businessService.getUserOwnedBusinessesWithState(user.id);
        const activeCount = businesses.filter((b: any) => b.access_state === 'active').length;
        const readOnlyCount = businesses.filter((b: any) => b.access_state === 'read_only_sales').length;

        console.log('[RevenueCatSubscriptionContext] Businesses state check:', {
          activeCount,
          readOnlyCount,
          maxAllowed,
          alreadyConfigured: activeCount === maxAllowed && readOnlyCount > 0
        });

        if (activeCount === maxAllowed && readOnlyCount > 0) {
          console.log('[RevenueCatSubscriptionContext] Businesses already in correct state, no action needed');
          setMustChooseBusinesses(false);
          setOwnedBusinesses([]);
          setReadOnlyBusinessIds([]);
        } else {
          console.log('[RevenueCatSubscriptionContext] Limit exceeded and not configured, setting must_choose_businesses flag');
          await supabase
            .from('user_profiles')
            .update({ must_choose_businesses: true })
            .eq('user_id', user.id);

          setOwnedBusinesses(businesses);

          const readOnlyIds = businesses
            .filter((b: any) => b.access_state === 'read_only_sales')
            .map((b: any) => b.id);
          setReadOnlyBusinessIds(readOnlyIds);
          setMustChooseBusinesses(true);

          setTierInfo(tierData);
          setOwnedBusinessCount(ownedCount);
        }
      } else */ if (mustChooseFromDb) {
        console.log('[RevenueCatSubscriptionContext] must_choose_businesses flag is set, showing modal');
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
        console.log('[RevenueCatSubscriptionContext] No action needed, clearing modal state');
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

      const currentInfo = await revenueCatService.getCustomerInfo();
      const activeProductIds = Object.values(currentInfo.entitlements.active)
        .map((entitlement: any) => entitlement.productIdentifier);

      if (activeProductIds.includes(productId)) {
        console.log('[RevenueCatSubscriptionContext] User already has this subscription');

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

        return true;
      }

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

      return true;
    } catch (error: any) {
      console.error('[RevenueCatSubscriptionContext] Error purchasing subscription:', error);

      if (error?.code === 'PRODUCT_ALREADY_PURCHASED_ERROR' ||
          error?.message?.toLowerCase().includes('already purchased') ||
          error?.message?.toLowerCase().includes('already own')) {
        console.log('[RevenueCatSubscriptionContext] Product already owned, returning success');

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

        return true;
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  }, [offerings, user?.id, currentBusiness?.id]);

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

        return true;
      }

      return false;
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentBusiness?.id]);

  const showPaywall = useCallback(async () => {
    if (!currentBusiness) return;

    const isOwner = user?.id === currentBusiness.owner_user_id;

    if (isOwner) {
      setIsPaywallVisible(true);
    } else if (user?.id) {
      const result = await accessControl.getUserOwnedBusinesses(user.id);
      if (result.count > 0) {
        setTeamMemberOwnedBusinesses(result.businesses);
        setIsTeamMemberUpgradeModalVisible(true);
      } else {
        setIsUnauthorizedModalVisible(true);
      }
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

  const hideTeamMemberUpgradeModal = useCallback(() => {
    setIsTeamMemberUpgradeModalVisible(false);
  }, []);

  const handleTeamMemberUpgradeConfirm = useCallback(() => {
    setIsTeamMemberUpgradeModalVisible(false);
    setIsPaywallVisible(true);
  }, []);

  const handleReconnect = useCallback((channelType: 'subscription' | 'business', setupFn: () => void) => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('[RevenueCatSubscriptionContext] Max reconnect attempts reached for', channelType, '- will retry on next app activity');
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
          console.log('[RevenueCatSubscriptionContext] Business count channel connection issue, attempting reconnect');
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
          console.log('[RevenueCatSubscriptionContext] User profile channel connection issue, attempting reconnect');
          handleReconnect('subscription', setupUserProfileSubscription);
        }
      });

    userProfileChannelRef.current = channel;
  }, [user?.id, handleReconnect, loadDowngradeData]);

  const setupSalesCountSubscription = useCallback(() => {
    if (!user?.id || !isAppActiveRef.current) {
      return;
    }

    if (salesCountChannelRef.current) {
      try {
        salesCountChannelRef.current.unsubscribe();
      } catch (error) {
        console.error('[RevenueCatSubscriptionContext] Error unsubscribing sales count channel:', error);
      }
      salesCountChannelRef.current = null;
    }

    const channel = supabase
      .channel(`sales-count-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sales_counts',
          filter: `user_id=eq.${user.id}`
        },
        async (payload: any) => {
          console.log('[RevenueCatSubscriptionContext] Sales count change detected:', payload);

          try {
            if (!currentBusiness?.id) {
              console.log('[RevenueCatSubscriptionContext] No current business, skipping sales count update');
              return;
            }

            const countData = await subscriptionService.getSalesCountData(user.id, currentBusiness.id);
            console.log('[RevenueCatSubscriptionContext] Updated sales count data:', countData);
            setSalesCountData(countData);
          } catch (error) {
            console.error('[RevenueCatSubscriptionContext] Error updating sales count:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('[RevenueCatSubscriptionContext] Sales count channel status:', status);

        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('[RevenueCatSubscriptionContext] Sales count channel connection issue, attempting reconnect');
          handleReconnect('subscription', setupSalesCountSubscription);
        }
      });

    salesCountChannelRef.current = channel;
  }, [user?.id, currentBusiness?.id, handleReconnect]);

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
        async (payload: any) => {
          console.log('[RevenueCatSubscriptionContext] Subscription change detected');

          if (!user?.id) {
            console.warn('[RevenueCatSubscriptionContext] No user ID available, skipping update');
            return;
          }

          try {
            const updatedBy = payload.new?.updated_by;
            console.log('[RevenueCatSubscriptionContext] Update source:', updatedBy);

            if (updatedBy === 'webhook') {
              console.log('[RevenueCatSubscriptionContext] Webhook update - skipping refreshCustomerInfo to prevent sync loop');
            } else if (isRevenueCatAvailable) {
              console.log('[RevenueCatSubscriptionContext] Non-webhook update - calling refreshCustomerInfo');
              try {
                await refreshCustomerInfo();
              } catch (refreshError) {
                console.error('[RevenueCatSubscriptionContext] Error refreshing customer info:', refreshError);
              }
            }

            const fullState = await subscriptionService.getFullSubscriptionState(
              user.id,
              currentBusiness?.id || null
            );

            if (fullState?.subscriptionStatus) {
              setSubscriptionStatus(fullState.subscriptionStatus);
              setIsSubscribed(fullState.subscriptionStatus.isSubscribed || false);
            }

            if (fullState?.tierInfo) {
              setTierInfo(fullState.tierInfo);
            }

            if (fullState?.ownedBusinessCount !== undefined) {
              setOwnedBusinessCount(fullState.ownedBusinessCount);
            }

            if (fullState?.salesCountData) {
              setSalesCountData(fullState.salesCountData);
            } else {
              setSalesCountData({
                salesCount: 0,
                remainingSales: FREE_TIER_LIMIT,
                isAtLimit: false,
              });
            }

            if (fullState?.canAccessFeature !== null && fullState?.canAccessFeature !== undefined) {
              setCanAccessFeature(fullState.canAccessFeature);
            }
          } catch (error) {
            console.error('[RevenueCatSubscriptionContext] Error processing subscription change:', error);

            setSalesCountData({
              salesCount: 0,
              remainingSales: FREE_TIER_LIMIT,
              isAtLimit: false,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[RevenueCatSubscriptionContext] Subscription channel status:', status);

        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('[RevenueCatSubscriptionContext] Subscription channel connection issue, attempting reconnect');
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
      setupSalesCountSubscription();
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

      if (salesCountChannelRef.current) {
        try {
          salesCountChannelRef.current.unsubscribe();
        } catch (error) {
          console.error('[RevenueCatSubscriptionContext] Error cleaning up sales count channel:', error);
        }
        salesCountChannelRef.current = null;
      }
    };
  }, [user?.id, setupRealtimeSubscription, setupBusinessCountSubscription, setupUserProfileSubscription, setupSalesCountSubscription]);

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
      <TeamMemberUpgradeInfoModal
        visible={isTeamMemberUpgradeModalVisible}
        onClose={hideTeamMemberUpgradeModal}
        onConfirm={handleTeamMemberUpgradeConfirm}
        ownedBusinesses={teamMemberOwnedBusinesses}
        currentBusinessName={currentBusiness?.business_name}
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
