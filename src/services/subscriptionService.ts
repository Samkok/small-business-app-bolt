import { supabase } from '@/src/config/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const FREE_TIER_LIMIT = 50;
const CACHE_TTL_MS = 2 * 60 * 1000;

export interface SubscriptionStatus {
  isSubscribed: boolean;
  subscriptionStatus: 'active' | 'expired' | 'cancelled' | 'trial';
  productId?: string;
  expirationDate?: string;
  platform?: 'ios' | 'android' | 'web';
}

export interface SalesCountData {
  salesCount: number;
  remainingSales: number;
  isAtLimit: boolean;
}

interface CachedSubscriptionData {
  status: SubscriptionStatus;
  cachedAt: number;
}

const SUBSCRIPTION_CACHE_KEY = 'subscription_status';
const SALES_COUNT_CACHE_KEY = 'sales_count_cache';

export const subscriptionService = {
  async getSalesCount(userId: string, businessId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('get_or_create_sales_count', {
          p_user_id: userId,
          p_business_id: businessId
        });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error getting sales count:', error);
      return 0;
    }
  },

  async incrementSalesCount(userId: string, businessId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('increment_sales_count', {
          p_user_id: userId,
          p_business_id: businessId
        });

      if (error) throw error;

      await this.clearSalesCountCache(businessId);

      return data || 0;
    } catch (error) {
      console.error('Error incrementing sales count:', error);
      throw error;
    }
  },

  async checkSalesLimit(userId: string, businessId: string): Promise<boolean> {
    try {
      const salesCount = await this.getSalesCount(userId, businessId);
      return salesCount >= FREE_TIER_LIMIT;
    } catch (error) {
      console.error('Error checking sales limit:', error);
      return false;
    }
  },

  async getSalesCountData(userId: string, businessId: string): Promise<SalesCountData> {
    try {
      const salesCount = await this.getSalesCount(userId, businessId);
      const remainingSales = Math.max(0, FREE_TIER_LIMIT - salesCount);
      const isAtLimit = salesCount >= FREE_TIER_LIMIT;

      return {
        salesCount,
        remainingSales,
        isAtLimit
      };
    } catch (error) {
      console.error('Error getting sales count data:', error);
      return {
        salesCount: 0,
        remainingSales: FREE_TIER_LIMIT,
        isAtLimit: false
      };
    }
  },

  async getSubscriptionStatus(userId: string, forceRefresh = false): Promise<SubscriptionStatus> {
    try {
      if (!forceRefresh) {
        const cachedData = await this.getCachedSubscriptionStatus();
        if (cachedData) {
          const { status, cachedAt } = cachedData;
          const now = Date.now();
          const cacheAge = now - cachedAt;

          if (cacheAge < CACHE_TTL_MS) {
            const isExpiredClientSide = this.isSubscriptionExpired(status);
            if (isExpiredClientSide && status.isSubscribed) {
              console.log('[SubscriptionService] Cache indicates expired subscription, forcing refresh');
              return await this.getSubscriptionStatus(userId, true);
            }
            return status;
          }
          console.log('[SubscriptionService] Cache expired, fetching fresh data');
        }
      }

      const { data, error } = await supabase
        .rpc('get_subscription_status', {
          p_user_id: userId
        });

      if (error) throw error;

      if (!data || data.length === 0) {
        const defaultStatus: SubscriptionStatus = {
          isSubscribed: false,
          subscriptionStatus: 'trial',
        };
        await this.cacheSubscriptionStatus(defaultStatus);
        return defaultStatus;
      }

      const statusData = data[0];
      const status: SubscriptionStatus = {
        isSubscribed: statusData.is_subscribed,
        subscriptionStatus: statusData.subscription_status as any,
        productId: statusData.product_id,
        expirationDate: statusData.expiration_date
      };

      await this.cacheSubscriptionStatus(status);
      return status;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        isSubscribed: false,
        subscriptionStatus: 'trial',
      };
    }
  },

  async updateSubscription(
    userId: string,
    status: 'active' | 'expired' | 'cancelled' | 'trial',
    productId?: string,
    expirationDate?: Date,
    receiptData?: string
  ): Promise<boolean> {
    try {
      const existingSubscription = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const subscriptionData = {
        user_id: userId,
        subscription_status: status,
        subscription_product_id: productId,
        subscription_expiration_date: expirationDate?.toISOString(),
        receipt_data: receiptData,
        last_validated_at: new Date().toISOString(),
        platform: Platform.OS as 'ios' | 'android' | 'web',
        updated_at: new Date().toISOString()
      };

      let error;

      if (existingSubscription.data) {
        const result = await supabase
          .from('user_subscriptions')
          .update(subscriptionData)
          .eq('id', existingSubscription.data.id);
        error = result.error;
      } else {
        subscriptionData['subscription_start_date'] = new Date().toISOString();
        const result = await supabase
          .from('user_subscriptions')
          .insert(subscriptionData);
        error = result.error;
      }

      if (error) throw error;

      await this.clearSubscriptionCache();

      return true;
    } catch (error) {
      console.error('Error updating subscription:', error);
      return false;
    }
  },

  isSubscriptionExpired(status: SubscriptionStatus): boolean {
    if (!status.expirationDate) {
      return false;
    }

    try {
      const expirationDate = new Date(status.expirationDate);
      const now = new Date();
      return now > expirationDate;
    } catch (error) {
      console.error('Error checking subscription expiration:', error);
      return false;
    }
  },

  async canAccessFeature(userId: string, businessId: string, forceRefresh = false): Promise<boolean> {
    try {
      const [subscription, salesCount] = await Promise.all([
        this.getSubscriptionStatus(userId, forceRefresh),
        this.getSalesCount(userId, businessId)
      ]);

      const isExpired = this.isSubscriptionExpired(subscription);
      if (isExpired && subscription.isSubscribed) {
        console.log('[SubscriptionService] Subscription expired, refreshing status');
        return await this.canAccessFeature(userId, businessId, true);
      }

      if (subscription.isSubscribed && !isExpired) {
        return true;
      }

      return salesCount < FREE_TIER_LIMIT;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  },

  async validateFeatureAccessForCriticalOperation(userId: string, businessId: string): Promise<boolean> {
    try {
      await this.clearSubscriptionCache();
      return await this.canAccessFeature(userId, businessId, true);
    } catch (error) {
      console.error('Error validating feature access for critical operation:', error);
      return false;
    }
  },

  async cacheSubscriptionStatus(status: SubscriptionStatus): Promise<void> {
    try {
      const cacheData: CachedSubscriptionData = {
        status,
        cachedAt: Date.now()
      };

      if (Platform.OS === 'web') {
        localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cacheData));
      } else {
        await SecureStore.setItemAsync(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cacheData));
      }
    } catch (error) {
      console.error('Error caching subscription status:', error);
    }
  },

  async getCachedSubscriptionStatus(): Promise<CachedSubscriptionData | null> {
    try {
      let cached: string | null;
      if (Platform.OS === 'web') {
        cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
      } else {
        cached = await SecureStore.getItemAsync(SUBSCRIPTION_CACHE_KEY);
      }

      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.cachedAt && parsed.status) {
          return parsed as CachedSubscriptionData;
        }
        return { status: parsed, cachedAt: Date.now() };
      }
      return null;
    } catch (error) {
      console.error('Error getting cached subscription status:', error);
      return null;
    }
  },

  async clearSubscriptionCache(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
      } else {
        await SecureStore.deleteItemAsync(SUBSCRIPTION_CACHE_KEY);
      }
    } catch (error) {
      console.error('Error clearing subscription cache:', error);
    }
  },

  async clearSalesCountCache(businessId: string): Promise<void> {
    try {
      const key = `${SALES_COUNT_CACHE_KEY}_${businessId}`;
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error('Error clearing sales count cache:', error);
    }
  },

  async validateReceiptWithBackend(receipt: string, platform: 'ios' | 'android'): Promise<{
    isValid: boolean;
    expiresDate: Date | null;
    productId: string | null;
  }> {
    try {
      console.log('Receipt validation called:', { platform, receiptLength: receipt.length });

      return {
        isValid: true,
        expiresDate: null,
        productId: platform === 'ios' ? 'bizmanage.pro.month' : null
      };
    } catch (error) {
      console.error('Error validating receipt:', error);
      return {
        isValid: false,
        expiresDate: null,
        productId: null
      };
    }
  }
};
