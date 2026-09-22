import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT, TierInfo, BusinessDisableReason, FullSubscriptionState } from '@/src/services/subscriptionService';
import { deriveEntitlement, toSubscriptionStatus, toTierInfo, mirrorDisagrees, entitlementFingerprint, DerivedEntitlement, DbSubscriptionSnapshot } from '@/src/services/entitlementState';
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
  businessDisableReason: BusinessDisableReason;
  tierInfo: TierInfo;
  ownedBusinessCount: number;
  isIAPAvailable: boolean;
  mustChooseBusinesses: boolean;
  ownedBusinesses: any[];
  readOnlyBusinessIds: string[];
  isBusinessReadOnly: (businessId: string) => boolean;
  offerings: any | null;
  customerInfo: any | null;
  hasError: boolean;
  /** where the plan shown to the user comes from: the RevenueCat SDK, or the database mirror when the SDK cannot answer */
  subscriptionSource: 'revenuecat' | 'database';
  retryInitialization: () => Promise<void>;

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

// Re-verify one RevenueCat state against the mirror at most this often
const MIRROR_SYNC_WINDOW_MS = 60 * 1000;
// Ask the SDK for fresh customer info on foreground at most this often (it answers from cache when fresh)
const FOREGROUND_CHECK_MS = 60 * 1000;

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
  const customerInfoRef = useRef<any | null>(null);
  useEffect(() => { customerInfoRef.current = customerInfo; }, [customerInfo]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [isUnauthorizedModalVisible, setIsUnauthorizedModalVisible] = useState(false);
  const [isTeamMemberUpgradeModalVisible, setIsTeamMemberUpgradeModalVisible] = useState(false);
  const [teamMemberOwnedBusinesses, setTeamMemberOwnedBusinesses] = useState<Array<{ id: string; business_name: string }>>([]);
  const [canAccessFeature, setCanAccessFeature] = useState(true);
  const [businessDisableReason, setBusinessDisableReason] = useState<BusinessDisableReason>(null);
  const [mustChooseBusinesses, setMustChooseBusinesses] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState<any[]>([]);
  const [readOnlyBusinessIds, setReadOnlyBusinessIds] = useState<string[]>([]);
  const isFirstLoadRef = useRef(true);
  const currentBusinessIdRef = useRef<string | null>(null);
  useEffect(() => { currentBusinessIdRef.current = currentBusiness?.id ?? null; }, [currentBusiness?.id]);

  // RevenueCat is the source of truth for the signed-in user's own plan. rcStateRef holds
  // the plan derived from the SDK's customer info (cached on the device, so reading it is
  // free). While it is null (web, Expo Go, or the SDK has not answered yet) the database
  // mirror drives the same state. dbSnapshotRef remembers what the mirror last said so the
  // two can be compared; a disagreement triggers one server-side re-verification.
  const rcStateRef = useRef<DerivedEntitlement | null>(null);
  const dbSnapshotRef = useRef<DbSubscriptionSnapshot | null>(null);
  const mirrorSyncRef = useRef<{ inFlight: Promise<boolean> | null; lastFingerprint: string | null; lastAt: number; disabled: boolean }>({ inFlight: null, lastFingerprint: null, lastAt: 0, disabled: false });
  const lastForegroundCheckRef = useRef(0);
  const [subscriptionSource, setSubscriptionSource] = useState<'revenuecat' | 'database'>('database');
  const applyFullStateRef = useRef<(state: FullSubscriptionState) => void>(() => {});

  useEffect(() => {
    rcStateRef.current = null;
    dbSnapshotRef.current = null;
    mirrorSyncRef.current = { inFlight: null, lastFingerprint: null, lastAt: 0, disabled: false };
    setSubscriptionSource('database');
  }, [user?.id]);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const businessCountChannelRef = useRef<RealtimeChannel | null>(null);
  const userProfileChannelRef = useRef<RealtimeChannel | null>(null);
  const salesCountChannelRef = useRef<RealtimeChannel | null>(null);
  const businessAccessChannelRef = useRef<RealtimeChannel | null>(null);
  const customerInfoListenerRemoveRef = useRef<(() => void) | null>(null);
  const isAppActiveRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsMap = useRef<Record<string, number>>({});
  const maxReconnectAttempts = 5;

  /**
   * When the plan from RevenueCat and the mirror disagree, ask the server to re-verify with
   * RevenueCat's API and correct the mirror. Never on the normal path: it runs only on a
   * disagreement (or after a purchase), once per distinct RevenueCat state per window, and
   * never twice at once. Resolves true when the mirror was changed.
   */
  const reconcileMirror = useCallback(async (force = false): Promise<boolean> => {
    const rc = rcStateRef.current;
    const sync = mirrorSyncRef.current;
    const userId = user?.id;
    if (!userId || !rc || sync.disabled) return false;
    if (!force && !mirrorDisagrees(rc, dbSnapshotRef.current)) return false;
    if (sync.inFlight) return sync.inFlight;

    const fingerprint = entitlementFingerprint(rc);
    if (!force && sync.lastFingerprint === fingerprint && Date.now() - sync.lastAt < MIRROR_SYNC_WINDOW_MS) return false;
    sync.lastFingerprint = fingerprint;
    sync.lastAt = Date.now();

    const run = (async () => {
      try {
        console.log('[RevenueCatSubscriptionContext] Mirror disagrees with RevenueCat, asking the server to re-verify');
        const outcome = await subscriptionService.syncMirrorWithRevenueCat();
        if (!outcome.ok) {
          if (outcome.reason === 'not_configured') {
            sync.disabled = true;
            console.warn('[RevenueCatSubscriptionContext] sync-subscription is not configured; the mirror will only follow the webhook');
          }
          return false;
        }
        const result = outcome.result;
        if (result.tier) {
          dbSnapshotRef.current = { tier: result.tier, expirationDate: result.expirationDate ?? null, productId: result.productId ?? null };
        }
        if (result.changed) {
          console.log('[RevenueCatSubscriptionContext] Mirror corrected:', result.status, result.tier);
          const full = await subscriptionService.getFullSubscriptionState(userId, currentBusinessIdRef.current);
          applyFullStateRef.current(full);
        }
        return !!result.changed;
      } catch (error) {
        console.warn('[RevenueCatSubscriptionContext] Mirror re-verification failed:', error);
        return false;
      } finally {
        sync.inFlight = null;
      }
    })();
    sync.inFlight = run;
    return run;
  }, [user?.id]);

  /** Makes the plan in RevenueCat's customer info the plan the app runs on. */
  const applyEntitlement = useCallback((info: any | null) => {
    // null means the SDK could not answer (no cache yet and offline): keep what we have
    if (!info || !user?.id) return;
    const derived = deriveEntitlement(info);
    rcStateRef.current = derived;
    setCustomerInfo(info);
    setSubscriptionStatus(toSubscriptionStatus(derived, info?.originalAppUserId || user.id));
    setIsSubscribed(derived.isActive);
    setTierInfo(toTierInfo(derived));
    setSubscriptionSource('revenuecat');
    void reconcileMirror();
  }, [user?.id, reconcileMirror]);

  /**
   * Records what the database mirror says. The mirror only drives the plan shown to the
   * user while RevenueCat has not answered (web, Expo Go, first milliseconds of a launch).
   */
  const noteDbSubscription = useCallback((snapshot: DbSubscriptionSnapshot, status?: SubscriptionStatus, tier?: TierInfo) => {
    dbSnapshotRef.current = { ...(dbSnapshotRef.current ?? {}), ...snapshot };
    if (!rcStateRef.current) {
      if (status) {
        setSubscriptionStatus(status);
        setIsSubscribed(status.isSubscribed);
      }
      if (tier) setTierInfo(tier);
    }
    void reconcileMirror();
  }, [reconcileMirror]);

  /** Applies a get_full_subscription_state answer: plan via the mirror rule, business-level data always. */
  const applyFullState = useCallback((fullState: FullSubscriptionState) => {
    noteDbSubscription(
      { tier: fullState.tierInfo.tier, expirationDate: fullState.tierInfo.expirationDate ?? null, productId: fullState.subscriptionStatus.productId ?? null },
      fullState.subscriptionStatus,
      fullState.tierInfo,
    );
    setOwnedBusinessCount(fullState.ownedBusinessCount);
    if (fullState.salesCountData) setSalesCountData(fullState.salesCountData);
    if (fullState.canAccessFeature !== null && fullState.canAccessFeature !== undefined) {
      setCanAccessFeature(fullState.canAccessFeature);
      setBusinessDisableReason(fullState.businessDisableReason);
    }
  }, [noteDbSubscription]);
  useEffect(() => { applyFullStateRef.current = applyFullState; }, [applyFullState]);

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

      // The plan first: it comes from the SDK's on-device cache, so the app knows the
      // user's tier right away without waiting for the store or the network. The SDK
      // refreshes it in the background and reports changes through the listener.
      applyEntitlement(await revenueCatService.getCustomerInfo());
      setIsInitialized(true);
      setIsLoading(false);

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

      console.log('[RevenueCatSubscriptionContext] RevenueCat initialized successfully');
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error initializing RevenueCat:', error);
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, [user?.id, user?.email, applyEntitlement]);

  /** Re-reads the plan from the SDK (cache when fresh, network otherwise) and applies it. */
  const refreshCustomerInfo = useCallback(async () => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id) return;

    try {
      applyEntitlement(await revenueCatService.getCustomerInfo());
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error refreshing customer info:', error);
    }
  }, [user?.id, applyEntitlement]);

  const refreshSubscriptionStatus = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;

    try {
      const shouldForceRefresh = forceRefresh || isFirstLoadRef.current;
      // Ask RevenueCat too, so a manual refresh picks up a plan change straight away
      const [status] = await Promise.all([
        subscriptionService.getSubscriptionStatus(user.id, shouldForceRefresh),
        refreshCustomerInfo(),
      ]);
      const isExpired = subscriptionService.isSubscriptionExpired(status);
      const supabaseSubscribed = status.isSubscribed && !isExpired;

      noteDbSubscription(
        { expirationDate: status.expirationDate ?? null, productId: status.productId ?? null },
        {
          ...status,
          isSubscribed: supabaseSubscribed,
          subscriptionStatus: supabaseSubscribed ? 'active' : (isExpired ? 'expired' : status.subscriptionStatus)
        },
      );
      setHasError(false);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
      setHasError(true);
      throw error;
    }
  }, [user?.id, refreshCustomerInfo, noteDbSubscription]);

  const refreshSalesCount = useCallback(async () => {
    if (!user?.id || !currentBusiness?.id) return;

    try {
      const countData = await subscriptionService.getSalesCountData(user.id, currentBusiness.id);
      setSalesCountData(countData);
      setHasError(false);
    } catch (error) {
      console.error('Error refreshing sales count:', error);
      setHasError(true);
      throw error;
    }
  }, [user?.id, currentBusiness?.id]);

  const refreshTierInfo = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [tierData, ownedCount] = await Promise.all([
        subscriptionService.getTierInfo(user.id),
        subscriptionService.getOwnedBusinessCount(user.id)
      ]);
      noteDbSubscription({ tier: tierData.tier, expirationDate: tierData.expirationDate }, undefined, tierData);
      setOwnedBusinessCount(ownedCount);
      setHasError(false);
    } catch (error) {
      console.error('Error refreshing tier info:', error);
      setHasError(true);
      throw error;
    }
  }, [user?.id, noteDbSubscription]);

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

        noteDbSubscription({ tier: tierData.tier, expirationDate: tierData.expirationDate }, undefined, tierData);
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
  }, [user?.id, noteDbSubscription]);

  const checkFeatureAccess = useCallback(async (forceRefresh = false) => {
    if (!user?.id || !currentBusiness?.id) {
      setCanAccessFeature(false);
      setBusinessDisableReason(null);
      return;
    }

    try {
      const hasAccess = await subscriptionService.canAccessFeature(user.id, currentBusiness.id, forceRefresh);
      setCanAccessFeature(hasAccess);
      const reason = await subscriptionService.getBusinessDisableReason(currentBusiness.id);
      setBusinessDisableReason(reason);
    } catch (error) {
      console.error('Error checking feature access:', error);
      setCanAccessFeature(false);
      setBusinessDisableReason(null);
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
      const activeProductIds = Object.values(currentInfo?.entitlements?.active ?? {})
        .map((entitlement: any) => entitlement.productIdentifier);

      if (activeProductIds.includes(productId)) {
        console.log('[RevenueCatSubscriptionContext] User already has this subscription');
        applyEntitlement(currentInfo);
        await reconcileMirror(true);
        applyFullState(await subscriptionService.getFullSubscriptionState(user.id, currentBusiness?.id));
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

      // The store's answer is the truth: the user is on the new plan right now
      applyEntitlement(newCustomerInfo);

      // Bring the mirror up to date so server-side checks (sales limit, business limit)
      // follow immediately; the webhook will land later and write the same thing
      const mirrorCorrected = await reconcileMirror(true);

      let fullState = await subscriptionService.getFullSubscriptionState(user.id, currentBusiness?.id);

      if (!mirrorCorrected && !fullState.subscriptionStatus.isSubscribed) {
        // Server-side verification was not available: give the webhook a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        fullState = await subscriptionService.getFullSubscriptionState(user.id, currentBusiness?.id);
      }

      if (!mirrorCorrected && !fullState.subscriptionStatus.isSubscribed) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        fullState = await subscriptionService.getFullSubscriptionState(user.id, currentBusiness?.id);
      }

      applyFullState(fullState);
      return true;
    } catch (error: any) {
      console.error('[RevenueCatSubscriptionContext] Error purchasing subscription:', error);

      if (error?.code === 'PRODUCT_ALREADY_PURCHASED_ERROR' ||
          error?.message?.toLowerCase().includes('already purchased') ||
          error?.message?.toLowerCase().includes('already own')) {
        console.log('[RevenueCatSubscriptionContext] Product already owned, returning success');
        await refreshCustomerInfo();
        await reconcileMirror(true);
        applyFullState(await subscriptionService.getFullSubscriptionState(user.id, currentBusiness?.id));
        return true;
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  }, [offerings, user?.id, currentBusiness?.id, applyEntitlement, reconcileMirror, applyFullState, refreshCustomerInfo]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable) {
      console.log('[RevenueCatSubscriptionContext] Restore not supported in this environment');
      return false;
    }

    try {
      setIsLoading(true);

      const restoredInfo = await revenueCatService.restorePurchases();
      applyEntitlement(restoredInfo);

      if (deriveEntitlement(restoredInfo).isActive) {
        await reconcileMirror(true);
        applyFullState(await subscriptionService.getFullSubscriptionState(user.id, currentBusiness?.id));
        return true;
      }

      return false;
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentBusiness?.id, applyEntitlement, reconcileMirror, applyFullState]);

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

  const retryInitialization = useCallback(async () => {
    if (!user?.id) return;

    console.log('[RevenueCatSubscriptionContext] Retrying initialization...');
    setIsLoading(true);
    setHasError(false);
    isFirstLoadRef.current = true;

    try {
      await Promise.all([
        refreshSubscriptionStatus(true),
        refreshTierInfo(),
        loadDowngradeData()
      ]);

      if (currentBusiness?.id) {
        await Promise.all([
          refreshSalesCount(),
          checkFeatureAccess(true)
        ]);
      }

      isFirstLoadRef.current = false;
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Retry failed:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshTierInfo, loadDowngradeData, refreshSalesCount, checkFeatureAccess]);

  const handleReconnect = useCallback((channelType: string, setupFn: () => void) => {
    const attempts = reconnectAttemptsMap.current[channelType] ?? 0;
    if (attempts >= maxReconnectAttempts) {
      console.log('[RevenueCatSubscriptionContext] Max reconnect attempts reached for', channelType, '- will retry on next app activity');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    reconnectAttemptsMap.current[channelType] = attempts + 1;

    console.log(`[RevenueCatSubscriptionContext] Reconnecting ${channelType} channel in ${delay}ms (attempt ${attempts + 1}/${maxReconnectAttempts})`);

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
          reconnectAttemptsMap.current['business'] = 0;
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
          reconnectAttemptsMap.current['user-profile'] = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('[RevenueCatSubscriptionContext] User profile channel connection issue, attempting reconnect');
          handleReconnect('user-profile', setupUserProfileSubscription);
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
          reconnectAttemptsMap.current['sales-count'] = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('[RevenueCatSubscriptionContext] Sales count channel connection issue, attempting reconnect');
          handleReconnect('sales-count', setupSalesCountSubscription);
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
            // The mirror changed (webhook or rc_sync). The plan itself still comes from
            // RevenueCat; this refresh picks up the business-level consequences.
            console.log('[RevenueCatSubscriptionContext] Update source:', payload.new?.updated_by);

            const fullState = await subscriptionService.getFullSubscriptionState(
              user.id,
              currentBusinessIdRef.current
            );
            applyFullState(fullState);
            if (!fullState.salesCountData) {
              setSalesCountData({
                salesCount: 0,
                remainingSales: FREE_TIER_LIMIT,
                isAtLimit: false,
              });
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
          reconnectAttemptsMap.current['subscription'] = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('[RevenueCatSubscriptionContext] Subscription channel connection issue, attempting reconnect');
          handleReconnect('subscription', setupRealtimeSubscription);
        }
      });

    realtimeChannelRef.current = channel;
  }, [user?.id, applyFullState, handleReconnect]);

  const setupCustomerInfoListener = useCallback(() => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id || !revenueCatService) return;

    // Remove previous listener to prevent memory leaks
    if (customerInfoListenerRemoveRef.current) {
      customerInfoListenerRemoveRef.current();
      customerInfoListenerRemoveRef.current = null;
    }

    try {
      if (revenueCatService.addCustomerInfoUpdateListener) {
        // The SDK calls this whenever the plan changes: after a purchase, a renewal, a
        // cancellation taking effect, or its own background refresh. This is how the app
        // follows RevenueCat without polling.
        const remove = revenueCatService.addCustomerInfoUpdateListener(async (info: any) => {
          const before = rcStateRef.current ? entitlementFingerprint(rcStateRef.current) : null;
          applyEntitlement(info);
          const after = rcStateRef.current ? entitlementFingerprint(rcStateRef.current) : null;
          if (before === after) return;

          // The plan changed: refresh the business-level consequences from the server
          try {
            applyFullState(await subscriptionService.getFullSubscriptionState(user.id, currentBusinessIdRef.current));
          } catch (error) {
            console.error('[RevenueCatSubscriptionContext] Error refreshing state from listener:', error);
          }
        });
        customerInfoListenerRemoveRef.current = remove;
      }
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error setting up customer info listener:', error);
    }
  }, [user?.id, applyEntitlement, applyFullState]);

  useEffect(() => {
    if (user?.id) {
      initializeRevenueCat();
      if (isRevenueCatAvailable) {
        setupCustomerInfoListener();
      }
    }
    return () => {
      if (customerInfoListenerRemoveRef.current) {
        customerInfoListenerRemoveRef.current();
        customerInfoListenerRemoveRef.current = null;
      }
    };
  }, [user?.id, initializeRevenueCat, setupCustomerInfoListener]);

  // On return to the foreground, re-read the plan. The SDK answers from cache when it is
  // fresh and only goes to the network when it is stale, so this costs nothing in the
  // common case and catches a renewal or expiry that happened while the app was away.
  useEffect(() => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundCheckRef.current < FOREGROUND_CHECK_MS) return;
      lastForegroundCheckRef.current = now;
      void refreshCustomerInfo();
    });
    return () => sub.remove();
  }, [user?.id, refreshCustomerInfo]);

  useEffect(() => {
    if (user?.id) {
      const loadInitialData = async () => {
        try {
          await Promise.all([
            refreshSubscriptionStatus(),
            refreshTierInfo(),
            loadDowngradeData()
          ]);
          isFirstLoadRef.current = false;
        } catch (error) {
          console.error('[RevenueCatSubscriptionContext] Error loading initial subscription data:', error);
          setHasError(true);
        } finally {
          setIsLoading(false);
        }
      };
      loadInitialData();
    }
  }, [user?.id, refreshSubscriptionStatus, refreshTierInfo, loadDowngradeData]);

  useEffect(() => {
    if (user?.id && currentBusiness?.id) {
      const loadBusinessData = async () => {
        try {
          await Promise.all([
            refreshSalesCount(),
            checkFeatureAccess()
          ]);
        } catch (error) {
          console.error('[RevenueCatSubscriptionContext] Error loading business data:', error);
        }
      };
      loadBusinessData();
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

  // Realtime subscription for business access_state changes (so team members see owner_disabled immediately)
  useEffect(() => {
    if (!currentBusiness?.id) return;

    if (businessAccessChannelRef.current) {
      try {
        businessAccessChannelRef.current.unsubscribe();
      } catch (_) {}
      businessAccessChannelRef.current = null;
    }

    const channel = supabase
      .channel(`business-access-state-${currentBusiness.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${currentBusiness.id}`,
        },
        (payload) => {
          const newState = payload.new?.access_state;
          const oldState = payload.old?.access_state;
          if (newState !== oldState) {
            console.log('[RevenueCatSubscriptionContext] Business access_state changed:', oldState, '->', newState);
            checkFeatureAccess(true);
          }
        }
      )
      .subscribe();

    businessAccessChannelRef.current = channel;

    return () => {
      if (businessAccessChannelRef.current) {
        try {
          businessAccessChannelRef.current.unsubscribe();
        } catch (_) {}
        businessAccessChannelRef.current = null;
      }
    };
  }, [currentBusiness?.id, checkFeatureAccess]);

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
    businessDisableReason,
    tierInfo,
    ownedBusinessCount,
    isIAPAvailable: Platform.OS !== 'web' && isRevenueCatAvailable,
    mustChooseBusinesses,
    ownedBusinesses,
    readOnlyBusinessIds,
    isBusinessReadOnly,
    offerings,
    customerInfo,
    hasError,
    subscriptionSource,
    retryInitialization,
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
