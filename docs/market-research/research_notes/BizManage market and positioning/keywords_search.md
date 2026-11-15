# Keywords and search language of small shop owners (POS, inventory, sales and profit tracking)

Collected 15 Nov 2026. This builds on the App Store audit in `docs/aso/aso-plan-2026-11-09.md` (24 App Store terms, 6 storefronts, App Store autocomplete only) and does not repeat it. New here: Google Play autocomplete and Play search results, Google Search autocomplete in 8 country settings, YouTube autocomplete and YouTube result titles with view counts, and local-language terms (Khmer, Vietnamese, Thai, Indonesian, Malay, Filipino/Taglish, Chinese).

**Method and how much to trust it.** No paid tool was used, so there are no search volumes. Demand proxies are: (a) whether a phrase shows up in autocomplete at all, (b) its position (1 = most common completion), (c) how many country settings it shows in, (d) install bands of the apps that rank on Play, and (e) view counts on YouTube results. Endpoints used:
- Google Suggest: `https://suggestqueries.google.com/complete/search?client=firefox&q=…&hl=…&gl=…` (Google web), and the same with `ds=yt` (YouTube).
- Google Play suggest: the Play web app's internal endpoint `https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc` (the old `market.android.com/suggest/SuggRequest` endpoint now returns 404).
- Google Play search: `https://play.google.com/store/search?q=…&c=apps&gl=KH&hl=en`, then each app's details page for its install band.
- YouTube search: `https://www.youtube.com/results?search_query=…` (titles, views, age).

**Caveats.** All requests came from one machine and IP. Play autocomplete was the same in all 7 `gl` settings for English seeds, so Play suggestions follow language and IP, not the `gl` value; country differences on Play are not measured. Google Suggest differed by `gl` only at the edges (country names, e.g. "…philippines", "…malaysia"). TikTok could not be read: `tiktok.com/discover/...` pages redirect to the home page or return "Please wait..." to automated requests, and web search does not index them. Raw data for every claim below is in `keywords_search_raw.json` in this folder (keys are `kind|country|language|seed`). Positions are written like `KH#3` (country, position) or `all 1.0` (every country tested, average position).

## 1. What Google Play autocomplete shows for POS, inventory, stock, cashier, sales, profit, small business, shop, barcode and bookkeeping

### Takeaway
On Play, the words that complete into real shop-app intent are `inventory`, `stock`, `pos app`, `sales tracker`, `sales and inventory`, `daily sales`, `barcode inventory` and `stock management`. Single words like `pos`, `stock`, `sales`, `profit`, `shop`, `small business` and `cashier` complete into unrelated things (games, banks, stock trading, Shopee, Salesforce, loans). The strongest pattern across seeds is the modifier "free" and "offline": `pos app free offline`, `inventory app offline`, `sales and inventory app offline`, `point of sale apps offline free`.

