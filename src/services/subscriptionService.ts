import { supabase } from '@/src/config/supabase';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert } from 'react-native';
import { productIdMapper } from '@/src/utils/productIdMapper';
import { isNetworkError, retryWithBackoff } from '@/src/lib/network';

export const FREE_TIER_LIMIT = 50;
const CACHE_TTL_MS = 2 * 60 * 1000;

function showNetworkErrorAlert(context: string) {
  Alert.alert(
    'Connection Issue',
    `Unable to ${context} due to a network problem. Please check your internet connection and try again.`,
    [{ text: 'OK' }]
  );
}

export type SubscriptionTier = 'free' | 'pro' | 'pro_plus' | 'max';

function getTierFromProductId(productId: string | undefined): SubscriptionTier {
  if (!productId) return 'free';
  return productIdMapper.getTierFromProductId(productId);
}

function getMaxOwnedBusinessesFromTier(tier: SubscriptionTier): number | null {
  switch (tier) {
    case 'pro':
      return 1;
    case 'pro_plus':
      return 3;
    case 'max':
      return 999999;
    case 'free':
    default:
      return null;
  }
}

export interface SubscriptionStatus {
  isSubscribed: boolean;
  subscriptionStatus: 'active' | 'expired' | 'cancelled' | 'trial';
  productId?: string;
  expirationDate?: string;
  platform?: 'ios' | 'android' | 'web';
  tier?: SubscriptionTier;
  maxOwnedBusinesses?: number;
  revenueCatAppUserId?: string;
  willRenew?: boolean;
}

export interface SalesCountData {
  salesCount: number;
  remainingSales: number;
  isAtLimit: boolean;
  totalSalesAllBusinesses?: number;
}

export interface TierInfo {
  tier: SubscriptionTier;
  maxOwnedBusinesses: number | null;
  subscriptionStatus: string;
  expirationDate: string | null;
}

export interface FullSubscriptionState {
  subscriptionStatus: SubscriptionStatus;
  tierInfo: TierInfo;
  ownedBusinessCount: number;
  salesCountData: SalesCountData | null;
  canAccessFeature: boolean | null;
}

interface CachedSubscriptionData {
  status: SubscriptionStatus;
  cachedAt: number;
}

const SUBSCRIPTION_CACHE_KEY = 'subscription_status';
const SALES_COUNT_CACHE_KEY = 'sales_count_cache';

