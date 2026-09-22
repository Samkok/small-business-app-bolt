/**
 * Reads a RevenueCat v1 subscriber (GET /v1/subscribers/{id}) and decides what the
 * user_subscriptions mirror row must say. Pure, so it can be unit tested.
 */

export type Tier = "free" | "pro" | "pro_plus" | "max";

const TIER_BY_ENTITLEMENT: Record<string, Tier> = {
  bizmanage_max: "max",
  bizmanage_pro_plus: "pro_plus",
  bizmanage_pro: "pro",
};

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, pro_plus: 2, max: 3 };

export const MAX_BUSINESSES: Record<Tier, number> = { free: 1, pro: 1, pro_plus: 3, max: 999999 };

interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
  purchase_date?: string;
}

interface RcSubscription {
  expires_date: string | null;
  store?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  grace_period_expires_date?: string | null;
  is_sandbox?: boolean;
  period_type?: string;
}

export interface RcSubscriber {
  original_app_user_id?: string;
  entitlements?: Record<string, RcEntitlement>;
  subscriptions?: Record<string, RcSubscription>;
}

export interface DerivedMirror {
  /** 'none' = this user never had a plan; no row is written for them */
  status: "active" | "expired" | "none";
  tier: Tier;
  productId: string | null;
  /** the date access ends; during a billing grace period this is the grace end */
  expirationDate: string | null;
  willRenew: boolean;
  inGracePeriod: boolean;
  gracePeriodEndsAt: string | null;
  platform: "ios" | "android" | "web" | null;
  maxOwnedBusinesses: number;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function platformOf(store: string | undefined): DerivedMirror["platform"] {
  switch ((store ?? "").toLowerCase()) {
    case "app_store":
    case "mac_app_store":
      return "ios";
    case "play_store":
    case "amazon":
      return "android";
    case "":
      return null;
    default:
      return "web";
  }
}

export function deriveMirror(subscriber: RcSubscriber | null | undefined, nowMs: number): DerivedMirror {
  const entitlements = subscriber?.entitlements ?? {};
  const subscriptions = subscriber?.subscriptions ?? {};

  let best: { id: string; tier: Tier; ent: RcEntitlement; endsAt: number | null; inGrace: boolean } | null = null;
  let everHadPlan = false;

  for (const [id, ent] of Object.entries(entitlements)) {
    const tier = TIER_BY_ENTITLEMENT[id];
    if (!tier) continue;
    everHadPlan = true;

    const expires = ms(ent.expires_date);
    const grace = ms(ent.grace_period_expires_date);
    const activeByExpiry = expires === null || expires > nowMs;
    const activeByGrace = !activeByExpiry && grace !== null && grace > nowMs;
    if (!activeByExpiry && !activeByGrace) continue;

    const endsAt = activeByGrace ? grace : expires;
    if (!best || TIER_RANK[tier] > TIER_RANK[best.tier]) {
      best = { id, tier, ent, endsAt, inGrace: activeByGrace };
    }
  }

  if (!best) {
    return {
      status: everHadPlan ? "expired" : "none",
      tier: "free",
      productId: null,
      expirationDate: null,
      willRenew: false,
      inGracePeriod: false,
      gracePeriodEndsAt: null,
      platform: null,
      maxOwnedBusinesses: MAX_BUSINESSES.free,
    };
  }

  const sub = subscriptions[best.ent.product_identifier];
  const store = (sub?.store ?? "").toLowerCase();
  const renewing = !!sub && !sub.unsubscribe_detected_at && !sub.billing_issues_detected_at && store !== "promotional";

  return {
    status: "active",
    tier: best.tier,
    productId: best.ent.product_identifier,
    expirationDate: best.endsAt === null ? null : new Date(best.endsAt).toISOString(),
    willRenew: renewing,
    inGracePeriod: best.inGrace,
    gracePeriodEndsAt: best.inGrace ? new Date(best.endsAt as number).toISOString() : null,
    platform: platformOf(sub?.store),
    maxOwnedBusinesses: MAX_BUSINESSES[best.tier],
  };
}

export interface MirrorRow {
  subscription_status: string | null;
  tier: string | null;
  subscription_product_id: string | null;
  subscription_expiration_date: string | null;
  will_renew: boolean | null;
  in_grace_period: boolean | null;
}

const SECOND = 1000;

/** True when writing `next` would change what the server enforces or what the app shows. */
export function mirrorNeedsUpdate(current: MirrorRow | null, next: DerivedMirror): boolean {
  if (!current) return next.status !== "none";
  if (next.status === "none") return current.subscription_status === "active";
  if ((current.subscription_status ?? "") !== next.status) return true;
  if ((current.tier ?? "free") !== next.tier) return true;
  if ((current.subscription_product_id ?? null) !== next.productId) return true;
  if (!!current.will_renew !== next.willRenew) return true;
  if (!!current.in_grace_period !== next.inGracePeriod) return true;

  const a = ms(current.subscription_expiration_date);
  const b = ms(next.expirationDate);
  if (a === null || b === null) return a !== b;
  return Math.abs(a - b) > SECOND;
}
