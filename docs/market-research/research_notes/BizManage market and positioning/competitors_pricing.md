# Competitor landscape and pricing: mobile POS, inventory and micro-merchant bookkeeping (SEA and global), as of 15 Nov 2026

Method note: store data was pulled on 15 Nov 2026 from Apple's search/lookup API (`itunes.apple.com/search`, `/lookup`; App Store rating counts are **per storefront**, so a KH count is Cambodia only) and from Google Play detail pages (Play counts are global; "n/a" means the page did not expose a rating to the scraper). In-app purchase (IAP) prices were read from the US App Store pages. Prices come from vendor pricing pages unless marked third-party. Almost no vendor page carries a price date; "undated" means the page shows only a copyright year. Where USD is shown next to a local price it is an approximation at assumed rates (1 USD ≈ 26,300 VND, 16,600 IDR, 4.2 MYR, 1.30 SGD, 88 INR, 58 PHP); these rates were not sourced. The earlier ASO work (docs/aso/competitors.json, aso-plan-2026-11-09.md) is not repeated here, only cited.

## Q1. Who are the most relevant competitors and how do they compare? (master table and profiles)

### Takeaway
Nobody combines what BizManage does at its price. Global freemium tools (Loyverse, Square, Zoho, Sortly) are polished and have huge rating counts, but they charge per employee, per location or per add-on, and none does riel/dollar. The SEA players (KiotViet, Sapo, majoo, Moka, StoreHub) cost $10–110 per outlet per month and sell through sales teams in their home markets. In Cambodia the App Store is almost empty: no POS/inventory app there has more than about 30 Cambodian ratings. The real local competition for a shop owner's attention is free bank apps (ABA, ACLEDA, Wing, Bakong).

### Cited Findings

**Master comparison table** (store data pulled 15 Nov 2026)

