# Security fix plan (from audit run-1, 2026-11-05)

Source: `~/security-audit-skill/small-business-app-bolt/run-1/REPORT.md` (10 confirmed, 26 needs-validation).
Live state was checked on 2026-11-05 with read-only catalog queries (`pg_policies`, `pg_proc`, `pg_trigger`,
`information_schema`, `storage.buckets`, `pg_publication`) plus four `count(*)` audits. Nothing was written.

## 1. Live check results

| Lead | Live? | What the live project shows |
|---|---|---|
| Admin can rewrite `businesses.owner_user_id` / `access_state` / `archived_at` | **Yes** | UPDATE policy is admin-membership only; `authenticated` holds table-wide UPDATE with no column revoke; the only trigger guards the four `menu_*` columns |
| `complete_sale_atomic` accepts another business's cart | **Yes** | Live body has no `business_id` predicate on the cart lock or the products update; `authenticated` can execute. Historical audit: 0 cross-business sales so far |
| Sales trigger ignores plan expiry (`check_sales_subscription_limit`) | **Yes** | Live body tests `v_tier = 'free'` only and never calls `effective_plan`. 1 owner currently has an expired paid tier with no grace and is therefore unlimited |
| `register_push_token` cross-user token takeover | **Yes (admin level)** | Body deletes/nulls other users' rows for the same token; admins of a shared business can read co-members' `user_profiles.expo_push_token` (correlated SELECT policy, column granted) |
| `reconciliation_log` readable by every signed-in user | **Yes** | Policy `SELECT TO authenticated USING (true)`, 306 rows, table is in the `supabase_realtime` publication |
| `business-images` bucket unbounded | **Yes** | `file_size_limit` NULL, `allowed_mime_types` NULL, INSERT policy is `bucket_id = 'business-images'` only (the other two buckets are 5 MB / image-only / folder-bound) |
| Realtime DELETE broadcasts whole rows | **Stands** | `pubdelete = true`; `businesses`, `user_profiles`, `user_business_roles`, `user_subscriptions`, `user_sales_counts` are `REPLICA IDENTITY FULL` |
| Business-creation race | **Stands (not hit)** | Trigger is SECURITY INVOKER with no lock; 0 owners over their limit, 0 businesses without an owner role row |
| RevenueCat webhook receives SANDBOX events | **Yes** | RC webhook integration `revenuecat-webhook-bizmanage` has `environment: null` (sandbox + production delivered) |
| `validate-subscription` grants a tier from any receipt | **No (dead)** | Function is deployed (v18) but the live CHECK on `user_subscriptions.updated_by` admits only `webhook, client, system, rc_sync`, so its write fails. `updated_by` live values: `rc_sync` only. Delete it anyway |
| `set_read_only_businesses` callable by users | **No** | `authenticated` and `anon` cannot execute. Add the body guard anyway |
| Discount views without `security_invoker` | **No** | Both views have `security_invoker=on` live |
| `security_events` open table | **No (latent)** | Table and `log_security_event` do not exist live; neutralise the migration so a reset or preview branch never creates them |
| Also deployed | — | `iap-webhook` 410 stub is still deployed with `verify_jwt=false`; `legacy_write` cost events so far: 0 |

Not checkable through the MCP (owner, dashboard): edge-function secrets (`TURNSTILE_SECRET_KEY`, `REVENUECAT_SECRET_API_KEY`, `APPLE_SHARED_SECRET`), Supabase Auth refresh-token/session settings, RevenueCat "restore behavior".

## 2. Compatibility facts that shape the plan

Current builds (≤ 2.11) still do these directly from the client, so the server must keep accepting them until a build that stops doing them is the floor:

