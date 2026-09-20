import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Push-Secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Two kinds of caller:
    //  1. The database trigger on `notifications` (send_push_notification_on_insert). It has no
    //     user session, so it proves itself with X-Push-Secret, a value that only exists in the
    //     database vault and is checked there by verify_push_trigger_secret (service role only).
    //  2. A signed-in user (JWT), who may only notify people they share a business with.
    const pushSecret = req.headers.get("X-Push-Secret");
    let callerUserId: string | null = null;

    if (pushSecret) {
      const { data: secretOk, error: secretError } = await supabase.rpc(
        "verify_push_trigger_secret",
        { p_secret: pushSecret }
      );
      if (secretError || secretOk !== true) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
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
      callerUserId = user.id;
    }

    const { targetUserId, title, body, data, sound = "default", badge, priority = "default" } = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "targetUserId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization for user callers: must share at least one business with the target user.
    // The database trigger is already trusted and notifies whoever the notification row is for.
    if (callerUserId) {
      const { data: hasShared, error: sharedError } = await supabase.rpc(
        "check_shared_business_membership",
        { p_caller_id: callerUserId, p_target_id: targetUserId }
      );

      if (sharedError || !hasShared) {
        return new Response(
          JSON.stringify({ error: "Not authorized to notify this user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Resolve push token server-side from target user profile
    let expoPushToken: string | null = null;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("expo_push_token")
      .eq("user_id", targetUserId)
      .maybeSingle();

    expoPushToken = profile?.expo_push_token || null;

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
      // Android channels created by the app: 'default', 'high', 'low'
      channelId: priority === "high" ? "high" : "default",
    };
    if (badge !== undefined) message.badge = badge;

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([message]),
    });

    const result = await response.json();

    // Expo answers { data: [ticket] } for an array of messages
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (!response.ok || ticket?.status === "error") {
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
