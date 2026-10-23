// Run with: npx tsx src/services/__tests__/salesAccess.test.ts
import assert from 'node:assert/strict';
import { salesAccess } from '../entitlementState';

const free = { planActive: false, isAtLimit: false, disableReason: null } as const;
const atLimit = { planActive: false, isAtLimit: true, disableReason: null } as const;
const paidServer = { planActive: true, isAtLimit: false, disableReason: null } as const;

// Owner on a paid plan: never blocked by the limit, even when the mirror still says free
assert.deepEqual(salesAccess({ rcActive: true, isOwner: true, server: atLimit }), { canSell: true, planActive: true, mirrorStale: true });
assert.deepEqual(salesAccess({ rcActive: true, isOwner: true, server: paidServer }), { canSell: true, planActive: true, mirrorStale: false });
// Owner on the free plan: the server's limit decides
assert.deepEqual(salesAccess({ rcActive: false, isOwner: true, server: atLimit }), { canSell: false, planActive: false, mirrorStale: false });
assert.deepEqual(salesAccess({ rcActive: false, isOwner: true, server: free }), { canSell: true, planActive: false, mirrorStale: false });
// A read-only or disabled business blocks everyone, paid or not
assert.equal(salesAccess({ rcActive: true, isOwner: true, server: { ...paidServer, disableReason: 'subscription' } }).canSell, false);
assert.equal(salesAccess({ rcActive: true, isOwner: true, server: { ...paidServer, disableReason: 'owner_disabled' } }).canSell, false);
// Staff: their own RevenueCat plan is irrelevant, the server (owner's plan) decides
assert.deepEqual(salesAccess({ rcActive: true, isOwner: false, server: atLimit }), { canSell: false, planActive: false, mirrorStale: false });
assert.deepEqual(salesAccess({ rcActive: null, isOwner: false, server: paidServer }), { canSell: true, planActive: true, mirrorStale: false });
// Nothing known yet: do not block
assert.equal(salesAccess({ rcActive: null, isOwner: true, server: null }).canSell, true);
assert.equal(salesAccess({ rcActive: true, isOwner: true, server: null }).mirrorStale, false);

console.log('salesAccess: all assertions passed');
