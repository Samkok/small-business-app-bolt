import { supabase } from '@/src/config/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const FREE_TIER_LIMIT = 50;

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

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const cachedStatus = await this.getCachedSubscriptionStatus();
      if (cachedStatus) {
        return cachedStatus;
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

  async canAccessFeature(userId: string, businessId: string): Promise<boolean> {
    try {
      const [subscription, salesCount] = await Promise.all([
        this.getSubscriptionStatus(userId),
        this.getSalesCount(userId, businessId)
      ]);

      if (subscription.isSubscribed) {
        return true;
      }

      return salesCount < FREE_TIER_LIMIT;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  },

  async cacheSubscriptionStatus(status: SubscriptionStatus): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(status));
      } else {
        await SecureStore.setItemAsync(SUBSCRIPTION_CACHE_KEY, JSON.stringify(status));
      }
    } catch (error) {
      console.error('Error caching subscription status:', error);
    }
  },

  async getCachedSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    try {
      let cached: string | null;
      if (Platform.OS === 'web') {
        cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
      } else {
        cached = await SecureStore.getItemAsync(SUBSCRIPTION_CACHE_KEY);
      }

      if (cached) {
        return JSON.parse(cached);
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
