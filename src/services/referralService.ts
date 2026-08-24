import { supabase, supabaseUrl } from '@/src/config/supabase';
import { Platform, Share } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';

const PENDING_REFERRAL_KEY = 'pending_referral_code';
const DEVICE_FINGERPRINT_KEY = 'device_fingerprint';

export interface ReferralStats {
  total_clicks: number;
  total_signups: number;
  total_conversions: number;
  credits_earned: number;
  lifetime_referrals: number;
}

export interface CreditBalance {
  current: number;
  total_earned: number;
  total_spent: number;
  total_expired: number;
}

export interface ReferralEvent {
  id: string;
  status: string;
  clicked_at: string;
  signed_up_at: string | null;
  subscribed_at: string | null;
  rewarded_at: string | null;
  subscription_tier: string | null;
  referee_user_id: string | null;
  referee_name: string | null;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  description: string;
  created_at: string;
}

export interface RewardRule {
  rule_name: string;
  referrer_credits: number;
  referee_credits: number;
  applies_to_tiers: string[];
}

export interface ReferralDashboardData {
  code: string | null;
  link: string | null;
  stats: ReferralStats;
  balance: CreditBalance;
  history: ReferralEvent[];
  credit_history: CreditTransaction[];
  reward_rules: RewardRule[];
}

async function getDeviceFingerprint(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      let fingerprint = await AsyncStorage.getItem(DEVICE_FINGERPRINT_KEY);
      if (!fingerprint) {
        fingerprint = `web_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        await AsyncStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
      }
      return fingerprint;
    }

    let fingerprint = await SecureStore.getItemAsync(DEVICE_FINGERPRINT_KEY);
    if (!fingerprint) {
      const deviceModel = Device.modelName || 'unknown';
      const osVersion = Device.osVersion || 'unknown';
      const brand = Device.brand || 'unknown';
      fingerprint = `${Platform.OS}_${brand}_${deviceModel}_${osVersion}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await SecureStore.setItemAsync(DEVICE_FINGERPRINT_KEY, fingerprint);
    }
    return fingerprint;
  } catch {
    return `fallback_${Platform.OS}_${Date.now()}`;
  }
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export const referralService = {
  async getDashboardData(): Promise<ReferralDashboardData | null> {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await fetch(`${supabaseUrl}/functions/v1/referral-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (error) {
      console.error('[Referral] Failed to get dashboard data:', error);
      return null;
    }
  },

  async getReferralCode(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase.rpc('generate_referral_code', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Referral] Failed to get referral code:', error);
      return null;
    }
  },

  async getCreditBalance(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase.rpc('get_user_credit_balance', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('[Referral] Failed to get credit balance:', error);
      return 0;
    }
  },

  async shareReferralLink(code: string): Promise<boolean> {
    try {
      const link = `https://bizmanage.xtremon.com/refer/${code}`;
      const message = i18n.t('referral.shareMessage', { code, link });
      const title = i18n.t('referral.shareTitle');

      const result = await Share.share({
        message,
        title,
      });

      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('[Referral] Failed to share link:', error);
      return false;
    }
  },

  async recordClick(code: string): Promise<{ success: boolean; event_id?: string }> {
    try {
      const deviceFingerprint = await getDeviceFingerprint();

      const response = await fetch(`${supabaseUrl}/functions/v1/referral-click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          code: code.toUpperCase(),
          device_fingerprint: deviceFingerprint,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Referral] Click recording failed:', data.error);
        return { success: false };
      }

      return { success: true, event_id: data.event_id };
    } catch (error) {
      console.error('[Referral] Failed to record click:', error);
      return { success: false };
    }
  },

  async claimReferral(referralCode?: string): Promise<{ success: boolean; referrer_name?: string }> {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false };

      const deviceFingerprint = await getDeviceFingerprint();

      const response = await fetch(`${supabaseUrl}/functions/v1/referral-claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_fingerprint: deviceFingerprint,
          referral_code: referralCode || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return { success: false };
      }

      // Clear the pending referral code
      await this.clearPendingReferralCode();

      return { success: true, referrer_name: data.referrer_name };
    } catch (error) {
      console.error('[Referral] Failed to claim referral:', error);
      return { success: false };
    }
  },

  async storePendingReferralCode(code: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
      } else {
        await SecureStore.setItemAsync(PENDING_REFERRAL_KEY, code);
      }
    } catch (error) {
      console.error('[Referral] Failed to store pending code:', error);
    }
  },

  async getPendingReferralCode(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
      }
      return await SecureStore.getItemAsync(PENDING_REFERRAL_KEY);
    } catch {
      return null;
    }
  },

  async clearPendingReferralCode(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
      } else {
        await SecureStore.deleteItemAsync(PENDING_REFERRAL_KEY);
      }
    } catch {
      // Non-critical
    }
  },

  async getRewardRules(): Promise<RewardRule[]> {
    try {
      const { data, error } = await supabase
        .from('referral_reward_rules')
        .select('rule_name, referrer_credits, referee_credits, applies_to_tiers')
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Referral] Failed to get reward rules:', error);
      return [];
    }
  },
};
