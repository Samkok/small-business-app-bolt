import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const APPLE_VERIFY_RECEIPT_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function getTierFromProductId(productId: string | null): string {
  if (!productId) return 'free';
  if (productId.includes('pro_plus')) return 'pro_plus';
  if (productId.includes('max')) return 'max';
  if (productId.includes('pro')) return 'pro';
  return 'free';
}

function getMaxBusinessesFromTier(tier: string): number | null {
  switch (tier) {
    case 'pro': return 1;
    case 'pro_plus': return 3;
    case 'max': return 999999;
    default: return null;
  }
}

function isDowngrade(prevTier: string | null, newTier: string): boolean {
  const tierOrder = { 'free': 0, 'pro': 1, 'pro_plus': 2, 'max': 3 };
  const prevOrder = tierOrder[prevTier as keyof typeof tierOrder] || 0;
  const newOrder = tierOrder[newTier as keyof typeof tierOrder] || 0;
  return newOrder < prevOrder;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const { receipt, platform, userId } = await req.json();

    if (!receipt || !platform || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: receipt, platform, or userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[ValidateReceipt] Validating receipt:', { platform, userId, receiptLength: receipt.length });

    let isValid = false;
    let expiresDate: string | null = null;
    let productId: string | null = null;

    if (platform === 'ios') {
      const appleSharedSecret = Deno.env.get('APPLE_SHARED_SECRET');

      if (!appleSharedSecret) {
        console.warn('[ValidateReceipt] APPLE_SHARED_SECRET not configured, using test mode');
        isValid = true;
        productId = 'bizmanage.pro.month';
        expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        const appleResponse = await fetch(APPLE_VERIFY_RECEIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'receipt-data': receipt,
            'password': appleSharedSecret,
          }),
        });

        const appleData = await appleResponse.json();
        console.log('[ValidateReceipt] Apple verification response status:', appleData.status);

        if (appleData.status === 21007) {
          console.log('[ValidateReceipt] Sandbox receipt detected, verifying with sandbox');
          const sandboxResponse = await fetch(APPLE_SANDBOX_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'receipt-data': receipt,
              'password': appleSharedSecret,
            }),
          });
          const sandboxData = await sandboxResponse.json();

          if (sandboxData.status === 0 && sandboxData.latest_receipt_info) {
            const latestReceipt = sandboxData.latest_receipt_info[sandboxData.latest_receipt_info.length - 1];
            isValid = true;
            expiresDate = new Date(parseInt(latestReceipt.expires_date_ms)).toISOString();
            productId = latestReceipt.product_id;
            console.log('[ValidateReceipt] Sandbox receipt validated successfully');
          } else {
            console.error('[ValidateReceipt] Sandbox receipt validation failed:', sandboxData);
          }
        } else if (appleData.status === 0 && appleData.latest_receipt_info) {
          const latestReceipt = appleData.latest_receipt_info[appleData.latest_receipt_info.length - 1];
          isValid = true;
          expiresDate = new Date(parseInt(latestReceipt.expires_date_ms)).toISOString();
          productId = latestReceipt.product_id;
          console.log('[ValidateReceipt] Production receipt validated successfully');
        } else {
          console.error('[ValidateReceipt] Apple receipt validation failed:', appleData);
        }
      }
    } else if (platform === 'android') {
      console.log('[ValidateReceipt] Android receipt validation - using test mode');
      isValid = true;
      productId = 'bizmanage.pro.month';
      expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (isValid) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const newTier = getTierFromProductId(productId);
      const maxOwnedBusinesses = getMaxBusinessesFromTier(newTier);

      // Get previous subscription to detect downgrade
      const { data: prevSubscription } = await supabase
        .from('user_subscriptions')
        .select('tier, max_owned_businesses')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousTier = prevSubscription?.tier || 'free';
      const isDowngradeDetected = isDowngrade(previousTier, newTier);

      console.log('[ValidateReceipt] Tier change detected:', {
        previousTier,
        newTier,
        isDowngrade: isDowngradeDetected
      });

      // Update subscription in database
      console.log('[ValidateReceipt] Updating subscription in database:', {
        userId,
        status: 'active',
        productId,
        tier: newTier,
        maxOwnedBusinesses,
        expiresDate,
        previousTier
      });

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          subscription_status: 'active',
          subscription_product_id: productId,
          tier: newTier,
          max_owned_businesses: maxOwnedBusinesses,
          subscription_expiration_date: expiresDate,
          receipt_data: receipt,
          last_validated_at: new Date().toISOString(),
          platform: platform,
          previous_tier: previousTier,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[ValidateReceipt] Database update error:', error);
        throw error;
      }

      // Handle downgrade: check owned business count and set read-only if needed
      if (isDowngradeDetected && maxOwnedBusinesses !== null) {
        const { count } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', userId);

        console.log('[ValidateReceipt] User owns', count, 'businesses, tier allows', maxOwnedBusinesses);

        if (count && count > maxOwnedBusinesses) {
          console.log('[ValidateReceipt] Downgrade detected: setting read-only businesses');

          // Call set_read_only_businesses function
          const { error: funcError } = await supabase.rpc('set_read_only_businesses', {
            p_user_id: userId,
            p_max_active_businesses: maxOwnedBusinesses
          });

          if (funcError) {
            console.error('[ValidateReceipt] Error setting read-only businesses:', funcError);
          } else {
            console.log('[ValidateReceipt] Read-only businesses set successfully');
          }
        }
      }

      // If upgrading, activate all businesses
      if (!isDowngradeDetected && previousTier !== 'free') {
        console.log('[ValidateReceipt] Upgrade detected: activating all businesses');

        const { error: updateError } = await supabase
          .from('businesses')
          .update({ access_state: 'active' })
          .eq('owner_id', userId);

        if (updateError) {
          console.error('[ValidateReceipt] Error activating businesses:', updateError);
        }

        // Clear must_choose_businesses flag
        await supabase
          .from('user_profiles')
          .update({ must_choose_businesses: false })
          .eq('user_id', userId);
      }

      console.log('[ValidateReceipt] Subscription updated successfully');
    }

    return new Response(
      JSON.stringify({
        isValid,
        expiresDate,
        productId,
        tier: getTierFromProductId(productId),
        maxOwnedBusinesses: getMaxBusinessesFromTier(getTierFromProductId(productId))
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ValidateReceipt] Error validating subscription:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
