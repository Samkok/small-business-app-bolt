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

    // Get the authenticated user
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

    // Get or generate user's referral code
    const { data: codeResult } = await supabase.rpc("generate_referral_code", {
      p_user_id: user.id,
    });

    // Get referral code details
    const { data: referralCode } = await supabase
      .from("referral_codes")
      .select("id, code, total_clicks, total_signups, total_conversions, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    // Get credit balance
    const { data: balanceResult } = await supabase.rpc("get_user_credit_balance", {
      p_user_id: user.id,
    });

    // Get balance details
    const { data: balanceDetails } = await supabase
      .from("user_credit_balances")
      .select("total_earned, total_spent, total_expired, current_balance, lifetime_referrals")
      .eq("user_id", user.id)
      .maybeSingle();

    // Get referral history (last 20 events)
    const { data: referralHistory } = await supabase
      .from("referral_events")
      .select("id, status, clicked_at, signed_up_at, subscribed_at, rewarded_at, subscription_tier, referee_user_id")
      .eq("referrer_user_id", user.id)
      .order("clicked_at", { ascending: false })
      .limit(20);

    // Get referee names for history display
    const refereeIds = (referralHistory || [])
      .map((e: any) => e.referee_user_id)
      .filter(Boolean);

    let refereeNames: Record<string, string> = {};
    if (refereeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, full_name")
        .in("user_id", refereeIds);

      if (profiles) {
        refereeNames = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.user_id] = p.full_name;
          return acc;
        }, {});
      }
    }

    // Get recent credit transactions (last 10)
    const { data: creditHistory } = await supabase
      .from("credit_ledger")
      .select("id, amount, balance_after, transaction_type, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get active reward rules for display
    const { data: rewardRules } = await supabase
      .from("referral_reward_rules")
      .select("rule_name, referrer_credits, referee_credits, applies_to_tiers")
      .eq("is_active", true);

    // Build referral link
    const referralLink = referralCode
      ? `https://bizmanage.app/refer/${referralCode.code}`
      : null;

    // Enrich history with names
    const enrichedHistory = (referralHistory || []).map((event: any) => ({
      ...event,
      referee_name: event.referee_user_id ? refereeNames[event.referee_user_id] || "User" : null,
    }));

    return new Response(
      JSON.stringify({
        code: referralCode?.code || codeResult,
        link: referralLink,
        stats: {
          total_clicks: referralCode?.total_clicks || 0,
          total_signups: referralCode?.total_signups || 0,
          total_conversions: referralCode?.total_conversions || 0,
          credits_earned: balanceDetails?.total_earned || 0,
          lifetime_referrals: balanceDetails?.lifetime_referrals || 0,
        },
        balance: {
          current: balanceResult || 0,
          total_earned: balanceDetails?.total_earned || 0,
          total_spent: balanceDetails?.total_spent || 0,
          total_expired: balanceDetails?.total_expired || 0,
        },
        history: enrichedHistory,
        credit_history: creditHistory || [],
        reward_rules: rewardRules || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[referral-status] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
