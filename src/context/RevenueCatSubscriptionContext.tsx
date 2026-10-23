import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT, TierInfo, BusinessDisableReason, FullSubscriptionState } from '@/src/services/subscriptionService';
import { deriveEntitlement, toSubscriptionStatus, toTierInfo, mirrorDisagrees, entitlementFingerprint, salesAccess, DerivedEntitlement, DbSubscriptionSnapshot } from '@/src/services/entitlementState';
import { supabase } from '@/src/config/supabase';
import { useAuth } from './AuthContext';
import { UnauthorizedUpgradeModal } from '@/src/components/subscription/UnauthorizedUpgradeModal';
import { TeamMemberUpgradeInfoModal } from '@/src/components/subscription/TeamMemberUpgradeInfoModal';
import { DowngradePick } from '@/src/components/subscription/DowngradePick';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { businessService } from '@/src/services/business';
import { Paywall } from '@/src/components/subscription/Paywall';
import { accessControl } from '@/src/utils/accessControl';
import { analytics } from '@/src/services/analytics';

/**
 * The subscription state of the signed-in user and of the business they are working in.
 *
 * Two inputs, one rule:
 *  - RevenueCat's customer info (cached on the device by the SDK) is the truth for the
 *    user's OWN plan. It is applied the moment the SDK answers and whenever the SDK
 *    reports a change.
 *  - One server read, get_full_subscription_state, answers everything else: the mirror's
 *    view of the plan, how many sales the current business has used, whether the business
 *    is read-only or disabled, how many businesses the user owns. It is re-read on launch,
 *    on business change, on every realtime change that could affect it, on return to the
 *    foreground, and after a purchase. A failed read keeps the previous answer.
 *
 * The values screens read (canAccessFeature, salesCountData, isSubscribed, tierInfo) are
 * DERIVED from those two inputs in one place (see `salesAccess`), so a paid owner is never
 * blocked by the free limit while the mirror lags, and a read-only or disabled business is
 * blocked for everyone. When the two inputs disagree the app asks the server to re-verify
 * the mirror with RevenueCat's API (sync-subscription).
 */

let revenueCatService: any = null;
let isRevenueCatAvailable = false;

