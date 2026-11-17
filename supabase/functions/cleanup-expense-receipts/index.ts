import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Removes receipt photos whose expense no longer lists them: expenses deleted from a build
// older than 2.16 (which does not know about receipts), expenses removed with their business,
// and uploads whose save did not finish. Files younger than a day are left alone so an upload
// in progress is never touched.
//
// Callers: the owner (or a scheduled job) with the service-role key as the Bearer token.
// Storage objects must be removed through the Storage API, not with SQL, so the database only
// lists them (list_orphan_expense_receipts, service role only) and this function deletes them.

const BUCKET = "expense-receipts";
const BATCH = 100;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${serviceKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";

  const { data, error } = await supabase.rpc("list_orphan_expense_receipts");
  if (error) return json({ error: error.message }, 500);

  const names: string[] = (data ?? []).map((r: { object_name: string }) => r.object_name);
  if (dryRun || names.length === 0) {
    return json({ dry_run: dryRun, orphans: names.length, sample: names.slice(0, 10) });
  }

  let removed = 0;
  const failures: string[] = [];
  for (let i = 0; i < names.length; i += BATCH) {
    const chunk = names.slice(i, i + BATCH);
    const { data: gone, error: removeError } = await supabase.storage.from(BUCKET).remove(chunk);
    if (removeError) failures.push(removeError.message);
    else removed += gone?.length ?? 0;
  }

  return json({ orphans: names.length, removed, failures });
});
