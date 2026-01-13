import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Enhanced interface with all RevenueCat webhook fields
interface RevenueCatEvent {
  api_version: string;
  event: {
    id: string;
    type: string;
    app_user_id: string;
    original_app_user_id: string;
    aliases?: string[];
    app_id?: string;
    event_timestamp_ms: number;

    // Product and subscription fields
    product_id?: string;
    new_product_id?: string;
    entitlement_ids?: string[];
    entitlement_id?: string;
    period_type?: string;

    // Timing fields
    purchased_at_ms?: number;
    expiration_at_ms?: number | null;
    grace_period_expiration_at_ms?: number | null;
    auto_resume_at_ms?: number | null;

    // Store and environment
    store?: string;
    environment?: string;

    // Transaction fields
    transaction_id?: string;
    original_transaction_id?: string;

    // Status fields
    is_trial_conversion?: boolean;
    is_family_share?: boolean;
    cancel_reason?: string;
    expiration_reason?: string;

    // Transfer fields
    transferred_from?: string[];
    transferred_to?: string[];

    // Pricing fields
    price?: number;
    currency?: string;
    price_in_purchased_currency?: number;

    // Metadata
    subscriber_attributes?: Record<string, any>;
    country_code?: string;
    offer_code?: string;
    presented_offering_id?: string;
    renewal_number?: number;
  };
}

// Helper Functions
function log(eventId: string, level: string, message: string, data?: any) {
  const prefix = `[RevenueCat:${eventId}]`;
  const fullMessage = `${prefix} [${level}] ${message}`;

  if (data) {
    console.log(fullMessage, JSON.stringify(data));
  } else {
    console.log(fullMessage);
  }
}

function getTierFromProductId(productId: string | null | undefined): string {
  if (!productId) return 'free';

  const lowerProductId = productId.toLowerCase();
  const proPlusMatch = lowerProductId.match(/pro[_\s-]?plus/);
  const maxMatch = lowerProductId.match(/\bmax\b/);
  const proMatch = lowerProductId.match(/\bpro\b/);

  if (proPlusMatch) return 'pro_plus';
  if (maxMatch) return 'max';
  if (proMatch) return 'pro';
  return 'free';
}

function getTierFromEntitlements(entitlementIds: string[] | null | undefined): string {
  if (!entitlementIds || !Array.isArray(entitlementIds) || entitlementIds.length === 0) {
    return 'free';
  }

  if (entitlementIds.includes('bizmanage_pro_plus')) return 'pro_plus';
  if (entitlementIds.includes('bizmanage_max')) return 'max';
  if (entitlementIds.includes('bizmanage_pro')) return 'pro';
  return 'free';
}

function getMaxBusinessesFromTier(tier: string): number | null {
  switch (tier) {
    case 'pro': return 1;
    case 'pro_plus': return 3;
    case 'max': return 999999;
    case 'free': return 1;
    default: return 1;
  }
}

function getTierLevel(tier: string): number {
  switch (tier) {
    case 'free': return 0;
    case 'pro': return 1;
    case 'pro_plus': return 2;
    case 'max': return 3;
    default: return 0;
  }
}

function isUpgrade(oldTier: string, newTier: string): boolean {
  return getTierLevel(newTier) > getTierLevel(oldTier);
}

function isDowngrade(oldTier: string, newTier: string): boolean {
  return getTierLevel(newTier) < getTierLevel(oldTier);
}

function getCancelReasonMessage(reason: string): string {
  switch (reason) {
    case 'UNSUBSCRIBE':
      return 'You cancelled your subscription. You will retain access until the expiration date.';
    case 'BILLING_ERROR':
      return 'There was a problem with your payment method. Please update it to continue your subscription.';
    case 'DEVELOPER_INITIATED':
      return 'Your subscription was cancelled by an administrator.';
    case 'PRICE_INCREASE':
      return 'Your subscription was cancelled due to a price increase.';
    case 'CUSTOMER_SUPPORT':
      return 'Your subscription was refunded by customer support.';
    default:
      return 'Your subscription was cancelled.';
  }
}