if (Platform.OS !== 'web') {
  try {
    const rcServiceModule = require('@/src/services/revenueCatService');
    revenueCatService = rcServiceModule.revenueCatService;
    isRevenueCatAvailable = !!revenueCatService && typeof revenueCatService.isAvailable === 'function' && revenueCatService.isAvailable();
    console.log('[RevenueCatSubscriptionContext] RevenueCat available:', isRevenueCatAvailable);
  } catch (error) {
    console.log('[RevenueCatSubscriptionContext] RevenueCat service not loaded, database-only mode:', error instanceof Error ? error.message : error);
    isRevenueCatAvailable = false;
    revenueCatService = null;
  }
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
  /**
   * Asks the server to re-verify the mirror with RevenueCat now and re-reads the state.
   * For a sale that the server refused for the free limit while the plan is paid: call
   * this, then try the sale once more. Resolves true when the mirror was corrected.
   */
  reverifyPlan: () => Promise<boolean>;
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
// On return to the foreground, re-read the plan and the server state at most this often
const FOREGROUND_CHECK_MS = 60 * 1000;

const DEFAULT_STATUS: SubscriptionStatus = { isSubscribed: false, subscriptionStatus: 'trial' };
const DEFAULT_TIER: TierInfo = { tier: 'free', maxOwnedBusinesses: null, subscriptionStatus: 'trial', expirationDate: null };
const DEFAULT_SALES: SalesCountData = { salesCount: 0, remainingSales: FREE_TIER_LIMIT, isAtLimit: false, totalSalesAllBusinesses: 0 };
const UNLIMITED = 999999;

export const RevenueCatSubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, currentBusiness } = useAuth();

  // --- the two inputs ---
  const [rcEntitlement, setRcEntitlement] = useState<DerivedEntitlement | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [serverState, setServerState] = useState<FullSubscriptionState | null>(null);

  // --- everything else ---
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [isUnauthorizedModalVisible, setIsUnauthorizedModalVisible] = useState(false);
  const [isTeamMemberUpgradeModalVisible, setIsTeamMemberUpgradeModalVisible] = useState(false);
  const [teamMemberOwnedBusinesses, setTeamMemberOwnedBusinesses] = useState<Array<{ id: string; business_name: string }>>([]);
  const [mustChooseBusinesses, setMustChooseBusinesses] = useState(false);
  const [ownedBusinesses, setOwnedBusinesses] = useState<any[]>([]);
  const [readOnlyBusinessIds, setReadOnlyBusinessIds] = useState<string[]>([]);

  const rcStateRef = useRef<DerivedEntitlement | null>(null);
  const dbSnapshotRef = useRef<DbSubscriptionSnapshot | null>(null);
  const mirrorSyncRef = useRef<{ inFlight: Promise<boolean> | null; lastFingerprint: string | null; lastAt: number; disabled: boolean }>({ inFlight: null, lastFingerprint: null, lastAt: 0, disabled: false });
  const fullStateInFlightRef = useRef<Promise<void> | null>(null);
  const currentBusinessIdRef = useRef<string | null>(null);
  useEffect(() => { currentBusinessIdRef.current = currentBusiness?.id ?? null; }, [currentBusiness?.id]);
  const lastForegroundCheckRef = useRef(0);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const businessCountChannelRef = useRef<RealtimeChannel | null>(null);
  const userProfileChannelRef = useRef<RealtimeChannel | null>(null);
  const salesCountChannelRef = useRef<RealtimeChannel | null>(null);
  const businessAccessChannelRef = useRef<RealtimeChannel | null>(null);
  const customerInfoListenerRemoveRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsMap = useRef<Record<string, number>>({});
  const maxReconnectAttempts = 5;

  // A new sign-in starts from nothing
  useEffect(() => {
    rcStateRef.current = null;
    dbSnapshotRef.current = null;
    mirrorSyncRef.current = { inFlight: null, lastFingerprint: null, lastAt: 0, disabled: false };
    setRcEntitlement(null);
    setCustomerInfo(null);
    setServerState(null);
  }, [user?.id]);

  // =========================================================================
  // The one server read
  // =========================================================================

  /** Re-reads get_full_subscription_state for the current business. Shared while in flight; a failure keeps the last answer. */
  const loadFullState = useCallback(async (): Promise<void> => {
    const userId = user?.id;
    if (!userId) return;
    if (fullStateInFlightRef.current) return fullStateInFlightRef.current;
    const run = (async () => {
      try {
        const state = await subscriptionService.getFullSubscriptionState(userId, currentBusinessIdRef.current);
        dbSnapshotRef.current = {
          tier: state.tierInfo.tier,
          expirationDate: state.tierInfo.expirationDate ?? null,
          productId: state.subscriptionStatus.productId ?? null,
        };
        setServerState(state);
        setHasError(false);
      } catch (error) {
        console.warn('[RevenueCatSubscriptionContext] Server state not refreshed, keeping the last answer:', error instanceof Error ? error.message : error);
        setHasError(true);
      } finally {
        fullStateInFlightRef.current = null;
      }
    })();
    fullStateInFlightRef.current = run;
    return run;
  }, [user?.id]);

  /**
   * When the plan from RevenueCat and the mirror disagree, ask the server to re-verify with
   * RevenueCat's API and correct the mirror. Runs only on a disagreement (or when forced),
   * once per distinct RevenueCat state per window, never twice at once. Resolves true when
   * the mirror was changed.
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
        console.log('[RevenueCatSubscriptionContext] Asking the server to re-verify the plan with RevenueCat');
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
          await loadFullState();
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
  }, [user?.id, loadFullState]);

  /** Makes the plan in RevenueCat's customer info the plan the app runs on. */
  const applyEntitlement = useCallback((info: any | null) => {
    // null means the SDK could not answer (no cache yet and offline): keep what we have
    if (!info || !user?.id) return;
    const derived = deriveEntitlement(info);
    rcStateRef.current = derived;
    setRcEntitlement(derived);
    setCustomerInfo(info);
    void reconcileMirror();
  }, [user?.id, reconcileMirror]);

  // =========================================================================
  // Derived state: what screens read
  // =========================================================================

  const isOwner = !!user?.id && !!currentBusiness && currentBusiness.owner_user_id === user.id;

  const subscriptionStatus = useMemo<SubscriptionStatus>(() => {
    if (rcEntitlement) return toSubscriptionStatus(rcEntitlement, customerInfo?.originalAppUserId || user?.id);
    return serverState?.subscriptionStatus ?? DEFAULT_STATUS;
  }, [rcEntitlement, customerInfo?.originalAppUserId, user?.id, serverState]);

  const tierInfo = useMemo<TierInfo>(() => {
    if (rcEntitlement) return toTierInfo(rcEntitlement);
    return serverState?.tierInfo ?? DEFAULT_TIER;
  }, [rcEntitlement, serverState]);

  const access = useMemo(() => salesAccess({
    rcActive: rcEntitlement ? rcEntitlement.isActive : null,
    isOwner,
    server: serverState && currentBusiness?.id ? {
      // the plan the limit follows is the business owner's: the server names it on the count
      planActive: serverState.salesCountData?.limitTier
        ? serverState.salesCountData.limitTier !== 'free'
        : serverState.subscriptionStatus.isSubscribed,
      isAtLimit: !!serverState.salesCountData?.isAtLimit,
      disableReason: serverState.businessDisableReason,
    } : null,
  }), [rcEntitlement, isOwner, serverState, currentBusiness?.id]);

  const salesCountData = useMemo<SalesCountData>(() => {
    const base = serverState?.salesCountData ?? DEFAULT_SALES;
    if (access.planActive) return { ...base, remainingSales: UNLIMITED, isAtLimit: false };
    return base;
  }, [serverState?.salesCountData, access.planActive]);

  // The mirror lags behind RevenueCat (paid plan, server still applies the limit): correct it now
  useEffect(() => {
    if (access.mirrorStale) void reconcileMirror(true);
  }, [access.mirrorStale, reconcileMirror]);

  // =========================================================================
  // RevenueCat
  // =========================================================================

  const initializeRevenueCat = useCallback(async () => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !revenueCatService) {
      console.log('[RevenueCatSubscriptionContext] Database-only mode');
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    try {
      await revenueCatService.configure(user?.id);

      // The plan first: it comes from the SDK's on-device cache, so the app knows the
      // user's tier right away without waiting for the store or the network.
      applyEntitlement(await revenueCatService.getCustomerInfo());
      setIsInitialized(true);
      setIsLoading(false);

      if (user?.id) {
        await revenueCatService.setAttributes({ 'user_id': user.id, 'email': user.email || null });
      }

      const offeringsData = await revenueCatService.getOfferings();
      setOfferings(offeringsData);
      if (offeringsData?.current) {
        setProducts(offeringsData.current.availablePackages.map((pkg: any) => ({
          productId: pkg.product.identifier,
          title: pkg.product.title,
          description: pkg.product.description,
          price: pkg.product.price.toString(),
          localizedPrice: pkg.product.priceString,
          currency: pkg.product.currencyCode,
          type: pkg.product.subscriptionPeriod?.includes('Y') ? 'yearly' : 'monthly',
        })));
      }
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

  const setupCustomerInfoListener = useCallback(() => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id || !revenueCatService) return;
    if (customerInfoListenerRemoveRef.current) {
      customerInfoListenerRemoveRef.current();
      customerInfoListenerRemoveRef.current = null;
    }
    try {
      if (revenueCatService.addCustomerInfoUpdateListener) {
        // The SDK calls this whenever the plan changes: after a purchase, a renewal, a
        // cancellation taking effect, or its own background refresh.
        const remove = revenueCatService.addCustomerInfoUpdateListener(async (info: any) => {
          const before = rcStateRef.current ? entitlementFingerprint(rcStateRef.current) : null;
          applyEntitlement(info);
          const after = rcStateRef.current ? entitlementFingerprint(rcStateRef.current) : null;
          if (before !== after) await loadFullState();
        });
        customerInfoListenerRemoveRef.current = remove;
      }
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error setting up customer info listener:', error);
    }
  }, [user?.id, applyEntitlement, loadFullState]);

  // =========================================================================
  // Downgrade: more businesses than the plan allows
  // =========================================================================

  const loadDowngradeData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // The server decides: it sets or clears must_choose_businesses and moves businesses
      // between active and read-only as the plan allows.
      const { error: selectionError } = await supabase.rpc('check_business_selection_requirement', { p_user_id: user.id });
      if (selectionError) {
        console.error('[RevenueCatSubscriptionContext] Error checking business selection:', selectionError);
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('must_choose_businesses')
        .eq('user_id', user.id)
        .maybeSingle() as unknown as { data: { must_choose_businesses: boolean } | null };

      if (profile?.must_choose_businesses) {
        const businesses = await businessService.getUserOwnedBusinessesWithState(user.id);
        setOwnedBusinesses(businesses);
        setReadOnlyBusinessIds(businesses.filter((b: any) => b.access_state === 'read_only_sales').map((b: any) => b.id));
        setMustChooseBusinesses(true);
      } else {
        setMustChooseBusinesses(false);
        setOwnedBusinesses([]);
        setReadOnlyBusinessIds([]);
      }
      // the check may have changed access states and counts
      await loadFullState();
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error loading downgrade data:', error);
      setMustChooseBusinesses(false);
      setOwnedBusinesses([]);
      setReadOnlyBusinessIds([]);
    }
  }, [user?.id, loadFullState]);

  // =========================================================================
  // Purchase and restore
  // =========================================================================

  const purchaseSubscription = useCallback(async (productId: string): Promise<boolean> => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable || !user?.id) {
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
        return true;
      }

      const pkg = offerings?.current?.availablePackages.find((p: any) => p.product.identifier === productId);
      if (!pkg) {
        console.error('[RevenueCatSubscriptionContext] Package not found for product:', productId);
        return false;
      }

      analytics.track(analytics.events.checkoutStarted, { product_id: productId });
      const { customerInfo: newCustomerInfo, cancelled } = await revenueCatService.purchasePackage(pkg);
      if (cancelled) return false;

      // The store's answer is the truth: the user is on the new plan right now, and the
      // derived state unblocks the sales buttons from this point. The server is told so
      // its own checks agree; the webhook will write the same thing shortly after.
      applyEntitlement(newCustomerInfo);
      await reconcileMirror(true);
      void loadFullState();
      return true;
    } catch (error: any) {
      console.error('[RevenueCatSubscriptionContext] Error purchasing subscription:', error);
      if (error?.code === 'PRODUCT_ALREADY_PURCHASED_ERROR' ||
          error?.message?.toLowerCase().includes('already purchased') ||
          error?.message?.toLowerCase().includes('already own')) {
        await refreshCustomerInfo();
        await reconcileMirror(true);
        return true;
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [offerings, user?.id, applyEntitlement, reconcileMirror, loadFullState, refreshCustomerInfo]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !isRevenueCatAvailable) return false;
    try {
      setIsLoading(true);
      const restoredInfo = await revenueCatService.restorePurchases();
      applyEntitlement(restoredInfo);
      if (deriveEntitlement(restoredInfo).isActive) {
        await reconcileMirror(true);
        void loadFullState();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [applyEntitlement, reconcileMirror, loadFullState]);

  // =========================================================================
  // Public refresh functions (all one server read, shared while in flight)
  // =========================================================================

  const refreshSubscriptionStatus = useCallback(async () => {
    await Promise.all([refreshCustomerInfo(), loadFullState()]);
  }, [refreshCustomerInfo, loadFullState]);
  const refreshSalesCount = loadFullState;
  const refreshTierInfo = loadFullState;

  const reverifyPlan = useCallback(async (): Promise<boolean> => {
    await refreshCustomerInfo();
    const changed = await reconcileMirror(true);
    if (!changed) await loadFullState();
    return changed;
  }, [refreshCustomerInfo, reconcileMirror, loadFullState]);

  const retryInitialization = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setHasError(false);
    try {
      await Promise.all([initializeRevenueCat(), loadDowngradeData()]);
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Retry failed:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, initializeRevenueCat, loadDowngradeData]);

  // =========================================================================
  // Paywall and modals
  // =========================================================================

  const showPaywall = useCallback(async () => {
    if (!currentBusiness) return;
    if (user?.id === currentBusiness.owner_user_id) {
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

  const hidePaywall = useCallback(() => setIsPaywallVisible(false), []);
  const hideUnauthorizedModal = useCallback(() => setIsUnauthorizedModalVisible(false), []);
  const hideTeamMemberUpgradeModal = useCallback(() => setIsTeamMemberUpgradeModalVisible(false), []);
  const handleTeamMemberUpgradeConfirm = useCallback(() => {
    setIsTeamMemberUpgradeModalVisible(false);
    setIsPaywallVisible(true);
  }, []);

  const isBusinessReadOnly = useCallback((businessId: string) => readOnlyBusinessIds.includes(businessId), [readOnlyBusinessIds]);

  const handleDowngradeModalDismiss = useCallback(async () => {
    if (!user?.id || ownedBusinesses.length === 0) return;
    try {
      const { error } = await supabase.functions.invoke('choose-businesses', {
        body: { userId: user.id, selectOldest: true, tierLimit: tierInfo.maxOwnedBusinesses || 1 },
      });
      if (error) throw error;
    } catch (error) {
      console.error('[RevenueCatSubscriptionContext] Failed to auto-select businesses:', error);
    } finally {
      await loadDowngradeData();
    }
  }, [user?.id, ownedBusinesses, tierInfo.maxOwnedBusinesses, loadDowngradeData]);

  // =========================================================================
  // Realtime: the mirror, the sales counter, the businesses, the profile flag
  // =========================================================================

  const handleReconnect = useCallback((channelType: string, setupFn: () => void) => {
    const attempts = reconnectAttemptsMap.current[channelType] ?? 0;
    if (attempts >= maxReconnectAttempts) {
      console.log('[RevenueCatSubscriptionContext] Max reconnect attempts reached for', channelType, '- will retry when the app comes to the foreground');
      return;
    }
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    reconnectAttemptsMap.current[channelType] = attempts + 1;
    reconnectTimeoutRef.current = setTimeout(setupFn, delay);
  }, []);

  const replaceChannel = (ref: React.MutableRefObject<RealtimeChannel | null>) => {
    if (ref.current) {
      try { ref.current.unsubscribe(); } catch {}
      ref.current = null;
    }
  };

  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id) return;
    replaceChannel(realtimeChannelRef);
    realtimeChannelRef.current = supabase
      .channel(`subscription-changes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        // The mirror changed (webhook or rc_sync): pick up the business-level consequences
        console.log('[RevenueCatSubscriptionContext] Mirror changed by', payload.new?.updated_by);
        void loadFullState();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reconnectAttemptsMap.current['subscription'] = 0;
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handleReconnect('subscription', setupRealtimeSubscription);
      });
  }, [user?.id, loadFullState, handleReconnect]);

  const setupBusinessCountSubscription = useCallback(() => {
    if (!user?.id) return;
    replaceChannel(businessCountChannelRef);
    businessCountChannelRef.current = supabase
      .channel(`business-count-changes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `owner_user_id=eq.${user.id}` }, () => {
        void loadFullState();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reconnectAttemptsMap.current['business'] = 0;
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handleReconnect('business', setupBusinessCountSubscription);
      });
  }, [user?.id, loadFullState, handleReconnect]);

  const setupUserProfileSubscription = useCallback(() => {
    if (!user?.id) return;
    replaceChannel(userProfileChannelRef);
    userProfileChannelRef.current = supabase
      .channel(`user-profile-changes-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (payload.new?.must_choose_businesses !== payload.old?.must_choose_businesses) void loadDowngradeData();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reconnectAttemptsMap.current['user-profile'] = 0;
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handleReconnect('user-profile', setupUserProfileSubscription);
      });
  }, [user?.id, loadDowngradeData, handleReconnect]);

  // Sales counters live on the OWNER's row, and only the owner may read it (RLS), so this
  // channel only informs owners; staff get the count from the server reads instead.
  const setupSalesCountSubscription = useCallback(() => {
    if (!user?.id) return;
    replaceChannel(salesCountChannelRef);
    salesCountChannelRef.current = supabase
      .channel(`sales-count-changes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sales_counts', filter: `user_id=eq.${user.id}` }, () => {
        void loadFullState();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reconnectAttemptsMap.current['sales-count'] = 0;
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handleReconnect('sales-count', setupSalesCountSubscription);
      });
  }, [user?.id, loadFullState, handleReconnect]);

  const setupBusinessAccessSubscription = useCallback(() => {
    const businessId = currentBusinessIdRef.current;
    replaceChannel(businessAccessChannelRef);
    if (!businessId) return;
    businessAccessChannelRef.current = supabase
      .channel(`business-access-state-${businessId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${businessId}` }, (payload: any) => {
        // so team members see owner_disabled or read-only immediately
        if (payload.new?.access_state !== payload.old?.access_state) void loadFullState();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reconnectAttemptsMap.current['business-access'] = 0;
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handleReconnect('business-access', setupBusinessAccessSubscription);
      });
  }, [loadFullState, handleReconnect]);

  // =========================================================================
  // Lifecycle
  // =========================================================================

  // Sign-in: the SDK, the server state and the downgrade check, in parallel
  useEffect(() => {
    if (!user?.id) return;
    void initializeRevenueCat();
    if (isRevenueCatAvailable) setupCustomerInfoListener();
    void loadDowngradeData();
    return () => {
      if (customerInfoListenerRemoveRef.current) {
        customerInfoListenerRemoveRef.current();
        customerInfoListenerRemoveRef.current = null;
      }
    };
  }, [user?.id, initializeRevenueCat, setupCustomerInfoListener, loadDowngradeData]);

  // Business change: one read for the new business
  useEffect(() => {
    if (!user?.id || !currentBusiness?.id) return;
    void loadFullState();
    setupBusinessAccessSubscription();
    return () => replaceChannel(businessAccessChannelRef);
  }, [user?.id, currentBusiness?.id, loadFullState, setupBusinessAccessSubscription]);

  // The server state says the user owns more businesses than the plan allows: run the check
  useEffect(() => {
    if (!user?.id || !serverState) return;
    const maxAllowed = tierInfo.maxOwnedBusinesses;
    if (maxAllowed !== null && maxAllowed !== UNLIMITED && serverState.ownedBusinessCount > maxAllowed && !mustChooseBusinesses) {
      void loadDowngradeData();
    }
  }, [user?.id, serverState, tierInfo.maxOwnedBusinesses, mustChooseBusinesses, loadDowngradeData]);

  useEffect(() => {
    if (!user?.id) return;
    setupRealtimeSubscription();
    setupBusinessCountSubscription();
    setupUserProfileSubscription();
    setupSalesCountSubscription();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      replaceChannel(realtimeChannelRef);
      replaceChannel(businessCountChannelRef);
      replaceChannel(userProfileChannelRef);
      replaceChannel(salesCountChannelRef);
    };
  }, [user?.id, setupRealtimeSubscription, setupBusinessCountSubscription, setupUserProfileSubscription, setupSalesCountSubscription]);

  // Return to the foreground: re-read the plan and the server state (a renewal, an expiry,
  // sales made on another device), and bring back any realtime channel that died while the
  // app was in the background, which is where the old state used to stick.
  useEffect(() => {
    if (!user?.id) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;

      const channels: Array<[React.MutableRefObject<RealtimeChannel | null>, () => void]> = [
        [realtimeChannelRef, setupRealtimeSubscription],
        [businessCountChannelRef, setupBusinessCountSubscription],
        [userProfileChannelRef, setupUserProfileSubscription],
        [salesCountChannelRef, setupSalesCountSubscription],
        [businessAccessChannelRef, setupBusinessAccessSubscription],
      ];
      reconnectAttemptsMap.current = {};
      for (const [ref, setup] of channels) {
        const st = ref.current?.state;
        if (!ref.current || (st !== 'joined' && st !== 'joining')) setup();
      }

      const now = Date.now();
      if (now - lastForegroundCheckRef.current < FOREGROUND_CHECK_MS) return;
      lastForegroundCheckRef.current = now;
      void refreshCustomerInfo();
      void loadFullState();
    });
    return () => sub.remove();
  }, [user?.id, refreshCustomerInfo, loadFullState, setupRealtimeSubscription, setupBusinessCountSubscription, setupUserProfileSubscription, setupSalesCountSubscription, setupBusinessAccessSubscription]);

  // =========================================================================

  const value: SubscriptionContextType = {
    isSubscribed: subscriptionStatus.isSubscribed,
    subscriptionStatus,
    salesCountData,
    products,
    isLoading,
    isInitialized,
    canAccessFeature: access.canSell,
    businessDisableReason: serverState?.businessDisableReason ?? null,
    tierInfo,
    ownedBusinessCount: serverState?.ownedBusinessCount ?? 0,
    isIAPAvailable: Platform.OS !== 'web' && isRevenueCatAvailable,
    mustChooseBusinesses,
    ownedBusinesses,
    readOnlyBusinessIds,
    isBusinessReadOnly,
    offerings,
    customerInfo,
    hasError,
    subscriptionSource: rcEntitlement ? 'revenuecat' : 'database',
    retryInitialization,
    purchaseSubscription,
    restorePurchases,
    refreshSubscriptionStatus,
    refreshSalesCount,
    refreshTierInfo,
    refreshCustomerInfo,
    reverifyPlan,
    showPaywall,
    hidePaywall,
    isPaywallVisible,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <Paywall visible={isPaywallVisible} onClose={hidePaywall} canClose={true} />
      <UnauthorizedUpgradeModal visible={isUnauthorizedModalVisible} onClose={hideUnauthorizedModal} />
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