| # | App (vendor) | Home market / target | Free tier | Paid entry → top (local) | ~USD/mo entry | Billing unit | iOS rating (count, storefront) | Play rating (count) / installs | Khmer UI on store |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Loyverse POS** (Cavius) | Global SMB retail/F&B | POS, essential inventory + low-stock alerts, loyalty, multi-store, KDS, integrations; 31-day reports | Add-ons: unlimited history $5/store/mo; employee mgmt $5/employee/mo; advanced inventory $25/store/mo (annual = 2 months free) | $5–35+ | per store + per employee | 4.67 (375, US); 5.0 (26, KH) | 4.62 (18,158) / 1M+ | Yes (KM in iOS language list) |
| 2 | **Square POS / Square for Retail** (Block) | US/global; card-processing led | Free plan: items/SKUs, discounts, refunds, sales reports | Plus (inventory, stock intake, POs, COGS reports); Premium (cross-location transfers). 2026 third-party: Plus $49, Premium $149/location/mo; Square help pages still show $79 and $89 | $0–49 | per location | 4.81 (607,934, US) | 4.52 (261,082) / 10M+ | No |
| 3 | **Shopify POS** | Global omnichannel | "Casual in-person selling" in every Shopify plan | Shopify Basic $39, Grow $105, Advanced $399/mo; POS Pro $89/location/mo (billed yearly) | $39–128 | per store plan + per location | 4.45 (7,468, US) | 4.89 (3,692) / 1M+ | No |
| 4 | **Zoho Inventory** | Global SMB (back office, not POS) | Free: 50 orders/mo, 1 user, 2 locations | Standard $29, Professional $79, Premium $129, Enterprise $249/org/mo (annual billing); add-on users $7.50 | $29 | per organization + user add-ons | 4.75 (1,048, US) | 4.67 (5,051) / 1M+ | No |
| 5 | **Sortly** | US SMB inventory (not POS) | Free: 100 items, 1 user | Advanced $49 list (promo $24, $288/yr), Ultra $149 list ($74 promo), Premium $299 list; iOS IAP Advanced $49.99/mo, $449.99/yr | $24–49 | per account, seat-capped | 4.73 (9,587, US) | n/a / 100K+ | No |
| 6 | **inFlow Inventory** | US/CA SMB inventory | none (trial) | Entrepreneur $161/mo ($129 annual), Small Business $436, Mid-Size $874 (vendor blog via search; older $186/$999 still listed) | $129–161 | per account | 4.12 (129, US) | n/a / 10K+ | No |
| 7 | **Odoo POS** | Global ERP | One App Free (one app, unlimited users) | Standard $8.95–11.20/user/mo; Custom $16.40–20.40/user/mo (all apps incl. POS and Inventory) | $9–11 per user | per user | 2.62 (148, US) | 4.21 (5,017) / 1M+ | No |
| 8 | **Lightspeed Retail (X-Series, ex-Vend)** | Mid-market retail | none | Basic $89, Core $149, Plus $289/mo (1 register each; extra locations/registers cost more) | $89 | per location/register | Scanner 4.5 (354, US) | — | No |
| 9 | **Vyapar** | India GST billing + inventory | Free mobile tier (third-party) | Android Silver ₹699/yr, Gold ₹799/yr; desktop ₹3,399+/yr (third-party); iOS IAPs Gold Mobile $34–39, Platinum Mobile $44, combos $109–149 | ~$1/mo Android; $3/mo iOS | per device type (mobile/desktop/combo) | 3.58 (1,232, IN) | 4.86 (200,086) / 10M+ | No |
| 10 | **Khatabook** | India credit ledger | Core ledger free | "Khatabook Pro" premium (price not published) | 0 | — | (iOS id not resolvable in IN; "Khatabook Vyapar App" by another publisher has 125,773) | 4.95 (592,724) / 100M+ | No |
| 11 | **OkCredit** | India credit ledger | Basic free: unlimited customers, entries, reminders, backup | Premium (ad-free, multi-device, GST billing); price not published | 0 | — | 4.85 (4,869, IN) | n/a / 10M+ | No |
| 12 | **myBillBook** | India GST billing | none found | Plus ₹3,490/yr, Pro ₹3,990/yr (1 user + CA); Pro Max from ₹570/mo (2 businesses, 3 users, POS billing); iOS IAP Plus/Pro $39.99/yr, Pro Max $99.99–149.99/yr | $3–6.50 | per business + users | 4.54 (3,273, IN) | — | No |
| 13 | **BukuWarung** | Indonesia micro-merchant bookkeeping + payments | Bookkeeping free (pricing not found) | not found | ? | — | not found on iOS ID | n/a / 5M+ | No |
| 14 | BukuKas / Lummo | Indonesia | **Shut down May 2023**; company in liquidation | — | — | — | — | — | — |
| 15 | **KiotViet** | Vietnam retail/F&B; 300,000+ businesses | Free trial only | Basic 270k VND/mo (1 branch, 3 users), Professional 330k (unlimited users), Premium 490k; extra branch 270k–375k/mo | $10–19 | per branch | 2.9 (1,428, VN) | 4.5 (2,173) / 500K+ (manager app) | **Yes (KM in iOS list)** |
| 16 | **Sapo** | Vietnam omnichannel | none | Start Up 170k VND/mo (1 channel, 3 staff), Pro 249k, Omni 449k, Advanced 600k, Growth 999k; extra store 200k/mo; setup fee 1–3M VND; iOS IAP Start Up $7.99, Pro $12.99 | $6.50–38 | per store/channel | 3.46 (1,515, VN) | — | No |
| 17 | **StoreHub** | Malaysia/PH/TH retail & F&B | trial | Starter RM122, Advanced RM235 (multi-location), Pro RM471/mo; 1 register + 1 store included | $29–112 | per store/register | Manager 1.89 (9, MY) | n/a / 10K+ | No |
| 18 | **Qashier** | Singapore/MY/PH hardware-bundled POS | unverified old "Free forever" column | "Everything included. $5 a day" (≈ S$150/mo) | ~$115 | per outlet (daily) | HQ app 0 ratings (SG) | n/a / 1K+ | No |
| 19 | **EasyStore** | Malaysia e-commerce + POS | none | Standard RM249, Business RM499, Growth RM899 (first plan with POS), Success RM1,199/mo | $214 for POS | per store plan | 3.56 (57, MY) | n/a / 50K+ | No |
| 20 | **Moka POS** (GoTo) | Indonesia F&B/retail | trial | Basic Rp299k, Pro Rp499k, Enterprise Rp799k per outlet/mo; staff caps 5/10/20; extra staff Rp10k | $18–48 | per outlet + staff caps | (Moka iOS not found in ID search) | n/a / 1M+ | No |
| 21 | **majoo** | Indonesia POS + ERP/accounting | none (trial) | Starter Rp249k, Advance Rp499k (multi-outlet, COGS, accounting), Prime Rp999k per outlet/mo; iOS IAP Starter $12.99, Advance $24.99, Prime $49.99 | $13–60 | per outlet | 4.22 (722, ID) | — | No |
| 22 | **Olsera** | Indonesia | none (14-day trial) | Basic Rp1.288M/yr (3 devices, owner + 2 staff, Android/Windows only), Premium Rp1.988M/yr, Pro Rp2.688M/yr | $6.50–13.50 | per account/yr | 4.07 (199, ID) | n/a / 100K+ | No |
| 23 | **Pawoon** | Indonesia | — | price not found | ? | — | — | n/a / 100K+ (last update Aug 2025) | No |
| 24 | **Ocha POS** | Thailand F&B | app free with IAP | monthly fee exists per a user review; tiers not found | ? | — | Manager 3.26 (206, TH) | — | No |
| 25 | **LINE MAN Wongnai POS** | Thailand F&B, tied to LINE MAN delivery | — | standard price not found; buffet tier 2,690 THB/mo; hardware bundle 5,799 THB | ? | — | Manager 2.47 (100, TH) | n/a / 50K+ | No |
| 26 | **UTAK** | Philippines F&B | none | ₱1,500–2,333/mo (third-party; PayMongo: "from Php 1,500 a month") | $26–40 | per outlet | 3.38 (58, PH) | Merchant n/a / 5K+ | No |
| 27 | **Peddlr** | Philippines sari-sari stores | Free ("premium POS functionality... for free") | earns from eLoad | 0 | — | 4.65 (46, US) | n/a / 1M+ | No |
| 28 | **Daily Sales Record** (JigsawLab) | Global micro-shops, offline | Free with ads | Pro **$9.99/mo, $99.99/yr**, $499.99 lifetime | $9.99 | per account | 4.71 (1,079, US); 4.72 (57, KH) | 4.55 (4,326) / 500K+ (Kutir Soft version) | Yes (KM listed) |
| 29 | **POS CAMBODIA** (B POS Co.) | Cambodia retail | Free download | not published | ? | — | 3.0 (4, KH); last update Jan 2025 | — | No (EN only) |
| 30 | **MyLekha POS** | Cambodia ("single free POS software in Cambodia") | Free | not published | 0 | — | 4.5 (10, KH) | 4.54 (29) / 5K+ | No (EN only) |
| 31 | **Mobi POS** (Techbox, MY/SG) | F&B, fully offline | Free download | not published | ? | — | 4.0 (3, KH) | n/a / 1K+ | No |
| 32 | **ABA Merchant** (ABA Bank) | Cambodia payment acceptance | Free mPOS for ABA account holders | — | 0 | — | 4.13 (331, KH) | 4.50 (4,092) / 1M+ | App: EN; ABA Mobile: KM |
| 33 | **Bakong** (National Bank of Cambodia) | Cambodia national payments | Free | — | 0 | — | 4.15 (581, KH) | 4.42 (1,989) / 100K+ | Yes |
| — | **BizManage** | Cambodia/SEA small shops | First 50 sales | Max $9.99/mo or $99.99/yr, whole team | $8.33–9.99 | per account (whole team) | 0 ratings | not on Play | **No (store page lists English only)** even though the app has Khmer |