// Shared handler for subscription activation (INITIAL_PURCHASE, RENEWAL, UNCANCELLATION)
async function handleSubscriptionActivation(
  supabase: any,
  event: RevenueCatEvent['event'],
  eventId: string,
  tier: string,
  maxBusinesses: number | null,
  productId: string | null
) {
  const userId = event.app_user_id;
  log(eventId, 'INFO', `Activating subscription for user`, { userId, tier, maxBusinesses });

  const { data: businessCountData } = await supabase
    .rpc('get_user_owned_business_count', { p_user_id: userId });

  const businessCount = businessCountData || 0;
  log(eventId, 'INFO', `User owns ${businessCount} businesses, tier allows ${maxBusinesses}`);

  const expirationDate = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const now = new Date().toISOString();

  // Update subscription record
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      subscription_status: 'active',
      subscription_product_id: productId,
      subscription_expiration_date: expirationDate,
      platform: event.store === 'APP_STORE' ? 'ios' : 'android',
      tier: tier,
      max_owned_businesses: maxBusinesses,
      revenuecat_app_user_id: event.original_app_user_id,
      will_renew: true,
      is_trial_conversion: event.is_trial_conversion || false,
      is_family_share: event.is_family_share || false,
      in_grace_period: false,
      grace_period_ends_at: null,
      cancel_reason: null,
      cancel_reason_at: null,
      updated_by: 'webhook',
      last_webhook_update: now,
      updated_at: now,
    }, {
      onConflict: 'user_id',
    });

  if (subscriptionError) {
    log(eventId, 'ERROR', 'Failed to update subscription', { error: subscriptionError });
    throw subscriptionError;
  }

  log(eventId, 'SUCCESS', 'Subscription record updated');

  // Handle business activation
  if (businessCount <= maxBusinesses!) {
    log(eventId, 'INFO', 'Activating all businesses');

    const { error: activateError } = await supabase.rpc('activate_all_businesses_and_populate_selection', {
      p_user_id: userId
    });

    if (activateError) {
      log(eventId, 'ERROR', 'Failed to activate businesses', { error: activateError });
    } else {
      log(eventId, 'SUCCESS', 'All businesses activated');
    }
  } else {
    log(eventId, 'WARN', 'Business count exceeds tier limit - user must select businesses');
  }
}

