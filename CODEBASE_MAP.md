# BizManage (business-manager-pro) — Codebase Map

Reference for modifying this project. Generated 2026-09-15 from the `uat` branch.
Read this before touching a feature; it tells you which layer owns what and where the traps are.

---

## 1. Stack and runtime

| Layer | Choice | Notes |
|---|---|---|
| App | Expo SDK 54, React Native 0.81.4, React 19.1, TypeScript 5.9 strict | `newArchEnabled: true`, typed routes on |
| Navigation | expo-router 6 (file-based) | `app/` directory is the route tree |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) | client in `src/config/supabase.ts` |
| Subscriptions | RevenueCat (`react-native-purchases` 8) | old `react-native-iap` path is dead; `iap-webhook` returns 410 |
| i18n | i18next + react-i18next | `en`, `km`, `zh` in `src/locales/` |
| Styling | `StyleSheet.create` per file + `isDark ?` ternaries | no design tokens; ~1,965 `isDark ?` sites |
| Validation | zod schemas in `src/lib/validation.ts` | react-hook-form is installed but unused |
| Storage | expo-secure-store (native) / AsyncStorage (web) for auth; AsyncStorage for offline queue, theme, cache | |
| Build/CI | EAS (`eas.json`), GitHub Actions manual dispatch → TestFlight / Play Store | `appVersionSource: remote`, autoIncrement on production |
| Tests | None configured. One orphan file `src/utils/__tests__/productIdMapper.test.ts` | `tsconfig` excludes `*.test.ts` |
| Type check | `npx tsc --noEmit` reports 1,090 errors on the current baseline | Not a usable gate today, see §9. Lint (`expo lint`) is the only working check. |

