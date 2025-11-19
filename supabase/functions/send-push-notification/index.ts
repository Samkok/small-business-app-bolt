import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

interface PushNotificationRequest {
  expoPushToken: string;
  title: string;
  body: string;
  data?: any;
  sound?: string;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { expoPushToken, title, body, data, sound = 'default', badge, priority = 'high' } = await req.json();

    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken[')) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing expoPushToken' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message: any = {
      to: expoPushToken,
      sound,
      title,
      body,
      data: data || {},
      priority,
    };

    if (badge !== undefined) message.badge = badge;
    if (priority === 'high') message.channelId = 'high';

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to send push notification', details: result }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});