import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT authentication (D4 fix)
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

    const { targetUserId, title, body, data, sound = "default", badge, priority = "default" } = await req.json();

    // Resolve push token server-side from target user profile (don't accept raw tokens from body)
    let expoPushToken: string | null = null;

    if (targetUserId) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("expo_push_token")
        .eq("user_id", targetUserId)
        .maybeSingle();

      expoPushToken = profile?.expo_push_token || null;
    }

    if (!expoPushToken) {
      return new Response(
        JSON.stringify({ error: "Target user has no push token registered" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validToken = /(ExponentPushToken\[|ExpoPushToken\[|PushToken\[)/.test(expoPushToken);
    if (!validToken) {
      return new Response(
        JSON.stringify({ error: "Invalid push token format for target user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message: Record<string, unknown> = {
      to: expoPushToken,
      sound,
      title,
      body,
      data: data || {},
      priority,
      channelId: "",
    };
    if (badge !== undefined) message.badge = badge;
    if (priority === "high") message.channelId = "high";

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([message]),
    });

    const result = await response.json();

    if (!response.ok || result[0]?.status === "error") {
      return new Response(
        JSON.stringify({ error: "Failed to send push notification", details: result }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
