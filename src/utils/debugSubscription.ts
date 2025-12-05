import { subscriptionService } from '@/src/services/subscriptionService';
import { supabase } from '@/src/config/supabase';

export const debugSubscription = {
  async simulateSalesCount(userId: string, businessId: string, count: number): Promise<void> {
    if (!__DEV__) {
      console.warn('Debug tools are only available in development mode');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_sales_counts')
        .upsert({
          user_id: userId,
          business_id: businessId,
          sales_count: count,
          last_counted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      await subscriptionService.clearSalesCountCache(businessId);

      console.log(`[DEBUG] Simulated sales count: ${count}`);
    } catch (error) {
      console.error('[DEBUG] Error simulating sales count:', error);
    }
  },

  async simulateSubscription(
    userId: string,
    status: 'active' | 'expired' | 'cancelled' | 'trial',
    productId?: string
  ): Promise<void> {
    if (!__DEV__) {
      console.warn('Debug tools are only available in development mode');
      return;
    }

    try {
      const expirationDate = status === 'active'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const finalProductId = productId || 'bizmanage.pro.month';

      let tier = 'free';
      let maxOwnedBusinesses = null;

      if (finalProductId.includes('pro_plus')) {
        tier = 'pro_plus';
        maxOwnedBusinesses = 3;
      } else if (finalProductId.includes('max')) {
        tier = 'max';
        maxOwnedBusinesses = 999999;
      } else if (finalProductId.includes('pro')) {
        tier = 'pro';
        maxOwnedBusinesses = 1;
      }

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          subscription_status: status,
          subscription_product_id: finalProductId,
          tier: tier,
          max_owned_businesses: maxOwnedBusinesses,
          subscription_expiration_date: status === 'active' ? expirationDate.toISOString() : null,
          receipt_data: 'debug_receipt_data',
          last_validated_at: new Date().toISOString(),
          platform: 'ios',
          subscription_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      await subscriptionService.clearSubscriptionCache();

      console.log(`[DEBUG] Simulated subscription: ${status}, product: ${finalProductId}, tier: ${tier}`);
    } catch (error) {
      console.error('[DEBUG] Error simulating subscription:', error);
    }
  },

  async resetAllData(userId: string, businessId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('Debug tools are only available in development mode');
      return;
    }

    try {
      await Promise.all([
        supabase
          .from('user_sales_counts')
          .delete()
          .eq('user_id', userId)
          .eq('business_id', businessId),
        supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', userId)
      ]);

      await subscriptionService.clearSubscriptionCache();
      await subscriptionService.clearSalesCountCache(businessId);

      console.log('[DEBUG] All subscription data reset');
    } catch (error) {
      console.error('[DEBUG] Error resetting data:', error);
    }
  },

  async logSubscriptionState(userId: string, businessId: string): Promise<void> {
    if (!__DEV__) {
      console.warn('Debug tools are only available in development mode');
      return;
    }

    try {
      const [subscription, salesCount, totalSales, tierInfo, ownedBusinessCount, canAccess, canCreateSale] = await Promise.all([
        subscriptionService.getSubscriptionStatus(userId),
        subscriptionService.getSalesCount(userId, businessId),
        subscriptionService.getTotalSalesCount(userId),
        subscriptionService.getTierInfo(userId),
        subscriptionService.getOwnedBusinessCount(userId),
        subscriptionService.canAccessFeature(userId, businessId),
        subscriptionService.canCreateSale(userId, businessId)
      ]);

      console.log('[DEBUG] Subscription State:', {
        subscription,
        tierInfo,
        salesCount,
        totalSales,
        ownedBusinessCount,
        canAccess,
        canCreateSale,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[DEBUG] Error logging state:', error);
    }
  }
};
