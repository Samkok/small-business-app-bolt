import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
Deno.serve(async (req)=>{
  const origin = req.headers.get("origin") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Allow-Credentials": "true"
  };
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const { expoPushToken, title, body, data, sound = "default", badge, priority = "default" } = await req.json();
    // Accept all token formats
    const validToken = expoPushToken && /(ExponentPushToken\[|ExpoPushToken\[|PushToken\[)/.test(expoPushToken);
    if (!validToken) {
      return new Response(JSON.stringify({
        error: "Invalid or missing expoPushToken"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const message = {
      to: expoPushToken,
      sound,
      badge,
      title,
      body,
      data: data || {},
      priority,
      channelId: ""
    };
    if (badge !== undefined) message.badge = badge;
    if (priority === "high") message.channelId = "high";
    // Expo expects an array
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        message
      ]),
      referrer: "no-referrer"
    });
    const result = await response.json();
    // Expo may return 200 but still have an internal "error" status
    if (!response.ok || result[0]?.status === "error") {
      return new Response(JSON.stringify({
        error: "Failed to send push notification",
        details: result
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
