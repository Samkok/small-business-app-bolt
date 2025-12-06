import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AppleNotificationPayload {
  signedPayload: string;
}

interface DecodedPayload {
  notificationType: string;
  subtype?: string;
  data: {
    signedTransactionInfo?: string;
    environment?: string;
  };
}

interface TransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  expiresDate: number;
  purchaseDate: number;
  originalPurchaseDate: number;
  bundleId: string;
  environment: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: AppleNotificationPayload = await req.json();
    console.log('Received Apple webhook:', payload);

    const decodedPayload = decodeJWT(payload.signedPayload);
    console.log('Decoded notification type:', decodedPayload.notificationType);

    const transactionInfo = decodedPayload.data.signedTransactionInfo
      ? decodeJWT(decodedPayload.data.signedTransactionInfo)
      : null;

    if (!transactionInfo) {
      console.error('No transaction info in payload');
      return new Response(JSON.stringify({ error: 'No transaction info' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionId, originalTransactionId, productId, expiresDate } = transactionInfo;

    const { data: existingTransaction } = await supabase
      .from('processed_transactions')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingTransaction) {
      console.log('Transaction already processed:', transactionId);
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, subscription_tier, max_owned_businesses')
      .eq('subscription_product_id', originalTransactionId)
      .maybeSingle();

    if (!profile) {
      console.log('No user found for transaction:', originalTransactionId);
      return new Response(JSON.stringify({ status: 'user_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = profile.id;
    const tier = extractTierFromProductId(productId);
    const maxBusinesses = getMaxBusinessesForTier(tier);

    switch (decodedPayload.notificationType) {
      case 'INITIAL_BUY':
      case 'DID_RENEW':
        await handleSubscriptionActivated(
          supabase,
          userId,
          tier,
          maxBusinesses,
          new Date(expiresDate)
        );
        break;

      case 'DID_CHANGE_RENEWAL_STATUS':
        if (decodedPayload.subtype === 'AUTO_RENEW_DISABLED') {
          await handleSubscriptionCancelled(supabase, userId);
        }
        break;

      case 'EXPIRED':
        await handleSubscriptionExpired(supabase, userId);
        break;

      case 'REFUND':
        await handleRefund(supabase, userId);
        break;

      default:
        console.log('Unhandled notification type:', decodedPayload.notificationType);
    }

    await supabase.from('processed_transactions').insert({
      transaction_id: transactionId,
      user_id: userId,
      notification_type: decodedPayload.notificationType,
      processed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ status: 'processed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function decodeJWT(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}

function extractTierFromProductId(productId: string): string {
  if (productId.includes('pro_plus') || productId.includes('proplus')) {
    return 'pro_plus';
  } else if (productId.includes('max')) {
    return 'max';
  } else if (productId.includes('pro')) {
    return 'pro';
  }
  return 'free';
}

function getMaxBusinessesForTier(tier: string): number | null {
  switch (tier) {
    case 'pro':
      return 1;
    case 'pro_plus':
      return 3;
    case 'max':
      return null;
    default:
      return 1;
  }
}

async function handleSubscriptionActivated(
  supabase: any,
  userId: string,
  tier: string,
  maxBusinesses: number | null,
  expirationDate: Date
) {
  console.log(`Activating subscription for user ${userId}: ${tier}`);

  await supabase
    .from('user_profiles')
    .update({
      subscription_tier: tier,
      subscription_status: 'active',
      subscription_expiration_date: expirationDate.toISOString(),
      max_owned_businesses: maxBusinesses,
      must_choose_businesses: false,
    })
    .eq('id', userId);

  const { count: ownedCount } = await supabase
    .from('businesses')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId);

  if (maxBusinesses && ownedCount && ownedCount <= maxBusinesses) {
    await supabase.rpc('set_all_businesses_active', { p_user_id: userId });
  }

  console.log(`Subscription activated for user ${userId}`);
}

async function handleSubscriptionCancelled(supabase: any, userId: string) {
  console.log(`Subscription cancelled for user ${userId}`);

  await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'cancelled',
    })
    .eq('id', userId);

  console.log(`Subscription marked as cancelled for user ${userId}`);
}

async function handleSubscriptionExpired(supabase: any, userId: string) {
  console.log(`Subscription expired for user ${userId}`);

  await supabase
    .from('user_profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'expired',
      max_owned_businesses: 1,
    })
    .eq('id', userId);

  const { count: ownedCount } = await supabase
    .from('businesses')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId);

  if (ownedCount && ownedCount > 1) {
    await supabase.rpc('set_read_only_businesses', {
      p_user_id: userId,
      p_max_active_businesses: 1
    });

    await supabase
      .from('user_profiles')
      .update({
        must_choose_businesses: true,
      })
      .eq('id', userId);

    console.log(`User ${userId} has ${ownedCount} businesses, downgrade modal triggered`);
  }

  console.log(`Subscription expired for user ${userId}, downgraded to free tier`);
}

async function handleRefund(supabase: any, userId: string) {
  console.log(`Refund processed for user ${userId}`);

  await supabase
    .from('user_profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'expired',
      max_owned_businesses: 1,
    })
    .eq('id', userId);

  const { count: ownedCount } = await supabase
    .from('businesses')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId);

  if (ownedCount && ownedCount > 1) {
    await supabase.rpc('set_read_only_businesses', {
      p_user_id: userId,
      p_max_active_businesses: 1
    });

    await supabase
      .from('user_profiles')
      .update({
        must_choose_businesses: true,
      })
      .eq('id', userId);
  }

  console.log(`Refund processed for user ${userId}, immediate downgrade`);
}
