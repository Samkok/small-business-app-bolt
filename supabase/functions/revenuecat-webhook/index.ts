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

function getTierFromEntitlements(entitlementIds: string[] | null | undefined): string {
  if (!entitlementIds || !Array.isArray(entitlementIds)) {
    return 'free';
  }

  if (entitlementIds.includes('bizmanage_max')) {
    return 'max';
  }
  if (entitlementIds.includes('bizmanage_pro_plus')) {
    return 'pro_plus';
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
    default:
      return null;
  }
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

    console.log('[RevenueCat Webhook] Received event:', event.type);
    console.log('[RevenueCat Webhook] User ID:', event.app_user_id);
    console.log('[RevenueCat Webhook] Product ID:', event.product_id);
    console.log('[RevenueCat Webhook] Entitlements:', event.entitlement_ids);

    const userId = event.app_user_id;
    const tier = getTierFromEntitlements(event.entitlement_ids);
    const maxBusinesses = getMaxBusinessesFromTier(tier);

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION': {
        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

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
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        console.log('[RevenueCat Webhook] Subscription updated successfully');
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_status: event.type === 'CANCELLATION' ? 'cancelled' : 'expired',
            tier: 'free',
            max_owned_businesses: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          console.error('[RevenueCat Webhook] Error updating subscription:', subscriptionError);
          throw subscriptionError;
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('must_choose_businesses')
          .eq('user_id', userId)
          .maybeSingle();

        if (!profile?.must_choose_businesses) {
          const { data: businesses } = await supabase
            .from('businesses')
            .select('id')
            .eq('owner_user_id', userId)
            .order('created_at', { ascending: true });

          if (businesses && businesses.length > 1) {
            const { error: profileError } = await supabase
              .from('user_profiles')
              .update({ must_choose_businesses: true })
              .eq('user_id', userId);

            if (profileError) {
              console.error('[RevenueCat Webhook] Error updating profile:', profileError);
            } else {
              console.log('[RevenueCat Webhook] User flagged to choose businesses');
            }
          }
        }

        console.log('[RevenueCat Webhook] Subscription cancelled/expired');
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

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
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