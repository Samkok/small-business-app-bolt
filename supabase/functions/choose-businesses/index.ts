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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT authentication
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

    const userId = user.id;
    const { selectedBusinessIds, selectOldest } = await req.json();

    // Compute tierLimit server-side from the user's actual subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('max_owned_businesses, tier')
      .eq('user_id', userId)
      .maybeSingle();

    const tierLimit = subscription?.max_owned_businesses || 1;

    let businessIdsToActivate: string[] = [];

    if (selectOldest) {
      console.log('[ChooseBusinesses] Auto-selecting oldest eligible businesses:', { userId, tierLimit });

      const limit = tierLimit || 1;

      const { data: allBusinesses, error: fetchError } = await supabase
        .from('businesses')
        .select('id, created_at')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('[ChooseBusinesses] Error fetching businesses:', fetchError);
        throw fetchError;
      }

      if (!allBusinesses || allBusinesses.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No businesses found for user' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // For free tier, filter out businesses that already exceeded the sales threshold
      const FREE_TIER_LIMIT = 50;
      let eligibleBusinesses = allBusinesses;

      if (subscription?.tier === 'free' || !subscription) {
        const { data: salesCounts } = await supabase
          .from('user_sales_counts')
          .select('business_id, sales_count')
          .eq('user_id', userId);

        const salesMap: Record<string, number> = {};
        (salesCounts || []).forEach((row: any) => { salesMap[row.business_id] = row.sales_count || 0; });

        eligibleBusinesses = allBusinesses.filter(b => (salesMap[b.id] || 0) < FREE_TIER_LIMIT);
        console.log('[ChooseBusinesses] Filtered eligible businesses (below sales threshold):', eligibleBusinesses.length);

        if (eligibleBusinesses.length === 0) {
          eligibleBusinesses = allBusinesses.slice(0, 1);
          console.log('[ChooseBusinesses] No eligible businesses below threshold, falling back to oldest');
        }
      }

      businessIdsToActivate = eligibleBusinesses.slice(0, limit).map(b => b.id);
      console.log('[ChooseBusinesses] Selected businesses:', businessIdsToActivate);
    } else {
      if (!selectedBusinessIds || !Array.isArray(selectedBusinessIds)) {
        return new Response(
          JSON.stringify({
            error: 'Missing or invalid required fields: selectedBusinessIds (must be array)'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Validate at least 1 selected
      if (selectedBusinessIds.length < 1) {
        return new Response(
          JSON.stringify({ error: 'You must keep at least one business active.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      businessIdsToActivate = selectedBusinessIds;
    }

    console.log('[ChooseBusinesses] Processing selection:', {
      userId,
      selectedCount: businessIdsToActivate.length,
      selectedIds: businessIdsToActivate,
      selectOldest: !!selectOldest
    });

    if (!selectOldest) {
      const { data: verifyBusinesses, error: verifyError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_user_id', userId)
        .in('id', businessIdsToActivate);

      if (verifyError) {
        console.error('[ChooseBusinesses] Error verifying businesses:', verifyError);
        throw verifyError;
      }

      if (!verifyBusinesses || verifyBusinesses.length !== businessIdsToActivate.length) {
        return new Response(
          JSON.stringify({
            error: 'Invalid business selection: some businesses are not owned by user'
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Validate against tier limit (cannot activate more than allowed)
    if (tierLimit !== null && businessIdsToActivate.length > tierLimit) {
      return new Response(
        JSON.stringify({
          error: `Too many businesses selected. Your tier allows ${tierLimit} active business(es).`,
          maxAllowed: tierLimit,
          selectedCount: businessIdsToActivate.length
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[ChooseBusinesses] Activating selected businesses');
    const { error: activateError } = await supabase.rpc('activate_selected_businesses', {
      p_user_id: userId,
      p_selected_business_ids: businessIdsToActivate
    });

    if (activateError) {
      console.error('[ChooseBusinesses] Error activating businesses:', activateError);
      const msg = activateError.message || '';
      if (msg.includes('INVALID_SELECTION')) {
        const userMsg = msg.replace(/^.*INVALID_SELECTION:\s*/, '');
        return new Response(
          JSON.stringify({ error: userMsg }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw activateError;
    }

    console.log('[ChooseBusinesses] Clearing must_choose_businesses flag');
    const { error: clearFlagError } = await supabase
      .from('user_profiles')
      .update({ must_choose_businesses: false })
      .eq('user_id', userId);

    if (clearFlagError) {
      console.error('[ChooseBusinesses] Error clearing must_choose_businesses flag:', clearFlagError);
    }

    console.log('[ChooseBusinesses] Running consistency safeguard to verify data integrity');
    const { error: safeguardError } = await supabase.rpc('ensure_selected_business_ids_consistency', {
      p_user_id: userId
    });

    if (safeguardError) {
      console.error('[ChooseBusinesses] Error running consistency safeguard:', safeguardError);
    } else {
      console.log('[ChooseBusinesses] Consistency safeguard completed successfully');
    }

    const { data: updatedBusinesses } = await supabase
      .from('businesses')
      .select('id, business_name, access_state')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true });

    console.log('[ChooseBusinesses] Selection saved successfully', { selectOldest: !!selectOldest });

    return new Response(
      JSON.stringify({
        success: true,
        activeBusinesses: businessIdsToActivate,
        autoSelected: !!selectOldest,
        businesses: (updatedBusinesses || []).map(b => ({
          id: b.id,
          name: b.business_name,
          accessState: b.access_state
        }))
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ChooseBusinesses] Error:', error);
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
