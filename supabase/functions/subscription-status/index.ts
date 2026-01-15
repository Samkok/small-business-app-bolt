import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const checkBusinessSelection = url.searchParams.get('checkBusinessSelection') === 'true';

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[SubscriptionStatus] Fetching status for user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optionally check business selection requirement
    if (checkBusinessSelection) {
      console.log('[SubscriptionStatus] Checking business selection requirement');
      const { data: selectionResult, error: selectionError } = await supabase
        .rpc('check_business_selection_requirement', { p_user_id: userId });

      if (selectionError) {
        console.error('[SubscriptionStatus] Error checking business selection:', selectionError);
      } else {
        console.log('[SubscriptionStatus] Business selection check result:', selectionResult);
      }
    }

    // Get subscription info
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('[SubscriptionStatus] Error fetching subscription:', subError);
      throw subError;
    }

    // Get tier info
    const { data: tierData } = await supabase
      .rpc('get_user_subscription_tier', { p_user_id: userId });

    const tierInfo = tierData && tierData.length > 0 ? tierData[0] : {
      tier: 'free',
      max_owned_businesses: null,
      subscription_status: 'trial',
      expiration_date: null
    };

    // Get owned businesses
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('id, business_name, access_state, created_at')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true });

    if (bizError) {
      console.error('[SubscriptionStatus] Error fetching businesses:', bizError);
      throw bizError;
    }

    // Get must_choose_businesses flag
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('must_choose_businesses')
      .eq('user_id', userId)
      .maybeSingle();

    // Get sales count
    const { data: salesCountData } = await supabase
      .from('user_sales_counts')
      .select('sales_count')
      .eq('user_id', userId);

    const totalSalesCount = salesCountData?.reduce((sum, item) => sum + (item.sales_count || 0), 0) || 0;

    // Get purchase history
    const { data: purchaseHistory } = await supabase
      .from('user_subscriptions')
      .select('subscription_product_id, subscription_start_date, subscription_expiration_date, platform, tier')
      .eq('user_id', userId)
      .order('subscription_start_date', { ascending: false })
      .limit(10);

    const isSubscribed = subscription?.subscription_status === 'active' &&
      (subscription?.subscription_expiration_date === null ||
        new Date(subscription.subscription_expiration_date) > new Date());

    const response = {
      isSubscribed,
      tier: tierInfo.tier,
      maxOwnedBusinesses: tierInfo.max_owned_businesses,
      subscriptionStatus: tierInfo.subscription_status,
      expirationDate: tierInfo.expiration_date,
      productId: subscription?.subscription_product_id || null,
      platform: subscription?.platform || null,
      ownedBusinesses: (businesses || []).map(b => ({
        id: b.id,
        name: b.business_name,
        accessState: b.access_state,
        createdAt: b.created_at
      })),
      businessCount: businesses?.length || 0,
      mustChooseBusinesses: profile?.must_choose_businesses || false,
      totalSalesCount,
      purchaseHistory: (purchaseHistory || []).map(p => ({
        productId: p.subscription_product_id,
        startDate: p.subscription_start_date,
        expirationDate: p.subscription_expiration_date,
        platform: p.platform,
        tier: p.tier
      }))
    };

    console.log('[SubscriptionStatus] Returning status:', {
      userId,
      tier: response.tier,
      businessCount: response.businessCount,
      mustChooseBusinesses: response.mustChooseBusinesses
    });

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SubscriptionStatus] Error:', error);
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
