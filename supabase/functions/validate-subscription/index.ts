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

  const lowerProductId = productId.toLowerCase();
  const proPlusMatch = lowerProductId.match(/pro[_\s-]?plus/);
  const maxMatch = lowerProductId.match(/\bmax\b/);
  const proMatch = lowerProductId.match(/\bpro\b/);

  if (proPlusMatch) return 'pro_plus';
  if (maxMatch) return 'max';
  if (proMatch) return 'pro';
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
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT authentication (E4 fix)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Force userId to the authenticated user — ignore any body-supplied userId
    const userId = user.id;

    const { receipt, platform } = await req.json();

    if (!receipt || !platform) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: receipt or platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let isValid = false;
    let expiresDate: string | null = null;
    let productId: string | null = null;

    if (platform === 'ios') {
      const appleSharedSecret = Deno.env.get('APPLE_SHARED_SECRET');

      if (!appleSharedSecret) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error: Apple shared secret not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const appleResponse = await fetch(APPLE_VERIFY_RECEIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receipt,
          'password': appleSharedSecret,
        }),
      });

      const appleData = await appleResponse.json();

      if (appleData.status === 21007) {
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
        }
      } else if (appleData.status === 0 && appleData.latest_receipt_info) {
        const latestReceipt = appleData.latest_receipt_info[appleData.latest_receipt_info.length - 1];
        isValid = true;
        expiresDate = new Date(parseInt(latestReceipt.expires_date_ms)).toISOString();
        productId = latestReceipt.product_id;
      }
    } else if (platform === 'android') {
      // Android receipt validation requires Google Play Developer API
      const googleServiceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
      if (!googleServiceAccountKey) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error: Google service account not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For now, reject Android validation until Google Play API integration is complete.
      // The revenuecat-webhook handles Android subscription state via server notifications.
      return new Response(
        JSON.stringify({ error: 'Android validation is handled via RevenueCat webhooks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid platform. Must be ios or android.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isValid) {
      const newTier = getTierFromProductId(productId);
      const maxOwnedBusinesses = getMaxBusinessesFromTier(newTier);

      const { data: prevSubscription } = await supabase
        .from('user_subscriptions')
        .select('tier, max_owned_businesses')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousTier = prevSubscription?.tier || 'free';

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          subscription_status: 'active',
          subscription_product_id: productId,
          tier: newTier,
          max_owned_businesses: maxOwnedBusinesses,
          subscription_expiration_date: expiresDate,
          last_validated_at: new Date().toISOString(),
          platform: platform,
          previous_tier: previousTier,
          updated_at: new Date().toISOString(),
          updated_by: 'validate-subscription',
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

      const { error: selectionError } = await supabase
        .rpc('check_business_selection_requirement', { p_user_id: userId });

      if (selectionError) {
        console.error('[ValidateReceipt] Error checking business selection:', selectionError);
      }
    }

    return new Response(
      JSON.stringify({
        isValid,
        expiresDate,
        productId,
        tier: getTierFromProductId(productId),
        maxOwnedBusinesses: getMaxBusinessesFromTier(getTierFromProductId(productId))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ValidateReceipt] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
