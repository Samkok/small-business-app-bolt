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
    new_product_id: string;
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

    let validatedProductId = event.product_id || event.new_product_id;
    if (!validatedProductId || validatedProductId === null || validatedProductId === undefined) {
      console.warn('[RevenueCat Webhook] WARNING: product_id is missing or null!');
      console.log('[RevenueCat Webhook] Attempting to derive from entitlements...');

      if (event.entitlement_ids && event.entitlement_ids.length > 0) {
        validatedProductId = event.entitlement_ids[0];
        console.log('[RevenueCat Webhook] Derived product_id from entitlements:', validatedProductId);
      } else {
        console.error('[RevenueCat Webhook] ERROR: Cannot derive product_id - both product_id and entitlements are empty!');
        validatedProductId = null;
      }
    }

    console.log('[RevenueCat Webhook] Validated Product ID:', validatedProductId);

    const userId = event.app_user_id;

    const productIdForTierDetection = event.type === 'PRODUCT_CHANGE' ? event.new_product_id : validatedProductId;

    console.log('[RevenueCat Webhook] ========== TIER DETECTION ==========');
    if (event.type === 'PRODUCT_CHANGE') {
      console.log('[RevenueCat Webhook] PRODUCT_CHANGE detected - using new_product_id for tier detection');
      console.log('[RevenueCat Webhook] Old Product ID:', event.product_id);
      console.log('[RevenueCat Webhook] New Product ID:', event.new_product_id);
    }

    const tierFromProductId = getTierFromProductId(productIdForTierDetection);
    const tierFromEntitlements = getTierFromEntitlements(event.entitlement_ids);
    const tier = tierFromProductId !== 'free' ? tierFromProductId : tierFromEntitlements;
    const maxBusinesses = getMaxBusinessesFromTier(tier);

    console.log('[RevenueCat Webhook] Product ID used for detection:', productIdForTierDetection);
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

        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);

        const { data: businessCountData } = await supabase
          .rpc('get_user_owned_business_count', { p_user_id: userId });

        const businessCount = businessCountData || 0;
        console.log('[RevenueCat Webhook] User has', businessCount, 'owned businesses');
        console.log('[RevenueCat Webhook] New tier allows', maxBusinesses, 'businesses');

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        console.log('[RevenueCat Webhook] Updating subscription with product_id:', validatedProductId);

        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            subscription_status: 'active',
            subscription_product_id: validatedProductId,
            subscription_expiration_date: expirationDate,
            platform: event.store === 'APP_STORE' ? 'ios' : 'android',
            tier: tier,
            max_owned_businesses: maxBusinesses,
            revenuecat_app_user_id: event.original_app_user_id,
            will_renew: true,
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

        if (businessCount <= maxBusinesses!) {
          console.log('[RevenueCat Webhook] Business count', businessCount, 'within tier limit', maxBusinesses, '- calling set_all_businesses_active()');

          const { error: activateError } = await supabase.rpc('set_all_businesses_active', {
            p_user_id: userId
          });

          if (activateError) {
            console.error('[RevenueCat Webhook] Error activating businesses:', activateError);
          } else {
            console.log('[RevenueCat Webhook] Successfully called set_all_businesses_active()');
          }

          const { error: clearFlagError } = await supabase
            .from('user_profiles')
            .update({ must_choose_businesses: false })
            .eq('user_id', userId);

          if (clearFlagError) {
            console.error('[RevenueCat Webhook] Error clearing flag:', clearFlagError);
          } else {
            console.log('[RevenueCat Webhook] Cleared must_choose_businesses flag');
          }
        } else {
          console.log('[RevenueCat Webhook] Business count', businessCount, 'exceeds tier limit', maxBusinesses);
          console.log('[RevenueCat Webhook] User will need to select which businesses to keep active');
        }

        const { data: afterState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] AFTER - selected_business_ids:', afterState?.selected_business_ids);
        console.log('[RevenueCat Webhook] AFTER - tier:', afterState?.tier);
        console.log('[RevenueCat Webhook] Subscription purchase/renewal processed successfully');
        console.log('[RevenueCat Webhook] ========================================');
        break;
      }

      case 'UNCANCELLATION': {
        console.log('[RevenueCat Webhook] ========== UNCANCELLATION ==========');
        console.log('[RevenueCat Webhook] User reactivated subscription - will now auto-renew');

        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);

        const { data: businessCountData } = await supabase
          .rpc('get_user_owned_business_count', { p_user_id: userId });

        const businessCount = businessCountData || 0;
        console.log('[RevenueCat Webhook] User has', businessCount, 'owned businesses');
        console.log('[RevenueCat Webhook] Reactivated tier allows', maxBusinesses, 'businesses');

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        console.log('[RevenueCat Webhook] Updating subscription with product_id:', validatedProductId);

        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            subscription_status: 'active',
            subscription_product_id: validatedProductId,
            subscription_expiration_date: expirationDate,
            platform: event.store === 'APP_STORE' ? 'ios' : 'android',
            tier: tier,
            max_owned_businesses: maxBusinesses,
            revenuecat_app_user_id: event.original_app_user_id,
            will_renew: true,
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

        if (businessCount <= maxBusinesses!) {
          console.log('[RevenueCat Webhook] Business count', businessCount, 'within tier limit', maxBusinesses, '- calling set_all_businesses_active()');

          const { error: activateError } = await supabase.rpc('set_all_businesses_active', {
            p_user_id: userId
          });

          if (activateError) {
            console.error('[RevenueCat Webhook] Error activating businesses:', activateError);
          } else {
            console.log('[RevenueCat Webhook] Successfully called set_all_businesses_active()');
          }

          const { error: clearFlagError } = await supabase
            .from('user_profiles')
            .update({ must_choose_businesses: false })
            .eq('user_id', userId);

          if (clearFlagError) {
            console.error('[RevenueCat Webhook] Error clearing flag:', clearFlagError);
          } else {
            console.log('[RevenueCat Webhook] Cleared must_choose_businesses flag');
          }
        } else {
          console.log('[RevenueCat Webhook] Business count', businessCount, 'exceeds tier limit', maxBusinesses);
          console.log('[RevenueCat Webhook] User will need to select which businesses to keep active');
        }

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

        const { data: businessCountData } = await supabase
          .rpc('get_user_owned_business_count', { p_user_id: userId });

        const businessCount = businessCountData || 0;
        console.log('[RevenueCat Webhook] User has', businessCount, 'owned businesses');
        console.log('[RevenueCat Webhook] New tier allows', maxBusinesses, 'businesses');

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        console.log('[RevenueCat Webhook] Updating subscription with product_id:', event.new_product_id);

        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            subscription_status: 'active',
            subscription_product_id: event.new_product_id,
            subscription_expiration_date: expirationDate,
            platform: event.store === 'APP_STORE' ? 'ios' : 'android',
            tier: tier,
            max_owned_businesses: maxBusinesses,
            previous_tier: previousTier,
            revenuecat_app_user_id: event.original_app_user_id,
            will_renew: true,
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
          console.log('[RevenueCat Webhook] UPGRADE detected from', previousTier, 'to', tier);

          if (businessCount <= maxBusinesses!) {
            console.log('[RevenueCat Webhook] Business count', businessCount, 'within new tier limit', maxBusinesses, '- calling set_all_businesses_active()');

            const { error: activateError } = await supabase.rpc('set_all_businesses_active', {
              p_user_id: userId
            });

            if (activateError) {
              console.error('[RevenueCat Webhook] Error activating businesses:', activateError);
            } else {
              console.log('[RevenueCat Webhook] Successfully called set_all_businesses_active()');
            }

            const { error: clearFlagError } = await supabase
              .from('user_profiles')
              .update({ must_choose_businesses: false })
              .eq('user_id', userId);

            if (clearFlagError) {
              console.error('[RevenueCat Webhook] Error clearing flag:', clearFlagError);
            } else {
              console.log('[RevenueCat Webhook] Cleared must_choose_businesses flag');
            }
          } else {
            console.log('[RevenueCat Webhook] Business count', businessCount, 'exceeds new tier limit', maxBusinesses);
            console.log('[RevenueCat Webhook] User will need to select which businesses to keep active');
          }
        } else if (isDowngrade(previousTier, tier)) {
          console.log('[RevenueCat Webhook] DOWNGRADE detected from', previousTier, 'to', tier);
          console.log('[RevenueCat Webhook] Old tier allowed:', getMaxBusinessesFromTier(previousTier), 'businesses');
          console.log('[RevenueCat Webhook] New tier allows:', maxBusinesses, 'businesses');

          if (businessCount > maxBusinesses!) {
            console.log('[RevenueCat Webhook] Business count', businessCount, 'exceeds new tier limit', maxBusinesses, '- calling set_read_only_businesses()');

            const { error: readOnlyError } = await supabase.rpc('set_read_only_businesses', {
              p_user_id: userId,
              p_max_active_businesses: maxBusinesses
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
                title: 'Subscription Plan Changed',
                message: `You've changed to a plan that allows ${maxBusinesses} active business${maxBusinesses === 1 ? '' : 'es'}. Please select which business${maxBusinesses === 1 ? '' : 'es'} to keep active.`,
                read: false,
                created_at: new Date().toISOString(),
              });

            if (notificationError) {
              console.error('[RevenueCat Webhook] Error creating notification:', notificationError);
            } else {
              console.log('[RevenueCat Webhook] Created downgrade notification for user');
            }
          } else {
            console.log('[RevenueCat Webhook] Business count', businessCount, 'within new tier limit', maxBusinesses, '- no action needed');

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
        } else {
          console.log('[RevenueCat Webhook] Same tier level - tier:', tier);
        }

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

      case 'CANCELLATION': {
        console.log('[RevenueCat Webhook] ========== CANCELLATION ==========');
        console.log('[RevenueCat Webhook] User cancelled subscription but will retain benefits until expiration date');

        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier, subscription_expiration_date')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);
        console.log('[RevenueCat Webhook] BEFORE - expiration_date:', beforeState?.subscription_expiration_date);

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        console.log('[RevenueCat Webhook] Marking subscription as will_renew=false');
        console.log('[RevenueCat Webhook] User will keep', beforeState?.tier || 'current', 'tier benefits until:', expirationDate);
        console.log('[RevenueCat Webhook] NOT downgrading immediately - benefits remain active');

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            will_renew: false,
            subscription_expiration_date: expirationDate,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('[RevenueCat Webhook] Subscription marked for cancellation');
        console.log('[RevenueCat Webhook] Status: Active until', expirationDate);
        console.log('[RevenueCat Webhook] will_renew: false (will not auto-renew)');
        console.log('[RevenueCat Webhook] NOTE: User retains full benefits until expiration date');
        console.log('[RevenueCat Webhook] NOTE: Downgrade will occur when EXPIRATION event is received');
        console.log('[RevenueCat Webhook] ========================================');
        break;
      }

      case 'EXPIRATION': {
        console.log('[RevenueCat Webhook] ========== EXPIRATION ==========');
        console.log('[RevenueCat Webhook] Subscription has expired - downgrading to free tier');

        const { data: beforeState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier, will_renew')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] BEFORE - selected_business_ids:', beforeState?.selected_business_ids);
        console.log('[RevenueCat Webhook] BEFORE - tier:', beforeState?.tier);
        console.log('[RevenueCat Webhook] BEFORE - will_renew:', beforeState?.will_renew);

        const { data: currentSubscription } = await supabase
          .from('user_subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .maybeSingle();

        const previousTier = currentSubscription?.tier || 'free';
        console.log('[RevenueCat Webhook] Previous tier:', previousTier);
        console.log('[RevenueCat Webhook] SETTING: subscription_status=expired, tier=free, max_owned_businesses=1');

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_status: 'expired',
            subscription_product_id: null,
            tier: 'free',
            max_owned_businesses: 1,
            previous_tier: previousTier,
            will_renew: false,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('[RevenueCat Webhook] Subscription record updated to expired/free tier');

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
              title: 'Subscription Expired',
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

        const { data: afterState } = await supabase
          .from('user_subscriptions')
          .select('selected_business_ids, tier')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[RevenueCat Webhook] AFTER - selected_business_ids:', afterState?.selected_business_ids);
        console.log('[RevenueCat Webhook] AFTER - tier:', afterState?.tier);
        console.log('[RevenueCat Webhook] Subscription expiration processed successfully');
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
          console.error('[RevenueCat Webhook] Error creating billing notification:', notificationError);
        } else {
          console.log('[RevenueCat Webhook] Created billing issue notification');
        }
        break;
      }

      default:
        console.log('[RevenueCat Webhook] Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('[RevenueCat Webhook] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});