Sources for the table, by row:
- Loyverse prices, free features and taglines — [Loyverse pricing](https://loyverse.com/pricing); ratings — [App Store](https://apps.apple.com/us/app/id1070865387), [Google Play](https://play.google.com/store/apps/details?id=com.loyverse.sale); KM language from Apple lookup — [Apple lookup](https://itunes.apple.com/lookup?id=1070865387&country=kh)
- Square plan contents — [Square for Retail pricing](https://squareup.com/us/en/point-of-sale/retail/pricing) (this page did not render prices); Plus $49 / Premium $149 per location — [FitSmallBusiness 2026](https://fitsmallbusiness.com/square-fees-pricing-guide/), [erpresearch](https://erpresearch.com/erp-add-ons/pos/square-for-retail/pricing); Square's own help pages show $79 (Canada) and $89 — [Square help CA](https://squareup.com/help/ca/article/6357), [Square help 6921](https://squareup.com/help/ca/article/6921); NerdWallet says retail Plus was previously $89 — [NerdWallet](https://www.nerdwallet.com/article/small-business/square-fees); per-location billing from Jan 2026 — [Square community](https://community.squareup.com/t5/Food-Beverage/Square-Plus-quot-Locations-quot-Pricing/m-p/849483). Conflict unresolved. Ratings — [App Store](https://apps.apple.com/us/app/id335393788), [Google Play](https://play.google.com/store/apps/details?id=com.squareup)
- Shopify — [Shopify POS pricing](https://www.shopify.com/pos/pricing); [App Store](https://apps.apple.com/us/app/id686830644), [Google Play](https://play.google.com/store/apps/details?id=com.shopify.pos)
- Zoho Inventory — [Zoho Inventory pricing](https://www.zoho.com/inventory/pricing/); [App Store](https://apps.apple.com/us/app/id1037960494), [Google Play](https://play.google.com/store/apps/details?id=com.zoho.inventory)
- Sortly — [Sortly pricing](https://www.sortly.com/pricing/); IAPs — [App Store](https://apps.apple.com/us/app/id529353551); [Google Play](https://play.google.com/store/apps/details?id=com.sortly.mythings)
- inFlow (vendor pricing page returned 404) — [inFlow blog via search](https://www.inflowinventory.com/blog/inventory-management-software-cost/), [CostBench](https://www.costbench.com/software/inventory-management/inflow/); older figures — [Capterra](https://www.capterra.com/p/78431/inFlow-Inventory/pricing/); [App Store](https://apps.apple.com/us/app/id1397589892), [Google Play](https://play.google.com/store/apps/details?id=com.inflowinventory.mobile)
- Odoo — [Odoo pricing](https://www.odoo.com/pricing); [App Store](https://apps.apple.com/us/app/id1272543640), [Google Play](https://play.google.com/store/apps/details?id=com.odoo.mobile)
- Lightspeed — [Lightspeed Retail pricing](https://www.lightspeedhq.com/pos/retail/pricing/) (the page says prices reflect X-Series and does not mention Vend by name); [App Store Scanner](https://apps.apple.com/us/app/id1100131368)
- Vyapar — Android prices from [Techjockey](https://www.techjockey.com/detail/vyapar) and [echai.ventures](https://echai.ventures/startingup/r/vyapar-plans-and-pricing--t5-su-tools-money-r003); desktop from [Capterra](https://www.capterra.com/p/180579/Vyapar/pricing/); 2026 changes from [PricingSaaS](https://pricingsaas.com/companies/vyapar) (not verified on Vyapar's site, whose pricing page did not render); iOS IAPs — [App Store](https://apps.apple.com/us/app/id6478382307); [Google Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- Khatabook — freemium model and "Pro" tier from [StartupTalky](https://startuptalky.com/khatabook-business-model/); [Google Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- OkCredit — [OkCredit FAQ](https://okcredit.in/faq), [OkCredit vs Khatabook](https://okcredit.in/khatabook-alternative); [App Store](https://apps.apple.com/in/app/id1488748286), [Google Play](https://play.google.com/store/apps/details?id=in.okcredit.merchant)
- myBillBook — [myBillBook pricing](https://mybillbook.in/pricing); IAPs — [App Store](https://apps.apple.com/us/app/id1612498254)
- BukuWarung — [Google Play](https://play.google.com/store/apps/details?id=com.bukuwarung); BukuKas closure — [DealStreetAsia](https://media.dealstreetasia.com/stories/indonesia-lummo-liquidation-360554), [Bisnis.com](https://teknologi.bisnis.com/read/20231213/266/1723450/daftar-11-startup-tutup-dan-phk-di-ri-terbaru-ada-pegipegi/2); CB Insights says it filed for bankruptcy in Sept 2023 — [CB Insights](https://www.cbinsights.com/company/bukukas) (the process is described differently by these sources)
- KiotViet — [KiotViet phí dịch vụ](https://www.kiotviet.vn/phi-dich-vu), [KiotViet home](https://www.kiotviet.vn/); KM language and rating — [Apple lookup](https://itunes.apple.com/lookup?id=1146695068&country=kh), [App Store VN](https://apps.apple.com/vn/app/id1146695068); [Google Play](https://play.google.com/store/apps/details?id=net.citigo.kiotviet.manager)
- Sapo — [Sapo bảng giá](https://www.sapo.vn/bang-gia.html); IAPs and rating — [App Store](https://apps.apple.com/vn/app/id979090133)
- StoreHub — [StoreHub MY pricing](https://www.storehub.com/my/pricing/) (page shows "published Oct 28, 2026"); [App Store](https://apps.apple.com/my/app/id1476682427), [Google Play](https://play.google.com/store/apps/details?id=com.storehub.backoffice)
- Qashier (pricing page returned 403) — [Qashier SG software pricing](https://qashier.com/sg/software-pricing), [Qashier blog Aug 2026](https://qashier.com/sg/blog/2026/08/05/cost-of-business-software-singapore/), older free column — [Qashier old plans page](https://qashier.com/sg/?p=5546)
- EasyStore — [EasyStore pricing](https://www.easystore.co/en-my/pricing); [App Store](https://apps.apple.com/my/app/id1499032417), [Google Play](https://play.google.com/store/apps/details?id=co.easystore.mobilepos)
- Moka — [Moka harga](https://www.mokapos.com/harga) (footer © 2025); [Google Play](https://play.google.com/store/apps/details?id=com.mokapos.android)
- majoo — [majoo harga](https://majoo.id/harga); IAPs — [App Store](https://apps.apple.com/id/app/id1642259472)
- Olsera — [Olsera pricing](https://www.olsera.com/id/pricing) (footer © 2024); [App Store](https://apps.apple.com/id/app/id1172633730), [Google Play](https://play.google.com/store/apps/details?id=com.olserapratama.pos)
- Pawoon — [Google Play](https://play.google.com/store/apps/details?id=com.pawoon.pos)
- Ocha — [App Store TH listing and review](https://apps.apple.com/th/app/ocha-pos/id1144791811); Ocha Manager rating — [App Store](https://apps.apple.com/th/app/id1279707675)
- Wongnai POS — [Brand Inside](https://brandinside.asia/?p=254973), [Wongnai POS bundle form](https://docs.google.com/forms/d/e/1FAIpQLScOJXhMVmZuBjLmQO8gHs6bd5vguDFUAq9JXCn9RIaoeA-UDg/viewform), [Wongnai POS article](https://www.wongnai.com/pos-articles/pos-standard-single-screen); [Google Play](https://play.google.com/store/apps/details?id=com.lmwn.managerapp)
- UTAK — [StoreHub vs UTAK](https://www.storehub.com/ph/blog/storehub-vs-utak) (competitor source), [PayMongo partner page](https://paymongo.com/partner/utak-pos), [Klikit](https://klikit.io/en/learn/utak-alternative-philippines); [App Store](https://apps.apple.com/ph/app/id1443245901)
- Peddlr — local file docs/aso/competitors.json (App Store description); [Google Play](https://play.google.com/store/apps/details?id=com.blvckbook.peddlr)
- Daily Sales Record — IAPs — [App Store](https://apps.apple.com/us/app/id415458892); [Google Play](https://play.google.com/store/apps/details?id=com.kutirsoft.dailysalesrecord) (the Play package is published by "Kutir Soft"; it may be a different app with the same name)
- POS CAMBODIA, MyLekha, Mobi POS, ABA Merchant, Bakong — [Apple lookup POS CAMBODIA](https://itunes.apple.com/lookup?id=6463697172&country=kh), [MyLekha](https://apps.apple.com/kh/app/id1576065840), [MyLekha Play](https://play.google.com/store/apps/details?id=app.mylekha.client.client_pos), [Mobi POS](https://apps.apple.com/kh/app/id594759320), [ABA Merchant iOS](https://apps.apple.com/kh/app/id1559488956), [ABA Merchant Play](https://play.google.com/store/apps/details?id=com.ababank.payway), [Bakong iOS](https://apps.apple.com/kh/app/id1440829141), [Bakong Play](https://play.google.com/store/apps/details?id=jp.co.soramitsu.bakong)
- BizManage IAPs on its own US page — [App Store](https://apps.apple.com/us/app/id6747810928); store languages English only — local file docs/aso/aso-plan-2026-11-09.md

**Short profiles** (one line each, what they do and who they're for)
- Loyverse: a free POS sold on "no ads, no credit card, no contracts", aimed at "retail store, cafe, bar, restaurant... grocery store, beauty salon". It is the default free choice across SEA: it shows up in search results for Pawoon, Olsera, StoreHub, Qashier, Ocha, Wongnai and Mobi POS in ID, MY, SG and TH — [App Store](https://apps.apple.com/us/app/id1070865387); search output from `itunes.apple.com/search` on 15 Nov 2026.
- Square / Shopify / Lightspeed: card-processing or e-commerce platforms with POS attached. In SEA they are mostly irrelevant because neither Square nor Shopify Payments is available there (inference; see Gaps). Lightspeed Retail includes "landed costs" and "custom user roles" on every plan from $89/mo — [Lightspeed](https://www.lightspeedhq.com/pos/retail/pricing/).
- Zoho Inventory / Sortly / inFlow: back-office inventory, not checkout. Sortly targets "inventory, supplies, parts, tools, equipment" and is "trusted by over 20,000 businesses" — docs/aso/competitors.json.
- Odoo: a modular ERP. One free app with unlimited users; POS together with Inventory needs Standard, billed per user — [Odoo](https://www.odoo.com/pricing).
- Vyapar / myBillBook / Khatabook / OkCredit: Indian GST invoicing (Vyapar, myBillBook) and credit-ledger apps (Khatabook, OkCredit) with very large Android bases (Khatabook 100M+ installs, 592,724 ratings) — [Google Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook).
- KiotViet: "Phần mềm quản lý bán hàng phổ biến nhất" (the most popular sales management software), used by more than 300,000 businesses with 10,000+ joining each month; it also offers free household-business accounting tied to Vietnam's 2026 tax reform — [KiotViet](https://www.kiotviet.vn/), [VCCI](https://www.vcci.com.vn/news/kiotviet-mien-phi-phan-mem-ke-toan-cho-ho-kinh-doanh).
- Sapo: Vietnamese omnichannel (store, marketplace stalls, social pages, livestream), "Tất cả những gì bạn cần để quản lý và kinh doanh" (everything you need to manage and run your business) — [Sapo](https://www.sapo.vn/bang-gia.html).
- majoo: Indonesian POS plus ERP, with full accounting, payroll and attendance in its higher tiers — [majoo](https://majoo.id/harga).
- AB Pro KH: an all-in-one app for "cafe owners in Cambodia" with "Khmer and English language support" (store metadata lists EN only); 4.33 from 6 KH ratings — [Apple lookup](https://itunes.apple.com/lookup?id=6744525787&country=kh).
- Kitluy (E-KHMER Technology): described in a search result as an online POS in Khmer with loyalty points; the App Store lookup for id1453049316 returned no result in the KH storefront — [App Store US](https://apps.apple.com/us/app/-/id1453049316).
- Haang: a Khmer-first POS/inventory project that handles riel and dollar and works offline; it is a Devpost write-up, not a store listing — [Devpost](https://devpost.com/software/haang).
- Other new KH-storefront POS apps found in the "pos", "khmer pos" and "cambodia inventory" searches (all with 0–5 ratings): MB POS, POS - Rabbit Technology, Anajak-POS, Retail | POS, Khmer Digital POS, KAMPUJA POS, Khmer Store, Bodiax POS (sales, inventory, expenses by category), NinPOS: Offline Point of Sale, NH Inventory, AKAS Business, Pii Stock — `itunes.apple.com/search?country=kh` results, 15 Nov 2026 (e.g. [Bodiax POS](https://apps.apple.com/kh/app/id6753270179), [NinPOS](https://apps.apple.com/kh/app/id6797074803)).
- PTC Computer (Phnom Penh) sells an in-house POS bundled with Rongta hardware, sales-led and with no public price — [PTC](https://solutions.ptc-computer.com.kh/service/detail/pos-solution).

### Inferences
- In Cambodia, competition is about shelf presence, not features. The most-rated KH-storefront POS apps are Loyverse (26 KH ratings) and Silom (33), and every local app has single-digit counts. Ten honest ratings would put BizManage near the top of the local set.
- Indonesia, Vietnam and Malaysia are owned by funded, sales-led local players that charge per outlet. Their weak iOS ratings (KiotViet 2.9, Sapo 3.46, StoreHub Manager 1.89) suggest a gap for a self-serve, well-reviewed phone app there. But they sell mostly on Android and through field sales, so iOS ratings understate their reach.
- Daily Sales Record charges exactly $9.99/mo and $99.99/yr. That shows the price point is accepted by micro-shops globally for a simpler product.

### Gaps
- B-Store, Pos.com.kh, "Kas" and BanhJi POS pricing: no B-Store app or site was found. "KAS POS" (KAS TECHNOLOGY CORPORATION, id1550575393, 0 ratings, last updated Sept 2024) exists, but its country is unconfirmed. BanhJi is listed on Capterra as accounting with a free version and per-feature pricing, but sources conflict and no POS price was found — [Capterra SG](https://www.capterra.com.sg/software/177596/banhji).
- Mosaic POS (PH) and Slurp (MY): no store listing or pricing found (slurp.com.my does not resolve).
- Pawoon, Ocha, Wongnai POS standard, BukuWarung and Khatabook Pro prices were not found on primary pages.
- Whether Square and Shopify Payments operate in Cambodia was not verified.
- Google Play ratings were missing for several packages (scraper limitation). Kasir Pintar shows 5.0 from 53,708 ratings, which looks like a parsing or regional artefact.

## Q2. Pricing models: per device, per store, per user, per add-on. Where does $9.99/month for the whole team sit?

### Takeaway
Almost every competitor charges for more staff or more stores: Loyverse per employee, Square, Shopify, KiotViet and Moka per location, Odoo per user, Zoho per organization with user caps. BizManage's flat $9.99 covering the whole team and several businesses is cheaper than any comparable setup outside India once you have 2 or more staff or 1 or more branches. The exceptions are Indian billing apps (Vyapar Android ≈ ₹699–799/yr), Olsera's annual plans (≈ $6.50–13.50/mo) and free ad-supported or bank apps.

### Cited Findings
- Loyverse: POS free; employee management $5 per employee/mo ($50/yr), advanced inventory $25 per store/mo ($250/yr), unlimited sales history $5 per store/mo — [Loyverse](https://loyverse.com/pricing). Worked example (inference): 1 store, 3 staff, advanced inventory and history = $15 + $25 + $5 = **$45/mo**.
- Shopify: staff roles and permissions and inventory management need POS Pro at $89 per location/mo, on top of a $39+ plan — [Shopify](https://www.shopify.com/pos/pricing). Example: **$128/mo** for one shop with staff roles.
- Square: inventory and COGS reporting start at Plus, billed per location ($49 in 2026 third-party sources; $79/$89 on Square help pages) — [Square](https://squareup.com/us/en/point-of-sale/retail/pricing), [FitSmallBusiness](https://fitsmallbusiness.com/square-fees-pricing-guide/), [Square help](https://squareup.com/help/ca/article/6357).
- Zoho Inventory: per organization, but users are capped (Free 1, Standard–Premium 2, Enterprise 7) and extra users cost $7.50/mo — [Zoho](https://www.zoho.com/inventory/pricing/).
- Odoo: per user, $8.95–11.20/user/mo on Standard — [Odoo](https://www.odoo.com/pricing). Example: 3 users ≈ $27–34/mo.
- Sortly: seat-capped plans (Free 1, Advanced 2, Ultra 5, Premium 8 users) — [Sortly](https://www.sortly.com/pricing/).
- KiotViet: per branch, 270k–490k VND/mo, with an extra branch at 270k–375k/mo; Basic caps users at 3 — [KiotViet](https://www.kiotviet.vn/phi-dich-vu).
- Sapo: per store/channel, 170k–999k VND/mo, plus 200k per extra store and a one-off setup fee of 1–3M VND — [Sapo](https://www.sapo.vn/bang-gia.html).
- Moka: per outlet with staff caps (5/10/20), extra staff Rp10k each — [Moka](https://www.mokapos.com/harga).
- majoo: per outlet, plus terminal caps (2/3/5) and manager caps (1/2/5) — [majoo](https://majoo.id/harga).
- Olsera: annual only, Rp1.288M–2.688M/yr; Basic caps at 3 devices and owner + 2 staff — [Olsera](https://www.olsera.com/id/pricing).
- StoreHub: per store with 1 register included; extra registers and stores cost extra — [StoreHub](https://www.storehub.com/my/pricing/).
- Qashier: flat "$5 a day" per outlet — [Qashier](https://qashier.com/sg/software-pricing).
- Vyapar: per device type (mobile vs desktop vs combo) — [Techjockey](https://www.techjockey.com/detail/vyapar), [App Store IAPs](https://apps.apple.com/us/app/id6478382307).
- myBillBook: per business and per user; multi-business (2) and 3 users only on Pro Max, and its iOS IAP names encode the caps ("Pro Max Plan (5B, 10U) $149.99") — [myBillBook](https://mybillbook.in/pricing), [App Store](https://apps.apple.com/us/app/id1612498254).
- Daily Sales Record: flat account subscription, $9.99/mo, $99.99/yr, $499.99 lifetime, plus $0.99 to remove ads — [App Store](https://apps.apple.com/us/app/id415458892).
- BizManage's US App Store page still lists older IAPs "Pro Plan" $4.99/mo ($49.99/yr) and "Pro Plus Plan" $6.99/mo ($69.99/yr) alongside Max $9.99/$99.99 — [App Store](https://apps.apple.com/us/app/id6747810928).

### Inferences
- Price ladder for a typical Cambodian minimart (1 shop, owner + 2 staff, inventory with cost, reports), approximate USD per month:
  - Free bank or ledger apps: $0
  - Vyapar Android: ~$0.70
  - Olsera Basic: ~$6.50
  - Sapo Start Up: ~$6.50
  - **BizManage: $8.33–9.99**
  - Daily Sales Record Pro: $9.99
  - KiotViet Basic: ~$10
  - majoo Starter: ~$15
  - Moka Basic: ~$18
  - Zoho Standard: $29
  - Loyverse with add-ons: ~$45
  - Square Plus: $49+
  - Shopify + POS Pro: $128
  - inFlow: $129+

  BizManage sits at the low end of paid tools and at the price of local per-branch SEA tools. Its pitch is that the price covers the whole team and every branch.
- The "whole team" advantage grows with headcount and branches. At 2 branches and 5 staff, Loyverse with add-ons would be about $25 + $60 + $10 = $95/mo and KiotViet Professional about 600k VND/mo, against $9.99 for BizManage.
- The legacy Pro/Pro Plus IAPs on the live store page could confuse buyers, and they undercut the "one plan" message.

### Gaps
- Exact current Square Plus price (conflicting sources) and Vyapar's 2026 lineup (its pricing page did not render).
- Whether Loyverse counts the owner as a paid "employee" was not confirmed on the pricing page.

## Q3. Which features are paywalled where (multi-store, staff, inventory, reports)?

### Takeaway
Staff roles and inventory with cost/COGS are the most common paywalls. Multi-store is free at Loyverse and Shopify but paid nearly everywhere in SEA. Unit-of-measure conversion and landed cost sit in high tiers ($129 Zoho Premium) or mid-market products (Lightspeed).

### Cited Findings
- Loyverse: multi-store management free; employee management paid per employee; advanced inventory (POs, transfers, counts) paid per store; reports limited to 31 days unless you pay $5/store — [Loyverse](https://loyverse.com/pricing).
- Square: Free has sales reports; inventory management, stock intake, POs and COGS/inventory reports need Plus; cross-location transfers need Premium — [Square](https://squareup.com/us/en/point-of-sale/retail/pricing).
- Shopify: staff roles and permissions, inventory management and pro retail reports need POS Pro; multi-location is in every plan — [Shopify](https://www.shopify.com/pos/pricing).
- Zoho Inventory: UoM conversion, stock counting and profit margin need Premium ($129/mo); serial and batch tracking need Professional — [Zoho](https://www.zoho.com/inventory/pricing/).
- Sortly: purchase orders on Ultra; customizable role permissions on Premium — [Sortly](https://www.sortly.com/pricing/).
- KiotViet: Basic lacks multi-warehouse, staff attendance/payroll, business analytics and API — [KiotViet](https://www.kiotviet.vn/phi-dich-vu).
- Sapo: detailed multichannel reports and promotions/loyalty from Pro; scan-based stock check from Omni — [Sapo](https://www.sapo.vn/bang-gia.html).
- StoreHub: multi-location, advanced inventory and reporting, and stock transfer with alerts need Advanced (RM235) — [StoreHub](https://www.storehub.com/my/pricing/).
- majoo: multi-outlet, COGS average, inter-outlet transfers and full accounting need Advance (Rp499k) — [majoo](https://majoo.id/harga).
- Olsera: iOS POS and unlimited staff need Premium; Basic is Android/Windows only — [Olsera](https://www.olsera.com/id/pricing).
- myBillBook: POS billing, 2 businesses and 3 users only on Pro Max — [myBillBook](https://mybillbook.in/pricing).
- EasyStore: POS only from Growth (RM899/mo) — [EasyStore](https://www.easystore.co/en-my/pricing).
- OkCredit says the ledger itself is never behind a paywall; premium adds multi-device and GST billing — [OkCredit FAQ](https://okcredit.in/faq).

### Inferences
- BizManage's free tier is a sales-count limit (50 sales), not a feature limit. Competitors gate by feature with unlimited free use (Loyverse, Square Free, OkCredit) or by volume (Zoho: 50 orders/month; Sortly: 100 items). Against free-forever Loyverse, "50 sales" reads as a trial, not a free plan. *(Corrected 15 Nov 2026: the free cap is 50 sales, not 10. This judgement was made at 10 and is weaker at 50.)*
- BizManage includes at its one price several features that competitors put in their top tiers: income statement after COGS (Square Plus, majoo Advance), multi-unit/UoM (Zoho Premium), landed cost (Lightspeed), staff roles (Shopify POS Pro, Sortly Premium), and multi-business (myBillBook Pro Max, Odoo Custom).

### Gaps
- KiotViet and Sapo UoM support, and the exact contents of Loyverse "advanced inventory", were not read in detail.

## Q4. Which competitors have Khmer UI, dual currency (riel/dollar), multi-unit (UoM), landed cost and offline mode?

### Takeaway
Khmer UI is rare and, among POS apps, mostly comes from global apps localized into 30–50 languages (Loyverse, Daily Sales Record) and from KiotViet. Riel/dollar is claimed only by small local apps (MyLekha, Haang) and Mobi POS ("Multiple Currency"). No phone-first app found combines Khmer UI, riel/dollar, multi-unit and landed cost.

### Cited Findings
- Khmer (KM) in the iOS language list: Loyverse POS, KiotViet, Daily Sales Record, Loyverse CDS. Among Cambodian finance apps: ABA Mobile, Wing Bank, ACLEDA mobile, Bakong — Apple search/lookup API, 15 Nov 2026 ([Loyverse lookup](https://itunes.apple.com/lookup?id=1070865387&country=kh), [KiotViet lookup](https://itunes.apple.com/lookup?id=1146695068&country=kh)).
- Local POS apps POS CAMBODIA, MyLekha, Mobi POS, Bodiax, MB POS and AB Pro KH list English only on the store; AB Pro KH's description claims Khmer support — [Apple lookup AB Pro KH](https://itunes.apple.com/lookup?id=6744525787&country=kh).
- "Shop Management Assistant" (KM listed) was last updated in 2018 — [App Store](https://apps.apple.com/kh/app/id1271188592).
- BizManage's store listing shows English only, although the app ships Khmer and Chinese — local file docs/aso/aso-plan-2026-11-09.md.
- Dual currency: MyLekha "Accept multi currencies (USD or Riel) payments" — [App Store](https://apps.apple.com/kh/app/id1576065840); Mobi POS "Multiple Currency" — [App Store](https://apps.apple.com/kh/app/id594759320); Haang handles riel and dollar — [Devpost](https://devpost.com/software/haang); Zoho has "multi-currency transactions for each contact" only on Enterprise — [Zoho](https://www.zoho.com/inventory/pricing/).
- Multi-unit/UoM: Zoho Inventory UoM conversion on Premium — [Zoho](https://www.zoho.com/inventory/pricing/); POS CAMBODIA lists "Units" and "Default Qty of Selling and Receiving" among its product fields — [Apple lookup](https://itunes.apple.com/lookup?id=6463697172&country=kh).
- Landed cost: Lightspeed Retail lists "landed costs" on all plans ($89+) — [Lightspeed](https://www.lightspeedhq.com/pos/retail/pricing/); not mentioned on Zoho's pricing page — [Zoho](https://www.zoho.com/inventory/pricing/).
- Offline: Mobi POS "runs totally offline" — [App Store](https://apps.apple.com/kh/app/id594759320); Silom POS "Offline working mode" and Daily Sales Record (subtitle "Arabic English, offline.") — docs/aso/competitors.json; NinPOS ("Offline Point of Sale") — [App Store](https://apps.apple.com/kh/app/id6797074803); Haang works offline — [Devpost](https://devpost.com/software/haang); Loyverse lists "Keep recording sales..." (truncated in our capture, presumably "even when offline") — [App Store](https://apps.apple.com/us/app/id1070865387).

### Inferences
- BizManage's combination (Khmer + Chinese UI, riel/dollar with its own exchange rate, carton-to-piece units, landed cost with shipping, write-offs at cost) is unmatched among cheap phone apps in the data gathered. But the store page hides the strongest local signal (Khmer) because the listing is English-only.
- Offline mode is a common claim among competitors aimed at micro-shops. BizManage does not claim it, which matters where connectivity is unreliable (inference; BizManage's offline behaviour was not checked).

### Gaps
- Not verified: whether Loyverse supports two currencies at once (it appears to be one currency per store), and whether KiotViet's Khmer is a full UI or just metadata.
- No Khmer-language inventory app with meaningful ratings was found. App Store searches in Khmer ("ស្តុក", "គ្រប់គ្រង ហាង") returned only tiny apps or games.

## Q5. Positioning statements and App Store / Play titles

### Takeaway
Global apps sell "free" (Loyverse) or "simple" (Sortly, Daily Sales Record). SEA apps sell "most popular" (KiotViet) or "everything you need" (Sapo). Bookkeeping apps sell "ledger, UPI, billing". Almost no title says "profit". The words that dominate titles are "POS", "Inventory", "Kasir" (ID) and "Billing" (IN).

### Cited Findings
| App | Store title (subtitle) | Stated positioning |
|---|---|---|
| Loyverse | "Loyverse POS - Point of Sale" ("Analytics & Sales Reports") | "Free POS system with optional paid add-ons"; "Point of sale and commerce platform for small businesses worldwide" — [Loyverse](https://loyverse.com/pricing) |
| Square | "Square Point of Sale (POS)"; Play "Square Point of Sale: Payment" | "Get retail features included in any Square plan" — [Square](https://squareup.com/us/en/point-of-sale/retail/pricing) |
| Shopify | "Shopify Point of Sale (POS)" | "Plans for selling in person" — [Shopify](https://www.shopify.com/pos/pricing) |
| Zoho Inventory | iOS "Zoho Inventory Management App"; Play "Inventory Management App -Zoho" | — [App Store](https://apps.apple.com/us/app/id1037960494) |
| Sortly | "Sortly: Inventory Simplified" ("Inventory Made Easy") | "trusted by over 20,000 businesses" — docs/aso/competitors.json |
| inFlow | "inFlow Inventory" (scraped subtitle "Just grab, scan, and go.", moderate confidence) | — [App Store](https://apps.apple.com/us/app/id1397589892) |
| Vyapar | iOS "Vyapar Billing & Invoice App"; Play "Vyapar Invoice GST Billing App" | "affordable billing, accounting, and inventory solutions" — [Vyapar](https://vyaparapp.in/pricing) |
| Khatabook | Play "Khatabook Credit Account Book" | — [Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook) |
| OkCredit | iOS "OkCredit - Udhar Bahi Khata"; Play "OkCredit: Ledger, UPI, Billing" | ledger never paywalled — [OkCredit](https://okcredit.in/faq) |
| myBillBook | "myBillBook Billing Software" | — [App Store](https://apps.apple.com/us/app/id1612498254) |
| BukuWarung | Play "BukuWarung Apps for MSMEs" | bookkeeping + QRIS + bill collection + financing — [extruct](https://www.extruct.ai/hub/bukuwarung-com/) |
| KiotViet | "KiotViet" | "The MOST POPULAR sales management software used in more than 300,000 stores" — [Apple lookup](https://itunes.apple.com/lookup?id=1146695068&country=kh) |
| Sapo | "Sapo - Sales Management" | "Tất cả những gì bạn cần để quản lý và kinh doanh" — [Sapo](https://www.sapo.vn/bang-gia.html) |
| StoreHub | "StoreHub Manager" | "Simple, transparent pricing" — [StoreHub](https://www.storehub.com/my/pricing/) |
| EasyStore | "EasyStore: Unified Commerce" | "Build your brand. Keep your profits. Scale without limits." — [EasyStore](https://www.easystore.co/en-my/pricing) |
| Qashier | — | "Everything included. $5 a day." — [Qashier](https://qashier.com/sg/software-pricing) |
| majoo | "majoo Aplikasi Kasir POS & ERP" | — [App Store](https://apps.apple.com/id/app/id1642259472) |
| Moka | Play "Moka POS - Aplikasi Kasir" | — [Play](https://play.google.com/store/apps/details?id=com.mokapos.android) |
| Pawoon | Play "Pawoon: Kasir / POS Online" | — [Play](https://play.google.com/store/apps/details?id=com.pawoon.pos) |
| Olsera | "Olsera - Point Of Sale V2" | — [App Store](https://apps.apple.com/id/app/id1172633730) |
| Peddlr | "Peddlr POS, Inventory and Load" ("eLoad & QRPh") | "Proudly made in the Philippines"; premium POS "for free" — docs/aso/competitors.json |
| Daily Sales Record | "Daily Sales Record - POS, CRM" ("Arabic English, offline.") | "Track your daily sales and profit in seconds." — docs/aso/competitors.json |
| MyLekha | "MyLekha POS" | "the a single free POS (point-of-sale) software in Cambodia" — [App Store](https://apps.apple.com/kh/app/id1576065840) |
| POS CAMBODIA | "POS CAMBODIA" ("Krubkrong-POS-Mobile") | feature dump, no positioning line — [Apple lookup](https://itunes.apple.com/lookup?id=6463697172&country=kh) |
| ABA Merchant | "ABA Merchant" | "free to use mPOS solution for any sized businesses" — [App Store](https://apps.apple.com/kh/app/id1559488956) |

### Inferences
- "Real profit after cost of goods" is not claimed in the title or tagline of any competitor found. Daily Sales Record comes closest ("see your profit instantly"). That makes it the most open positioning for BizManage, in line with the ASO plan's "profit tracker" subtitle.
- "Made for Cambodian shops" is claimed only by tiny apps (MyLekha, AB Pro KH). A well-reviewed app could own it.

### Gaps
- iOS subtitles for most SEA apps could not be scraped reliably; the parser picked up subtitles of "You might also like" apps, so those were discarded.

## Q6. "Do nothing" competitors: paper notebook, Excel/Google Sheets, Telegram/Facebook chat records, bank apps

### Takeaway
Little hard data exists. The one Cambodian study found says digital technology adoption among MSMEs is "uneven and relatively low". The free alternatives a shop owner already has are bank apps with millions of users and chat apps that dominate the KH App Store.

### Cited Findings
- A 2023 CDRI survey of 1,000 tourism MSMEs in seven provinces found digital technology adoption "uneven and relatively low" — [CDRI via Open Development Mekong](https://data.opendevelopmentmekong.net/th/library_record/the-current-state-and-role-of-digital-technology-adoption-in-tourism-msmes-in-cambodia).
- Ratings in the KH storefront for the free tools a shop already uses: ABA Mobile 15,993; Wing Bank 15,822; ACLEDA mobile 36,006; Facebook 639,605; Messenger 469,904; TikTok 307,277 — Apple search API, 15 Nov 2026 ([ABA Mobile](https://apps.apple.com/kh/app/id968860649), [ACLEDA](https://apps.apple.com/kh/app/id1196285236), [Wing](https://apps.apple.com/kh/app/id1113286385)).
- ABA Merchant is free mPOS for ABA account holders (1M+ Play installs, 4,092 ratings) — [App Store](https://apps.apple.com/kh/app/id1559488956), [Play](https://play.google.com/store/apps/details?id=com.ababank.payway). ABA Business adds expense tracking for business-banking users — [Apple lookup](https://itunes.apple.com/lookup?id=6445813834&country=kh).
- Competitor marketing positions directly against notebooks and spreadsheets: KitaTracker says "Replace paper notebooks and spreadsheets with one simple business app" — docs/aso/competitors.json; Daily Sales Record says "No accounting knowledge needed" — docs/aso/competitors.json.

### Inferences
- The bank apps already record every transfer, so a shop's "sales record" is partly in ABA or ACLEDA history. BizManage's cash/transfer split and income statement compete with "I can see it in my ABA app", not with Loyverse. The pitch has to be what bank apps cannot show: stock, cost of goods, profit and staff.
- Telegram and Facebook chats act as order books for social sellers. BizManage's link/QR order menu, where orders land as carts, is a direct replacement and could be marketed that way.

### Gaps
- No source quantified notebook, Excel or Telegram record-keeping among Cambodian retail shops. Telegram's KH user count was not gathered.

## Q7. Gaps: what no cheap phone-first app does well

### Takeaway
Across 30+ apps, none under $10/mo for the whole team offers all of these together: (a) a Khmer UI advertised on the store, (b) riel and dollar at the shop's own rate, (c) buying by carton and selling by piece, (d) landed cost, (e) an income statement after COGS, and (f) unlimited staff and branches. Each is found somewhere, but split across products or locked in high tiers.

### Cited Findings
- UoM conversion is Zoho Premium at $129/mo — [Zoho](https://www.zoho.com/inventory/pricing/); landed cost is Lightspeed at $89+/mo — [Lightspeed](https://www.lightspeedhq.com/pos/retail/pricing/).
- Staff roles cost $89 per location (Shopify POS Pro) or $5 per employee (Loyverse) — [Shopify](https://www.shopify.com/pos/pricing), [Loyverse](https://loyverse.com/pricing).
- COGS reports need paid tiers at Square (Plus) and majoo (Advance) — [Square](https://squareup.com/us/en/point-of-sale/retail/pricing), [majoo](https://majoo.id/harga).
- Riel/dollar is found only in tiny local apps (MyLekha, 10 KH ratings) — [App Store](https://apps.apple.com/kh/app/id1576065840).
- Large SEA players are rated poorly on iOS (KiotViet 2.9, Sapo 3.46, StoreHub Manager 1.89, Wongnai POS Manager 2.47) — Apple search API ([KiotViet](https://apps.apple.com/vn/app/id1146695068), [Wongnai POS Manager](https://apps.apple.com/th/app/id6444689682)).
- Features BizManage lacks, which many competitors offer: card payments (Square, Shopify, Qashier, Lightspeed), loyalty (Loyverse free, Sapo Pro, Lightspeed), invoices and e-invoicing (Vyapar, myBillBook, KiotViet), hardware (Qashier, Wongnai, Olsera bundles), offline mode (Mobi POS, Silom, Daily Sales Record) — sources as cited in Q1–Q4.

### Inferences
- The open gap is "accountant-grade profit for a minimart, on one phone, in Khmer, for one price". BizManage covers it in-product, but the evidence that it does (store languages, screenshots, ratings) is not on its listing.
- Main competitive risks: (1) Loyverse is free, in Khmer and dominant in the KH search results; (2) KiotViet already lists Khmer and could move into Cambodia; (3) ABA and other banks could add inventory or sales features to free merchant apps. Points (2) and (3) are speculative.
- The missing features (invoices, card payments, loyalty) matter less to Cambodian cash/KHQR minimarts than to Western retailers, but invoices are a common reason for one-star reviews in Indian billing-app categories (inference, not verified).

### Gaps
- Not checked: KiotViet's actual presence in Cambodia (sales team, KHQR support).
- Not checked: whether any bank merchant app (ABA, ACLEDA, Wing) offers inventory. Only their store descriptions were read.
- Hands-on checks of competitors' UoM, landed cost and offline behaviour were not done; claims come from listings and pricing pages.
