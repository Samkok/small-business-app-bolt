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

    const { code, device_fingerprint } = await req.json();

    if (!code || !device_fingerprint) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, device_fingerprint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract IP and user agent from request
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Validate referral code exists and is active
    const { data: referralCode, error: codeError } = await supabase
      .from("referral_codes")
      .select("id, user_id, is_active, max_uses, total_clicks, expires_at")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (codeError) {
      throw codeError;
    }

    if (!referralCode) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired referral code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if code has expired
    if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Referral code has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses
    if (referralCode.max_uses !== null && referralCode.total_clicks >= referralCode.max_uses) {
      return new Response(
        JSON.stringify({ error: "Referral code has reached maximum uses" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: max 50 clicks per day per code
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count: dailyClicks } = await supabase
      .from("referral_events")
      .select("id", { count: "exact", head: true })
      .eq("referral_code_id", referralCode.id)
      .gte("clicked_at", oneDayAgo);

    if ((dailyClicks || 0) >= 50) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this device already has an active click for this code (dedup)
    const { data: existingClick } = await supabase
      .from("referral_events")
      .select("id")
      .eq("referral_code_id", referralCode.id)
      .eq("referee_device_fingerprint", device_fingerprint)
      .eq("status", "clicked")
      .maybeSingle();

    if (existingClick) {
      return new Response(
        JSON.stringify({
          success: true,
          event_id: existingClick.id,
          deduplicated: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create referral event
    const { data: event, error: insertError } = await supabase
      .from("referral_events")
      .insert({
        referral_code_id: referralCode.id,
        referrer_user_id: referralCode.user_id,
        referee_device_fingerprint: device_fingerprint,
        status: "clicked",
        ip_address: ipAddress,
        user_agent: userAgent,
        attribution_metadata: { code, source: "deep_link" },
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    // Update click count on referral code
    await supabase
      .from("referral_codes")
      .update({
        total_clicks: referralCode.total_clicks + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", referralCode.id);

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[referral-click] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