// Shared handler for tier changes
async function handleTierChange(
  supabase: any,
  event: RevenueCatEvent['event'],
  eventId: string,
  previousTier: string,
  newTier: string,
  maxBusinesses: number | null,
  productId: string | null
) {
  const userId = event.app_user_id;
  log(eventId, 'INFO', `Tier change: ${previousTier} -> ${newTier}`);

  const { data: businessCountData } = await supabase
    .rpc('get_user_owned_business_count', { p_user_id: userId });

  const businessCount = businessCountData || 0;
  const expirationDate = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const now = new Date().toISOString();

  // Update subscription
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      subscription_status: 'active',
      subscription_product_id: productId,
      subscription_expiration_date: expirationDate,
      platform: event.store === 'APP_STORE' ? 'ios' : 'android',
      tier: newTier,
      max_owned_businesses: maxBusinesses,
      previous_tier: previousTier,
      revenuecat_app_user_id: event.original_app_user_id,
      will_renew: true,
      is_trial_conversion: event.is_trial_conversion || false,
      is_family_share: event.is_family_share || false,
      updated_by: 'webhook',
      last_webhook_update: now,
      updated_at: now,
    }, {
      onConflict: 'user_id',
    });

  if (subscriptionError) {
    log(eventId, 'ERROR', 'Failed to update subscription', { error: subscriptionError });
    throw subscriptionError;
  }

  // Handle upgrade
  if (isUpgrade(previousTier, newTier)) {
    log(eventId, 'INFO', `UPGRADE detected`);

    if (businessCount <= maxBusinesses!) {
      const { error: activateError } = await supabase.rpc('activate_all_businesses_and_populate_selection', {
        p_user_id: userId
      });

      if (activateError) {
        log(eventId, 'ERROR', 'Failed to activate businesses', { error: activateError });
      } else {
        log(eventId, 'SUCCESS', 'All businesses activated after upgrade');
      }
    } else {
      log(eventId, 'WARN', 'Business count exceeds new tier limit');
    }
  }
  // Handle downgrade
  else if (isDowngrade(previousTier, newTier)) {
    log(eventId, 'INFO', `DOWNGRADE detected`);

    if (businessCount > maxBusinesses!) {
      const { error: readOnlyError } = await supabase.rpc('set_read_only_businesses', {
        p_user_id: userId,
        p_max_active_businesses: maxBusinesses
      });

      if (readOnlyError) {
        log(eventId, 'ERROR', 'Failed to set read-only businesses', { error: readOnlyError });
      } else {
        log(eventId, 'SUCCESS', 'Set businesses to read-only');
      }

      // Send notification
      await supabase.from('notifications').insert({
        user_id: userId,
        business_id: null,
        type: 'subscription_warning',
        title: 'Subscription Plan Changed',
        message: `You've changed to a plan that allows ${maxBusinesses} active business${maxBusinesses === 1 ? '' : 'es'}. Please select which business${maxBusinesses === 1 ? '' : 'es'} to keep active.`,
        read: false,
        created_at: new Date().toISOString(),
      });

      log(eventId, 'INFO', 'Downgrade notification sent');
    } else {
      // Business count is within new tier limit - activate all businesses
      log(eventId, 'INFO', 'Business count within downgrade tier limit, activating all businesses');

      const { error: activateError } = await supabase.rpc('activate_all_businesses_and_populate_selection', {
        p_user_id: userId
      });

      if (activateError) {
        log(eventId, 'ERROR', 'Failed to activate businesses', { error: activateError });
      } else {
        log(eventId, 'SUCCESS', 'All businesses activated after downgrade');
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  let eventId = 'unknown';

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: RevenueCatEvent = await req.json();
    const { event } = payload;

    eventId = event.id || 'no-id';
    const userId = event.app_user_id;

    log(eventId, 'INFO', '========== WEBHOOK EVENT RECEIVED ==========');
    log(eventId, 'INFO', `Event: ${event.type}`);
    log(eventId, 'INFO', `User: ${userId}`);
    log(eventId, 'INFO', `Store: ${event.store || 'N/A'}`);
    log(eventId, 'INFO', `Environment: ${event.environment || 'N/A'}`);

    // Check for idempotency - prevent duplicate processing
    const { data: alreadyProcessed } = await supabase
      .rpc('is_webhook_event_processed', { p_event_id: eventId });

    if (alreadyProcessed) {
      log(eventId, 'WARN', 'Event already processed (duplicate webhook) - skipping');
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine tier
    let validatedProductId = event.product_id || event.new_product_id;
    if (!validatedProductId && event.entitlement_ids && event.entitlement_ids.length > 0) {
      validatedProductId = event.entitlement_ids[0];
      log(eventId, 'INFO', `Derived product_id from entitlements: ${validatedProductId}`);
    }

    const productIdForTierDetection = event.type === 'PRODUCT_CHANGE' ? event.new_product_id : validatedProductId;
    const tierFromProductId = getTierFromProductId(productIdForTierDetection);
    const tierFromEntitlements = getTierFromEntitlements(event.entitlement_ids);
    const tier = tierFromProductId !== 'free' ? tierFromProductId : tierFromEntitlements;
    const maxBusinesses = getMaxBusinessesFromTier(tier);

    log(eventId, 'INFO', `Detected tier: ${tier} (max businesses: ${maxBusinesses})`);

    // Process event based on type
    switch (event.type) {
      case 'TEST': {
        log(eventId, 'INFO', 'TEST event received from dashboard');
        break;
      }

      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION': {
        await handleSubscriptionActivation(supabase, event, eventId, tier, maxBusinesses, validatedProductId);
        break;
      }

      case 'PRODUCT_CHANGE': {
        const { data: currentSubscription } = await supabase
          .from('user_subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .maybeSingle();

        const previousTier = currentSubscription?.tier || 'free';
        await handleTierChange(supabase, event, eventId, previousTier, tier, maxBusinesses, event.new_product_id);
        break;
      }

      case 'CANCELLATION': {
        log(eventId, 'INFO', `CANCELLATION - reason: ${event.cancel_reason || 'UNKNOWN'}`);

        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            will_renew: false,
            cancel_reason: event.cancel_reason || null,
            cancel_reason_at: now,
            subscription_expiration_date: expirationDate,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          log(eventId, 'ERROR', 'Failed to update subscription', { error: subscriptionError });
          throw subscriptionError;
        }

        // Send notification based on cancel reason
        const message = getCancelReasonMessage(event.cancel_reason || 'UNKNOWN');
        await supabase.from('notifications').insert({
          user_id: userId,
          business_id: null,
          type: event.cancel_reason === 'BILLING_ERROR' ? 'subscription_warning' : 'subscription_info',
          title: event.cancel_reason === 'CUSTOMER_SUPPORT' ? 'Subscription Refunded' : 'Subscription Cancelled',
          message: message,
          read: false,
          created_at: now,
        });

        log(eventId, 'SUCCESS', 'Subscription marked for cancellation - benefits remain until expiration');
        break;
      }

      case 'EXPIRATION': {
        log(eventId, 'INFO', `EXPIRATION - reason: ${event.expiration_reason || 'UNKNOWN'}`);

        const { data: currentSubscription } = await supabase
          .from('user_subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .maybeSingle();

        const previousTier = currentSubscription?.tier || 'free';
        const now = new Date().toISOString();

        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_status: 'expired',
            subscription_product_id: null,
            tier: 'free',
            max_owned_businesses: 1,
            previous_tier: previousTier,
            expiration_reason: event.expiration_reason || null,
            expiration_reason_at: now,
            will_renew: false,
            in_grace_period: false,
            grace_period_ends_at: null,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          log(eventId, 'ERROR', 'Failed to update subscription', { error: subscriptionError });
          throw subscriptionError;
        }

        // Set ALL businesses to read-only when subscription expires
        // No business selection needed - trigger will handle this automatically
        log(eventId, 'INFO', 'Setting all businesses to read-only due to expiration');

        const { error: readOnlyError } = await supabase.rpc('set_all_businesses_read_only_on_expiration', {
          p_user_id: userId
        });

        if (readOnlyError) {
          log(eventId, 'ERROR', 'Failed to set businesses to read-only', { error: readOnlyError });
        } else {
          log(eventId, 'SUCCESS', 'All businesses set to read-only');
        }

        // Send notification
        await supabase.from('notifications').insert({
          user_id: userId,
          business_id: null,
          type: 'subscription_warning',
          title: 'Subscription Expired',
          message: 'Your subscription has ended. All your businesses are now in read-only mode. Upgrade to continue creating sales.',
          read: false,
          created_at: now,
        });

        log(eventId, 'SUCCESS', 'Subscription expired and all businesses set to read-only');
        break;
      }

      case 'BILLING_ISSUE': {
        log(eventId, 'INFO', 'BILLING_ISSUE detected');

        const gracePeriodEnd = event.grace_period_expiration_at_ms
          ? new Date(event.grace_period_expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            in_grace_period: gracePeriodEnd ? true : false,
            grace_period_ends_at: gracePeriodEnd,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          log(eventId, 'ERROR', 'Failed to update grace period', { error: subscriptionError });
        }

        const message = gracePeriodEnd
          ? `There was a problem with your subscription payment. Your access will continue until ${new Date(gracePeriodEnd).toLocaleDateString()}. Please update your payment method.`
          : 'There was a problem with your subscription payment. Please update your payment method.';

        await supabase.from('notifications').insert({
          user_id: userId,
          business_id: null,
          type: 'subscription_warning',
          title: 'Payment Failed',
          message: message,
          read: false,
          created_at: now,
        });

        log(eventId, 'SUCCESS', 'Billing issue notification sent');
        break;
      }

      case 'NON_RENEWING_PURCHASE': {
        log(eventId, 'INFO', 'NON_RENEWING_PURCHASE - one-time purchase without auto-renewal');
        // Typically for consumables or one-time products
        // Handle similarly to INITIAL_PURCHASE but without renewal expectations
        await handleSubscriptionActivation(supabase, event, eventId, tier, maxBusinesses, validatedProductId);
        break;
      }

      case 'SUBSCRIPTION_PAUSED': {
        log(eventId, 'INFO', 'SUBSCRIPTION_PAUSED (Android) - subscription will pause at end of period');
        log(eventId, 'INFO', `Will auto-resume at: ${event.auto_resume_at_ms ? new Date(event.auto_resume_at_ms).toISOString() : 'N/A'}`);

        // Note: Do NOT revoke access yet - wait for EXPIRATION event
        const now = new Date().toISOString();
        await supabase
          .from('user_subscriptions')
          .update({
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        await supabase.from('notifications').insert({
          user_id: userId,
          business_id: null,
          type: 'subscription_info',
          title: 'Subscription Paused',
          message: 'Your subscription will be paused at the end of the current period. You will retain access until then.',
          read: false,
          created_at: now,
        });

        log(eventId, 'INFO', 'Subscription pause notification sent - access remains active');
        break;
      }

      case 'TRANSFER': {
        log(eventId, 'INFO', 'TRANSFER - subscription transfer between users');
        log(eventId, 'INFO', `From: ${event.transferred_from?.join(', ')}`);
        log(eventId, 'INFO', `To: ${event.transferred_to?.join(', ')}`);

        // The webhook is sent for the destination user (transferred_to)
        // The subscription should now belong to this user
        await handleSubscriptionActivation(supabase, event, eventId, tier, maxBusinesses, validatedProductId);
        log(eventId, 'SUCCESS', 'Transfer processed - subscription moved to new user');
        break;
      }

      case 'SUBSCRIPTION_EXTENDED': {
        log(eventId, 'INFO', 'SUBSCRIPTION_EXTENDED - expiration date extended by developer/store');

        const newExpirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        const now = new Date().toISOString();
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_expiration_date: newExpirationDate,
            updated_by: 'webhook',
            last_webhook_update: now,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (subscriptionError) {
          log(eventId, 'ERROR', 'Failed to update expiration date', { error: subscriptionError });
        }

        log(eventId, 'SUCCESS', `Subscription extended to ${newExpirationDate}`);
        break;
      }

      case 'TEMPORARY_ENTITLEMENT_GRANT': {
        log(eventId, 'WARN', 'TEMPORARY_ENTITLEMENT_GRANT - temporary access during store outage');
        log(eventId, 'INFO', 'Limited event data available - store validation pending');

        // Grant temporary access - full event will come later as INITIAL_PURCHASE or EXPIRATION
        const tempExpirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

        log(eventId, 'INFO', `Temporary access until: ${tempExpirationDate}`);
        break;
      }

      case 'REFUND_REVERSED': {
        log(eventId, 'INFO', 'REFUND_REVERSED (iOS) - refund was reversed, restoring subscription');

        // Treat like a reactivation
        await handleSubscriptionActivation(supabase, event, eventId, tier, maxBusinesses, validatedProductId);

        await supabase.from('notifications').insert({
          user_id: userId,
          business_id: null,
          type: 'subscription_info',
          title: 'Subscription Restored',
          message: 'Your subscription has been restored after a refund reversal.',
          read: false,
          created_at: new Date().toISOString(),
        });

        log(eventId, 'SUCCESS', 'Refund reversed - subscription restored');
        break;
      }

      case 'SUBSCRIBER_ALIAS': {
        log(eventId, 'INFO', 'SUBSCRIBER_ALIAS - user ID was aliased/merged');
        log(eventId, 'INFO', `Original: ${event.original_app_user_id}, Alias: ${event.app_user_id}`);
        // No action needed - RevenueCat handles user ID merging internally
        break;
      }

      case 'INVOICE_ISSUANCE': {
        log(eventId, 'INFO', 'INVOICE_ISSUANCE (Web Billing) - new invoice issued');
        // For web billing, invoice created but not yet paid
        // Wait for INITIAL_PURCHASE or RENEWAL when payment completes
        break;
      }

      case 'VIRTUAL_CURRENCY_TRANSACTION': {
        log(eventId, 'INFO', 'VIRTUAL_CURRENCY_TRANSACTION - not applicable to this app');
        // This app doesn't use virtual currency, so we can safely ignore
        break;
      }

      case 'EXPERIMENT_ENROLLMENT': {
        log(eventId, 'INFO', 'EXPERIMENT_ENROLLMENT - user enrolled in A/B test');
        // Log for analytics purposes, no subscription changes needed
        break;
      }

      default:
        log(eventId, 'WARN', `Unhandled event type: ${event.type}`);
        log(eventId, 'INFO', 'Event payload', event);

        // Log to errors table for investigation
        await supabase.rpc('log_webhook_error', {
          p_event_id: eventId,
          p_event_type: event.type,
          p_app_user_id: userId,
          p_error_type: 'UNHANDLED_EVENT_TYPE',
          p_error_message: `Received unhandled event type: ${event.type}`,
          p_event_payload: event,
          p_severity: 'low'
        });
    }

    // Mark event as processed
    const processingDuration = Date.now() - startTime;
    await supabase.rpc('mark_webhook_event_processed', {
      p_event_id: eventId,
      p_event_type: event.type,
      p_app_user_id: userId,
      p_event_timestamp_ms: event.event_timestamp_ms,
      p_processing_duration_ms: processingDuration,
      p_metadata: {
        store: event.store,
        environment: event.environment,
        product_id: validatedProductId,
      }
    });

    log(eventId, 'SUCCESS', `Event processed in ${processingDuration}ms`);
    log(eventId, 'INFO', '============================================');

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const processingDuration = Date.now() - startTime;
    log(eventId, 'ERROR', `Fatal error after ${processingDuration}ms: ${error.message}`);
    console.error('[RevenueCat] Stack trace:', error.stack);

    // Try to log error to database
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.rpc('log_webhook_error', {
        p_event_id: eventId,
        p_event_type: 'UNKNOWN',
        p_app_user_id: null,
        p_error_type: 'PROCESSING_ERROR',
        p_error_message: error.message,
        p_error_details: { stack: error.stack },
        p_event_payload: null,
        p_severity: 'high'
      });
    } catch (logError) {
      console.error('[RevenueCat] Failed to log error to database:', logError);
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
