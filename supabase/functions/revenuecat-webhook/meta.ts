/**
 * Meta Conversions API: tells Meta ads when a subscription trial starts or a subscription is
 * paid, from the server, so the two events campaigns optimise for are never lost to a closed
 * app. Sends nothing unless both secrets exist:
 *   META_DATASET_ID        the dataset (app events) id from Events Manager
 *   META_CAPI_ACCESS_TOKEN a Conversions API access token for that dataset
 * Optional: META_TEST_EVENT_CODE, shown under "Test events" in Events Manager while verifying.
 *
 * Only a hashed user id identifies the person. No email, phone or name is sent.
 */

const GRAPH_VERSION = "v21.0";

export type MetaConversion = "StartTrial" | "Subscribe";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function platformOf(store: string | undefined): "ios" | "android" | null {
  switch ((store ?? "").toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "ios";
    case "PLAY_STORE":
    case "AMAZON":
      return "android";
    default:
      return null;
  }
}

export interface MetaConversionInput {
  event: MetaConversion;
  userId: string;
  eventId: string;
  occurredAtMs: number;
  store?: string;
  productId?: string | null;
  value?: number | null;
  currency?: string | null;
}

/** Returns true when an event was accepted by Meta, false when skipped or refused. Never throws. */
export async function sendMetaConversion(input: MetaConversionInput, log: (level: string, message: string, data?: unknown) => void): Promise<boolean> {
  const datasetId = Deno.env.get("META_DATASET_ID");
  const token = Deno.env.get("META_CAPI_ACCESS_TOKEN");
  if (!datasetId || !token) return false;

  const platform = platformOf(input.store);
  const bundle = "com.businessmanager.pro";
  // extinfo: Meta's fixed-position app info array. Position 0 is the platform ("i2" iOS,
  // "a2" Android), 1 the package name; the rest are optional and left empty here.
  const extinfo = [platform === "ios" ? "i2" : "a2", bundle, "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

  const body: Record<string, unknown> = {
    data: [{
      event_name: input.event,
      event_time: Math.floor(input.occurredAtMs / 1000),
      event_id: input.eventId,
      action_source: "app",
      user_data: { external_id: [await sha256Hex(input.userId)] },
      app_data: {
        advertiser_tracking_enabled: 0,
        application_tracking_enabled: 0,
        extinfo,
      },
      custom_data: {
        ...(input.value != null && input.currency ? { value: input.value, currency: input.currency } : {}),
        ...(input.productId ? { content_ids: [input.productId], content_type: "product" } : {}),
      },
    }],
  };
  const testCode = Deno.env.get("META_TEST_EVENT_CODE");
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${datasetId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      log("WARN", `Meta ${input.event} refused (${res.status})`, text.slice(0, 300));
      return false;
    }
    log("INFO", `Meta ${input.event} sent`);
    return true;
  } catch (error) {
    log("WARN", `Meta ${input.event} not sent`, error instanceof Error ? error.message : String(error));
    return false;
  }
}