- `productService.updateStock` writes `products.current_stock` directly when a sale is **voided** (`src/services/sales.ts:693`) and when items are **returned** (`src/services/sales.ts:806`), for staff as well as owners. A hard block on direct stock writes would break void/return in every installed build.
- `AuthContext.updateBusiness` sends an arbitrary `Partial<Business>` to `businesses`, but the app only ever sends settings fields; nothing client-side writes `owner_user_id`, `access_state` or `archived_at` (only the unmounted dev screen `SubscriptionDebug.tsx`). A trigger on those three columns is safe for current builds, **provided** it lets the trusted SECURITY DEFINER RPCs that users call (e.g. `activate_all_businesses_and_populate_selection`) through.
- The client never writes `user_business_roles` directly (all through RPCs, which are SECURITY DEFINER) and never reads `reconciliation_log`, so those policies can be removed without a client change.
- `AuthContext` reads its own profile with `select('*')` on `user_profiles`. A column-level REVOKE on `expo_push_token` would make that query fail for every build, so the token column is hidden by emptying it, not by revoking it.
- Uploads to `business-images` always use `businesses/<file>` with an explicit image content type (`src/services/storage.ts:226-280`), so a size/MIME limit and a folder-bound policy are compatible.
- No client code calls `send-push-notification`; only the DB trigger (vault secret) does. The user-JWT path can go.

## 3. Phase 1 — one migration, server only, safe for every installed build

