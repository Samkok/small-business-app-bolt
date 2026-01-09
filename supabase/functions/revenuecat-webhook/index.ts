import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RevenueCatEvent {
  api_version: string;
  event: {
    type: string;
    app_user_id: string;
    original_app_user_id: string;
    product_id: string;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: string;
    entitlement_ids: string[];
    store: string;
    transaction_id: string;
    original_transaction_id: string;
    is_trial_conversion: boolean;
    subscriber_attributes?: Record<string, any>;
  };
}

function getTierFromProductId(productId: string | null | undefined): string {
  if (!productId) {
    return 'free';
  }

  const lowerProductId = productId.toLowerCase();

  const proPlusMatch = lowerProductId.match(/pro[_\s-]?plus/);
  const maxMatch = lowerProductId.match(/\bmax\b/);
  const proMatch = lowerProductId.match(/\bpro\b/);

  if (proPlusMatch) {
    return 'pro_plus';
  } else if (maxMatch) {
    return 'max';
  } else if (proMatch) {
    return 'pro';
  }

  return 'free';
}

function getTierFromEntitlements(entitlementIds: string[] | null | undefined): string {
  if (!entitlementIds || !Array.isArray(entitlementIds) || entitlementIds.length === 0) {
    return 'free';
  }

  if (entitlementIds.includes('bizmanage_pro_plus')) {
    return 'pro_plus';
  }
  if (entitlementIds.includes('bizmanage_max')) {
    return 'max';
  }
  if (entitlementIds.includes('bizmanage_pro')) {
    return 'pro';
  }
  return 'free';
}

function getMaxBusinessesFromTier(tier: string): number | null {
  switch (tier) {
    case 'pro':
      return 1;
    case 'pro_plus':
      return 3;
    case 'max':
      return 999999;
    case 'free':
      return 1;
    default:
      return 1;
  }
}

function getTierLevel(tier: string): number {
  switch (tier) {
    case 'free':
      return 0;
    case 'pro':
      return 1;
    case 'pro_plus':
      return 2;
    case 'max':
      return 3;
    default:
      return 0;
  }
}

function isUpgrade(oldTier: string, newTier: string): boolean {
  return getTierLevel(newTier) > getTierLevel(oldTier);
}

