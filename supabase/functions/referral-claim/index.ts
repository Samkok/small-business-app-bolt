import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { device_fingerprint, referral_code } = await req.json();

    if (!device_fingerprint && !referral_code) {
      return new Response(
        JSON.stringify({ error: "Either device_fingerprint or referral_code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let eventId: string | null = null;

    // First try device fingerprint attribution
    if (device_fingerprint) {
      const { data: claimResult } = await supabase.rpc("claim_referral_attribution", {
        p_referee_user_id: user.id,
        p_device_fingerprint: device_fingerprint,
      });
      eventId = claimResult;
    }

    // If no device match, try manual code entry
    if (!eventId && referral_code) {
      const code = referral_code.toUpperCase().trim();

      // Look up the referral code
      const { data: referralCodeData } = await supabase
        .from("referral_codes")
        .select("id, user_id, is_active")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (referralCodeData) {
        // Self-referral check
        if (referralCodeData.user_id === user.id) {
          return new Response(
            JSON.stringify({ success: false, error: "Cannot use your own referral code" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if user already has an attributed referral
        const { data: existingReferral } = await supabase
          .from("referral_events")
          .select("id")
          .eq("referee_user_id", user.id)
          .in("status", ["signed_up", "subscribed", "rewarded"])
          .maybeSingle();

        if (existingReferral) {
          return new Response(
            JSON.stringify({ success: false, error: "Referral already claimed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create a new referral event directly in signed_up state
        const { data: newEvent, error: insertError } = await supabase
          .from("referral_events")
          .insert({
            referral_code_id: referralCodeData.id,
            referrer_user_id: referralCodeData.user_id,
            referee_user_id: user.id,
            referee_device_fingerprint: device_fingerprint || "manual_entry",
            status: "signed_up",
            signed_up_at: new Date().toISOString(),
            attribution_metadata: { source: "manual_code_entry", code },
          })
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        eventId = newEvent.id;

        // Update referral code stats
        await supabase
          .from("referral_codes")
          .update({
            total_signups: referralCodeData.user_id ? 1 : 0, // Will be incremented
            updated_at: new Date().toISOString(),
          })
          .eq("id", referralCodeData.id);

        // Increment signups properly
        await supabase.rpc("increment_referral_code_signups", {
          p_code_id: referralCodeData.id,
        }).catch(() => {
          // Non-critical - stats update
        });
      }
    }

    if (!eventId) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid referral found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get referrer name for display
    const { data: eventData } = await supabase
      .from("referral_events")
      .select("referrer_user_id")
      .eq("id", eventId)
      .single();

    let referrerName: string | null = null;
    if (eventData) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("user_id", eventData.referrer_user_id)
        .maybeSingle();
      referrerName = profile?.full_name || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        referral_event_id: eventId,
        referrer_name: referrerName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[referral-claim] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
