// Run with: npx tsx src/services/__tests__/entitlementState.test.ts
import assert from 'node:assert/strict';
import { deriveEntitlement, entitlementFingerprint, mirrorDisagrees, toSubscriptionStatus, toTierInfo } from '../entitlementState';

const future = '2026-10-22T08:00:00.000Z';
const past = '2026-09-01T08:00:00.000Z';

function ent(id: string, over: Record<string, unknown> = {}) {
  return { identifier: id, isActive: true, willRenew: true, productIdentifier: `premium.${id.replace('bizmanage_', '')}.year`, expirationDate: future, isSandbox: false, ...over };
}

// active plan
{
  const d = deriveEntitlement({ entitlements: { active: { bizmanage_pro_plus: ent('bizmanage_pro_plus') }, all: { bizmanage_pro_plus: ent('bizmanage_pro_plus') } } });
  assert.equal(d.tier, 'pro_plus');
  assert.equal(d.isActive, true);
  assert.equal(d.status, 'active');
  assert.equal(d.maxOwnedBusinesses, 3);
  assert.equal(d.productId, 'premium.pro_plus.year');
  assert.equal(toSubscriptionStatus(d, 'u1').isSubscribed, true);
  assert.equal(toSubscriptionStatus(d, 'u1').revenueCatAppUserId, 'u1');
  assert.equal(toTierInfo(d).subscriptionStatus, 'active');
}

// best of several
{
  const d = deriveEntitlement({ entitlements: { active: { bizmanage_pro: ent('bizmanage_pro'), bizmanage_max: ent('bizmanage_max') }, all: {} } });
  assert.equal(d.tier, 'max');
  assert.equal(d.maxOwnedBusinesses, 999999);
}

// cancelled, still running
{
  const d = deriveEntitlement({ entitlements: { active: { bizmanage_pro: ent('bizmanage_pro', { willRenew: false }) }, all: {} } });
  assert.equal(d.isActive, true);
  assert.equal(d.willRenew, false);
}

// lapsed
{
  const d = deriveEntitlement({ entitlements: { active: {}, all: { bizmanage_pro: ent('bizmanage_pro', { isActive: false, expirationDate: past }) } } });
  assert.equal(d.tier, 'free');
  assert.equal(d.status, 'expired');
  assert.equal(d.expirationDate, past);
  assert.equal(d.maxOwnedBusinesses, 1);
}

// never subscribed, empty and missing info
{
  assert.equal(deriveEntitlement({ entitlements: { active: {}, all: {} } }).status, 'trial');
  assert.equal(deriveEntitlement(null).status, 'trial');
  assert.equal(deriveEntitlement({ entitlements: { active: { other_app: ent('other_app') }, all: {} } }).tier, 'free');
}

// mirror comparison
{
  const rc = deriveEntitlement({ entitlements: { active: { bizmanage_pro: ent('bizmanage_pro') }, all: {} } });
  assert.equal(mirrorDisagrees(rc, null), false);
  assert.equal(mirrorDisagrees(rc, { tier: 'pro', expirationDate: '2026-10-22T08:00:30.000Z', productId: 'premium.pro.year' }), false);
  assert.equal(mirrorDisagrees(rc, { tier: 'free' }), true);
  assert.equal(mirrorDisagrees(rc, { tier: 'pro', expirationDate: past }), true);
  assert.equal(mirrorDisagrees(rc, { tier: 'pro', expirationDate: null }), true);
  assert.equal(mirrorDisagrees(rc, { tier: 'pro', productId: 'premium.pro.month' }), true);
  assert.equal(mirrorDisagrees(rc, { productId: null }), false, 'a mirror without a product is not a disagreement');

  const free = deriveEntitlement(null);
  assert.equal(mirrorDisagrees(free, { tier: 'free', expirationDate: past }), false);
  assert.equal(mirrorDisagrees(free, { tier: 'pro_plus', expirationDate: future }), true, 'mirror says paid, RevenueCat says free');

  assert.notEqual(entitlementFingerprint(rc), entitlementFingerprint(free));
  assert.equal(entitlementFingerprint(rc), entitlementFingerprint(deriveEntitlement({ entitlements: { active: { bizmanage_pro: ent('bizmanage_pro') }, all: {} } })));
}

console.log('entitlementState: all assertions passed');