function isDowngrade(oldTier: string, newTier: string): boolean {
  return getTierLevel(newTier) < getTierLevel(oldTier);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: RevenueCatEvent = await req.json();
    const { event } = payload;

    console.log('[RevenueCat Webhook] ========== EVENT RECEIVED ==========');
    console.log('[RevenueCat Webhook] Event type:', event.type);
    console.log('[RevenueCat Webhook] User ID:', event.app_user_id);
    console.log('[RevenueCat Webhook] Product ID (RAW):', event.product_id);
    console.log('[RevenueCat Webhook] Entitlements (RAW):', JSON.stringify(event.entitlement_ids));
    console.log('[RevenueCat Webhook] Store:', event.store);
    console.log('[RevenueCat Webhook] Original App User ID:', event.original_app_user_id);

    const userId = event.app_user_id;
    const tierFromProductId = getTierFromProductId(event.product_id);
    const tierFromEntitlements = getTierFromEntitlements(event.entitlement_ids);
    const tier = tierFromProductId !== 'free' ? tierFromProductId : tierFromEntitlements;
    const maxBusinesses = getMaxBusinessesFromTier(tier);

    console.log('[RevenueCat Webhook] ========== TIER DETECTION ==========');
    console.log('[RevenueCat Webhook] Tier from product ID:', tierFromProductId);
    console.log('[RevenueCat Webhook] Tier from entitlements:', tierFromEntitlements);
    console.log('[RevenueCat Webhook] Final tier selected:', tier);
    console.log('[RevenueCat Webhook] Max businesses for tier:', maxBusinesses);
    console.log('[RevenueCat Webhook] NOTE: For CANCELLATION/EXPIRATION events, this tier will be IGNORED and set to "free"');
    console.log('[RevenueCat Webhook] =======================================');

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL': {
        console.log('[RevenueCat Webhook] ========== INITIAL_PURCHASE/RENEWAL ==========');

        // Log current state before changes
        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);

        // Get active business count
        const { data: businessCountData } = await supabase
          .rpc('get_user_owned_business_count', { p_user_id: userId });

        const businessCount = businessCountData || 0;
        console.log('[RevenueCat Webhook] User has', businessCount, 'owned businesses');
        console.log('[RevenueCat Webhook] New tier allows', maxBusinesses, 'businesses');

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            subscription_status: 'active',
            subscription_product_id: event.product_id,
            subscription_expiration_date: expirationDate,
            platform: event.store === 'APP_STORE' ? 'ios' : 'android',
            tier: tier,
            max_owned_businesses: maxBusinesses,
            revenuecat_app_user_id: event.original_app_user_id,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          }, {
            onConflict: 'user_id',
          });

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('[RevenueCat Webhook] Subscription record updated');

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('must_choose_businesses')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] must_choose_businesses flag:', profile?.must_choose_businesses);

        if (profile?.must_choose_businesses) {
          console.log('[RevenueCat Webhook] User needs to reactivate businesses, calling set_all_businesses_active()');

          const { error: clearFlagError } = await supabase
            .from('user_profiles')
            .update({ must_choose_businesses: false })
            .eq('user_id', userId);

          if (clearFlagError) {
            console.error('[RevenueCat Webhook] Error clearing must_choose_businesses flag:', clearFlagError);
          } else {
            console.log('[RevenueCat Webhook] Cleared must_choose_businesses flag');
          }

          const { error: activateError } = await supabase.rpc('set_all_businesses_active', {
            p_user_id: userId
          });

          if (activateError) {
            console.error('[RevenueCat Webhook] Error activating businesses:', activateError);
          } else {
            console.log('[RevenueCat Webhook] Successfully called set_all_businesses_active()');
          }
        } else {
          console.log('[RevenueCat Webhook] User does not need business reactivation');
        }

        // Log final state
        const { data: afterState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] AFTER - selected_business_ids:', afterState?.selected_business_ids);
        console.log('[RevenueCat Webhook] AFTER - tier:', afterState?.tier);
        console.log('[RevenueCat Webhook] Subscription updated successfully');
        console.log('[RevenueCat Webhook] ========================================');
        break;
      }

      case 'UNCANCELLATION': {
        console.log('[RevenueCat Webhook] ========== UNCANCELLATION ==========');

        // Log current state before changes
        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);

        // Get active business count
        const { data: businessCountData } = await supabase
          .rpc('get_user_owned_business_count', { p_user_id: userId });

        const businessCount = businessCountData || 0;
        console.log('[RevenueCat Webhook] User has', businessCount, 'owned businesses');
        console.log('[RevenueCat Webhook] Reactivated tier allows', maxBusinesses, 'businesses');

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            subscription_status: 'active',
            subscription_product_id: event.product_id,
            subscription_expiration_date: expirationDate,
            platform: event.store === 'app_store' ? 'ios' : 'android',
            tier: tier,
            max_owned_businesses: maxBusinesses,
            revenuecat_app_user_id: event.original_app_user_id,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          }, {
            onConflict: 'user_id',
          });

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('[RevenueCat Webhook] Subscription record updated');
        console.log('[RevenueCat Webhook] Calling set_all_businesses_active() to reactivate all businesses');

        const { error: clearFlagError } = await supabase
          .from('user_profiles')
          .update({ must_choose_businesses: false })
          .eq('user_id', userId);

        if (clearFlagError) {
          console.error('[RevenueCat Webhook] Error clearing must_choose_businesses flag:', clearFlagError);
        } else {
          console.log('[RevenueCat Webhook] Cleared must_choose_businesses flag on uncancellation');
        }

        const { error: activateError } = await supabase.rpc('set_all_businesses_active', {
          p_user_id: userId
        });

        if (activateError) {
          console.error('[RevenueCat Webhook] Error activating businesses:', activateError);
        } else {
          console.log('[RevenueCat Webhook] Successfully called set_all_businesses_active()');
        }

        // Log final state
        const { data: afterState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] AFTER - selected_business_ids:', afterState?.selected_business_ids);
        console.log('[RevenueCat Webhook] AFTER - tier:', afterState?.tier);
        console.log('[RevenueCat Webhook] Subscription uncancelled successfully');
        console.log('[RevenueCat Webhook] ========================================');
        break;
      }

      case 'PRODUCT_CHANGE': {
        console.log('[RevenueCat Webhook] ========== PRODUCT_CHANGE ==========');

        // Log current state before changes
        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);

        const { data: currentSubscription } = await supabase
          .from('user_subscriptions')
          .select('tier, previous_tier')
          .eq('user_id', userId)
          .maybeSingle();

        const previousTier = currentSubscription?.tier || 'free';
        console.log('[RevenueCat Webhook] Previous tier:', previousTier);
        console.log('[RevenueCat Webhook] New tier:', tier);

        // Get active business count
        const { data: businessCountData } = await supabase
          .rpc('get_user_owned_business_count', { p_user_id: userId });

        const businessCount = businessCountData || 0;
        console.log('[RevenueCat Webhook] User has', businessCount, 'owned businesses');
        console.log('[RevenueCat Webhook] New tier allows', maxBusinesses, 'businesses');

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            subscription_status: 'active',
            subscription_product_id: event.product_id,
            subscription_expiration_date: expirationDate,
            platform: event.store === 'app_store' ? 'ios' : 'android',
            tier: tier,
            max_owned_businesses: maxBusinesses,
            previous_tier: previousTier,
            revenuecat_app_user_id: event.original_app_user_id,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          }, {
            onConflict: 'user_id',
          });

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('[RevenueCat Webhook] Subscription record updated');

        if (isUpgrade(previousTier, tier)) {
          console.log('[RevenueCat Webhook] *** UPGRADE DETECTED *** from', previousTier, 'to', tier);
          console.log('[RevenueCat Webhook] Calling set_all_businesses_active() to activate all businesses');

          const { error: clearFlagError } = await supabase
            .from('user_profiles')
            .update({ must_choose_businesses: false })
            .eq('user_id', userId);

          if (clearFlagError) {
            console.error('[RevenueCat Webhook] Error clearing must_choose_businesses flag:', clearFlagError);
          } else {
            console.log('[RevenueCat Webhook] Cleared must_choose_businesses flag on upgrade');
          }

          const { error: activateError } = await supabase.rpc('set_all_businesses_active', {
            p_user_id: userId
          });

          if (activateError) {
            console.error('[RevenueCat Webhook] Error activating businesses:', activateError);
          } else {
            console.log('[RevenueCat Webhook] Successfully called set_all_businesses_active()');
          }
        } else if (isDowngrade(previousTier, tier)) {
          console.log('[RevenueCat Webhook] *** DOWNGRADE DETECTED *** from', previousTier, 'to', tier);

          if (businessCount > (maxBusinesses || 1)) {
            console.log('[RevenueCat Webhook] Business count', businessCount, 'exceeds tier limit', maxBusinesses, '- calling set_read_only_businesses()');

            const { error: readOnlyError } = await supabase.rpc('set_read_only_businesses', {
              p_user_id: userId,
              p_max_active_businesses: maxBusinesses || 1
            });

            if (readOnlyError) {
              console.error('[RevenueCat Webhook] Error setting read-only businesses:', readOnlyError);
            } else {
              console.log('[RevenueCat Webhook] Successfully called set_read_only_businesses()');
            }

            const { error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: userId,
                business_id: null,
                type: 'subscription_warning',
                title: 'Plan Downgraded',
                message: `Your plan has been downgraded to ${tier}. Please select which ${maxBusinesses} business(es) to keep active.`,
                read: false,
                created_at: new Date().toISOString(),
              });

            if (notificationError) {
              console.error('[RevenueCat Webhook] Error creating notification:', notificationError);
            } else {
              console.log('[RevenueCat Webhook] Created downgrade notification for user');
            }
          } else {
            console.log('[RevenueCat Webhook] Business count', businessCount, 'within tier limit', maxBusinesses, '- no action needed');
          }
        } else {
          console.log('[RevenueCat Webhook] Tier unchanged (lateral move) - no business state changes');
        }

        // Log final state
        const { data: afterState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] AFTER - selected_business_ids:', afterState?.selected_business_ids);
        console.log('[RevenueCat Webhook] AFTER - tier:', afterState?.tier);
        console.log('[RevenueCat Webhook] Product change processed successfully');
        console.log('[RevenueCat Webhook] ========================================');
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        console.log('[RevenueCat Webhook] ========== CANCELLATION/EXPIRATION ==========');
        console.log('[RevenueCat Webhook] Event type:', event.type);

        // Log current state before changes
        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);

        const { data: currentSubscription } = await supabase
          .from('user_subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .maybeSingle();

        const previousTier = currentSubscription?.tier || 'free';
        console.log('[RevenueCat Webhook] Current tier from database:', previousTier);
        console.log('[RevenueCat Webhook] SETTING: subscription_product_id = null, tier = free, max_owned_businesses = 1');

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_status: event.type === 'CANCELLATION' ? 'cancelled' : 'expired',
            subscription_product_id: null,
            tier: 'free',
            max_owned_businesses: 1,
            previous_tier: previousTier,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('[RevenueCat Webhook] Subscription record updated');

        const { data: businessCountData } = await supabase
          .rpc('get_user_owned_business_count', { p_user_id: userId });

        const businessCount = businessCountData || 0;
        console.log('[RevenueCat Webhook] User owns', businessCount, 'businesses');
        console.log('[RevenueCat Webhook] Free tier allows 1 business');

        if (businessCount > 1) {
          console.log('[RevenueCat Webhook] Business count', businessCount, 'exceeds free tier limit (1) - calling set_read_only_businesses()');

          const { error: readOnlyError } = await supabase.rpc('set_read_only_businesses', {
            p_user_id: userId,
            p_max_active_businesses: 1
          });

          if (readOnlyError) {
            console.error('[RevenueCat Webhook] Error setting read-only businesses:', readOnlyError);
          } else {
            console.log('[RevenueCat Webhook] Successfully called set_read_only_businesses()');
          }

          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              business_id: null,
              type: 'subscription_warning',
              title: event.type === 'CANCELLATION' ? 'Subscription Cancelled' : 'Subscription Expired',
              message: 'Your subscription has ended. Please select 1 business to keep active on the free plan.',
              read: false,
              created_at: new Date().toISOString(),
            });

          if (notificationError) {
            console.error('[RevenueCat Webhook] Error creating notification:', notificationError);
          } else {
            console.log('[RevenueCat Webhook] Created expiration notification for user');
          }
        } else {
          console.log('[RevenueCat Webhook] Business count', businessCount, 'within free tier limit - clearing must_choose_businesses flag');

          const { error: clearFlagError } = await supabase
            .from('user_profiles')
            .update({ must_choose_businesses: false })
            .eq('user_id', userId);

          if (clearFlagError) {
            console.error('[RevenueCat Webhook] Error clearing flag:', clearFlagError);
          } else {
            console.log('[RevenueCat Webhook] Cleared must_choose_businesses flag');
          }
        }

        // Log final state
        const { data: afterState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] AFTER - selected_business_ids:', afterState?.selected_business_ids);
        console.log('[RevenueCat Webhook] AFTER - tier:', afterState?.tier);
        console.log('[RevenueCat Webhook] Subscription', event.type.toLowerCase(), 'processed successfully');
        console.log('[RevenueCat Webhook] ========================================');
        break;
      }

      case 'BILLING_ISSUE': {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            business_id: null,
            type: 'subscription_warning',
            title: 'Billing Issue',
            message: 'There was a problem with your subscription payment. Please update your payment method.',
            read: false,
            created_at: new Date().toISOString(),
          });

        if (notificationError) {
          console.error('[RevenueCat Webhook] Error creating notification:', notificationError);
        }

        console.log('[RevenueCat Webhook] Billing issue notification sent');
        break;
      }

      default:
        console.log('[RevenueCat Webhook] Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ success: true, event: event.type }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[RevenueCat Webhook] Error:', error);
    console.error('[RevenueCat Webhook] Error type:', typeof error);
    console.error('[RevenueCat Webhook] Error details:', JSON.stringify(error, null, 2));

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        details: error,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});