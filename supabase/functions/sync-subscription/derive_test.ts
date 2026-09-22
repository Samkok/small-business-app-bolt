import { assertEquals } from "jsr:@std/assert@1";
import { deriveMirror, mirrorNeedsUpdate } from "./derive.ts";

const NOW = Date.parse("2026-09-22T08:00:00Z");
const future = "2026-10-22T08:00:00.000Z";
const past = "2026-09-01T08:00:00.000Z";

Deno.test("active entitlement becomes an active mirror on the right tier", () => {
  const d = deriveMirror({
    original_app_user_id: "u1",
    entitlements: { bizmanage_pro_plus: { expires_date: future, product_identifier: "premium.pro_plus.year" } },
    subscriptions: { "premium.pro_plus.year": { expires_date: future, store: "app_store", unsubscribe_detected_at: null } },
  }, NOW);
  assertEquals(d.status, "active");
  assertEquals(d.tier, "pro_plus");
  assertEquals(d.maxOwnedBusinesses, 3);
  assertEquals(d.platform, "ios");
  assertEquals(d.willRenew, true);
  assertEquals(d.expirationDate, future);
});

Deno.test("the best active plan wins when several entitlements are active", () => {
  const d = deriveMirror({
    entitlements: {
      bizmanage_pro: { expires_date: future, product_identifier: "premium.pro.month" },
      bizmanage_max: { expires_date: future, product_identifier: "premium.max.year" },
    },
    subscriptions: {},
  }, NOW);
  assertEquals(d.tier, "max");
  assertEquals(d.productId, "premium.max.year");
});

Deno.test("cancelled but not yet ended stays active with willRenew false", () => {
  const d = deriveMirror({
    entitlements: { bizmanage_pro: { expires_date: future, product_identifier: "premium.pro.month" } },
    subscriptions: { "premium.pro.month": { expires_date: future, store: "play_store", unsubscribe_detected_at: past } },
  }, NOW);
  assertEquals(d.status, "active");
  assertEquals(d.willRenew, false);
  assertEquals(d.platform, "android");
});

Deno.test("billing grace period keeps access until the grace end", () => {
  const graceEnd = "2026-09-30T08:00:00.000Z";
  const d = deriveMirror({
    entitlements: { bizmanage_pro: { expires_date: past, grace_period_expires_date: graceEnd, product_identifier: "premium.pro.month" } },
    subscriptions: { "premium.pro.month": { expires_date: past, store: "app_store", billing_issues_detected_at: past } },
  }, NOW);
  assertEquals(d.status, "active");
  assertEquals(d.inGracePeriod, true);
  assertEquals(d.expirationDate, graceEnd);
  assertEquals(d.gracePeriodEndsAt, graceEnd);
  assertEquals(d.willRenew, false);
});

Deno.test("lapsed plan is expired, never subscribed is none", () => {
  const lapsed = deriveMirror({ entitlements: { bizmanage_pro: { expires_date: past, product_identifier: "p" } } }, NOW);
  assertEquals(lapsed.status, "expired");
  assertEquals(lapsed.tier, "free");
  const never = deriveMirror({ entitlements: {} }, NOW);
  assertEquals(never.status, "none");
  const unknownOnly = deriveMirror({ entitlements: { other_app: { expires_date: future, product_identifier: "x" } } }, NOW);
  assertEquals(unknownOnly.status, "none");
});

Deno.test("mirrorNeedsUpdate only reports real differences", () => {
  const next = deriveMirror({
    entitlements: { bizmanage_pro: { expires_date: future, product_identifier: "premium.pro.month" } },
    subscriptions: { "premium.pro.month": { expires_date: future, store: "app_store" } },
  }, NOW);
  const same = { subscription_status: "active", tier: "pro", subscription_product_id: "premium.pro.month", subscription_expiration_date: "2026-10-22T08:00:00.500Z", will_renew: true, in_grace_period: false };
  assertEquals(mirrorNeedsUpdate(same, next), false);
  assertEquals(mirrorNeedsUpdate({ ...same, tier: "free", subscription_status: "expired" }, next), true);
  assertEquals(mirrorNeedsUpdate({ ...same, subscription_expiration_date: past }, next), true);
  assertEquals(mirrorNeedsUpdate({ ...same, will_renew: false }, next), true);
  assertEquals(mirrorNeedsUpdate(null, next), true);

  const none = deriveMirror({ entitlements: {} }, NOW);
  assertEquals(mirrorNeedsUpdate(null, none), false);
  assertEquals(mirrorNeedsUpdate({ ...same }, none), true);
  assertEquals(mirrorNeedsUpdate({ ...same, subscription_status: "expired", tier: "free" }, none), false);
});
