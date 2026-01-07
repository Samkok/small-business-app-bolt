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
    const { userId, selectedBusinessIds, selectOldest, tierLimit } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let businessIdsToActivate: string[] = [];

    if (selectOldest) {
      console.log('[ChooseBusinesses] Auto-selecting oldest businesses:', { userId, tierLimit });

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

      businessIdsToActivate = allBusinesses.slice(0, limit).map(b => b.id);
      console.log('[ChooseBusinesses] Selected oldest businesses:', businessIdsToActivate);
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

    const { data: tierData } = await supabase
      .rpc('get_user_subscription_tier', { p_user_id: userId });

    const tierInfo = tierData && tierData.length > 0 ? tierData[0] : null;

    if (!tierInfo) {
      return new Response(
        JSON.stringify({ error: 'Could not fetch subscription tier' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const maxBusinesses = tierInfo.max_owned_businesses;
    if (maxBusinesses !== null && businessIdsToActivate.length > maxBusinesses) {
      return new Response(
        JSON.stringify({
          error: `Too many businesses selected. Your tier allows ${maxBusinesses} active business(es).`,
          maxAllowed: maxBusinesses,
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
      throw activateError;
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