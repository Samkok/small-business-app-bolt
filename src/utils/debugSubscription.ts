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

      await subscriptionService.updateSubscription(
        userId,
        status,
        productId || 'bizmanage.pro.month',
        status === 'active' ? expirationDate : undefined,
        'debug_receipt_data'
      );

      console.log(`[DEBUG] Simulated subscription: ${status}, product: ${productId}`);
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
      const [subscription, salesCount, canAccess] = await Promise.all([
        subscriptionService.getSubscriptionStatus(userId),
        subscriptionService.getSalesCount(userId, businessId),
        subscriptionService.canAccessFeature(userId, businessId)
      ]);

      console.log('[DEBUG] Subscription State:', {
        subscription,
        salesCount,
        canAccess,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[DEBUG] Error logging state:', error);
    }
  }
};
