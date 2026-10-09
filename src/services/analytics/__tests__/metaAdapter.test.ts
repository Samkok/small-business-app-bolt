// Run with: npx tsx src/services/analytics/__tests__/metaAdapter.test.ts
// An event reported before the Meta SDK starts (sign-up happens before sign-in) must be
// held and sent once the SDK is initialised, not dropped.
import assert from 'node:assert/strict';
import Module from 'node:module';

const store: Record<string, string> = {};
const logged: Array<[string, Record<string, string>]> = [];
const stubs: Record<string, unknown> = {
  'react-native': { Platform: { OS: 'ios' } },
  'expo-constants': { __esModule: true, default: { executionEnvironment: 'standalone' } },
  '@react-native-async-storage/async-storage': {
    __esModule: true,
    default: {
      getItem: async (k: string) => store[k] ?? null,
      setItem: async (k: string, v: string) => { store[k] = v; },
      removeItem: async (k: string) => { delete store[k]; },
    },
  },
  'react-native-fbsdk-next': {
    Settings: {
      setAppID() {}, setClientToken() {}, setAdvertiserTrackingEnabled() {},
      setAdvertiserIDCollectionEnabled() {}, setAutoLogAppEventsEnabled() {}, initializeSDK() {},
    },
    AppEventsLogger: {
      logEvent: (name: string, params: Record<string, string>) => { logged.push([name, params]); },
      setUserID() {},
      AppEvents: { CompletedRegistration: 'fb_mobile_complete_registration' },
    },
  },
};
const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, ...rest: unknown[]) {
  if (request in stubs) return stubs[request];
  return originalLoad.call(this, request, ...rest);
};

const tick = () => new Promise(r => setTimeout(r, 5));
const fresh = (appId: string) => {
  process.env.EXPO_PUBLIC_META_APP_ID = appId;
  for (const k of Object.keys(require.cache)) if (k.includes('analytics/metaAdapter')) delete require.cache[k];
  logged.length = 0;
  for (const k of Object.keys(store)) delete store[k];
  return require('../metaAdapter');
};

(async () => {
  // 1. Held before init, sent on init, queue cleared
  {
    const meta = fresh('123');
    meta.trackMeta('sign_up_completed');
    await tick();
    assert.equal(logged.length, 0, 'not sent before init');
    assert.equal(JSON.parse(store['analytics.meta.pending.v1']).length, 1, 'queued');
    meta.initMeta(false);
    await tick();
    assert.deepEqual(logged, [['fb_mobile_complete_registration', {}]], 'sent on init');
    assert.equal(store['analytics.meta.pending.v1'], undefined, 'queue cleared');
  }
  // 2. After init: sent immediately, once, with only non-identifying params
  {
    const meta = fresh('123');
    meta.initMeta(true);
    await tick();
    meta.trackMeta('business_created', { role: 'owner', business_id: 'b1' });
    assert.deepEqual(logged, [['BusinessCreated', { role: 'owner' }]]);
  }
  // 3. Not configured: nothing queued, nothing sent
  {
    const meta = fresh('');
    meta.trackMeta('sign_up_completed');
    await tick();
    assert.equal(store['analytics.meta.pending.v1'], undefined);
    assert.equal(logged.length, 0);
  }
  console.log('metaAdapter queue tests passed');
})().catch(e => { console.error(e); process.exit(1); });
