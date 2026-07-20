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

    // Verify webhook shared secret (D5 fix)
    const webhookSecret = Deno.env.get('APPLE_WEBHOOK_SECRET');
    if (webhookSecret) {
      const authHeader = req.headers.get('Authorization') || '';
      const providedSecret = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

      if (!providedSecret || providedSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const expectedBundleId = Deno.env.get('APPLE_BUNDLE_ID');

    const payload: AppleNotificationPayload = await req.json();

    const decodedPayload = decodeJWT(payload.signedPayload);

    // Validate environment — reject sandbox in production
    const environment = decodedPayload.data?.environment;
    if (environment === 'Sandbox' && Deno.env.get('ENVIRONMENT') === 'production') {
      return new Response(JSON.stringify({ error: 'Sandbox events rejected in production' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transactionInfo = decodedPayload.data.signedTransactionInfo
      ? decodeJWT(decodedPayload.data.signedTransactionInfo)
      : null;

    if (!transactionInfo) {
      return new Response(JSON.stringify({ error: 'No transaction info' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate bundleId against expected value
    if (expectedBundleId && transactionInfo.bundleId !== expectedBundleId) {
      return new Response(JSON.stringify({ error: 'Bundle ID mismatch' }), {
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

    // Query user_subscriptions table (not user_profiles) to find the user
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('user_id, tier, max_owned_businesses')
      .eq('subscription_product_id', originalTransactionId)
      .maybeSingle();

    if (!subscription) {
      console.log('No user found for transaction:', originalTransactionId);
      return new Response(JSON.stringify({ status: 'user_not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = subscription.user_id;
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
  const lowerProductId = productId.toLowerCase();
  const proPlusMatch = lowerProductId.match(/pro[_\s-]?plus/);
  const maxMatch = lowerProductId.match(/\bmax\b/);
  const proMatch = lowerProductId.match(/\bpro\b/);

  if (proPlusMatch) return 'pro_plus';
  if (maxMatch) return 'max';
  if (proMatch) return 'pro';
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

  // Update user_subscriptions table with subscription fields
  await supabase
    .from('user_subscriptions')
    .update({
      tier: tier,
      subscription_status: 'active',
      subscription_expiration_date: expirationDate.toISOString(),
      max_owned_businesses: maxBusinesses,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // Use centralized business selection logic
  const { data: selectionResult, error: selectionError } = await supabase
    .rpc('check_business_selection_requirement', { p_user_id: userId });

  if (selectionError) {
    console.error(`Error checking business selection for user ${userId}:`, selectionError);
  } else {
    console.log(`Business selection check result for user ${userId}:`, selectionResult);
  }

  console.log(`Subscription activated for user ${userId}`);
}

async function handleSubscriptionCancelled(supabase: any, userId: string) {
  console.log(`Subscription cancelled for user ${userId}`);

  // Update user_subscriptions table with subscription status
  await supabase
    .from('user_subscriptions')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log(`Subscription marked as cancelled for user ${userId}`);
}

async function handleSubscriptionExpired(supabase: any, userId: string) {
  console.log(`Subscription expired for user ${userId}`);

  // Update user_subscriptions table with expired status and free tier
  await supabase
    .from('user_subscriptions')
    .update({
      tier: 'free',
      subscription_status: 'expired',
      max_owned_businesses: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // Use centralized business selection logic
  const { data: selectionResult, error: selectionError } = await supabase
    .rpc('check_business_selection_requirement', { p_user_id: userId });

  if (selectionError) {
    console.error(`Error checking business selection for user ${userId}:`, selectionError);
  } else {
    console.log(`Business selection check result for user ${userId}:`, selectionResult);
  }

  console.log(`Subscription expired for user ${userId}, downgraded to free tier`);
}

async function handleRefund(supabase: any, userId: string) {
  console.log(`Refund processed for user ${userId}`);

  // Update user_subscriptions table with expired status and free tier
  await supabase
    .from('user_subscriptions')
    .update({
      tier: 'free',
      subscription_status: 'expired',
      max_owned_businesses: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // Use centralized business selection logic
  const { data: selectionResult, error: selectionError } = await supabase
    .rpc('check_business_selection_requirement', { p_user_id: userId });

  if (selectionError) {
    console.error(`Error checking business selection for user ${userId}:`, selectionError);
  } else {
    console.log(`Business selection check result for user ${userId}:`, selectionResult);
  }

  console.log(`Refund processed for user ${userId}, immediate downgrade`);
}
