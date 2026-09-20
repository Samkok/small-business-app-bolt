import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Public endpoint: a customer submits an order from the web menu.
// The browser calls this directly (not through the site's server) so x-forwarded-for is the
// customer's IP, which the per-IP rate limit in create_web_order() depends on.
//
// Optional secrets:
//   TURNSTILE_SECRET_KEY  - when set, a valid Cloudflare Turnstile token is required.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 20_000;

// create_web_order() raises 'WEB_ORDER:<code>[:detail...]'
const ERROR_STATUS: Record<string, number> = {
  menu_not_found: 404,
  invalid_name: 400,
  invalid_phone: 400,
  text_too_long: 400,
  invalid_items: 400,
  invalid_quantity: 400,
  product_unavailable: 409,
  insufficient_stock: 409,
  blocked: 403,
  rate_limited: 429,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!res.ok) return false;
  const outcome = await res.json();
  return outcome.success === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    // Honeypot: a hidden field real customers never fill. Pretend it worked.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return json({ success: true, order_ref: "W-00000", token: crypto.randomUUID(), total: 0, item_count: 0 });
    }

    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name : "";
    const phone = typeof body.phone === "string" ? body.phone : "";
    const address = typeof body.address === "string" ? body.address : null;
    const note = typeof body.note === "string" ? body.note : null;

    if (!SLUG_RE.test(slug)) return json({ error: "menu_not_found" }, 404);

    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
      return json({ error: "invalid_items" }, 400);
    }
    const items: { product_id: string; quantity: number }[] = [];
    for (const item of body.items) {
      const productId = item?.product_id;
      const quantity = item?.quantity;
      if (typeof productId !== "string" || !UUID_RE.test(productId)) {
        return json({ error: "invalid_items" }, 400);
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
        return json({ error: "invalid_quantity" }, 400);
      }
      items.push({ product_id: productId, quantity });
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (turnstileSecret) {
      const token = typeof body.turnstile_token === "string" ? body.turnstile_token : "";
      if (!token || !(await verifyTurnstile(turnstileSecret, token, ipAddress))) {
        return json({ error: "captcha_failed" }, 403);
      }
    }

    // Only a keyed hash of the IP is stored, never the address itself.
    const ipHash = ipAddress ? await hmacHex(serviceKey, ipAddress) : null;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data, error } = await supabase.rpc("create_web_order", {
      p_slug: slug,
      p_customer_name: name,
      p_customer_phone: phone,
      p_items: items,
      p_address: address,
      p_note: note,
      p_ip_hash: ipHash,
    });

    if (error) {
      const match = /WEB_ORDER:([a-z_]+)(?::([^:]+):([^:\s]+))?/.exec(error.message || "");
      if (match) {
        const code = match[1];
        const payload: Record<string, unknown> = { error: code };
        if (code === "insufficient_stock") {
          payload.product_id = match[2];
          // Same cap as max_qty in get_public_menu(): never reveal the real stock level.
          payload.available = Math.min(Number(match[3]), 99);
        }
        return json(payload, ERROR_STATUS[code] ?? 400);
      }
      throw error;
    }

    return json({ success: true, ...data });
  } catch (error) {
    console.error("[menu-order] Error:", error);
    return json({ error: "internal_error" }, 500);
  }
});
