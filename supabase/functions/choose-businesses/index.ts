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
    const { userId, selectedBusinessIds } = await req.json();

    if (!userId || !selectedBusinessIds || !Array.isArray(selectedBusinessIds)) {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid required fields: userId, selectedBusinessIds (must be array)'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[ChooseBusinesses] Processing selection:', {
      userId,
      selectedCount: selectedBusinessIds.length,
      selectedIds: selectedBusinessIds
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify all selected businesses are owned by user
    const { data: verifyBusinesses, error: verifyError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .in('id', selectedBusinessIds);

    if (verifyError) {
      console.error('[ChooseBusinesses] Error verifying businesses:', verifyError);
      throw verifyError;
    }

    if (!verifyBusinesses || verifyBusinesses.length !== selectedBusinessIds.length) {
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

    // Get user's subscription tier to verify selection count
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

    // Verify selection count matches tier limit
    const maxBusinesses = tierInfo.max_owned_businesses;
    if (maxBusinesses !== null && selectedBusinessIds.length > maxBusinesses) {
      return new Response(
        JSON.stringify({
          error: `Too many businesses selected. Your tier allows ${maxBusinesses} active business(es).`,
          maxAllowed: maxBusinesses,
          selectedCount: selectedBusinessIds.length
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Call activate_selected_businesses function
    console.log('[ChooseBusinesses] Activating selected businesses');
    const { error: activateError } = await supabase.rpc('activate_selected_businesses', {
      p_user_id: userId,
      p_selected_business_ids: selectedBusinessIds
    });

    if (activateError) {
      console.error('[ChooseBusinesses] Error activating businesses:', activateError);
      throw activateError;
    }

    // Get updated business states
    const { data: updatedBusinesses } = await supabase
      .from('businesses')
      .select('id, business_name, access_state')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true });

    console.log('[ChooseBusinesses] Selection saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        activeBusinesses: selectedBusinessIds,
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
