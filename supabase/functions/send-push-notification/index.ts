import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const TOKEN_RE = /^(ExponentPushToken|ExpoPushToken|PushToken)\[[^\]]+\]$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Push-Secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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
        return json({ error: "Unauthorized" }, 401);
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return json({ error: "Missing authorization header" }, 401);
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return json({ error: "Unauthorized" }, 401);
      }
      callerUserId = user.id;
    }

    const { targetUserId, title, body, data, sound = "default", badge, priority = "default" } = await req.json();

    if (!targetUserId) {
      return json({ error: "targetUserId is required" }, 400);
    }

    // Authorization for user callers: must share at least one business with the target user.
    // The database trigger is already trusted and notifies whoever the notification row is for.
    if (callerUserId) {
      const { data: hasShared, error: sharedError } = await supabase.rpc(
        "check_shared_business_membership",
        { p_caller_id: callerUserId, p_target_id: targetUserId }
      );

      if (sharedError || !hasShared) {
        return json({ error: "Not authorized to notify this user" }, 403);
      }
    }

    // Every device the user is signed in on (user_push_tokens), plus the legacy single token on
    // the profile for accounts that have not opened a build that registers per device yet.
    const [{ data: deviceRows }, { data: profile }] = await Promise.all([
      supabase.from("user_push_tokens").select("token").eq("user_id", targetUserId),
      supabase.from("user_profiles").select("expo_push_token").eq("user_id", targetUserId).maybeSingle(),
    ]);

    const tokens = new Set<string>();
    for (const row of deviceRows ?? []) if (row?.token && TOKEN_RE.test(row.token)) tokens.add(row.token);
    if (profile?.expo_push_token && TOKEN_RE.test(profile.expo_push_token)) tokens.add(profile.expo_push_token);

    if (tokens.size === 0) {
      return json({ error: "Target user has no push token registered" }, 400);
    }

    const messages = [...tokens].map((to) => {
      const message: Record<string, unknown> = {
        to,
        sound,
        title,
        body,
        data: data || {},
        priority,
        // Android channels created by the app: 'default', 'high', 'low'
        channelId: priority === "high" ? "high" : "default",
      };
      if (badge !== undefined) message.badge = badge;
      return message;
    });

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    // Expo answers { data: [ticket, ...] } in the order the messages were sent
    const tickets: any[] = Array.isArray(result?.data) ? result.data : [result?.data].filter(Boolean);

    let delivered = 0;
    const dead: string[] = [];
    const failures: unknown[] = [];
    messages.forEach((m, i) => {
      const ticket = tickets[i];
      if (ticket?.status === "ok") {
        delivered += 1;
      } else {
        failures.push({ to: m.to, ticket });
        // The app was uninstalled or its token replaced: stop sending to this device
        if (ticket?.details?.error === "DeviceNotRegistered") dead.push(m.to as string);
      }
    });

    if (dead.length > 0) {
      await Promise.all([
        supabase.from("user_push_tokens").delete().in("token", dead),
        supabase.from("user_profiles").update({ expo_push_token: null }).eq("user_id", targetUserId).in("expo_push_token", dead),
      ]);
      console.log(`[send-push-notification] removed ${dead.length} unregistered device(s) for ${targetUserId}`);
    }

    if (!response.ok || delivered === 0) {
      return json({ error: "Failed to send push notification", details: result }, 400);
    }

    return json({ success: true, delivered, devices: tokens.size, failures, data: result });
  } catch (error) {
    return json({ error: "Internal server error", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
