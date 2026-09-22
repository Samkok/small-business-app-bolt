import type { SubscriptionStatus, SubscriptionTier, TierInfo } from '@/src/services/subscriptionService';

/**
 * Turns RevenueCat's CustomerInfo into the plan the app runs on.
 *
 * RevenueCat is the source of truth for the signed-in user's own subscription. The SDK
 * keeps CustomerInfo cached on the device, so deriving from it costs nothing and never
 * waits on the network. The database row in user_subscriptions is a mirror kept for
 * monitoring and for server-side checks; when the two disagree the app asks the
 * sync-subscription function to re-verify with RevenueCat and correct the mirror.
 */

export const ENTITLEMENT_TIERS: Record<string, SubscriptionTier> = {
  bizmanage_max: 'max',
  bizmanage_pro_plus: 'pro_plus',
  bizmanage_pro: 'pro',
};

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, pro_plus: 2, max: 3 };

/** Same numbers the server uses (get_user_subscription_tier, the RevenueCat webhook). */
export const MAX_BUSINESSES_BY_TIER: Record<SubscriptionTier, number> = {
  free: 1,
  pro: 1,
  pro_plus: 3,
  max: 999999,
};

export interface DerivedEntitlement {
  tier: SubscriptionTier;
  isActive: boolean;
  /** 'trial' means never subscribed; the app has always used that word for the free state */
  status: 'active' | 'expired' | 'trial';
  productId: string | null;
  expirationDate: string | null;
  willRenew: boolean;
  maxOwnedBusinesses: number;
  isSandbox: boolean;
}

interface EntitlementLike {
  identifier?: string;
  isActive?: boolean;
  willRenew?: boolean;
  productIdentifier?: string;
  expirationDate?: string | null;
  isSandbox?: boolean;
}

interface CustomerInfoLike {
  entitlements?: {
    active?: Record<string, EntitlementLike>;
    all?: Record<string, EntitlementLike>;
  };
}

function rank(tier: SubscriptionTier): number {
  return TIER_RANK[tier] ?? 0;
}

function tierOf(entitlementId: string): SubscriptionTier | null {
  return ENTITLEMENT_TIERS[entitlementId] ?? null;
}

export function deriveEntitlement(info: CustomerInfoLike | null | undefined): DerivedEntitlement {
  const active = info?.entitlements?.active ?? {};
  const all = info?.entitlements?.all ?? {};

  // The best plan among the active entitlements wins
  let best: { tier: SubscriptionTier; ent: EntitlementLike } | null = null;
  for (const [id, ent] of Object.entries(active)) {
    const tier = tierOf(id);
    if (!tier || ent?.isActive === false) continue;
    if (!best || rank(tier) > rank(best.tier)) best = { tier, ent };
  }

  if (best) {
    return {
      tier: best.tier,
      isActive: true,
      status: 'active',
      productId: best.ent.productIdentifier ?? null,
      expirationDate: best.ent.expirationDate ?? null,
      willRenew: best.ent.willRenew !== false,
      maxOwnedBusinesses: MAX_BUSINESSES_BY_TIER[best.tier],
      isSandbox: !!best.ent.isSandbox,
    };
  }

  // Nothing active: report the most recent lapsed plan so screens can say when it ended
  let lapsed: EntitlementLike | null = null;
  for (const [id, ent] of Object.entries(all)) {
    if (!tierOf(id) || !ent?.expirationDate) continue;
    if (!lapsed || new Date(ent.expirationDate).getTime() > new Date(lapsed.expirationDate as string).getTime()) {
      lapsed = ent;
    }
  }

  return {
    tier: 'free',
    isActive: false,
    status: lapsed ? 'expired' : 'trial',
    productId: lapsed?.productIdentifier ?? null,
    expirationDate: lapsed?.expirationDate ?? null,
    willRenew: false,
    maxOwnedBusinesses: MAX_BUSINESSES_BY_TIER.free,
    isSandbox: !!lapsed?.isSandbox,
  };
}

export function toSubscriptionStatus(d: DerivedEntitlement, appUserId?: string | null): SubscriptionStatus {
  return {
    isSubscribed: d.isActive,
    subscriptionStatus: d.status,
    productId: d.productId ?? undefined,
    expirationDate: d.expirationDate ?? undefined,
    tier: d.tier,
    maxOwnedBusinesses: d.maxOwnedBusinesses,
    revenueCatAppUserId: appUserId ?? undefined,
    willRenew: d.willRenew,
  };
}

export function toTierInfo(d: DerivedEntitlement): TierInfo {
  return {
    tier: d.tier,
    maxOwnedBusinesses: d.maxOwnedBusinesses,
    subscriptionStatus: d.status,
    expirationDate: d.expirationDate,
  };
}

/** What the database mirror says, merged from whichever RPC answered last. */
export interface DbSubscriptionSnapshot {
  tier?: SubscriptionTier;
  expirationDate?: string | null;
  productId?: string | null;
}

const EXPIRATION_TOLERANCE_MS = 60 * 1000;

/**
 * True when the mirror disagrees with RevenueCat on something that changes what the
 * server lets the user do: the plan, or (while subscribed) the product or the end date.
 * Fields the mirror has not reported yet are not compared.
 */
export function mirrorDisagrees(rc: DerivedEntitlement, db: DbSubscriptionSnapshot | null): boolean {
  if (!db) return false;
  if (db.tier !== undefined && db.tier !== rc.tier) return true;
  if (!rc.isActive) return false;

  if (db.productId !== undefined && db.productId && rc.productId && db.productId !== rc.productId) return true;

  if (db.expirationDate !== undefined && rc.expirationDate) {
    if (!db.expirationDate) return true;
    const diff = Math.abs(new Date(db.expirationDate).getTime() - new Date(rc.expirationDate).getTime());
    if (Number.isNaN(diff) || diff > EXPIRATION_TOLERANCE_MS) return true;
  }
  return false;
}

/** Identifies one RevenueCat state, so the app re-verifies each distinct state at most once per window. */
export function entitlementFingerprint(d: DerivedEntitlement): string {
  return [d.tier, d.isActive ? 1 : 0, d.productId ?? '', d.expirationDate ?? '', d.willRenew ? 1 : 0].join('|');
}
