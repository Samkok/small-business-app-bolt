import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Public, read-only endpoint for the web menu site.
//   GET ?slug=<menu_slug>   -> { business, products }
//   GET ?order=<token>      -> order status for the customer's confirmation page
// Both go through SECURITY DEFINER functions that only return columns safe to show a stranger.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")?.trim().toLowerCase();
    const orderToken = url.searchParams.get("order")?.trim();

    if (orderToken) {
      if (!UUID_RE.test(orderToken)) {
        return json({ error: "order_not_found" }, 404);
      }
      const { data, error } = await supabase.rpc("get_web_order_status", { p_token: orderToken });
      if (error) throw error;
      if (!data) return json({ error: "order_not_found" }, 404);
      return json(data, 200, { "Cache-Control": "no-store" });
    }

    if (!slug || !SLUG_RE.test(slug)) {
      return json({ error: "menu_not_found" }, 404);
    }

    const { data, error } = await supabase.rpc("get_public_menu", { p_slug: slug });
    if (error) throw error;
    if (!data) return json({ error: "menu_not_found" }, 404);

    return json(data, 200, { "Cache-Control": "public, max-age=15, s-maxage=30" });
  } catch (error) {
    console.error("[menu-get] Error:", error);
    return json({ error: "internal_error" }, 500);
  }
});
