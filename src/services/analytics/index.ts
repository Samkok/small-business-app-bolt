import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/src/config/supabase';
import { ANALYTICS_EVENTS, AnalyticsEvent, AnalyticsProps } from './events';
import { initMeta, isMetaConfigured, setMetaUser, trackMeta } from './metaAdapter';
import { askTrackingPermission } from './trackingPermission';

/**
 * The one place screens report what happened. Each tool behind it (Meta today, PostHog when
 * its project exists) is an adapter that does nothing until configured, so this file is safe
 * to call everywhere and the app never waits on it.
 */

let started = false;
let currentUserId: string | null = null;

const baseProps = (): AnalyticsProps => ({
  platform: Platform.OS,
  app_version: Constants.expoConfig?.version ?? undefined,
});

export const analytics = {
  events: ANALYTICS_EVENTS,

  /** Call once the user is signed in and the app is on screen. Asks the iOS tracking question if needed. */
  async start(userId: string): Promise<void> {
    currentUserId = userId;
    if (started) {
      setMetaUser(userId);
      return;
    }
    started = true;
    if (isMetaConfigured) {
      const allowed = await askTrackingPermission();
      initMeta(allowed);
      setMetaUser(userId);
    }
  },

  /** Sign-out: later events carry no user id. */
  reset(): void {
    currentUserId = null;
    setMetaUser(null);
  },

  track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
    const merged = { ...baseProps(), ...props };
    try {
      trackMeta(event, merged);
    } catch (error) {
      console.warn('[Analytics] track failed:', error instanceof Error ? error.message : error);
    }
    if (__DEV__) console.log('[Analytics]', event, merged, currentUserId ? '' : '(no user)');
  },

  /**
   * After a sale is recorded: reports FirstSale when it was the business's first. The count
   * comes from the server (the same counter the free plan uses), so repeats and other devices
   * cannot report it twice. Skipped for sales saved offline, whose count is not known yet.
   */
  async saleCompleted(userId: string, businessId: string, offline: boolean): Promise<void> {
    if (offline || !isMetaConfigured) return;
    try {
      const { data, error } = await supabase.rpc('get_user_total_sales_count', { p_user_id: userId, p_business_id: businessId });
      if (error) return;
      if (Number(data) === 1) analytics.track(ANALYTICS_EVENTS.firstSale, { business_id: businessId });
    } catch {}
  },
};