### Cited Findings
- `pos` alone completes to unrelated apps: Poseidon, Post Bank, Posera, Pos Malaysia, POSB, pos365 (VN), Poshmark (US). `pos app` completes to `pos app offline point of sale`, `pos app free`, `pos app cloud`, `pos app free offline` in all 7 country settings — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc), raw `play|KH|en|pos app`.
- `point of sale` completes to `point of sale app`, `point of sale apps offline`, `point of sale apps offline free`, `point of sale app free` in all settings — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `inventory` completes to `inventory management`, `inventory app`, `inventory and sales tracker` (KH, PH#1, TH, ID, VN), `inventory stock tracker` and `inventory stock manager free` (MY), `inventory management offline` and `inventory offline free zobaze` (PH) — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `inventory app` completes to `inventory app free`, `inventory app offline`, `inventory app with pictures` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `stock` alone is dominated by Stockbit, Stockfish, StockX and stock-market apps; only KH shows `stock and inventory` (#5). `stock app` completes to `stock app for shop` (#2 everywhere) and `stock app for shop free`. `stock management` completes to `stock management app`, `stock management app free`, `stock management system`, `stock management inventory`. `stock in stock out` completes to `stock in stock out app` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `cashier` is games first (`cashier game`, `cashier simulator`, `cashier games offline`); `cashier app` completes to `cashier app for business` (#2) and `cashier app free`, also `cashier app offline pos` (PH) — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `sales` alone is Salesforce in every setting; PH also shows `sales and inventory app` and `sales tracker`, MY shows `salesplay pos`. `sales tracker` completes to `sales tracker app`, `sales tracker app free`, `inventory and sales tracker`. `sales and inventory` completes to `sales and inventory app`, `sales and inventory app offline`, `sales and inventory management`, `free sales and inventory app`. `sales record` completes to `sales record app offline` (#1), `sales record book` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `daily sales` completes to `daily sales record` (#1), `daily sales record app`, `daily sales profit and inventory`, `daily sales record offline`: the names of two competitor apps are now the completions — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `profit` alone is Profit AI, Profitmart, "profit karo make money online", workout apps; business intent only as `profit tracker` (PH, US), `profit calculator` (MY), `profit and loss account app` (MY). `profit calculator` completes to `profit calculator app`, `profit calculator forex`, `crypto profit calculator`. `profit and loss` completes to `profit and loss account app`, `profit and loss calendar` (a trading journal), `profit and loss app` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `income statement` completes to `income statement app` (#1 in 6 of 7), `income statement and balance sheet` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `small business` on Play completes to loans (`small business loan`, `small business tradofina`) and games outside the US; the US shows `small business apps` and `small business apps free` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `shop management` completes to `shop management game` (#1 in KH, PH, US), `shop management app`, `shop management system`, `shop management app free`; `store management` is led by `store management simulator`; `shop` alone is Shopee in every SEA setting — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `barcode` completes to `barcode scanner`, `barcode generator`, `barcode to sheet`; `barcode inventory` completes to `barcode inventory app`, `barcode inventory management`, `barcode inventory scanner`, `barcode inventory stock taking` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `bookkeeping` completes to `bookkeeping app`, `bookkeeping learning app`, `bookkeeping app for small business`, `bookkeeping app free`; `expense tracker` to `expense tracker app`, `expense tracker free`, `expense tracker offline` — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- `business manager` completes to `business manager for facebook` and `business manager game` (the app's brand word collides with Meta Business Manager on Play) — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- Vertical seeds: `grocery pos` completes to `grocery pos sales and inventory`, `pos for grocery store`; `pharmacy pos` to `pharmacy pos app`, `pharmacy pos software`; `cafe pos` to `cafe pos system free`; `restaurant pos` to `restaurant pos system for android`; `retail pos` to `retail pos billing and inventory`, `retail pos system free`; `minimart` is games only (`minimart game`, `minimart simulator`) — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- Who ranks on Play for `pos` (KH, English): Loyverse POS (1M+ installs), Shopify POS (1M+), GrabMerchant (10M+), Goe POS (10K+), Square (10M+), Kyte (1M+), MyLekha POS (5K+), Zobaze (1M+) — [Play search "pos"](https://play.google.com/store/search?q=pos&c=apps&gl=KH&hl=en), installs from each [app's details page](https://play.google.com/store/apps/details?id=com.loyverse.sale).
- Who ranks for `inventory` and `sales and inventory app`: Zoho Inventory (1M+), StoDo Stock & Inventory Simple (1M+), Mobile Inventory (500K+), zaico (100K+), Daily Sales Profit & Inventory (100K+), Daily Sales Record (500K+), Zobaze (1M+), Kyte (1M+), Kelola Stock and Inventory Tracker (100K+) — [Play search "sales and inventory app"](https://play.google.com/store/search?q=sales+and+inventory+app&c=apps&gl=KH&hl=en).
- Who ranks for `daily sales record`: Daily Sales Record (500K+), Daily Sales Profit & Inventory (100K+), Record Book (1M+), then apps with 5+ to 1K+ installs from position 4 — [Play search "daily sales record"](https://play.google.com/store/search?q=daily+sales+record&c=apps&gl=KH&hl=en).
- Who ranks for `profit tracker`: Profit Tracker - Trade Journal (500+), Profit Tracker AI (100+), Profit (trading, 1M+), ProFit gym app (100K+), Daily Sales Profit & Inventory (100K+), P&L Calendar (50K+): no strong shop app owns it — [Play search "profit tracker"](https://play.google.com/store/search?q=profit+tracker&c=apps&gl=KH&hl=en).
- `income statement app` returns personal money apps: Income Expense (1M+), Cash Book (10M+), Money Manager (10M+), Xero (1M+): no shop POS ranks — [Play search "income statement app"](https://play.google.com/store/search?q=income+statement+app&c=apps&gl=KH&hl=en).

### Inferences
- Play needs the two-word forms in the title and short description: `POS app`, `inventory app`, `sales tracker`, `stock app for shop`, `sales and inventory`. The single words carry no shop intent on Play, which matches the App Store finding for `sales` and `shop`.
- "free" and "offline" are the two most frequent modifiers on Play. BizManage is a cloud app with a 50-sale free tier; using "offline" in metadata would be misleading, and "free" is only true for the first 50 sales. Expect these searchers to be price-sensitive and to bounce on a paywall.
- `inventory and sales tracker` and `daily sales profit and inventory` show owners searching for the sales + stock + profit bundle that BizManage sells; the incumbents there have 100K to 500K installs, not millions, so this cluster is easier than `pos` (Loyverse, Square, Grab, Shopify).
- `profit tracker` and `income statement app` on Play are owned by trading and personal finance apps with weak shop relevance: an opening for "profit" positioning, but the searchers are mixed.
- Avoid leading with "business manager" on Play: it completes to Facebook Business Manager.

### Gaps
- No Play search-volume data; the Play Console "Store performance > search terms" report will give real terms once a listing exists.
- Play suggestions per country could not be separated (same output for every `gl` from one IP).
- Rating counts were not reliably parsed from Play pages; install bands were.

## 2. How owners phrase the problem on Google Search (gl = kh, ph, my, th, vn, id, sg, us)

### Takeaway
Problem-aware searches are phrased around "how to track inventory for small business", "how to record daily sales (in a shop)", "how to calculate profit (margin / for my business)", "app to track sales and expenses", and "stop staff stealing from till / stock". Excel and Google Sheets appear in almost every problem completion, so the real competitor at this stage is a spreadsheet. Differentiator phrasings (landed cost per unit, multi-unit, dual currency, staff login, profit report) mostly have no autocomplete at all: owners do not search with those words.

### Cited Findings
- `how to track inventory` completes to `in excel` (#2), `on shopify`, `for small business` (avg #3.9), `in quickbooks`, `in square`, `in google sheets`, in all 8 settings — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20track%20inventory&hl=en&gl=kh).
- `how to track inventory for small` completes to `…business`, `…business in excel`, `best way to track inventory for small business`, `how to keep track of inventory for small business free`, `…free template` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20track%20inventory%20for%20small&hl=en&gl=ph).
- `how to record daily sales` completes to `in a shop` (#1.6 avg), `for small business`, `in a book`, `manually`, `and expenses in excel`, `in quickbooks online` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20record%20daily%20sales&hl=en&gl=kh).
- `how to calculate profit` completes mainly to `margin` (#1.2), `percentage`, `and loss`, `margin for a product`, `on sales` (KH, PH, TH, VN), `in business` (PH); `how to calculate profit for my` completes to `business` (#1) — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20calculate%20profit&hl=en&gl=kh).
- `how to know my shop profit` completes to `how to see my tiktok shop earnings`, `how to calculate shop profit`, `how much profit does a shop make`, `how to know profit in business` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20know%20my%20shop%20profit&hl=en&gl=kh).
- `app to track sales and` completes to `expenses` (#1), `app to track sales on items` (#2) — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=app%20to%20track%20sales%20and&hl=en&gl=ph).
- `sales and inventory app` completes to `free`, `for android`, `management app`, `daily sales profit and inventory app`, `best app for sales and inventory` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=sales%20and%20inventory%20app&hl=en&gl=ph).
- `inventory app for` completes to `small business` (#1.2), `small business free`, `android`, `resellers`, `restaurants`, and `sari sari store` (PH#5, #8 elsewhere) — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=inventory%20app%20for&hl=en&gl=ph).
- `pos system for small` completes to `business`, `business free`, `restaurant`, `retail business`, `business with inventory management`, and country forms `…philippines` (PH#3), `…singapore` (SG#1), `…malaysia` (MY#2) — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=pos%20system%20for%20small&hl=en&gl=sg).
- `free pos app` completes to `for android` (#2), `for small business`, `for iphone`, `philippines` (#5), `for restaurant`; `best free pos app` completes to `for android` (#1), `for ios`, `for ipad`, `philippines`, `for small business` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=free%20pos%20app&hl=en&gl=ph).
- `how to stop staff stealing` completes to `from till` (#1) and `stock` (#2) — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20stop%20staff%20stealing&hl=en&gl=kh).
- `how to manage stock in` completes to `inventory`, `excel`, `pharmacy` (#3), `business`, `retail business` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20manage%20stock%20in&hl=en&gl=kh).
- `landed cost` completes to `meaning`, `formula`, `calculation`, `computation` (PH#3), `calculator` (US#4), `vs cogs` (US#8), `adalah` (ID#1), `là gì` (VN#1); `how to calculate landed cost` completes to `of imported goods`, `…from china` (#5), `per unit` (#4), `for multiple items` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=how%20to%20calculate%20landed%20cost&hl=en&gl=ph).
- `profit after cost of goods` completes only to accounting-class phrases (`profit after cost of goods sold`, quiz questions) — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=profit%20after%20cost%20of%20goods&hl=en&gl=kh).
- No autocomplete at all (in any of 8 settings) for: `inventory app for minimart`, `pos riel dollar`, `why my shop no profit`, `pos with multiple units`, `employee theft small shop`, `pos app with staff`, `cost per unit including shipping`, `buy in bulk sell per piece`, `sell by piece and by box`, `inventory app with units`, `pack and piece inventory`, `pos app with expenses`, `pos with profit report`, `app that shows profit`, `online order link for shop` — raw `g|…` keys in `keywords_search_raw.json`, e.g. [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=inventory%20app%20for%20minimart&hl=en&gl=kh).
- Weak but present: `multi unit inventory` (only unrelated completions), `inventory unit of measure` (Zoho, Odoo, SOS completions), `multi branch pos` / `multi branch pos system`, `pos system for multiple stores`, `multi currency pos` / `pos dual currency`, `pos staff login`, `minimart pos` / `minimart pos system`, `grocery store pos system with scale`, `shop owner app` (#1), `small shop app` (#1), `store owner app` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=multi%20branch%20pos&hl=en&gl=ph).
- Cambodia-specific English: `pos cambodia` completes to `cambodia pos system`, `point of sale cambodia`, `cloud pos cambodia`, `pos machine cambodia`; `pos system in cambodia` to `pos software in cambodia`, `pos system price in cambodia`, `best pos system in cambodia`; `accounting software cambodia` to `best accounting software in cambodia`; `inventory cambodia` and `stock management cambodia` have no shop completions — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=pos%20system%20in%20cambodia&hl=en&gl=kh).
- `riel and dollar` and `exchange rate riel` complete only to currency conversion queries — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=riel%20and%20dollar&hl=en&gl=kh).

### Inferences
- The problem words owners use are "track", "record", "manage", "calculate profit (margin)", and "daily sales". The differentiator words in BizManage's own copy (landed cost, multi-unit, dual currency, income statement) are rarely typed by owners. Keep them as proof points in descriptions and captions, and lead search copy with the owners' words: "track stock", "daily sales", "profit", "sales and expenses".
- `how to calculate profit margin for a product` and `how to calculate landed cost per unit / of imported goods from china` are the closest high-demand problem phrases to BizManage's cost-per-unit-with-shipping feature: good blog/landing-page and video topics rather than store keywords.
- "Excel" and "google sheets" in completions mean spreadsheets are the default tool; copy that compares against "your notebook or Excel" speaks to the actual alternative.
- Staff theft is a phrased problem ("stop staff stealing from till / stock"), even though "pos app with staff" is not searched. Content about "who made each sale" and "stock count write-offs" fits this problem.
- "best pos system in cambodia" and "pos system price in cambodia" show a local buyer search that is answered today by B2B POS vendors (hardware + software), a content gap a phone-first app could target with a landing page.

### Gaps
- No search-volume numbers (Google Keyword Planner needs an Ads account; Search Console data will exist only once a site ranks).
- Country variation is muted because all requests came from one IP.

## 3. Local-language terms (Khmer, Vietnamese, Thai, Indonesian, Malay, Filipino, Chinese)

### Takeaway
Vietnamese, Thai and Indonesian have deep, product-specific autocomplete (phần mềm bán hàng, โปรแกรมขายหน้าร้าน, aplikasi kasir, aplikasi stok barang), each with local category leaders. Khmer has almost no autocomplete for formal app phrases; Khmer owners code-mix English ("app គ្រប់គ្រងស្តុក", "របៀបគ្រប់គ្រង stock", "app កត់ត្រា ចំណូល ចំណាយ"), and Play shows no Khmer-language stock or POS app for Khmer queries. Filipino owners search in English plus "sari sari store". Chinese search centres on 进销存 and 收银系统.

### Cited Findings
**Khmer (hl=km, gl=kh)**
- No Google, YouTube or Play autocomplete for: កម្មវិធីលក់ (sales app), គ្រប់គ្រងស្តុក / គ្រប់គ្រងស្ដុក (manage stock, both spellings), កម្មវិធីគ្រប់គ្រងស្តុក (stock management app), ទូលក់ (sales counter), ប្រព័ន្ធលក់ (sales system), កម្មវិធីគិតលុយ (cashier app), ម៉ាស៊ីនគិតលុយ (cash register), ហាងលក់ទំនិញ (shop), មីនីម៉ាត (minimart), កម្មវិធីគណនេយ្យ (accounting app), ប្រាក់ចំណេញ (profit), ប្រព័ន្ធ pos, pos ខ្មែរ — raw `g|kh|km|…`, `yt|kh|km|…`, `play|KH|km|…`; e.g. [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=%E1%9E%80%E1%9E%98%E1%9F%92%E1%9E%98%E1%9E%9C%E1%9E%B7%E1%9E%92%E1%9E%B8%E1%9E%9B%E1%9E%80%E1%9F%8B&hl=km&gl=kh).
- Code-mixed forms do complete: YouTube `app គ្រប់គ្រង` → `app គ្រប់គ្រងស្តុក` (stock management app); YouTube `របៀបគ្រប់គ្រង` (how to manage) → `របៀបគ្រប់គ្រង stock`; Google `app កត់ត្រា` (recording app) → `app កត់ត្រា ចំណូល ចំណាយ` (income-expense recording app); YouTube `ចំណូលចំណាយ` (income expense) → `ចំណូលចំណាយ excel`, `app ចំណូលចំណាយ`; YouTube `ស្តុក` → `ស្តុក excel`; Google `app លក់` (selling app) → `app លក់ អីវ៉ាន់`, `app លក់ ទំនិញ នៅ ខ្មែរ` (mostly marketplace intent) — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=app%20%E1%9E%82%E1%9F%92%E1%9E%9A%E1%9E%94%E1%9F%8B%E1%9E%82%E1%9F%92%E1%9E%9A%E1%9E%84&hl=km&gl=kh).
- The Khmer queries with the most autocomplete are money-making apps: `app រកលុយ` (earn-money app) completes to `app រកលុយខ្មែរ 2026` etc. on Google, YouTube and Play — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=app%20%E1%9E%9A%E1%9E%80%E1%9E%9B%E1%9E%BB%E1%9E%99&hl=km&gl=kh).
- Play search for គ្រប់គ្រងស្តុក returns only English-titled apps (StoDo 1M+, Simple Stock Manager 100K+, Offline Shop 50K+): no Khmer-language stock app ranks; កម្មវិធីលក់ returns AliExpress, Lazada, Temu — [Play search](https://play.google.com/store/search?q=%E1%9E%82%E1%9F%92%E1%9E%9A%E1%9E%94%E1%9F%8B%E1%9E%82%E1%9F%92%E1%9E%9A%E1%9E%84%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%BB%E1%9E%80&c=apps&gl=KH&hl=en).
- Play search `pos khmer` shows a local app, Khmernokor POS, at #4 with 100+ installs and 8 ratings — [Play search](https://play.google.com/store/search?q=pos+khmer&c=apps&gl=KH&hl=en).
- YouTube Khmer results for `app គ្រប់គ្រងស្តុក`: "កម្មវិធីទូរស័ព្ទកាន់ស្តុកអីវ៉ាន់ គ្រប់គ្រងចំនូលចំនាយ បុគ្គលិកងាយៗ - Free ទៀត" (phone app to hold stock, manage income/expense and staff easily, also free) 16,067 views, 3 years old — [YouTube](https://www.youtube.com/watch?v=dXzo9CCaJ_w); "ប្រព័ន្ធគ្រប់គ្រងការលក់ ប្រើដោយគិតថ្លៃ!" (sales management system, use free) 18,158 views — [YouTube](https://www.youtube.com/watch?v=X2C06X4cCpQ); an Excel stock-manager series (រៀនបង្កើតកម្មវិធីគ្រប់គ្រងឃ្លាំងស្តុកទំនិញ) 5,137 views — [YouTube](https://www.youtube.com/watch?v=u7seFCKE31I); vendor channels (RTO TECH "APP គ្រប់គ្រងស្តុក" 263 views, Sesan App 11 to 14 views) — [YouTube](https://www.youtube.com/watch?v=E28zrd-Z2gY).

**Vietnamese (hl=vi, gl=vn)**
- `phần mềm bán hàng` (sales software) completes to `miễn phí` (free), `sapo`, `misa`, `offline free`, `kiotviet`, `ipos`, `viettel`; `app quản lý bán hàng` (sales management app) to `miễn phí`, `miễn phí trên điện thoại` (free on phone), `offline miễn phí`; `quản lý kho` (warehouse/stock management) to `quản lý kho hàng`, `bằng excel`, `bằng google sheet`, `miễn phí`, `offline`; `sổ bán hàng` (sales book) to `sổ bán hàng hộ kinh doanh` (household business), `vnpt`; `phần mềm tính tiền` (billing software) to `quán ăn`, `quán cafe`, `trên điện thoại` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=ph%E1%BA%A7n%20m%E1%BB%81m%20b%C3%A1n%20h%C3%A0ng&hl=vi&gl=vn).
- Play search `phần mềm bán hàng`: Sapo (100K+), KiotViet Café (500K+), KiotViet (500K+), Loyverse, then English-titled apps — [Play search](https://play.google.com/store/search?q=ph%E1%BA%A7n+m%E1%BB%81m+b%C3%A1n+h%C3%A0ng&c=apps&gl=KH&hl=en).
- YouTube: "Top 3 ứng dụng quản lý bán hàng miễn phí thật sự trên điện thoại" 9,221 views — [YouTube](https://www.youtube.com/watch?v=J2H9VKukDf8); "Phần Mềm Bán Hàng Miễn Phí Vĩnh Viễn" (free forever) 42,236 views — [YouTube](https://www.youtube.com/watch?v=PP0C39blFIM).

**Thai (hl=th, gl=th)**
- `โปรแกรมขายของ` (program for selling) completes to `หน้าร้าน` (storefront), `หน้าร้าน ฟรี` (free), `ชำ` (grocery), `หน้าร้าน บาร์โค้ด` (barcode); `โปรแกรมขายหน้าร้าน` completes to `ฟรี`, `ปลีกส่ง` (retail and wholesale), `pos`, `ไม่มี รายเดือน` (no monthly fee), `excel`; `โปรแกรม pos` to `ฟรี`, `ร้านค้าปลีก ตัวไหนดี` (which is good for retail); `แอพคิดเงิน` (cashier app) to `แอพคิดเงินร้านค้า` (for shops); `แอพ บันทึกรายรับรายจ่ายร้านค้าฟรี` (free shop income-expense app) appears; `แอพจัดการสต็อก` has no completions; Play completes `โปรแกรมสต๊อกสินค้า` and `…ฟรี` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=%E0%B9%82%E0%B8%9B%E0%B8%A3%E0%B9%81%E0%B8%81%E0%B8%A3%E0%B8%A1%E0%B8%82%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99&hl=th&gl=th).
- `แอพขายของ` / `แอปขายของ` (selling app) mean online/marketplace selling (มือสอง second-hand, ออนไลน์, ไลน์แมน LINE MAN), not POS — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=%E0%B9%81%E0%B8%AD%E0%B8%9E%E0%B8%82%E0%B8%B2%E0%B8%A2%E0%B8%82%E0%B8%AD%E0%B8%87&hl=th&gl=th).
- YouTube: Quick POS "ซื้อขาด ไม่เสียค่าใช้จ่าย รายเดือน-รายปี" (buy outright, no monthly or yearly fees) 289,449 views — [YouTube](https://www.youtube.com/watch?v=gXbL7CncPd8); "POS เจ๋งจัดการร้านไร้สาย ใช้ฟรี" 147,845 views — [YouTube](https://www.youtube.com/watch?v=xMP9yEvrE0M).

**Indonesian (hl=id, gl=id) and Malay (hl=ms, gl=my)**
- `aplikasi kasir` (cashier app) completes to `gratis` (free), `android gratis`, `pintar` (Kasir Pintar), `pos`; `aplikasi kasir gratis` to `selamanya` (forever), `offline`, `umkm`; `aplikasi stok barang` (stock app) to `gratis`, `dan penjualan` (and sales), `keluar masuk` (in and out), `toko offline`; `aplikasi pencatatan` to `keuangan usaha` (business finance), `penjualan gratis`; `cara menghitung keuntungan` (how to calculate profit) to `penjualan` (sales), `jualan makanan`, `dari modal` (from capital); `aplikasi untuk toko` to `sembako` (grocery staples), `bangunan` (hardware store), `kelontong`, `grosir` (wholesale); `aplikasi pembukuan` to `usaha`, `umkm gratis`, `warung sembako` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=aplikasi%20kasir&hl=id&gl=id); Play forms in raw `play|ID|id|…`.
- Play search `aplikasi kasir`: Kasir Pintar (1M+), Kasir Pintar Pro (1M+), Moka POS (1M+), Qasir (1M+) — [Play search](https://play.google.com/store/search?q=aplikasi+kasir&c=apps&gl=KH&hl=en).
- Play `kasir` completes to `kasir pintar`, `kasir warung`, `kasir go` even with hl=en in every setting — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- YouTube: "Aplikasi Kasir Android Offline Gratis Terbaik untuk Pemula!" 42,909 views (7 months) — [YouTube](https://www.youtube.com/watch?v=7KpIl5N2X8w); "UMKM Wajib Tahu! Inilah 7 Rekomendasi Aplikasi Kasir Terbaik" 135,535 views — [YouTube](https://www.youtube.com/watch?v=z6nFlNYSylg).
- Malay: `sistem pos` completes to `kedai runcit` (grocery shop), `cashier`, `restoran`, `free`, `terbaik`; `pos kedai runcit` and `sistem pos kedai runcit` exist; `aplikasi stok` mirrors Indonesian completions — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=sistem%20pos&hl=ms&gl=my).

**Filipino / Taglish (hl=tl, gl=ph)**
- `sari sari store app` completes to `inventory app`, `inventory app free download`, `app free download`; `pos for sari sari` to `store`, `store free`, `best pos for sari sari store`; `inventory sari sari` to `store products list`, `template for sari sari store`, `inventory ng sari sari store`; `paano mag inventory` (how to do inventory) to `sa tindahan` (in the store), `sa sari sari store`, `ng paninda` (of goods); `listahan ng utang app` (credit list app) exists; `app para sa tindahan` has no completions — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=paano%20mag%20inventory&hl=tl&gl=ph).
- YouTube `pos philippines` completes to `loyverse pos philippines`, `qashier pos philippines`, `zobaze pos philippines` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=pos%20philippines&hl=tl&gl=ph).

**Chinese (hl=zh-CN, gl=kh and my)**
- `进销存` (purchase-sales-stock) completes to `进销存系统`, `进销存系统推荐` (recommended), `进销存软体`, `进销存明细表excel下载`; `进销存app` to `进销存app推荐`, `进销存app ios`; `收银系统` (cashier system) to `免费` (free), `app`, `零售` (retail), `餐饮` (F&B); `库存管理` to `库存管理app免费`; `记账app` (bookkeeping app) to `记账app马来西亚`; `小店收银` (small shop cashier) has no completions — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=%E8%BF%9B%E9%94%80%E5%AD%98&hl=zh-CN&gl=kh).
- YouTube Chinese POS videos are small: GoodCashier tutorials 7 to 45 views; Pospal demo 5,160 views (6 years) — [YouTube](https://www.youtube.com/watch?v=KWYlrR_zWxc).

### Inferences
- Khmer is a low-demand, zero-competition surface: few people type Khmer phrases for apps, and no Khmer-titled app ranks for them on Play. Cheap to own (a Khmer localization with ស្តុក, លក់, ចំណូលចំណាយ, ប្រាក់ចំណេញ in the title/description), but it will not bring much volume alone. The bigger Khmer lever is video: Khmer-language YouTube/TikTok explainers about "app គ្រប់គ្រងស្តុក" get 16K to 18K views with little competition.
- Khmer owners mix English nouns into Khmer: "stock", "app", "excel", "pos". Khmer metadata and captions should keep those English words (e.g. "app គ្រប់គ្រង stock") rather than translate them.
- The most common Khmer shop-money phrase is ចំណូលចំណាយ (income and expenses), not ប្រាក់ចំណេញ (profit) or គណនេយ្យ (accounting). Use it as the Khmer hook.
- Vietnamese, Thai and Indonesian markets are owned by local leaders (KiotViet, Sapo, MISA; Quick POS, POSPOS; Kasir Pintar, Moka, Qasir with 1M+ installs each). Winning there needs a full localization and is outside the current three languages.
- "free" (miễn phí, ฟรี, gratis, 免费) and "no monthly fee" (ไม่มี รายเดือน, selamanya) recur in every language: price is the dominant search filter across the region.
- Thai and Indonesian completions name shop types (ร้านชำ grocery, ปลีกส่ง retail-wholesale, sembako, bangunan, kelontong, grosir, warung): the vertical words to use in local copy if those languages are ever added.

### Gaps
- Khmer has two spellings of "stock" (ស្តុក with coeng ta, ស្ដុក with coeng da); neither had shop autocomplete, so which one owners type is unknown.
- Chinese for Cambodia: no data on whether Chinese-Cambodian shop owners search in Simplified or Traditional Chinese.
- No Tagalog-only query showed demand; Filipino demand is English plus "sari sari store".

## 4. Competitor and alternative searches

### Takeaway
"Alternative" searches exist for every major competitor tested: Loyverse, Square, Vyapar, Kyte, Zobaze, Peddlr, StoreHub, KiotViet, Zoho Inventory, Sortly, Shopify POS. Loyverse is the comparison anchor in SEA ("loyverse vs peddlr / zobaze / kyte / utak / storehub"), and creators publish "X vs Loyverse" videos with 10K+ views. Only Loyverse has region-scale autocomplete depth; the rest show 1 to 3 completions.

### Cited Findings
- `loyverse alternative` completes to `free` (#2), `reddit`, `loyverse pos alternative`, `open source alternative`; `alternative to loyverse` → `…pos` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=loyverse%20alternative&hl=en&gl=ph).
- `loyverse vs` completes to `peddlr` (#1), `square`, `zobaze`, `kyte`, `utak pos`, `odoo`, `storehub`, `aronium`, `lightspeed` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=loyverse%20vs&hl=en&gl=ph).
- `vyapar alternative` has 10 completions including `free`, `app`, `2026`, `india`, `best vyapar alternative 2026` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=vyapar%20alternative&hl=en&gl=kh).
- `square pos alternative(s)` → `australia`, `square point of sale alternative`, `square register alternatives`; `square alternatives for small business` — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=square%20alternative&hl=en&gl=ph).
- `kyte pos alternative`, `kyte app alternative`, `zobaze pos alternative`, `peddlr app alternative`, `storehub alternative`, `kiotviet alternative`, `zoho inventory alternatives free`, `sortly alternative free`, `apps like sortly`, `shopify pos alternatives` all exist; `utak pos alternative` has none — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=kyte%20alternative&hl=en&gl=ph).
- Play `loyverse` completes to `loyverse pos`, `loyverse dashboard`, `loyverse pos printer`, `loyverse cds`, `loyverse kds`, and `loyverse pos kasir online` (TH, ID) — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).
- YouTube `loyverse` completes to `loyverse pos tutorial`, `loyverse pos review`, `loyverse inventory management`, `loyverse pos free`, `loyverse pos tutorial tagalog` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=loyverse&hl=en&gl=us).
- Comparison videos: "Zobaze POS vs Loyverse POS Comparison! [Best Free POS]" 13,318 views — [YouTube](https://www.youtube.com/watch?v=3lehSAyqqyc); "Kyte POS vs Loyverse POS Comparison" 10,205 views — [YouTube](https://www.youtube.com/watch?v=KGytRB2uhao); "6 Best Free POS Systems in 2026 (But..is there a CATCH?)" 7,639 views — [YouTube](https://www.youtube.com/watch?v=yXNA-XZcaq0); "SARI SARI STORE TIPS FREE POS LOYVERSE TUTORIAL PT. 1" 9,523 views — [YouTube](https://www.youtube.com/watch?v=5R390jHIVsc).
- Play `khata` completes to `khatabook` and `khata app`; Play `vyapar` to `vyapar app`, `vyapar invoice billing app`, `vyapar pos` (US) — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc).

### Inferences
- "Loyverse alternative", "loyverse vs …", "free POS app" form the competitor cluster that matters most in SEA. Loyverse's paid add-ons (inventory, employee management) are the natural angle; the merchant-review pages cited in other notes cover what those cost.
- Brand names cannot go in App Store keywords (Apple rejects competitor names); on Play they cannot appear in the title. They belong on a web comparison page ("BizManage vs Loyverse") and in YouTube video titles, where "X vs Loyverse" titles already draw 10K+ views.
- Peddlr is the #1 Loyverse comparison in Google Suggest, which points to Philippine sari-sari stores as the most active comparison-shopping segment.

### Gaps
- No volume per competitor term; positions only.
- Did not check what Google ranks for "loyverse alternative" (which pages win), which would size the SEO effort.

## 5. Social search language on TikTok and YouTube

### Takeaway
YouTube search language mirrors Google: "best free POS app (for small business / android)", "inventory app for small business", "sari sari store inventory app", "how to track sales and inventory / for small business". The highest-view videos are Excel/Google Sheets templates (1M to 2.2M views) and listicles ("Top 5 free inventory software", 257K). TikTok could not be measured.

### Cited Findings
- YouTube `best pos app` completes to `for small business`, `for ios`, `for restaurant`, `for android`; `best free pos app` to `for small business`, `for android`, `best free pos software for small retail business` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=best%20free%20pos%20app&hl=en&gl=ph).
- YouTube `inventory app` completes to `inventory app for sari sari store` (#2 in PH, #7 in US), `for small business`, `appsheet`, `free` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=inventory%20app&hl=en&gl=ph).
- YouTube `how to track sales` completes to `for small business` (#1), `and inventory`, `and expenses`, `using excel` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=how%20to%20track%20sales&hl=en&gl=ph).
- YouTube `best app for small business` completes to `best apps for small business owners`, `best inventory app for small business`, `best pos app for small business` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=best%20app%20for%20small%20business&hl=en&gl=ph).
- YouTube `daily sales record` completes to `app`, `app review`, `book`, `excel` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=daily%20sales%20record&hl=en&gl=ph).
- YouTube `sari sari store inventory` completes to `app`, `system`, `list`, `excel`, `daily sales inventory`, `how to make sari sari store inventory` — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=sari%20sari%20store%20inventory&hl=en&gl=ph).
- YouTube `how i track` completes only to personal topics (money, expenses, finances, calories); no shop phrasing — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=how%20i%20track&hl=en&gl=us).
- YouTube `how to calculate profit` is trading-dominated (forex, Binance, options, Amazon FBA) — [YouTube suggest](https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=how%20to%20calculate%20profit&hl=en&gl=ph).
- Top-viewed results for inventory problems are spreadsheets: "Stock Control Sheet In Excel" 2,243,130 views — [YouTube](https://www.youtube.com/watch?v=Cs7OVqDaLqg); "Stock In Out and Balance Template in Excel" 1,012,337 views — [YouTube](https://www.youtube.com/watch?v=3eaDn1dohNU); "SARI-SARI STORE INVENTORY SYSTEM USING MICROSOFT EXCEL" 406,823 views — [YouTube](https://www.youtube.com/watch?v=BpDG-oEQuhA).
- Listicle and app videos: "Top 5 Free Inventory Management Software for Small Business (2025)" 257,495 views — [YouTube](https://www.youtube.com/watch?v=gQyE0XMK3Lw); "Stock and Inventory Online - App for Small Business Management - Track Sales, Purchases and Exp…" 135,261 views — [YouTube](https://www.youtube.com/watch?v=S2sz_YE-KsA); "5 BEST POS Systems for Small Business | (2025 Rankings!)" 103,067 views — [YouTube](https://www.youtube.com/watch?v=ZLSmaer0-aQ); "Discover The Best Free POS Systems For Small Businesses" 72,711 views — [YouTube](https://www.youtube.com/watch?v=pDAydHnYe_k).
- Do-it-yourself builds rank too: "How to Build a POS System for Small Business – Claude Code + VS Code + Google Sheets" 202,394 views in 6 months — [YouTube](https://www.youtube.com/watch?v=i9kOEIDyvPw); "Build an Inventory Management Software with AI (Google Sheet)" 127,493 views — [YouTube](https://www.youtube.com/watch?v=CzgGSaKeVc0).
- Profit-calculation videos are small: "How to Calculate Net Profit of Your Business" 3,502 views; "How to Calculate Profit Margin of Your Business" 5,255 views — [YouTube](https://www.youtube.com/watch?v=_wZjHFM5ZHM).
- Title vocabulary that recurs in successful titles: "Best Free", "(2026)", "No Monthly Fees", "for Small Business", "Sari-Sari", "Tracker: Sales, Inventory, Profit & Loss, Pautang" — e.g. "SARI-SARI Store Tracker: Sales, Inventory, Profit & Loss, Pautang, Daily Cashflow" 8,004 views — [YouTube](https://www.youtube.com/watch?v=GfUXNin01wI); "How to Get Started with a Free POS System (No Monthly Fees)" by Square, 14,518 views — [YouTube](https://www.youtube.com/watch?v=g_ppczCwHNw).
- TikTok discover pages (`tiktok.com/discover/best-free-pos-app`, `…/inventory-app-for-small-business`, etc.) redirect to the home page or show "Please wait..." to automated requests; web search returned no TikTok pages for these phrases — [TikTok discover](https://www.tiktok.com/discover/inventory-app-for-small-business).

### Inferences
- On YouTube the phrase that pays is "free" + shop type + "inventory/POS app" + year. A BizManage video titled in that shape (e.g. "Free inventory app for small shops (2026): scan, sell, see real profit") matches how people search; "how I track my shop's profit" has no autocomplete and would rely on the feed, not search.
- Spreadsheet templates are the biggest attention pool (1M+ views). "Stop using Excel for stock" or "Excel vs app" content addresses the real current tool.
- "Profit" is weak as a YouTube search term (trading crowds it out) but strong as a hook inside shop content; keep it in the video's first line rather than the title's search phrase.
- Video demand in Khmer exists (16K to 18K views for stock/sales app explainers) with little competition (vendor videos get 11 to 263 views). Pairs with the existing Khmer/English TikTok plan.

### Gaps
- TikTok search terms, view counts and hashtag sizes could not be collected; this needs a logged-in browser session or TikTok Creative Center (ads.tiktok.com/business/creativecenter), checked by hand.
- Facebook search and group language were not measurable without login.
- YouTube results were fetched with `gl=PH` only.

## 6. Low-competition long-tail terms that fit BizManage's differentiators, and the keyword map by intent

### Takeaway
The best-fitting long-tail terms with visible demand and weak incumbents are: `inventory and sales tracker`, `daily sales profit and inventory`, `sales and inventory app`, `stock app for shop`, `stock in stock out app`, `profit tracker`, `income statement app`, `barcode inventory stock taking`, `sari sari store inventory app`, `grocery pos sales and inventory`, `multi branch pos`, `pos system in cambodia`, and Khmer `app គ្រប់គ្រងស្តុក` / `app កត់ត្រា ចំណូល ចំណាយ`. Differentiator phrases (landed cost per unit, multi-unit, dual currency, staff roles) have little or no search demand, so they should be used as conversion proof, not as target keywords.

### Cited Findings
- `profit tracker` on Play: top two results have 500+ and 100+ installs; only one shop app (Daily Sales Profit & Inventory, 100K+) in the top 10 — [Play search "profit tracker"](https://play.google.com/store/search?q=profit+tracker&c=apps&gl=KH&hl=en).
- `income statement app` is a #1 Play completion in 6 of 7 settings, and no POS or inventory app is in its top 10 — [Google Play suggest](https://play.google.com/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc); [Play search](https://play.google.com/store/search?q=income+statement+app&c=apps&gl=KH&hl=en).
- `stock in stock out app` top 10 includes apps with 100+, 500+ and 1K+ installs (StockCounts, Mainstock, Inventory Register) — [Play search](https://play.google.com/store/search?q=stock+in+stock+out+app&c=apps&gl=KH&hl=en).
- `sari sari store inventory app` top 10 is led by Sari Sari Store System (1K+), Inventory Now (500+), StockIT (10K+), Offline Shop (50K+), KaSari (100+) — [Play search](https://play.google.com/store/search?q=sari+sari+store+inventory+app&c=apps&gl=KH&hl=en).
- `pos cambodia` on Play: MyLekha POS (5K+), Wintech POS (100+, last updated Aug 2023), two Cambodia Post apps, then generic POS apps — [Play search](https://play.google.com/store/search?q=pos+cambodia&c=apps&gl=KH&hl=en).
- `multi currency pos` on Play: W&O POS (100K+), then a currency converter, SalesPlay (100K+), POS2U (100+), Excart (500+) — [Play search](https://play.google.com/store/search?q=multi+currency+pos&c=apps&gl=KH&hl=en).
- `landed cost calculator` on Play returns only unrelated calculators (land area, construction, 3D printing): no app owns the term — [Play search](https://play.google.com/store/search?q=landed+cost+calculator&c=apps&gl=KH&hl=en); Google shows `landed cost calculator` only in the US setting (#4) — [Google Suggest](https://suggestqueries.google.com/complete/search?client=firefox&q=landed%20cost&hl=en&gl=us).
- `stock app for shop` is a #2 Play completion everywhere; results are StoDo (1M+), Yahoo Finance, Zoho Stock Tracker (100K+), Offline Shop (50K+) — [Play search](https://play.google.com/store/search?q=stock+app+for+shop&c=apps&gl=KH&hl=en).
- The App Store audit already found KH App Store results thin (`pos` #2 is POS CAMBODIA with 0 ratings) — `docs/aso/aso-plan-2026-11-09.md` section 6, from [Apple search API](https://itunes.apple.com/search?term=pos&country=kh&entity=software).

### Inferences

**Keyword map by intent** (demand: High = top-3 autocomplete in most settings plus 1M+ install incumbents or 100K+ view videos; Med = autocomplete present, incumbents 100K or less; Low = autocomplete only in one surface or none. Surfaces: AS = App Store, GP = Google Play, GS = Google Search/web, YT = YouTube, TT = TikTok (not measured, inferred from YT)).

| Intent | Keyword / phrase | Demand evidence (this note) | Competition | Surface where it matters | Fit with BizManage |
|---|---|---|---|---|---|
| Problem-aware | how to track inventory for small business | GS all #1 for the seed, YT #1–3 | Very high (Shopify, QuickBooks, Excel) | GS, YT | Good (blog/video) |
| Problem-aware | how to record daily sales in a shop | GS avg #1.6 | Low-medium (articles, Excel) | GS, YT | Strong |
| Problem-aware | how to calculate profit margin for a product / for my business | GS #1 for "for my" | High (accounting sites) | GS | Strong (real profit after cost) |
| Problem-aware | app to track sales and expenses | GS #1 | Medium | GS, GP | Strong |
| Problem-aware | how to stop staff stealing from till / stock | GS #1, #2 | Low (articles) | GS, YT/TT | Strong (staff on every sale, stock count write-offs) |
| Problem-aware | how to calculate landed cost of imported goods (from china) / per unit | GS #1–5 | Medium (Incoterm/freight sites) | GS, YT | Strong (shipping in cost per unit) |
| Problem-aware | paano mag inventory sa tindahan / sari sari store | GS PH | Low | GS, YT, TT | Good if Tagalog captions |
| Problem-aware (KH) | របៀបគ្រប់គ្រង stock; app កត់ត្រា ចំណូល ចំណាយ; ចំណូលចំណាយ excel | YT/GS Khmer, only completions found | Very low | YT, TT, Facebook | Strong (Khmer UI) |
| Solution-aware | pos app (free / for small business) | GP all settings, GS #1 | Very high (Loyverse, Square, Kyte, Zobaze) | GP, AS, GS | Medium (cannot claim free/offline) |
| Solution-aware | inventory app / inventory management app | GP #1–3 | Very high (Zoho, StoDo, Sortly) | GP, AS | Good |
| Solution-aware | sales and inventory app | GP, GS #1 | High but beatable (100K–1M incumbents) | GP, AS | Strong |
| Solution-aware | inventory and sales tracker | GP in 5 of 7 settings | Medium | GP, AS | Strong |
| Solution-aware | daily sales record / daily sales profit and inventory | GP #1 | Medium (500K, 100K incumbents) | GP | Strong |
| Solution-aware | stock app for shop / stock management app | GP #2 everywhere | Medium (StoDo 1M+) | GP | Strong |
| Solution-aware | best free pos app (2026) | GS, YT | High (review sites) | YT, GS | Medium |
| Feature | barcode inventory (app / stock taking / scanner) | GP | Medium | GP, AS | Strong |
| Feature | profit tracker | GP (PH, US), AS (US, from audit) | Low (500+, 100+ leaders) | GP, AS | Strong |
| Feature | income statement app; profit and loss app | GP #1 / present | Low for shop apps | GP, AS | Strong |
| Feature | expense tracker (business) | GP high | Very high (personal finance) | GP, AS | Medium (secondary keyword) |
| Feature | stock in stock out app | GP | Low (100+ to 1K+ in top 10) | GP | Strong |
| Feature | multi branch pos (system) / pos system for multiple stores | GS only | Medium (B2B) | GS | Strong but low volume |
| Feature | multi currency pos / pos dual currency | GS weak | Low | GS, GP | Strong for KH, low volume |
| Feature | qr menu / qr menu maker | GP, GS, YT high | High (restaurant tools) | GP, GS | Partial (order link), restaurant-skewed |
| Feature | landed cost / cost per unit with shipping; multi-unit (carton/piece); staff login | None or near none for app intent | None | Copy and screenshots only | Core proof points |
| Vertical | sari sari store inventory app / pos for sari sari store | GS, GP, YT #2 (PH) | Low (1K+, 100+ apps) | GP, YT, TT | Strong (PH) |
| Vertical | grocery pos (sales and inventory) / pos for grocery store | GP | Medium | GP, AS | Strong |
| Vertical | pharmacy pos (app) | GP, GS "manage stock in pharmacy" | Medium | GP | Good |
| Vertical | minimart pos (system) | GS only; Play "minimart" = games | Low | GS | Strong, low volume |
| Vertical | cafe pos system free / restaurant pos | GP | High | GP | Partial |
| Vertical (local) | aplikasi untuk toko sembako / kelontong; โปรแกรมขายของชำ; sistem pos kedai runcit | GS ID/TH/MY | High (local leaders) | GP, GS | Only with new languages |
| Competitor/alternative | loyverse alternative (free); loyverse vs peddlr / zobaze / kyte | GS #1–2; YT videos 10K+ views | Low-medium (review blogs) | GS, YT | Strong (web page, video) |
| Competitor/alternative | square / kyte / zobaze / peddlr / storehub / zoho inventory / sortly alternative | GS present | Low-medium | GS | Good |
| Competitor/alternative | vyapar alternative; khatabook | GS 10 completions; GP | India-centred | GS | Weak (India) |
| Local (KH, English) | pos system in cambodia; best pos system in cambodia; pos system price in cambodia; cloud pos cambodia | GS KH | Low (B2B vendors) | GS | Strong |
| Local (Khmer) | app គ្រប់គ្រងស្តុក; stock (in Khmer text); ចំណូលចំណាយ | YT/GS, thin | None on Play | GP (km listing), YT, TT | Strong, low volume |
| Local (Chinese) | 进销存app (推荐); 收银系统 app / 免费; 库存管理app免费 | GS present | Medium (Pospal, GoodCashier) | GS, GP (zh listing) | Good (app has Chinese) |
| Local (VI/TH/ID) | phần mềm bán hàng miễn phí; โปรแกรมขายหน้าร้าน ฟรี; aplikasi kasir gratis; aplikasi stok barang | GS/GP/YT deep | Very high (KiotViet, Sapo, Kasir Pintar, Moka, Qasir) | GP, YT | Not now (no language) |

- Store-keyword shortlist this adds to the App Store plan: `tracker` (confirmed on Play as `inventory and sales tracker`, `sales tracker`, `profit tracker`), `daily`, `record`, `stock` + `shop` as a pair, `income statement`, `stocktaking`/`stock taking`, `grocery`, `sari sari` (PH reach), `minimart`, `pharmacy`. For Play, the short description and full description should repeat `sales and inventory`, `stock app for shop`, `daily sales`, `profit tracker`, `barcode`, `income statement` naturally 2 to 3 times each.
- Words to avoid leading with: `business manager` (Facebook on Play), `offline` (not true), `free` without the 50-sale condition, `cashier` and `minimart` alone (games), `stock` alone (trading), `sales` alone (Salesforce), `small business` alone on Play (loans).
- Differentiators map to searched problems, not searched features: landed cost → "how to calculate landed cost per unit"; multi-unit → "carton to pieces" (only a unit-conversion query); dual currency → no search; staff roles → "stop staff stealing from till"; income statement → "income statement app", "how to calculate profit for my business". Content and screenshots should name the problem in owners' words and show the feature as the answer.

### Gaps
- No absolute volumes; demand tiers are relative and from one IP.
- Competitor strength on Play is install bands only; keyword difficulty scores need a paid tool.
- Khmer-language Play results may change once any Khmer-localized competitor appears; recheck when the Play listing launches.
- The App Store hidden keyword field is still unknown (noted in the audit).
