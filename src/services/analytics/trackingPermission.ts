import { Platform } from 'react-native';
import { isMetaConfigured } from './metaAdapter';

/**
 * iOS asks the user once whether the app may track them across other apps and websites.
 * Apple requires the question before any advertising identifier is used, so it is asked only
 * when Meta is configured (nothing tracks otherwise) and only after the user is signed in.
 * Android has no prompt: its advertising id is allowed unless the user turned it off.
 */
export async function askTrackingPermission(): Promise<boolean> {
  if (!isMetaConfigured) return false;
  if (Platform.OS !== 'ios') return true;
  try {
    const tracking = require('expo-tracking-transparency');
    const current = await tracking.getTrackingPermissionsAsync();
    if (current.status === 'granted') return true;
    if (!current.canAskAgain) return false;
    const answer = await tracking.requestTrackingPermissionsAsync();
    return answer.status === 'granted';
  } catch (error) {
    console.warn('[Tracking] permission check failed:', error instanceof Error ? error.message : error);
    return false;
  }
}