**Applied to the live project on 2026-11-05** as `supabase/migrations/20261105090000_security_audit_phase1.sql` (live version `20261105085850`; do not re-apply) after a rolled-back dry run with 20 assertions (admin state writes refused, owner RPC still allowed, foreign cart refused, direct stock write allowed and logged, reconciliation_log refused, role policies gone, owner row protected). Deviations from the plan below: item 7 uses plain `REPLICA IDENTITY DEFAULT` everywhere (the roles PK is `(user_id, business_id)`, which the app's DELETE handler needs); item 12's trigger is SECURITY INVOKER with an insert-only policy on the log table (a definer trigger cannot tell an API write from an RPC write).

1. **Tenant binding in `complete_sale_atomic`**: cart lock `WHERE id = p_cart_id AND business_id = p_business_id FOR UPDATE`; products update `AND business_id = p_business_id`; same signature, repeat the REVOKE/GRANT lines. Regression: a cart of another business raises `Cart not found`.
2. **`businesses` state guard**: `BEFORE UPDATE OF owner_user_id, access_state, archived_at` trigger that raises `42501` when the value changes, `auth.uid() IS NOT NULL`, and `current_setting('bizmanage.state_writer', true) IS DISTINCT FROM 'rpc'`. Each trusted RPC that legitimately changes `access_state` sets `PERFORM set_config('bizmanage.state_writer','rpc',true)` first (enumerate them at implementation time with `select proname from pg_proc where prosrc ilike '%access_state%'`). Service role (edge functions, webhook, cron) has `auth.uid()` null and passes. `owner_user_id` has no legitimate user-driven writer today, so it is always refused for users.
3. **`user_business_roles`**: drop the admin UPDATE and DELETE policies (RPCs bypass RLS); keep SELECT. Add a `BEFORE UPDATE OR DELETE` trigger refusing changes to the row where `user_id = (select owner_user_id from businesses where id = business_id)` unless service role. Change `invite_user_to_business` so `ON CONFLICT` raises `already a member` instead of `DO UPDATE SET role`, and refuse inviting the owner's own id.
4. **`check_sales_subscription_limit`**: take `tier` from `public.effective_plan(v_owner_user_id)` exactly as `can_user_create_sale` does. **User-visible**: the one owner with an expired paid plan becomes free-limited on their next sale. Decide whether to message them first.
5. **`reconciliation_log`**: drop policy `System admins can view reconciliation logs`; `REVOKE ALL … FROM anon, authenticated` (table and view `recent_reconciliation_history`); `ALTER PUBLICATION supabase_realtime DROP TABLE reconciliation_log, user_sales_count_history`.
6. **`business-images` bucket**: `UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']`; replace the INSERT policy with `bucket_id = 'business-images' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = 'businesses'`.
7. **Realtime payloads**: `ALTER TABLE … REPLICA IDENTITY DEFAULT` on `businesses`, `user_profiles`, `user_business_roles`, `user_subscriptions`, `user_sales_counts` (the app's DELETE handlers key on the primary key only; verify `useRealtimeBusinessRoles` and `useBusinessManager` at implementation time).
8. **`enforce_business_creation_limit`**: `SECURITY DEFINER`, `PERFORM pg_advisory_xact_lock(hashtext(v_owner_id::text))` before the count; same lock in `create_business` before `can_user_create_business`.
9. **`set_read_only_businesses`**: add `PERFORM public.require_service_caller()` as the first statement (already closed by ACL; this keeps it closed if it is ever re-created).
10. **`check_user_exists_by_email`**: require the caller to be an admin of at least one business, add a per-caller throttle (e.g. 20/hour via a small `email_lookup_log`), keep the current return shape so 2.11 keeps working. A tighter `check_invitee(p_email, p_business_id)` RPC that returns `{exists, is_member, role}` without `user_id` lands with the 2.12 client.
11. **`create_web_order`**: move the stock check below the abuse limits; add per-`ip_hash` 24 h cap (20) and per-(business, `ip_hash`) 24 h cap (10); when `p_ip_hash` is null, count under the literal key `'unknown'` with the per-business cap instead of skipping.
12. **Stock-write guard, record mode** (mirrors the cost guard): `BEFORE UPDATE OF current_stock ON products` trigger that, when `auth.uid()` is set and the caller is not owner/admin (`NOT can_adjust_stock(...)`) and no RPC flag is set, inserts a `direct_stock_writes` log row (product, user, old, new) and **allows** the write. Phase 4 turns it into a refusal once no rows appear for 14 days after 2.12 is the floor.
13. **Neutralise** `20251116172604_add_security_audit_logging.sql` (body → comment) so `supabase db reset` and preview branches never create `security_events`/`log_security_event`.

Verification after apply: rerun the Q1–Q4 catalog queries from the audit (`run-1/OWNER-CHECKS-2026-11-05.md`); app smoke test on a 2.11 build: void a sale, return an item, edit business settings, upload a logo, invite a staff member, complete a web order.

## 4. Phase 2 — edge functions (redeploy, no client change)

**Done 2026-11-05** (see CODEBASE_MAP.md "Edge-function hardening"). Turnstile stays optional until `TURNSTILE_SECRET_KEY` is set (owner task); `RC_SANDBOX_ALLOWLIST` is a new optional secret for testers.

1. **`send-push-notification`**: remove the user-JWT path entirely (trigger secret only); drop `to` from `failures[]` and return only counts. This closes the forced-membership push chain today without waiting for an invitation flow.
2. **`delete-business`**: for `product-images`, accept a parsed path only if it matches `^products/[A-Za-z0-9._-]+$` **and** no product of another business references it (`select 1 from products where image_url like '%'||path and business_id <> :id`); for `business-images`, remove the exact objects named by `businesses.business_image_url` and the payment-QR column(s) (path must start with `businesses/`) instead of listing a prefix the app never writes. Same for `delete-auth-user` and `profiles/`.
3. **`menu-order`**: drop the `x-real-ip` fallback (every request arrives through Cloudflare, per the 2026-09-25 probe); pass `'unknown'` instead of null when `cf-connecting-ip` is absent; once `TURNSTILE_SECRET_KEY` is set, make the check fail closed when the secret is missing.
4. **`revenuecat-webhook`**: reject events with `environment = 'SANDBOX'` unless `app_user_id` is in an allow-list secret; on `TRANSFER` set `transferred_from` accounts to `expired`/`free`; honour the `mark_webhook_event_processed` return value (skip duplicates). **`sync-subscription`**: ignore `is_sandbox` entitlements.
5. **Delete** `validate-subscription` and `iap-webhook` (functions, `config.toml` blocks, deployed instances) and `validateReceiptWithBackend` + the `SubscriptionDebug` test button in the client.

## 5. Phase 3 — client 2.12

**Code done 2026-11-05** (app.json 2.12.0; see CODEBASE_MAP.md "Client hardening, 2.12"). Server side in `20261105120000_security_phase3_client_support.sql` (restore_sale_stock, check_invitee, push-token changes), **applied live 2026-11-05**. Not done: moving the session into SecureStore (sign-out ordering fixed instead), the invitation-acceptance flow (phase 4).

1. **Deep link**: remove the `#access_token…type=recovery` branch in `AuthContext.handleDeepLink` and the token branch in `app/(auth)/reset-password.tsx` `createSessionFromUrl`; on `resetPassword` store `{email, expiresAt}` in AsyncStorage and accept `?code=` only while it exists, no other user is signed in, and the resulting session's email matches; clear it after use.
2. **Sign-out ordering**: call `supabase.auth.signOut({scope:'local'})` **before** `clearAuthStorage()` so `/logout` revokes the server session; same in `handleInvalidToken`. Call `revenueCatService.logOut()` on sign-out.
3. **Offline queue**: key `offline_sale_queue:<uid>`; on first load, migrate the legacy key only if its entries' `created_by` equals the current user, otherwise drop them.
4. **Stock restore via RPC**: new SECURITY DEFINER `restore_sale_stock(p_sale_id, p_lines jsonb)` (member of the sale's business, product bound to that business, base-unit conversion server-side) used by void and return instead of `productService.updateStock`; delete `bulkUpdateStock`, `salesImportProcessor`, `importService`, `bulkImportProcessor`, `csvParser`.
5. **Team invite**: use `check_invitee`; stop displaying `user_id`.
6. **Push token**: profile screen stops reading `expo_push_token`; `register_push_token` stops writing it (user_push_tokens only); the DB push trigger reads `user_push_tokens`; then a migration nulls the column.
7. **CSV export**: one shared cell helper that doubles quotes and prefixes `'` to cells starting with `= + - @ \t \r`.
8. **Receipt HTML**: restrict `<img src>` for logo/QR to the project's storage origin.

## 6. Phase 4 — after 2.12 is the floor (watch the two record-mode logs)

**Status 2026-11-05:** the invitation-acceptance flow (4a) is built and applied (`20261105150000_security_phase4_invitations`, applied live 2026-11-05 after the commit; re-run the catalog check in §1 style if in doubt). The strict guards (4b) are written as `20261105160000_security_phase4_strict_guards.sql` with a gate that refuses to run while either log has rows from the last 14 days; apply it after 2.12 is the installed floor:

```bash
supabase db push --include-all
```

or through the dashboard SQL editor; the gate's own error message says why if it is too early.

- Cost: restore the strict `guard_product_cost_write` (SQL in `docs/product-cost-flow-recommendation.md` §6) when `product_cost_events` has had no `legacy_write` for 14 days.
- Stock: switch the Phase 1 stock guard from record to refuse when `direct_stock_writes` has had no rows for 14 days.
- Membership: invitation-acceptance flow (`business_invitations` table; the role row is created on accept), which removes the forced-membership root cause.

## 7. Owner tasks (dashboard, not code)

Status 2026-11-05 (done through the owner's browser):

- RevenueCat → Integrations → Webhooks → `revenuecat-webhook-bizmanage`: environment set to **Production only** (was both). The webhook's own SANDBOX gate stays as a second line.
- Supabase → Edge Functions → Secrets: `TURNSTILE_SECRET_KEY` was already set (25 Sep 2026) and the menu site (`bizmanage_menu`, `OrderSlip.tsx`) renders the widget and sends `turnstile_token` when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, so the bot check is active; `REVENUECAT_SECRET_API_KEY` confirmed present (22 Sep 2026); `APPLE_SHARED_SECRET` deleted. Still present but no longer read by any function: `APPLE_BUNDLE_ID` and `GOOGLE_SERVICE_ACCOUNT_KEY` (the CI workflow reads the latter from GitHub secrets, not from here) — safe to delete when convenient.
- Follow-up: make `menu-order` fail closed when `TURNSTILE_SECRET_KEY` is missing (it is set, so this is a one-line change at the next redeploy).
- Supabase → Authentication → Settings: refresh-token reuse interval and session timebox not yet reviewed (bounds the AsyncStorage-token exposure until 2.12 fixes sign-out ordering).
- CI: pin `actions/*` to SHAs, pin `eas-cli`, `npm ci --ignore-scripts`, `permissions: contents: read`.

## 8. Order of work

1. Phase 1 migration (dry run → apply) and Phase 2 redeploys — one sitting, no release needed, closes everything that is live today except the client-side items.
2. Owner dashboard tasks (§7).
3. 2.12 build with Phase 3; submit.
4. Phase 4 when the record-mode logs go quiet.
