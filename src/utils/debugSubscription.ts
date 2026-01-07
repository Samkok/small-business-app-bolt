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

      const lowerProductId = finalProductId.toLowerCase();
      const proPlusMatch = lowerProductId.match(/pro[_\s-]?plus/);
      const maxMatch = lowerProductId.match(/\bmax\b/);
      const proMatch = lowerProductId.match(/\bpro\b/);

      if (proPlusMatch) {
        tier = 'pro_plus';
        maxOwnedBusinesses = 3;
      } else if (maxMatch) {
        tier = 'max';
        maxOwnedBusinesses = 999999;
      } else if (proMatch) {
        tier = 'pro';
        maxOwnedBusinesses = 1;
      }

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
        subscription_product_id: finalProductId,
        tier: tier,
        max_owned_businesses: maxOwnedBusinesses,
        subscription_expiration_date: status === 'active' ? expirationDate.toISOString() : null,
        receipt_data: 'debug_receipt_data',
        last_validated_at: new Date().toISOString(),
        platform: 'ios' as const,
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
        const result = await supabase
          .from('user_subscriptions')
          .insert({
            ...subscriptionData,
            subscription_start_date: new Date().toISOString()
          });
        error = result.error;
      }

      if (error) throw error;

      const { data: authUser } = await supabase.auth.getUser();
      console.log(`[DEBUG] Updating user_profile for userId: ${userId}, authenticated as: ${authUser?.user?.id}`);

      const { data: profileExists } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileExists) {
        throw new Error(`User profile not found for userId: ${userId}. Please ensure the user profile exists.`);
      }

      const { data: updatedProfile, error: updateError, count } = await supabase
        .from('user_profiles')
        .update({ must_choose_businesses: true })
        .eq('user_id', authUser.user.id)
        .select();

      if (updateError) {
        console.error('[DEBUG] Update error:', updateError);
        throw updateError;
      }

      if (!updatedProfile || updatedProfile.length === 0) {
        throw new Error(
          `Failed to update user_profiles: 0 rows affected. ` +
          `This may be due to RLS policies blocking the update. ` +
          `Authenticated user: ${authUser?.user?.id}, Target user: ${userId}`
        );
      }

      console.log(`[DEBUG] Successfully updated user_profiles, rows affected: ${count || updatedProfile.length}`);

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
      const [salesResult, subscriptionsResult] = await Promise.all([
        supabase
          .from('user_sales_counts')
          .delete()
          .eq('user_id', userId)
          .eq('business_id', businessId)
          .select(),
        supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', userId)
          .select()
      ]);

      if (salesResult.error) {
        console.error('[DEBUG] Error deleting sales counts:', salesResult.error);
        throw salesResult.error;
      }

      if (subscriptionsResult.error) {
        console.error('[DEBUG] Error deleting subscriptions:', subscriptionsResult.error);
        throw subscriptionsResult.error;
      }

      console.log(`[DEBUG] Deleted ${salesResult.data?.length || 0} sales count records`);
      console.log(`[DEBUG] Deleted ${subscriptionsResult.data?.length || 0} subscription records`);

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