export const subscriptionService = {
  async getTierInfo(userId: string, showErrorAlert = false): Promise<TierInfo> {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .rpc('get_user_subscription_tier', {
            p_user_id: userId
          });

        if (error) throw error;

        if (!data || data.length === 0) {
          return {
            tier: 'free',
            maxOwnedBusinesses: null,
            subscriptionStatus: 'trial',
            expirationDate: null
          };
        }

        const tierData = data[0];
        return {
          tier: tierData.tier as SubscriptionTier,
          maxOwnedBusinesses: tierData.max_owned_businesses,
          subscriptionStatus: tierData.subscription_status,
          expirationDate: tierData.expiration_date
        };
      }, 'get tier info');
    } catch (error) {
      console.error('Error getting tier info:', error);

      if (isNetworkError(error) && showErrorAlert) {
        showNetworkErrorAlert('load subscription information');
      }

      return {
        tier: 'free',
        maxOwnedBusinesses: null,
        subscriptionStatus: 'trial',
        expirationDate: null
      };
    }
  },

  async getTotalSalesCount(userId: string, businessId?: string, showErrorAlert = false): Promise<number> {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .rpc('get_user_total_sales_count', {
            p_user_id: userId,
            p_business_id: businessId || null
          });

        if (error) throw error;
        return data || 0;
      }, 'get total sales count');
    } catch (error) {
      console.error('Error getting total sales count:', error);

      if (isNetworkError(error) && showErrorAlert) {
        showNetworkErrorAlert('load sales count');
      }

      return 0;
    }
  },

  async canCreateSale(userId: string, businessId: string, showErrorAlert = false): Promise<{
    canCreate: boolean;
    reason: string | null;
    currentCount: number;
    limitReached: boolean;
  }> {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .rpc('can_user_create_sale', {
            p_user_id: userId,
            p_business_id: businessId
          });

        if (error) throw error;

        if (!data || data.length === 0) {
          return {
            canCreate: false,
            reason: 'UNKNOWN_ERROR',
            currentCount: 0,
            limitReached: false
          };
        }

        const result = data[0];
        return {
          canCreate: result.can_create,
          reason: result.reason,
          currentCount: result.current_count,
          limitReached: result.limit_reached
        };
      }, 'check if user can create sale');
    } catch (error) {
      console.error('Error checking if user can create sale:', error);

      if (isNetworkError(error)) {
        if (showErrorAlert) {
          showNetworkErrorAlert('verify sales permissions');
        }
        return {
          canCreate: false,
          reason: 'NETWORK_ERROR',
          currentCount: 0,
          limitReached: false
        };
      }

      return {
        canCreate: false,
        reason: 'ERROR',
        currentCount: 0,
        limitReached: false
      };
    }
  },

  async getOwnedBusinessCount(userId: string, showErrorAlert = false): Promise<number> {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .rpc('get_user_owned_business_count', {
            p_user_id: userId
          });

        if (error) throw error;
        return data || 0;
      }, 'get owned business count');
    } catch (error) {
      console.error('Error getting owned business count:', error);

      if (isNetworkError(error) && showErrorAlert) {
        showNetworkErrorAlert('load business count');
      }

      return 0;
    }
  },

  async canCreateBusiness(userId: string, showErrorAlert = false): Promise<boolean> {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .rpc('can_user_create_business', {
            p_user_id: userId
          });

        if (error) throw error;
        return data || false;
      }, 'check if user can create business');
    } catch (error) {
      console.error('Error checking if user can create business:', error);

      if (isNetworkError(error) && showErrorAlert) {
        showNetworkErrorAlert('verify business creation permissions');
      }

      return false;
    }
  },

  async getSalesCount(userId: string, businessId: string, showErrorAlert = false): Promise<number> {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .rpc('get_or_create_sales_count', {
            p_user_id: userId,
            p_business_id: businessId
          });

        if (error) throw error;
        return data || 0;
      }, 'get sales count');
    } catch (error) {
      console.error('Error getting sales count:', error);

      if (isNetworkError(error) && showErrorAlert) {
        showNetworkErrorAlert('load sales count');
      }

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
      const [salesCount, totalSales, tierInfo] = await Promise.all([
        this.getSalesCount(userId, businessId),
        this.getTotalSalesCount(userId),
        this.getTierInfo(userId)
      ]);
      console.log("TOTAL SALES COUNT: ", totalSales);

      if (tierInfo.tier === 'free') {
        const remainingSales = Math.max(0, FREE_TIER_LIMIT - totalSales);
        const isAtLimit = totalSales >= FREE_TIER_LIMIT;

        return {
          salesCount,
          remainingSales,
          isAtLimit,
          totalSalesAllBusinesses: totalSales
        };
      }

      return {
        salesCount,
        remainingSales: 999999,
        isAtLimit: false,
        totalSalesAllBusinesses: totalSales
      };
    } catch (error) {
      console.error('Error getting sales count data:', error);
      return {
        salesCount: 0,
        remainingSales: FREE_TIER_LIMIT,
        isAtLimit: false,
        totalSalesAllBusinesses: 0
      };
    }
  },

  async getSubscriptionStatus(userId: string, forceRefresh = false, showErrorAlert = false): Promise<SubscriptionStatus> {
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
              return await this.getSubscriptionStatus(userId, true, showErrorAlert);
            }
            return status;
          }
          console.log('[SubscriptionService] Cache expired, fetching fresh data');
        }
      }

      return await retryWithBackoff(async () => {
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
          expirationDate: statusData.expiration_date,
          revenueCatAppUserId: statusData.revenuecat_app_user_id,
          willRenew: statusData.will_renew
        };

        await this.cacheSubscriptionStatus(status);
        return status;
      }, 'get subscription status');
    } catch (error) {
      console.error('Error getting subscription status:', error);

      if (isNetworkError(error)) {
        if (showErrorAlert) {
          showNetworkErrorAlert('load subscription status');
        }

        const cachedData = await this.getCachedSubscriptionStatus();
        if (cachedData) {
          console.log('[SubscriptionService] Using cached data due to network error');
          return cachedData.status;
        }
      }

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

      const tier = getTierFromProductId(productId);
      const maxOwnedBusinesses = getMaxOwnedBusinessesFromTier(tier);

      const subscriptionData = {
        user_id: userId,
        subscription_status: status,
        subscription_product_id: productId,
        subscription_expiration_date: expirationDate?.toISOString(),
        receipt_data: receiptData,
        last_validated_at: new Date().toISOString(),
        platform: Platform.OS as 'ios' | 'android' | 'web',
        tier: tier,
        max_owned_businesses: maxOwnedBusinesses,
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

  async canAccessFeature(userId: string, businessId: string, forceRefresh = false, showErrorAlert = false): Promise<boolean> {
    try {
      return await retryWithBackoff(async () => {
        const result = await this.canCreateSale(userId, businessId, false);

        const { data: business, error } = await supabase
          .from('businesses')
          .select('access_state')
          .eq('id', businessId)
          .maybeSingle();

        if (error || !business) {
          throw new Error('Business not found or query failed');
        }

        const active = business.access_state !== 'read_only_sales';

        return result.canCreate && active;
      }, 'check feature access');
    } catch (error) {
      console.error('Error checking feature access:', error);

      if (isNetworkError(error) && showErrorAlert) {
        showNetworkErrorAlert('verify feature access');
      }

      return false;
    }
  },

  async validateFeatureAccessForCriticalOperation(userId: string, businessId: string): Promise<boolean> {
    try {
      await this.clearSubscriptionCache();
      return await this.canAccessFeature(userId, businessId, true, true);
    } catch (error) {
      console.error('Error validating feature access for critical operation:', error);

      if (isNetworkError(error)) {
        showNetworkErrorAlert('validate permissions');
      }

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
      console.log('Validating receipt with backend:', { platform, receiptLength: receipt.length });

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('validate-subscription', {
        body: {
          receipt,
          platform,
          userId: userData.user.id,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Receipt validation result:', data);

      return {
        isValid: data.isValid,
        expiresDate: data.expiresDate ? new Date(data.expiresDate) : null,
        productId: data.productId,
      };
    } catch (error) {
      console.error('Error validating receipt:', error);
      return {
        isValid: false,
        expiresDate: null,
        productId: null
      };
    }
  },

  async getBusinessOwnerSubscriptionTier(businessId: string): Promise<{
    ownerId: string;
    tier: SubscriptionTier;
    subscriptionStatus: string;
    expirationDate: string | null;
    maxOwnedBusinesses: number | null;
    isExpired: boolean;
  } | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_business_owner_subscription_tier', {
          p_business_id: businessId
        });

      if (error) throw error;

      if (!data || data.length === 0) {
        return null;
      }

      const ownerData = data[0];
      return {
        ownerId: ownerData.owner_id,
        tier: ownerData.tier as SubscriptionTier,
        subscriptionStatus: ownerData.subscription_status,
        expirationDate: ownerData.expiration_date,
        maxOwnedBusinesses: ownerData.max_owned_businesses,
        isExpired: ownerData.is_expired
      };
    } catch (error) {
      console.error('Error getting business owner subscription tier:', error);
      return null;
    }
  },

  async getFullSubscriptionState(userId: string, businessId?: string | null, showErrorAlert = false): Promise<FullSubscriptionState> {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .rpc('get_full_subscription_state', {
            p_user_id: userId,
            p_business_id: businessId || null
          });

        if (error) throw error;

        if (!data) {
          return {
            subscriptionStatus: {
              isSubscribed: false,
              subscriptionStatus: 'trial',
            },
            tierInfo: {
              tier: 'free',
              maxOwnedBusinesses: null,
              subscriptionStatus: 'trial',
              expirationDate: null
            },
            ownedBusinessCount: 0,
            salesCountData: businessId ? {
              salesCount: 0,
              remainingSales: FREE_TIER_LIMIT,
              isAtLimit: false
            } : null,
            canAccessFeature: businessId ? true : null
          };
        }

        return {
          subscriptionStatus: {
            isSubscribed: data.subscriptionStatus.isSubscribed,
            subscriptionStatus: data.subscriptionStatus.subscriptionStatus,
            productId: data.subscriptionStatus.subscriptionProductId,
            expirationDate: data.subscriptionStatus.subscriptionExpirationDate,
          },
          tierInfo: {
            tier: data.tierInfo.tier,
            maxOwnedBusinesses: data.tierInfo.maxOwnedBusinesses,
            subscriptionStatus: data.tierInfo.subscriptionStatus,
            expirationDate: data.tierInfo.expirationDate
          },
          ownedBusinessCount: data.ownedBusinessCount,
          salesCountData: data.salesCountData ? {
            salesCount: data.salesCountData.salesCount,
            remainingSales: data.salesCountData.remainingSales,
            isAtLimit: data.salesCountData.isAtLimit,
            totalSalesAllBusinesses: data.salesCountData.totalSalesAllBusinesses
          } : null,
          canAccessFeature: data.canAccessFeature
        };
      }, 'get full subscription state');
    } catch (error) {
      console.error('Error getting full subscription state:', error);

      if (isNetworkError(error) && showErrorAlert) {
        showNetworkErrorAlert('load subscription information');
      }

      return {
        subscriptionStatus: {
          isSubscribed: false,
          subscriptionStatus: 'trial',
        },
        tierInfo: {
          tier: 'free',
          maxOwnedBusinesses: null,
          subscriptionStatus: 'trial',
          expirationDate: null
        },
        ownedBusinessCount: 0,
        salesCountData: businessId ? {
          salesCount: 0,
          remainingSales: FREE_TIER_LIMIT,
          isAtLimit: false,
          totalSalesAllBusinesses: 0
        } : null,
        canAccessFeature: businessId ? true : null
      };
    }
  }
};
