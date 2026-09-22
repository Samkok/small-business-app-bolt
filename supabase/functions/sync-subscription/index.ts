import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deriveMirror, mirrorNeedsUpdate, type MirrorRow, type RcSubscriber } from "./derive.ts";

/**
 * Re-verifies the caller's subscription with RevenueCat's server API and corrects the
 * user_subscriptions mirror row. The app calls this only when the plan it reads from the
 * RevenueCat SDK disagrees with what the database mirror says, so it is off the normal
 * path. The row is written with updated_by = 'rc_sync'; the RevenueCat webhook keeps
 * writing its own events as before.
 *
 * Needs the REVENUECAT_SECRET_API_KEY secret (a v1 secret key, sk_...). Without it the
 * function answers 503 and the app simply keeps trusting the SDK.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RC_SUBSCRIBERS = "https://api.revenuecat.com/v1/subscribers/";
const RC_TIMEOUT_MS = 8000;
const MIN_INTERVAL_MS = 10_000;

// One RevenueCat call per user per window, per function instance
const lastCallByUser = new Map<string, number>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchSubscriber(appUserId: string, secretKey: string): Promise<{ subscriber: RcSubscriber } | { error: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RC_TIMEOUT_MS);
  try {
    const res = await fetch(RC_SUBSCRIBERS + encodeURIComponent(appUserId), {
      headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) return { error: "revenuecat_key_rejected", status: 503 };
    if (res.status === 429) return { error: "revenuecat_rate_limited", status: 429 };
    if (!res.ok) return { error: `revenuecat_http_${res.status}`, status: 502 };
    const data = await res.json();
    return { subscriber: (data?.subscriber ?? {}) as RcSubscriber };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { error: aborted ? "revenuecat_timeout" : "revenuecat_unreachable", status: 504 };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secretKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  if (!secretKey) return json({ error: "not_configured" }, 503);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // The caller can only sync their own row: the user id comes from the verified token
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "unauthorized" }, 401);
  const userId = user.id;

  const { data: current, error: readError } = await supabase
    .from("user_subscriptions")
    .select("subscription_status, tier, subscription_product_id, subscription_expiration_date, will_renew, in_grace_period, last_validated_at, revenuecat_app_user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) {
    console.error("[sync-subscription] read failed", readError);
    return json({ error: "read_failed" }, 500);
  }

  const now = Date.now();
  const last = lastCallByUser.get(userId) ?? 0;
  if (now - last < MIN_INTERVAL_MS) {
    return json({ changed: false, throttled: true, mirror: current ?? null });
  }
  lastCallByUser.set(userId, now);

  // The app configures the SDK with the Supabase user id as the RevenueCat app user id.
  // RevenueCat resolves aliases itself, so the stored original id is only a fallback.
  const rc = await fetchSubscriber(userId, secretKey);
  if ("error" in rc) {
    console.error("[sync-subscription] RevenueCat lookup failed:", rc.error);
    return json({ error: rc.error }, rc.status);
  }

  const next = deriveMirror(rc.subscriber, now);
  const nowIso = new Date(now).toISOString();
  const needsUpdate = mirrorNeedsUpdate((current as MirrorRow | null) ?? null, next);

  if (!needsUpdate) {
    // The mirror already agrees; record the verification time only when a row exists
    if (current) {
      await supabase.from("user_subscriptions").update({ last_validated_at: nowIso }).eq("user_id", userId);
    }
    return json({ changed: false, status: next.status, tier: next.tier, expirationDate: next.expirationDate, productId: next.productId, validatedAt: nowIso });
  }

  const previousTier = current?.tier && current.tier !== "free" && current.tier !== next.tier ? current.tier : undefined;

  if (next.status === "active") {
    const row: Record<string, unknown> = {
      user_id: userId,
      subscription_status: "active",
      subscription_product_id: next.productId,
      subscription_expiration_date: next.expirationDate,
      tier: next.tier,
      max_owned_businesses: next.maxOwnedBusinesses,
      will_renew: next.willRenew,
      in_grace_period: next.inGracePeriod,
      grace_period_ends_at: next.gracePeriodEndsAt,
      revenuecat_app_user_id: rc.subscriber.original_app_user_id ?? current?.revenuecat_app_user_id ?? userId,
      expiration_reason: null,
      expiration_reason_at: null,
      last_validated_at: nowIso,
      updated_by: "rc_sync",
      updated_at: nowIso,
    };
    if (next.platform) row.platform = next.platform;
    if (previousTier) row.previous_tier = previousTier;

    const { error } = await supabase.from("user_subscriptions").upsert(row, { onConflict: "user_id" });
    if (error) {
      console.error("[sync-subscription] upsert failed", error);
      return json({ error: "write_failed" }, 500);
    }

    // Same follow-up the webhook does after an activation: activate businesses within the
    // plan, or ask the owner to choose which ones stay active
    const { error: selectionError } = await supabase.rpc("check_business_selection_requirement", { p_user_id: userId });
    if (selectionError) console.error("[sync-subscription] business selection check failed", selectionError);
  } else {
    // Lapsed (or never had a plan but the mirror still says active). Marking the row
    // expired lets the database trigger put the businesses into the free-plan state.
    const row: Record<string, unknown> = {
      subscription_status: "expired",
      subscription_product_id: null,
      tier: "free",
      max_owned_businesses: 1,
      will_renew: false,
      in_grace_period: false,
      grace_period_ends_at: null,
      last_validated_at: nowIso,
      updated_by: "rc_sync",
      updated_at: nowIso,
    };
    if (previousTier) row.previous_tier = previousTier;

    const { error } = await supabase.from("user_subscriptions").update(row).eq("user_id", userId);
    if (error) {
      console.error("[sync-subscription] update failed", error);
      return json({ error: "write_failed" }, 500);
    }
  }

  console.log(`[sync-subscription] mirror corrected for ${userId}: ${current?.subscription_status ?? "none"}/${current?.tier ?? "none"} -> ${next.status}/${next.tier}`);
  return json({ changed: true, status: next.status, tier: next.tier, expirationDate: next.expirationDate, productId: next.productId, validatedAt: nowIso });
});