Env vars (all `EXPO_PUBLIC_*`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REVENUECAT_API_KEY`, `EAS_PROJECT_ID`, `APP_URL`, `APP_SCHEME`. Copy `.env.example` → `.env`.

Version numbers live in two places: `package.json` (1.0.1, unused by stores) and `app.json` (2.5.0, the real one). Bundle id `com.businessmanager.pro`, EAS project `ddca231c-…`.

Git workflow: work on `uat`, open PRs `uat → main`. Main has 63 such merges. Never commit directly to main (it has happened four times and caused drift).

---

## 2. Directory layout

```
app/                      expo-router routes (29k lines)
  _layout.tsx             root: provider stack + <Stack>
  index.tsx               session? → (app)/(tabs) : (auth)/signin
  (auth)/                 signin, signup, forgot-password, reset-password, terms
  (app)/
    _layout.tsx           auth guard + business-onboarding/selection redirects
    (tabs)/               6 tabs: index(dashboard) inventory customers sales expenses settings
      inventory/          index, low-stock, product-details, batch-details, product-insight, product-sales, unit-groups
      sales/              index, customer-selection, product-selection, cart/[cartId], checkout/[cartId], details/[saleId]
      settings/           index, profile, business, team, terms, privacy, change-password, currencies,
                          subscription, notifications, notification-preferences, referrals, debug-subscription
    reports/              index, income-statement, cash-flow, sales-history
    business-onboarding, business-selection, top-customers, top-products, customer-orders/[customerId]
  refer/[code].tsx        deep-link referral landing
  +not-found.tsx
hooks/useFrameworkReady.ts   (bolt template artefact, required by root layout)
src/                      48k lines
  config/supabase.ts      typed client, PKCE, SecureStore adapter
  context/                13 providers (see §3)
  services/               21 service objects = ALL Supabase data access (see §5)
  components/             grouped by domain: account auth business checkout customers expenses
                          inventory notifications products profile sales settings sharing
                          subscription team ui
  hooks/                  data hooks + business/session managers
  lib/                    infra: errors, logger, network retry, offline queue, rate limiter,
                          secure storage, validation schemas, dataCache
  utils/                  domain helpers: accessControl, businessAccessGuard, csv import processors,
                          profitCalculation, formatCurrency, notification helpers
  types/database.ts       generated Supabase types — STALE, see §6
  locales/                en.json km.json zh.json + i18n init
supabase/
  config.toml             per-function verify_jwt flags
  functions/              11 Deno edge functions (see §7)
  migrations/             192 SQL files, 2025-06 → 2026-09 (NOT a complete schema, see §6)
.bolt/                    bolt.new template config + 21 discarded migrations (ignore)
*.md                      RevenueCat/webhook/testing guides (historical, partly outdated)
```

---

## 3. Provider stack (order matters)

`app/_layout.tsx` nests, outermost first:

```
GestureHandlerRootView > ErrorBoundary > ThemeProvider > LanguageProvider > NetworkProvider
  > AuthProvider > CurrencyProvider > ReferralProvider > SubscriptionProvider
    > BusinessSwitchProvider > SaleDetailsModalProvider > NotificationProvider
      > CartProvider > InstantCheckoutProvider > <Stack/> + NetworkBanner + PendingSalesSyncModal
```

| Context | Hook | Owns |
|---|---|---|
| `AuthContext` (866 lines) | `useAuth` | session, `userProfile`, `userBusinesses`, `currentBusiness`, `currentUserRole` ('admin'/'staff'), signIn/Up/Out, switchBusiness, createBusiness, password flows, inactivity sign-out. Shape in `authTypes.ts`. |
| `RevenueCatSubscriptionContext` (1,350 lines) | `useSubscription` | tier, `salesCountData`, `canAccessFeature`, `readOnlyBusinessIds`, `mustChooseBusinesses`, paywall visibility, purchase/restore. 5 realtime channels. `SubscriptionContext.tsx` is just a re-export alias. |
| `CartContext` (678) | `useCart` | multi-cart CRUD, `completeSale()` → salesService or offline queue |
| `InstantCheckoutContext` (551) | `useInstantCheckout` | quick-sale widget session, separate from carts |
| `NotificationContext` (620) | `useNotifications` | in-app notifications list, unread count, realtime, push token registration |
| `NetworkContext` | `useNetwork` | `isConnected`, `pendingSalesCount` (tab badge) |
| `CurrencyContext` | `useCurrencyContext` (+ `hooks/useCurrency`) | business currencies, default, conversion |
| `BusinessSwitchContext` | `useBusinessSwitch` | loading modal during business switch |
| `SaleDetailsModalContext` | `useSaleDetailsModal` | global sale-details modal |
| `ReferralContext` | `useReferral` | referral code, credits, pending-code claim |
| `ThemeContext` | `useTheme` | `isDark` only. 'system' is hardcoded to light (TODO in code). |
| `LanguageContext` | `useLanguage` | i18n language switch, persisted |

Route guards: `app/(app)/_layout.tsx` redirects to `business-onboarding` when the user has no businesses and to `business-selection` when none is current. `app/(auth)/_layout.tsx` bounces signed-in users to `(app)` unless in password recovery.

---

## 4. Core domain flows

**Sale (cart checkout)**: `sales/product-selection` → `CartContext.addItemToCart` → `sales/cart/[cartId]` (1,460 lines, discounts per item + per sale) → `sales/checkout/[cartId]` → `CartContext.completeSale` → `salesService.completeSale` → RPC `complete_sale_atomic` (single transaction: sale + items + stock + sales count). Offline: payload goes to `lib/offlineSaleQueue` (AsyncStorage), `PendingSalesSyncModal` replays when back online.

**Instant checkout**: `components/checkout/InstantCheckoutModal` (1,411 lines) → `instantCheckoutService.completeInstantCheckout` → same `salesService.completeSale`.

**Void / return / refund**: `components/sales/VoidSaleModal`, `ReturnSaleForm` → `salesService.voidSale / returnItems / performSaleAction` → `sale_actions` table; triggers update `returned_amount`; `calculate_cogs` subtracts returns.

**Inventory**: products (`productService`, archive support) → stock via imports (`inventoryService`, `batchImportService`; `inventory_imports`, `inventory_batches`, `import_costs`) → cost per unit recalculated by trigger `update_product_cost_trigger`. Units: `unitService` (`unit_groups`, `units`, `product_unit_prices`). Barcode scan: `components/inventory/BarcodeScanner` (expo-camera). Barcode **rendering**: `utils/barcode.ts` (dependency-free Code 128 encoder + SVG string), `components/products/BarcodeView` (react-native-svg) on product details for the product and each unit variant, and `services/productBarcodeExport.ts` (CSV with barcode column, or PDF via expo-print with every row's barcode drawn) behind the Export button on the inventory tab.

**Money semantics** (settled 2026-09-15, see `src/utils/saleMoney.ts`): `delivery_cost` is a courier fee the business absorbs, so `sales.total_amount` is net proceeds and reporting revenue is `total_amount + delivery_cost − refunds`, with delivery fees as an operating expense. A return's `loss_amount` is the deduction kept back from the refund and stays inside revenue; `adjusted_amount` is the cash refunded. Refunds are priced at what the customer paid after the cart discount. Use the helpers, never re-derive.

**Reporting currency** (`src/utils/reportCurrency.ts`): every report is produced in one currency, the one picked on the screen or the business default; sales convert with `exchange_rate_at_sale`, expenses with the current rate, COGS per currency through `getConvertedCOGS`; rows with no `currency_id` are the default currency. Chart buckets use `bucketKey()` (local time). Pass `currencyId` as the trailing argument of every report call.

**Product Insight** (`inventory/product-insight`): `productInsightService.fetchProductsAndSales` gathers per-product daily demand for the window and the prior window (completed + partially returned, returns subtracted, unit variants converted to base units); the maths lives in pure `src/utils/inventoryPlanning.ts`: ABC on margin contribution, XYZ on weekly demand CV, safety stock `Z·σ·√horizon`, reorder point, suggested order quantity, dead stock at cost, and a discontinue list (C class, >26 weeks of supply, velocity halved). Tested by hand with `tsx` on synthetic cases; keep it I/O-free.

**Courier fee lives in two places.** `sales.delivery_cost` is null on many rows (864 live sales on 2026-09-19, still being written until the checkout fix that day) while the fee sits on `carts.delivery_cost`. `getSaleDeliveryCost` falls back to the cart, but only if the query selected it: every `from('sales')` select that reads `delivery_cost` must also select `carts(delivery_cost)`, or revenue and delivery fees are both understated by the missing fees (net profit is not, which hides the bug). The Sales tab's day header and Sales Analytics use `getSaleGrossRevenue` like the dashboard, in local time.

**Sales counters are per owner.** `user_sales_counts` holds ONE row per business, keyed to the business OWNER: the sale trigger `auto_increment_sales_count` increments it, the free-plan limit reads it, and the nightly cron `daily_sales_count_reconciliation` (02:00 UTC) only visits (owner, business). A row for anyone else is never incremented or reconciled (it sat at 0 with `last_reconciled_at` NULL). Since migration `20260920081810` the trigger `enforce_sales_count_owner` makes the table refuse non-owner rows; `get_or_create_sales_count` gives a team member the owner's figure without creating a row (0 for anyone with no role in the business); void / un-void adjust the owner's row, not `sales.created_by`. Open question, not changed: a void subtracts 1 from the counter, but the nightly reconciliation counts ALL sales including voided, so each void is added back the next night and logged as `corrected`.

**Who pays delivery.** Two payers, two columns, chosen with `DeliveryPayerSelector` in the Shopping Cart and in quick checkout's delivery popup (`src/utils/deliveryPayer.ts`: `readDelivery`, `deliveryColumns`). SHOP pays (free delivery) is the original behaviour: `carts.delivery_cost` / `sales.delivery_cost`, deducted from `sales.total_amount`, reported as a fee, receipt says FREE. CUSTOMER pays (charge delivery): `carts.delivery_charge` (migration `20260920160449`), NOT deducted and NOT in revenue, profit, fees or refunds; money-wise the sale is identical to one with no delivery. It exists only on the cart (every checkout, including quick checkout and the offline sync, creates a cart row, and a sale has exactly one cart), is never passed to `complete_sale_atomic`, and is read by the checkout summaries, the sale details (`sale.carts.delivery_charge`) and the receipt, where it prints as a `Delivery fee` line and is ADDED to TOTAL (`ReceiptModel.delivery.kind = 'charged'`). Only one of the two amounts may be positive (check `carts_delivery_one_payer`); the screens always write both together, and editing a sale's delivery cost to a positive value clears the charge. Do not fold the charge into `delivery_cost` or `total_amount`: dozens of report, profit and refund calculations read those. Currency: a cart's amounts, and the sale recorded from it, are in the business's DEFAULT currency (both checkouts format and total that way). The fee box (`DeliveryFeeInput`) has a currency picker that defaults to the products' currency; a fee typed in another currency is converted with `useCurrency().convertBetween` into the default currency BEFORE it is used or saved, and nothing records which currency it was typed in, so a reopened cart shows the converted amount. After a cart checkout the cart leaves `CartContext`, so `checkout/[cartId].tsx` builds its `PostSaleActionModal` before its "Cart Not Found" early return and leaves with `router.dismissTo('/sales')`, which also drops the cart screen underneath.

**Push notifications.** Every push starts in the database: the AFTER INSERT trigger `send_push_notification_on_insert` on `notifications` calls the edge function `send-push-notification` through `pg_net`; the app never calls that function. The trigger authenticates with the header `X-Push-Secret`, a random value kept only in the vault (`push_trigger_secret`) and checked by `verify_push_trigger_secret` (service_role only); the `Authorization: Bearer <anon key>` it also sends merely gets the request past the gateway (`verify_jwt = true`). It sends `targetUserId` and the function resolves the Expo token itself. The function's other path, a signed-in user's JWT plus shared-business check, is unchanged. History: from 2026-07-20 (commit `2d4f2a0`) to 2026-09-20 the function required a user JWT while the trigger still sent the anon key, so EVERY push was refused with 401 and only the in-app list worked; fixed by migration `20260920121338` plus a redeploy. To debug delivery, read `net._http_response` (kept a few hours): 200 with `status: ok` means Expo accepted it. Who gets a push is decided entirely on the server (the business's owner and admins, minus their preference switch); the business currently open in the app is client-only state and plays no part. One Expo token is stored per user (`user_profiles.expo_push_token`), so only the device that registered last receives pushes. Tapping a push is handled in `NotificationContext` (`handlePushResponse`): it waits until the app can navigate (`canNavigateFromPush`: data loaded, a business chosen, inside `(app)` and past onboarding/selection), so a tap that launches a closed app is picked up afterwards through `getLastNotificationResponseAsync()` instead of being lost; each tap is handled once (`handledPushResponses`). Navigation goes through `BusinessSwitchContext.handleNotificationNavigation`, which switches to the notification's `business_id` first when another business is open; the cart screen re-looks the cart up after such a switch before saying "Cart Not Found". `web_order_received` resolves through `webOrderService.notificationTarget`: active cart, else the sale if it was checked out, else Active Carts with an explanation.

**Online menu (public web ordering).** The website is a separate project, `~/Desktop/Development/bizmanage_menu` (Next.js); its brief for this app is `docs/phase-3-app-instructions.md` there. A customer opens `<MENU_URL>/<menu_slug>`, orders, and the order is inserted server-side as an ACTIVE CART (`carts.source = 'web'`, `order_ref`), checked out through the normal flow. The site never reads tables: it calls the edge functions `menu-get` and `menu-order` (`verify_jwt = false`, service role inside), which call `get_public_menu` / `create_web_order` / `get_web_order_status` (service_role only, keep it that way; never expose `cost_per_unit`). Schema in `20260920120000_web_menu_orders.sql`, applied to production through the Supabase MCP as version `20260920092639`, so the file name and the live version differ; do not re-apply. The menu is 404 unless `businesses.menu_enabled`, `access_state = 'active'` and not archived. App side so far: `src/config/menu.ts` (the site address is BUILT IN, `https://bizmanagemenu.vercel.app`; `EXPO_PUBLIC_MENU_URL` only overrides it. It used to be env-only, and because `.env` is git-ignored every build not bundled on the developer's machine hid the whole feature), `src/utils/onlineMenu.ts` (link-name suggestion, zod schema, constraint-to-message mapping), `src/components/menu/OnlineMenuSharePanel.tsx` (link, QR image served by the site at `/<slug>/qr.png`, share, printable poster), `OnlineMenuButton.tsx` (dashboard row + bottom sheet) and `settings/online-menu.tsx`. Free on every tier. Who may do what: the menu follows the OWNER's plan (public only while `access_state = 'active'`), so only the owner switches it on or off, renames it or edits the Telegram name and note; every other member, admin or staff, sees the same state and may view and share the link and QR. The app checks `currentBusiness.owner_user_id === user.id`, and the database enforces it with the trigger `enforce_menu_owner_only` on `businesses` (migration `20260920153652`): a signed-in non-owner changing any `menu_*` column gets 42501, while other columns and service-role calls are unaffected (RLS alone would let any admin update the row). Web orders in the app: `Cart.source` / `Cart.order_ref` (missing = 'app'); `WebOrderBadge` on `ActiveCartCard` and the cart screen, where a web cart also offers "Block this number" (`src/services/webOrders.ts`, phone normalised exactly like `menu_normalize_phone()`; table `web_order_blocked_phones`, members only). `CartContext` subscribes to realtime INSERTs on `carts` for the current business and calls `refreshCarts(true)` when `source = 'web'`; the channel is removed on business switch and sign-out. Notification type `web_order_received` (payload `cart_id, order_ref, customer_name, customer_phone, total_amount, business_id, business_name`) is handled in `NotificationContext` (push tap), `NotificationModal` and `settings/notifications.tsx`: `webOrderService.notificationTarget(cart_id)` opens the cart while it is active, otherwise `/(app)/(tabs)/sales?tab=carts` (the Sales tab now reads `?tab=`). The cart screen refreshes once before showing "Cart Not Found". Push priority is `high` in the app and in the DB trigger `send_push_notification_on_insert` (migration `20260920102037`). Preference switch: `notification_preferences.web_orders_enabled`. Migration `20260920101955` schedules the cron job `abandon-stale-web-carts` (19:17 UTC daily): web carts still active after 7 days become `abandoned`, which removes them from Active Carts and reads "cancelled" on the customer's status page; app carts are never expired. Migration `20260920101928` makes `get_web_order_status` return the cart's current `items` (name, quantity, unit_price, subtotal, currency; never cost, stock, notes or customer details). Decided 2026-09-20: a business that is not `active` keeps a 404 menu. The site is live at `https://bizmanagemenu.vercel.app` (built into `src/config/menu.ts`). Not done: customer platform `'web'` (brief item 9, optional). Hardening from the 2026-09-21 assessment, applied 2026-09-25: `clientIp()` in `menu-order` and `referral-click` reads ONLY `cf-connecting-ip` / `x-real-ip` (probed: every request comes through Cloudflare, which sets `cf-connecting-ip`, rewrites `x-forwarded-for` so its last hop is an internal AWS proxy, and rejects a caller-supplied `cf-connecting-ip`; a missing address just skips the per-IP limit). `menu-get` and `menu-order` answer CORS only for the origins in the `MENU_ALLOWED_ORIGINS` secret (comma separated; default `https://bizmanagemenu.vercel.app`, so Vercel preview URLs need adding). Cron `web-order-spike-alert` (01:05 UTC, migration `20260925093133`) runs `notify_web_order_spikes(50)`: one `web_order_received` notification with `data.kind = 'spike'` per business over 50 web orders in 24 h, which `notificationTarget(cart_id, kind)` sends to Active Carts. Still open, owner only: Turnstile keys (`TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), and whether the `heng-dy-mart` menu, the customer "Test Customer (web menu)" and the test orders are test data to delete.

**Terms acceptance.** `user_profiles.terms_accepted_version` / `terms_accepted_at` (migration `20260925094457`). The current version is `TERMS_VERSION` in `src/config/terms.ts` (raise it with the terms text; both terms screens print it). Sign-up passes `terms_version` in the auth metadata and the profile trigger `handle_new_user_profile` stores it; `TermsUpdatePrompt` (mounted in `app/(app)/_layout.tsx`) blocks with a summary until the user agrees when their version is behind, then writes the profile. Every existing user is asked once for 1.4.0.

**Who is limited by whose plan.** Since migration `20260925094451` a business's sales limit always follows its OWNER's plan and the business's own counter, whoever is selling: `can_user_create_sale` and `get_full_subscription_state` (its `salesCountData`, now also `limitTier`) read `effective_plan(owner)` (internal helper, no caller guard, service-role only) exactly like the insert trigger; before that a staff member was judged on their own free plan and counter (0). A non-member gets `NOT_A_MEMBER`. The caller's own `tierInfo` / `subscriptionStatus` are unchanged. **Void rule:** a voided sale does not use a free-plan slot: the void trigger takes one off `user_sales_counts` and the nightly `reconcile_sales_count` now counts `status <> 'voided'`, so the two agree (before, reconciliation added every void back each night and logged "corrected").

**Push tokens are per device.** `user_push_tokens` (migration `20260925094514`, token PK, RLS own rows) replaces the single `user_profiles.expo_push_token`, which is kept in sync with the latest device for older builds. The app calls `register_push_token(token, platform, device, version)` after registering (moves the token away from any other account on that phone) and `unregister_push_token` on sign-out (`AuthContext.signOut`, token remembered under `PUSH_TOKEN_STORAGE_KEY`). `send-push-notification` sends to every token of the target user in one Expo request and deletes tokens Expo reports as `DeviceNotRegistered`.

**Receipts, phase 2 (2026-09-25).** The total is printed a second time in the other currency at the rate saved on the sale (`ReceiptInput.exchangeRateAtSale` + `secondaryCurrency`, chosen by `secondaryCurrencyFor(saleCurrencyId, currencies)`: the business default, else the first other currency; renderers take `formatAmountIn`). A "Pay to" block prints `businesses.receipt_payment_qr_url` and `receipt_payment_note` (migration `20260925094553`; edited on the business settings screen, QR stored like the logo). Every numbered receipt ends with a Code 128 barcode of its label (`src/utils/barcode128.ts`, pure, tested; SVG in the HTML, `react-native-svg` on screen); the barcode button in the Sales History search bar scans it, `parseReceiptNumber` + `salesService.getSaleIdByReceiptNumber` open the sale, any other code becomes the search text. Sales History also remembers collapsed days per business in AsyncStorage. The Edit Sale modal has the same who-pays tabs as the cart (`updateSaleRecord` takes `deliveryPayer` and writes `deliveryColumns`). Older sales got `sales.delivery_cost` copied from their cart (`20260925094138`, 888 rows).

**Cart and checkout are one screen** (2026-09-25): `sales/cart/[cartId].tsx` holds items, discounts, delivery, notes, sale date, payment method, PAID/COD, the order summary and margin, with Complete Sale and Save draft in the footer; Complete Sale saves pending edits first, then `completeSale`, then the post-sale prompt. `sales/checkout/[cartId].tsx` is only a redirect to the cart for old links. **Checkout draft.** `carts.payment_status` ('paid' | 'cod') and `carts.payment_method` (migration `20260925101238`) hold the choices made on the checkout screen while the cart is still open. The screen writes them the moment they are tapped (`rememberDraft` → `updateCart`) and reads them back when the cart is opened again; a cart with no choice yet starts from the last PAID/COD used in that business (AsyncStorage `checkout_last_payment_status_<businessId>`). "Save draft" under Complete Sale writes status, method and notes and returns to Active Carts. Completing the sale still copies the values onto `sales` as before.

**Free sales limit is per business.** One rule everywhere since migration `20260920094712`: on the free plan EACH business may hold `get_effective_sales_limit(owner)` sales (50 + the owner's referral credits); sales in the owner's other businesses do not count. A business that is `read_only_sales` or `owner_disabled` takes no new sales on any plan. Applied by `can_user_create_sale` (pre-check, via `subscriptionService.canAccessFeature`), `get_full_subscription_state` (what the app displays; `subscriptionService.getSalesCountData` reads it, including after realtime counter changes) and the BEFORE INSERT trigger `check_sales_subscription_limit` on `sales` (hard stop, raises `SUBSCRIPTION_LIMIT_REACHED:` / `BUSINESS_READ_ONLY:` / `BUSINESS_OWNER_DISABLED:`). Before that migration the trigger summed ALL owned businesses against a flat 50, so a lapsed subscriber saw "41 remaining" and had every sale refused. `salesCountData.totalSalesAllBusinesses` is informational only; the Sales tab warning banner shows the current business's count and appears from 80% used. Known gap: for a team member these functions use the member's own plan and counter (0), while the trigger uses the owner's, so the trigger is the only real limit for staff.

**Database functions and the public key.** Supabase grants EXECUTE on every new `public` function to `anon`, so a SECURITY DEFINER function is callable with only the app's public key unless revoked, and guards written as `IF auth.uid() IS NOT NULL AND ...` are skipped by anonymous callers (so is `p_user_id != auth.uid()`, which yields NULL). Closed on two layers on 2026-09-19: `complete_sale_atomic` (migration `20260919103109`) and 17 user, business, referral and webhook functions (migration `20260919104338`). Layer 1: EXECUTE revoked from PUBLIC and anon (and from authenticated for the service-only ones). Layer 2: a guard as the first statement, via three helpers: `require_self_or_service(user_id)` (the signed-in user acting on their OWN id, or the service role), `require_not_anon()` (any signed-in user or the service role) and `require_service_caller()` (service role or direct SQL only: `activate_all_businesses_and_populate_selection`, both `increment_referral_conversions`, `log_webhook_error`, `mark_webhook_event_processed`). All five edge functions that call these use the SERVICE ROLE key, so the service path must stay open. A DROP + CREATE re-grants anon automatically, so any migration that recreates a function must repeat the REVOKE; never change a signature with CREATE OR REPLACE (second overload, ambiguous calls). The remaining 22 were closed on 2026-09-25 (migration `20260925093056_close_remaining_anon_functions`): two non-raising helpers `caller_is_self_or_service(user)` and `caller_is_member_or_service(business)` for functions that must answer false rather than fail (`is_business_admin_check` is used by RLS on `user_business_roles`), a guard line patched in after the first BEGIN of ten plpgsql functions, `can_adjust_stock` and `get_low_stock_products` rewritten, EXECUTE revoked from PUBLIC and anon on every SECURITY DEFINER function, and the schema default privileges changed so a new function no longer gets anon EXECUTE (functions created by role `supabase_admin` still would; migrations run as `postgres`). Advisor lint 0028 is clear; lint 0029 (signed-in users can call SECURITY DEFINER functions) is expected, the app calls them signed in and each one checks the caller. Anon can still execute 16 non-definer functions: 10 trigger functions (not callable over REST) and 6 pure calculations that run with the caller's own rights. Three bugs found on the way were fixed in migration `20260919105516`, none security related: `generate_referral_code` had two overloads, `(uuid)` and `(uuid, text DEFAULT NULL)`, so every one-argument call was ambiguous and no referral code ever loaded; the two-argument one is dropped and the get-or-create `(uuid) RETURNS text` stays. `check_business_selection_requirement` failed for every user: free users (no `user_subscriptions` row) on `ROW('free', 1)` having no named field, subscribers on an `ORDER BY` next to `json_agg`. Because it raised after its UPDATEs, businesses were not re-activated and `must_choose_businesses` was not cleared after a subscription change. A missing subscription row now means the free limit of one business, as in `get_full_subscription_state`.

**PAID or COD** (`sales.payment_status`: 'paid' | 'cod', NULL on sales made before 2026-09-19, never backfilled). Required at both checkouts with no default (`PaymentStatusSelector`), editable from a sale's Edit form, shown on sale cards and details. It is written inside `complete_sale_atomic` via the trailing `p_payment_status text DEFAULT NULL`; the parameter must stay optional because installed app versions do not send it. Changing that function's signature means DROP + CREATE in one transaction (CREATE OR REPLACE would add a second overload and make every named-argument call ambiguous), then re-GRANT and `NOTIFY pgrst`. Carried through the offline queue (`OfflineSalePayload.paymentStatus`) so a COD sale made offline syncs as COD. Payment method now defaults to Transfer in both flows. On receipts: PAID prints the type plus the method; COD prints "COD (Cash on delivery)", no "Paid by" line, and the total reads TOTAL DUE; the staff name is not printed.

**Receipts** (`sales/receipt` screen; pure `src/utils/receipt.ts` builds a `ReceiptModel`, rendered by `src/utils/receiptHtml.ts` for PDF/print and `ReceiptView` for the screen and the shared image, so the two cannot disagree on money). Opened from the post-sale prompt in both checkout flows and from a sale's details (screen and sheet). Rules: TOTAL is what the customer paid (items − discounts = `total_amount + delivery_cost`), never `total_amount` alone; a recorded delivery fee means the business paid the courier, so the receipt says FREE and never shows the amount, no fee means "Paid by customer to courier", walk-in customers get no delivery line; voided sales keep their number and print with a VOID stamp; partially returned sales list returns, deduction kept, refund and net paid; when an old sale's lines do not sum to its recorded price an "Adjustment" line keeps the receipt adding up (61 of 1,949 sales on 2026-09-19). `sales.receipt_number` is a per-business running number assigned by the `assign_sale_receipt_number` BEFORE INSERT trigger (counter in `business_receipt_counters`, no gaps on rollback, never reused); older sales stay NULL and print their short id. Offline sales print a PROVISIONAL receipt from `receiptDraftStore`. Business header/footer come from `businesses.receipt_phone/address/page_name/footer` (Business settings). All user text is HTML-escaped.

**Profit preview before a sale** (`SaleMarginCard`, fed by pure `src/utils/saleMargin.ts`): shown under the order summary in Quick Checkout, the cart screen and the checkout confirmation. Customer pays = items after item and cart discounts; profit = customer pays − cost of goods − courier fee; margin = profit ÷ customer pays. It equals what the books record (`total_amount − COGS`), checked against every completed sale of Sep 2026. A line's `cost_per_unit` must be the cost of ONE SOLD UNIT: both add-to-cart paths multiply the base cost by the unit's conversion factor (a Box of 24 costs 24×), because that value is snapshotted onto the sale line and `calculate_cogs` prefers it. The Create Cart flow also sells a variant at the variant's price, not the base price.

**Fees & Discounts** (summary card on the Reports overview that opens `reports/fees-discounts`, which has its own presets and custom date range; `reportsService.getFeesAndDiscounts`; CSV in the export bundle and from the screen): courier fees absorbed plus cart and item discounts given, which are not expenses and are totalled nowhere else. `range` follows the selected dates, `rangeMonths` splits exactly those dates by month (partial months clipped, so rows add up to `range`), and `months` is the whole-month trend covering at least the last six months. Pure maths in `src/utils/feesAndDiscounts.ts` (cart discount is rebuilt from the cart rule when `sale_discount_amount` is null). Share is fees over full-price revenue (revenue plus discounts).

**Stock adjustments** (`inventory/stock-count`, `inventory/stock-adjustments`, "Adjust Stock" on product details): manual stock changes (damaged, expired, lost, sample, count, found, other) are an ledger in `stock_adjustments`, written only by SECURITY DEFINER functions (no insert/update/delete policies): `adjust_product_stock` (locks the product row, refuses to go below zero, snapshots `cost_per_unit`, updates `current_stock`, writes a `product_history` row), `post_stock_count` (one 'count' row per product whose counted quantity differs), and since migration `20260920162137` `update_stock_adjustment` (applies only the DIFFERENCE between the old and new quantity to the stock; keeps the original `unit_cost` snapshot) and `delete_stock_adjustment` (takes the quantity back out of the stock and removes the row, so the write-off leaves the statements). Both refuse a result below zero, are owner/admin only (`can_adjust_stock`), and copy the row before and after to `stock_adjustment_changes` (read-only for members) as well as writing `product_history`, so there is still a record of every change to stock. In the app, tapping a record in `inventory/stock-adjustments` or on the product detail page opens `StockAdjustmentModal` in edit mode (`editing` prop) with Save and Delete; staff cannot tap. Owner or admin only; staff can read. Reports: negative rows at cost are "Inventory write-offs" under COGS on the income statement (positive rows are "Found stock"), added back as non-cash on the cash flow statement, and shown on the Inventory Spend card. Adjustments never feed Product Insight demand. Client code: `src/services/stockAdjustments.ts`, pure maths in `src/utils/stockAdjustmentMath.ts`, `src/components/inventory/StockAdjustmentModal.tsx`. Never edit or delete a row; reverse with an opposite entry.

**Reports**: `reportsService` (~1,700 lines, 18 methods incl. `getIncomeStatement`, shared by the screen and CSV; `getCashFlowStatement` is indirect method with inventory purchases) feeds dashboard (`(tabs)/index`), `reports/*`, `top-products`, `top-customers`. COGS comes from RPC `calculate_cogs(business, from, to, currency)`.

**Subscription gating**: since 2026-09-22 the signed-in user's OWN plan comes from the RevenueCat SDK (`src/services/entitlementState.ts` derives tier/status/expiry from `CustomerInfo`, which the SDK caches on the device, so it is instant and offline-safe; `revenueCatService.getCustomerInfo` returns `null` when it cannot answer and the app keeps its last plan). `user_subscriptions` is a MIRROR kept for monitoring and for the server-side checks (sales trigger, business limit, RLS): the RevenueCat webhook writes it (`updated_by = 'webhook'`), and when the app sees the mirror disagree with the SDK it calls edge function `sync-subscription`, which re-verifies with RevenueCat's REST API (`REVENUECAT_SECRET_API_KEY`) and corrects the row (`updated_by = 'rc_sync'`, `last_validated_at`). That call runs only on a disagreement or right after a purchase/restore, once per distinct SDK state per minute, so it never sits on the normal path. On web/Expo Go, or before the SDK answers, the mirror drives the UI (`subscriptionSource` on the context says which). Team members see the OWNER's plan only through the mirror (`get_business_owner_subscription_tier`, `businesses.access_state`). Mirror → triggers set `businesses.access_state` (`active` / `read_only_sales` / `read_only` / `owner_disabled`). Client reads `get_full_subscription_state` RPC for business-level data (sales count, access), subscribes to realtime, and checks `utils/accessControl` before writes. Free tier: `FREE_TIER_LIMIT = 50` sales **per business** (changed 2026-08-24). Tiers: free / pro (1 business) / pro_plus (3) / max (unlimited). When tier drops, `mustChooseBusinesses` shows `DowngradePick` → edge fn `choose-businesses`.

**Team**: `teamMemberService` → RPCs `invite_user_to_business`, `change_user_business_role`, `remove_user_from_business`, `check_user_exists_by_email`. Roles are only `admin` and `staff`; ownership is `businesses.owner_user_id`.

**Auth lifecycle**: PKCE, session in SecureStore. `useSessionManager` signs out after 7 days inactivity. Deep links: `businessmanager://` scheme, `refer/[code]`, password reset.

**Notifications**: DB triggers insert into `notifications` → trigger `on_notification_insert_send_push` calls edge fn `send-push-notification` via pg_net → Expo push. Client realtime on `notifications:{userId}`.

**Referrals**: `referral_codes`, `referral_events`, `credit_ledger`, `user_credit_balances`; edge fns `referral-click` (public), `referral-claim`, `referral-status`; cron `expire_credits`.

---

## 5. Services (all Supabase access goes through these)

Every service is a plain object exported from `src/services/<name>.ts`. `src/services/index.ts` re-exports 16 of them; `accountService`, `businessService`, `currencyService`, `unitService`, `notificationService`, `pushNotificationService`, `referralService`, `productInsightService` and `instantCheckoutService` are not in the barrel and are imported by file path.

| Service | Key methods |
|---|---|
| `salesService` | completeSale, getSalesPaginated, getSaleWithDiscountBreakdown, voidSale, refundSale, returnItems, performSaleAction, getSalesWithCOGS, getDiscountAnalytics |
| `cartService` | createCart, getActiveCarts, addItemToCart, updateCartItem, applyItemDiscount, updateCartTotal, getCartWithDiscountDetails |
| `productService` | getProducts, createProduct, updateProduct, searchByBarcode, updateStock, updateCostPerUnit, recalculateProductCost, archive/unarchive |
| `inventoryService` / `batchImportService` | createImport, markImportAsArrived, getImportHistory, calculateFinalCost / createBatchImport, markBatchAsArrived |
| `unitService` | unit groups, units, product units, conversion factors, barcode per unit |
| `customerService` | CRUD, search, platform tracking, guest customer (`is_system_customer`) |
| `expenseService` | categories + expenses + report |
| `reportsService` | dashboard stats, charts, cash flow, income statement, COGS, loss analysis, sales history, creator stats |
| `subscriptionService` | getFullSubscriptionState, canCreateSale, canCreateBusiness, getSalesCountData, cache (2 min TTL, SecureStore) |
| `revenueCatService` | configure, getOfferings, purchasePackage, restorePurchases, getCurrentTier, presentCustomerCenter |
| `teamMemberService` | getTeamMembers, inviteUser, changeUserRole, removeUser |
| `businessService` / `accountService` | delete previews + deletion via edge fns, access state |
| `notificationService` / `pushNotificationService` | list/mark/prefs/realtime ; Expo push permissions, channels, badge |
| `currencyService` | CRUD, default, convertToDefault |
| `storageService` | product / business / profile image upload to buckets `product-images`, `business-images`, `profile-images` |
| `importService` / `exportService` | CSV in (sales, inventory) via `utils/*ImportProcessor` ; CSV out (sales, income, cash flow, products) |
| `referralService` | dashboard, code, balance, share, click/claim (edge fns) |
| `productInsightService` | settings + classification (fast/slow/dead stock) |
| `iapService` | legacy stub kept for interface compatibility |

Cross-cutting: `lib/network.retryWithBackoff` + `isNetworkError`, `lib/api-response.wrapApiCall`, `lib/errors` typed errors, `lib/dataCache` + `hooks/useCachedData` / `useApiQuery` (13 call sites).

---

## 6. Database

### Tables used by the client (27) and where they are defined

Created in `supabase/migrations/`: `audit_logs cart_items carts credit_ledger customers expense_categories expenses import_costs inventory_imports notification_preferences notifications processed_webhook_events product_insight_settings products profiles rate_limit_records reconciliation_log referral_codes referral_events referral_fraud_flags referral_reward_rules sale_actions sales security_events user_business_roles user_credit_balances user_profiles user_sales_count_history user_sales_counts user_subscriptions webhook_errors`

**Migration history is out of sync with the repo (verified against the live project `tevtbyffttmbttekhejk` on 2026-09-15).** The live database has 196 applied migrations; the repo has 192 files. They differ in both directions:

*Applied live, previously missing from the repo (10), recovered on 2026-09-15 with `supabase migration fetch`:* `20250619065109_soft_bonus` (the very first schema: `profiles`, `categories`, `products`, `sales`, `sale_items`, `expenses`; later migrations rename and reshape these), `20251120144418`, `20251120144433`, `20251124153916`, `20251206123147_fix_user_sales_counts_tracking_and_backfill`, `20260416003002_add_unique_barcode_index_per_business`, `20260416003130_create_currencies_table`, `20260416003150_add_currency_id_to_products_and_sales`, `20260416005927_create_unit_groups_units_product_unit_prices`, `20260422102636_make_barcodes_required_and_unique`. The fetched files arrived with literal `\n` escapes (CLI 2.75 quirk) and were unescaped; they keep their original doc comments. The CLI is linked now (`supabase/config.toml` has `project_id`), so `supabase migration list` shows local vs remote directly.

Semantic check of the other 186 files against what was applied: 181 identical, 4 differ only in comments, and `20251204101829_add_sales_subscription_validation` was applied reading from `user_business_sales_count` while the repo says `user_sales_counts` (superseded minutes later by `20251204122006`, so no live effect).

*In the repo, never applied live (6):* `20250927151813_sunny_spark` (storage buckets + policies; buckets exist anyway), `20251116172604_add_security_audit_logging` (`audit_logs`, `security_events`, `log_security_event`, `check_rate_limit` — none of these exist in production), and the four `20260107161553`–`20260107161620` files (`ensure_selected_business_ids_consistency` and selection-clearing variants of `set_all_businesses_active` / `set_read_only_businesses`; the live versions of those two functions come from later migrations). Do not assume code paths that reference audit logging or rate limiting are backed by tables.

All 22 RPCs the client calls exist live. Live extras with no client caller: `get_quantity_sold`, `get_user_sales_summary`, `auto_create_default_currency`, `handle_user_email_update`. Live cron jobs: `daily_sales_count_reconciliation`, `expire_referral_credits`. Extensions: `pg_cron`, `pg_net`.

### `src/types/database.ts` is stale
Regenerated on 2026-09-25 from the live project (`supabase gen types typescript --project-id tevtbyffttmbttekhejk > src/types/database.ts`), which took the type-check from about 1,030 errors to about 520, of which roughly 210 are unused-variable notices. jsonb RPC results (`get_full_subscription_state`) are typed `Json` and cast at the call site. Before that: it typed 20 tables and 8 functions. Missing tables: `currencies units unit_groups product_unit_prices referral_reward_rules` + both views. Missing RPCs: `calculate_cogs can_user_create_business can_user_create_sale check_business_selection_requirement check_user_exists_by_email complete_sale_atomic generate_referral_code get_business_owner_subscription_tier get_distinct_customer_count_for_sales get_full_subscription_state get_low_stock_products get_user_credit_balance get_user_owned_business_count get_user_subscription_tier get_user_total_sales_count`. Calls to these are untyped (`any`). Regenerate with `supabase gen types typescript` (or the Supabase MCP `generate_typescript_types`) before larger changes.

### RPCs the client calls (22)
`calculate_cogs` (3×) · `can_user_create_business` (2×) · `complete_sale_atomic` · `get_full_subscription_state` · `get_subscription_status` · `get_or_create_sales_count` · `increment_sales_count` · `get_user_total_sales_count` · `get_user_subscription_tier` · `get_business_owner_subscription_tier` · `get_user_owned_business_count` · `can_user_create_sale` · `check_business_selection_requirement` · `create_business` · `invite_user_to_business` · `change_user_business_role` · `remove_user_from_business` · `check_user_exists_by_email` · `get_low_stock_products` · `get_distinct_customer_count_for_sales` · `generate_referral_code` · `get_user_credit_balance`

### Most-rewritten DB functions (count of CREATE OR REPLACE across migrations)
`set_read_only_businesses` 9 · `can_user_create_sale` 9 · `activate_selected_businesses` 8 · `get_full_subscription_state` 7 · `get_business_owner_subscription_tier` 6 · `get_user_subscription_tier` 6 · `calculate_cogs` 5 · `get_subscription_status` 5. Always read the **latest** migration defining a function; earlier ones are superseded.

### Triggers to know about
`trigger_auto_increment_sales_count` (sales count), `check_sales_limit_trigger` (blocks inserts over free limit), `trg_enforce_business_creation_limit`, `update_product_cost_trigger`, `update_returned_amount_trigger`, `cart_items_discount_trigger`, `on_notification_insert_send_push`, `on_sale_created/voided_notification`, `on_subscription_change`, `trigger_handle_subscription_status_change`, `populate_*_creator_name_trigger` (denormalised names for anonymised users), `on_auth_user_created_profile`.

Cron (pg_cron): sales-count reconciliation, `expire_credits`, cleanup jobs. Push credentials are in Vault (migration 2026-03-05).

Security posture (2026-07 → 2026-09 hardening): RLS everywhere, `auth.uid()` guards inside SECURITY DEFINER functions, EXECUTE revoked from public on internal functions, entitlement tables service-role only. Adding a new RPC: grant EXECUTE explicitly and add the `auth.uid()` membership check.

---

## 7. Edge functions (`supabase/functions/`)

| Function | JWT | Purpose |
|---|---|---|
| `revenuecat-webhook` (992 lines) | no (secret header `REVENUECAT_WEBHOOK_SECRET`) | Maps every RC event to `user_subscriptions`, idempotent via `processed_webhook_events`, grace periods, business activation |
| `choose-businesses` | yes | User picks which businesses stay active after downgrade; validates against tier limits |
| `subscription-status`, `validate-subscription` | yes | Status read; Apple receipt validation (`APPLE_SHARED_SECRET`, `GOOGLE_SERVICE_ACCOUNT_KEY`), mostly legacy |
| `sync-subscription` | yes | Re-verifies the caller's plan with the RevenueCat REST API and corrects the `user_subscriptions` mirror (`updated_by='rc_sync'`); 503 `not_configured` until `REVENUECAT_SECRET_API_KEY` is set; pure logic in `derive.ts` with `deno test` |
| `delete-business`, `delete-auth-user` | yes | Owner-checked cascade deletion; account deletion with anonymisation |
| `send-push-notification` | yes | Called by DB trigger via pg_net; posts to Expo push API |
| `referral-click` | **no** | Public click tracking with device fingerprint; client address from `cf-connecting-ip` only |
| `referral-claim`, `referral-status` | yes | Attribution + dashboard |
| `iap-webhook` | no | Deprecated stub → 410 |

Deploy: `supabase functions deploy <name>`. `config.toml` has an empty project id; link locally before deploying.

---

## 8. Hotspots and heavy files

Largest screens/components (lines): `inventory/index` 2,158 · `sales/index` 2,051 · `reports/index` 1,473 · `sales/cart/[cartId]` 1,460 · `InstantCheckoutModal` 1,411 · `RevenueCatSubscriptionContext` 1,350 · `ProductForm` 1,090 · `ImportStockForm` 1,082 · `EditBatchForm` 1,074 · `SaleDetailsContent` 1,024 · `product-details` 1,015.

Most-changed in the last 200 commits: `sales/index` 16 · `inventory/index` 14 · `reports/sales-history` 13 · `AuthContext` 11 · `ImportStockForm` 10 · `EditBatchForm` 10 · `cart/[cartId]` 10 · dashboard 10.

Recent themes (Aug–Sep 2026): multi-currency (Aug 30), subscription audit + DB column fixes (Sep 3), per-business free limit (Aug 24), `DowngradePick` race fix (Sep 6, uat only).

---

## 9. Conventions and traps

- **Imports**: `@/src/...` alias (`@/*` → repo root). Services are objects, not classes; call as `salesService.method()`.
- **Business scoping**: every query filters by `business_id`; use `currentBusiness.id` from `useAuth`, and validate with `utils/businessAccessGuard` when data may come from a notification or deep link.
- **Access checks before writes**: `accessControl.canAccessFeature(feature, userId, businessId)`; the DB trigger will reject anyway, but the UI should pre-check to show the paywall.
- **Dark mode**: no theme tokens. Add `isDark ?` ternaries matching neighbouring code; palette is Tailwind-ish greys (`#374151`, `#4b5563`, `#9ca3af`, `#e5e7eb`) and brand blue `#2563eb`.
- **i18n**: add keys to all three JSON files; `km` and `zh` are each 14 keys behind `en` already. Use `useTranslation` from `@/src/locales`, not from react-i18next directly.
- **Console logging**: `babel-plugin-transform-remove-console` strips `console.log` in production; `warn`/`error` survive. Code is verbose with `console.log`; that's expected.
- **Caching**: subscription status cached 2 min in SecureStore; clear with `subscriptionService.clearSubscriptionCache()` after any tier-changing action.
- **Realtime channel names** must be unique per user/business (see RevenueCat context) and cleaned up on unmount.
- **Types**: `database.ts` is hand-edited and stale (§6). Don't trust it for the newer tables.
- **Docs in repo root** (`REVENUECAT_*.md`, `WEBHOOK_SETUP.md`, etc.) describe intent at the time of writing; the migrations and code win when they disagree.
- **`.bolt/`** and `InstantCheckoutModal.tsx.patch_marker` are template leftovers; safe to ignore.
- **Type check is red on the baseline** (measured 2026-09-15 on `uat`): 1,090 errors, 198 in `app/`, 814 in `src/`, 78 in `supabase/functions/`. Breakdown: 468 × TS2339 "property does not exist on type 'never'" (Supabase query results collapse to `never` because the table or column is absent from `database.ts`), 227 × TS6133 unused imports, 93 × TS2345, 55 × TS7006 implicit any, 36 × TS18047 possible null. The Deno errors are because `tsconfig.include` sweeps `supabase/functions`; add it to `exclude`. Regenerating `database.ts` should remove most of the 468. Until then, judge a change by `git diff`-scoped `tsc` output, not by the total.
- **Local iOS build after adding a native module**: `ios/` is generated (`npx expo run:ios` prebuilds it). If you run `pod install` by hand, the prebuilt React core ends up as the *release* flavour and a Debug build fails to link with undefined `facebook::react::Sealable` / `getDebugProps` symbols from `libExpoModulesCore.a`. Fix from `ios/Pods`: `echo Release > React-Core-prebuilt/.last_build_configuration && node ../../node_modules/react-native/scripts/replace-rncore-version.js -c Debug -r 0.81.4 -p "$PWD"`, then rebuild. Cleaning DerivedData does not help.
- **Lint**: `npm run lint`. No test runner.
