import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
  const fb = loadSdk();
  if (!fb || !initialised) return;
  const mapping = META_EVENT_NAMES[event];
  if (!mapping) return;
  try {
    const { AppEventsLogger } = fb;
    const name = mapping.standard ? AppEventsLogger.AppEvents[mapping.standard] : mapping.custom;
    if (!name) return;
    // Only non-identifying parameters go along
    const params: Record<string, string> = {};
    if (props.plan) params.plan = props.plan;
    if (props.product_id) params.product_id = props.product_id;
    if (props.role) params.role = props.role;
    AppEventsLogger.logEvent(name, params);
  } catch (error) {
    console.warn('[Meta] logEvent failed:', error instanceof Error ? error.message : error);
  }
}
