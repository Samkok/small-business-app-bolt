import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsEvent, AnalyticsProps, META_EVENT_NAMES } from './events';

/**
 * Meta (Facebook) app events for ads measurement. Everything here is a no-op until
 * EXPO_PUBLIC_META_APP_ID is set at build time, which is also what makes app.config.js add
 * the native SDK. The SDK is initialised only after the iOS tracking prompt has been
 * answered (see trackingPermission.ts), so nothing leaves the phone before consent.
 */

const APP_ID = (process.env.EXPO_PUBLIC_META_APP_ID || '').trim();
const CLIENT_TOKEN = (process.env.EXPO_PUBLIC_META_CLIENT_TOKEN || '').trim();

export const isMetaConfigured = APP_ID.length > 0 && Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';

let sdk: any = null;
let initialised = false;

// Events reported before the SDK starts. Saved so a sign-up survives the app being closed
// while the user confirms their email. Small and short-lived on purpose.
const QUEUE_KEY = 'analytics.meta.pending.v1';
const MAX_QUEUED = 20;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
type PendingEvent = { event: AnalyticsEvent; params: Record<string, string>; at: number };
let queueWrite: Promise<void> = Promise.resolve();

async function readQueue(): Promise<PendingEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as PendingEvent[]) : [];
    return Array.isArray(list) ? list.filter(e => e && Date.now() - e.at < MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

function enqueue(item: PendingEvent): void {
  queueWrite = queueWrite.then(async () => {
    try {
      const list = await readQueue();
      list.push(item);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-MAX_QUEUED)));
    } catch {}
  });
}

function flushQueue(): void {
  queueWrite = queueWrite.then(async () => {
    const list = await readQueue();
    try { await AsyncStorage.removeItem(QUEUE_KEY); } catch {}
    for (const item of list) logNow(item.event, item.params);
    if (list.length) console.log('[Meta] sent', list.length, 'queued event(s)');
  });
}

function paramsFor(props: AnalyticsProps): Record<string, string> {
  // Only non-identifying parameters go along
  const params: Record<string, string> = {};
  if (props.plan) params.plan = props.plan;
  if (props.product_id) params.product_id = props.product_id;
  if (props.role) params.role = props.role;
  return params;
}

function logNow(event: AnalyticsEvent, params: Record<string, string>): void {
  const mapping = META_EVENT_NAMES[event];
  if (!mapping || !sdk) return;
  try {
    const { AppEventsLogger } = sdk;
    const name = mapping.standard ? AppEventsLogger.AppEvents[mapping.standard] : mapping.custom;
    if (!name) return;
    AppEventsLogger.logEvent(name, params);
  } catch (error) {
    console.warn('[Meta] logEvent failed:', error instanceof Error ? error.message : error);
  }
}

function loadSdk(): any | null {
  if (!isMetaConfigured) return null;
  if (sdk) return sdk;
  try {
    // The package is installed only when Meta is switched on (see app.config.js). Inside a
    // try/catch the bundler treats this require as optional, so a build without the package
    // compiles and this simply fails at runtime, which is never reached while unconfigured.
    sdk = require('react-native-fbsdk-next');
    return sdk;
  } catch (error) {
    console.log('[Meta] SDK not in this build:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Starts the SDK. `trackingAllowed` is the iOS tracking prompt answer (true on Android). */
export function initMeta(trackingAllowed: boolean): void {
  const fb = loadSdk();
  if (!fb || initialised) return;
  try {
    const { Settings } = fb;
    Settings.setAppID(APP_ID);
    if (CLIENT_TOKEN) Settings.setClientToken(CLIENT_TOKEN);
    Settings.setAdvertiserTrackingEnabled(trackingAllowed);
    Settings.setAdvertiserIDCollectionEnabled(trackingAllowed);
    Settings.setAutoLogAppEventsEnabled(true);
    Settings.initializeSDK();
    initialised = true;
    console.log('[Meta] SDK initialised, tracking allowed:', trackingAllowed);
    flushQueue();
  } catch (error) {
    console.warn('[Meta] SDK init failed:', error instanceof Error ? error.message : error);
  }
}

export function setMetaUser(userId: string | null): void {
  const fb = loadSdk();
  if (!fb || !initialised) return;
  try {
    fb.AppEventsLogger.setUserID(userId);
  } catch {}
}

export function trackMeta(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (!isMetaConfigured || !META_EVENT_NAMES[event]) return;
  const params = paramsFor(props);
  if (!initialised || !loadSdk()) {
    enqueue({ event, params, at: Date.now() });
    return;
  }
  logNow(event, params);
}
