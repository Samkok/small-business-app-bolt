# Voice of the customer: complaints, unmet needs and praise in mobile POS, inventory and small-business bookkeeping apps

Research date: 2026-11-15. Most of the evidence comes from reviews collected directly from the stores.
- **App Store:** about 2,700 reviews from the public RSS feeds (`https://itunes.apple.com/{country}/rss/customerreviews/page=N/id={appId}/sortBy=mostRecent/json`). They cover Loyverse (10 storefronts: us, gb, au, ph, my, th, id, sg, vn, in), Square POS, Square Retail, Shopify POS, Zoho Inventory, Sortly, inFlow, KiotViet (vn) and myBillBook (in).
- **Google Play:** about 2,400 reviews (newest plus "most relevant") for Loyverse, Square, Shopify POS, Zoho Inventory, BukuWarung (id), Khatabook (in), Vyapar (in) and KiotViet (vn).
- **Overlap removed:** after deduplication there are 5,103 unique reviews. 1,848 are 1-2 stars, and 1,153 of those are dated 2024-2026.
- **Web sources:** these add context (Capterra, GetApp, Trustpilot, vendor pricing pages, forum and complaint aggregators).
- **Reddit:** search was blocked (the JSON API returned HTML, and site: searches returned no reddit.com threads). Reddit evidence below is therefore second-hand.

How to read the frequency numbers:
- **Method:** counts come from keyword and regex tagging of review text. Treat them as lower-bound signals, not exact shares.
- **Translations:** quotes not in English are my translations and are marked "(tr. from X)".
- **App Store source links:** the app's page, e.g. `https://apps.apple.com/{country}/app/id{appId}`, plus the RSS feed above. Store reviews have no per-review URL.
- **Play source links:** `https://play.google.com/store/apps/details?id={package}`.

## 1. Top complaint themes, ranked by frequency, with quotes

### Takeaway
The pain changes with the type of app.
- **Payment-led POS (Square, Shopify):** reviews are dominated by funds holds and account closures, unreachable or AI-only support, and updates that break the checkout or the scanner.
- **Light, free-first apps (Loyverse, BukuWarung, Khatabook, Vyapar, KiotViet):**
  - Bugs and lag: lag, crashes and updates that make things worse.
  - Money and support: features moved behind paywalls, and support that is good before the sale and gone after it.
  - Hardware and stock: Bluetooth printers that will not connect, and stock that is not deducted or not synced.

Data loss is less common but is the most emotional complaint. Multi-unit, wrong profit and offline complaints are rare in volume but get many upvotes.

### Cited Findings

**Frequency overview: App Store 1-2 star reviews, 2024-2026, keyword-tagged** (from [Square POS](https://apps.apple.com/us/app/id335393788), [Shopify POS](https://apps.apple.com/us/app/id686830644), [myBillBook](https://apps.apple.com/in/app/id1612498254), [KiotViet](https://apps.apple.com/vn/app/id1146695068), [Loyverse](https://apps.apple.com/us/app/id1070865387))

**Square POS** (176 negative reviews)
- Price, fees or money words: 65. Inflated, because "money" also appears in hold complaints.
- Support: 45.
- Funds hold, deactivation or payout: 33.
- Update broke something: 27.
- Hardware: 18.
- Login: 15.

**Shopify POS** (90 negative reviews)
- Update broke something: 28.
- Hardware, reader or scanner: 25.
- Support: 18.
- Slow or crashing: 15.
- Price: 14.

**myBillBook** (96 negative reviews)
- Support: 28.
- Price or paywall: 27.
- Slow or crashing: 11.

**KiotViet** (201 negative reviews, Vietnamese regex, Jul 2024 - Nov 2026)
- Lag, crashes or errors: 97 (48%).
- Price or fees: 42.
- Update or app merge made it worse: 40.
- Poor support: 39.
- Unwanted sales calls after signup: 31.
- Bluetooth printer or scanner: 9.
- Inventory wrong: 8.
- Ads inside a paid app: 8.

**Loyverse** (only 27 negative iOS reviews in 2024-26, out of 616 total)
- Rating spread is 59 one-star against 378 five-star. Bluetooth printer or scanner complaints are the largest negative cluster.

**Combined iOS and Play data, 1,153 negative reviews from 2024 on**
- Login or OTP: 49.
- Unwanted sales calls: 44.
- Update made it worse: 37.
- Bluetooth printer or scanner: 33.
- Funds held: 31.
- Support is a bot or AI only: 29.
- Auto-renew or cancellation trouble: 27.
- Intrusive permissions (SMS, location): 24.
- Feature moved behind a plan: 13.
- Inventory not deducting or wrong: 11.
- Data lost: 7.
- Offline: 5.
- Profit or report wrong: 3.
- Multi-unit: 1, but the related Vyapar review has 410 upvotes.

**A. Funds holds, account closures and payout delays (Square, Shopify)**
- Square: "Square permanently closed my account without providing a specific explanation and is withholding $1,600" (1★, Oct 2026) — [Square POS, App Store US](https://apps.apple.com/us/app/id335393788)
- Square: "They take 8-10 days to give you your money, very outdated" (1★, Sep 2026) — [Square POS, App Store US](https://apps.apple.com/us/app/id335393788)
- Shopify: "there was a 'pause' on my payouts" right after the seller spent days loading inventory (1★, Sep 2025) — [Shopify POS, App Store US](https://apps.apple.com/us/app/id686830644)
- Shopify: "Woke up to a email about our store being terminated… only been using the system for less than a week" (1★, Jun 2025) — [Shopify POS, App Store US](https://apps.apple.com/us/app/id686830644)
- Trustpilot and ConsumerAffairs show the same pattern. One reviewer reports a "$9000" hold with deactivation and no explanation. Square's replies say holds are part of its terms (unusual activity, disputes) — [Trustpilot Square US](https://www.trustpilot.com/review/squareup.com?page=2); [ConsumerAffairs Square](https://www.consumeraffairs.com/business/square.html?page=3)
- BBB rating for Square is cited as 1.06 from 538 reviews (second-hand figure) — [cardpaymentoptions.com](https://www.cardpaymentoptions.com/how-to-contact-square/)

**B. Support that disappears after purchase, or is a bot**
- myBillBook: "The customer support… is now almost entirely AI-based, making it very difficult to connect with a human" (1★, Jul 2026) — [myBillBook, App Store IN](https://apps.apple.com/in/app/id1612498254)
- Vyapar: "There will be a minimum of 10 calls per day to purchase the app. And not a single call after we buy" (1★, Aug 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- KiotViet: "Before you pay, sales call from morning to night. After you buy… support is nowhere" (tr. from Vietnamese, 1★, Apr 2026) — [KiotViet, App Store VN](https://apps.apple.com/vn/app/id1146695068)
- BukuWarung: "reported it to CS, the CS is AI" (tr. from Indonesian, 1★, 42 upvotes, Aug 2026) — [BukuWarung, Play](https://play.google.com/store/apps/details?id=com.bukuwarung)
- Shopify: "good luck talking to their LLM that doesn't resolve any issues" (1★, Oct 2025) — [Shopify POS, App Store US](https://apps.apple.com/us/app/id686830644)
- Square: "spent from 3:19pm until 4:19pm in a chat message being transferred" (1★, Nov 2026) — [Square POS, App Store US](https://apps.apple.com/us/app/id335393788)

**C. Updates that break checkout or change the UI too often**
- Shopify: "Every time someone checks out the buttons for cash go away and we had to force close" (1★, May 2026) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- Shopify: "The interface of the app changes every. damn. month… new employees get hired all the time" (2★, Apr 2026) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- Shopify: "QA process for shopify is gone… every update i keep losing my ability to run till counts" (1★, Apr 2026) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- KiotViet: merging the separate selling app into the management app "lost many good features… lag, freezes, keeps kicking out" (tr., 1★, Mar 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- Square Android: "you push an update. that deems the app unusable… my client is standing there" (1★, 55 upvotes, Jul 2026) — [Square, Play](https://play.google.com/store/apps/details?id=com.squareup)
- BukuWarung Android: for months the bottom row of the keypad ("0") and the Save button sat under the Android navigation bar. Reviews: "complaint since January… still not fixed in May 2026" (tr., 20 upvotes), and similar posts with 19 and 42 upvotes. A fix was acknowledged in Nov 2026 — [BukuWarung, Play](https://play.google.com/store/apps/details?id=com.bukuwarung)

**D. Bluetooth printers, scanners and card readers**
- **Loyverse iOS (recurring 2023-2026):** only listed printer models connect over Bluetooth on iOS. "Other model" offers Ethernet only, which blocks the cheap printers common in SEA (Xprinter, PeriPage, PT-210, XP-58).
  - About 15 iOS reviews from PH, MY, TH, ID, VN and US.
  - Example: "There is no other Bluetooth printer option" (1★, IN, May 2026) — [Loyverse, App Store](https://apps.apple.com/in/app/id1070865387)
  - Example: "Most branded barcode scanners are not supported" (1★, AU, Mar 2026) — [Loyverse, App Store AU](https://apps.apple.com/au/app/id1070865387)
- Shopify: "Can't search by barcode scan anymore" (1★, Oct 2026); "reader disconnects multiples times per day" (1★, Oct 2026) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- Shopify: "I need to keep a backup Square reader around for when this app inevitably breaks down" (1★, Jul 2025) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- KiotViet: "Bluetooth printing errors"; "can't scan barcodes even though the barcode is complete" (tr., 1★, 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)

**E. Stock not deducting, not syncing, or counts wrong**
- **Loyverse Thailand, v3.12 (May 2026):** at least 5 reviews in two weeks saying stock was not deducted after sales.
  - "Keyed the order but stock won't deduct, have to log out and log in again" (tr. from Thai, 1★).
  - A Thai user wrote a detailed bug report saying iOS devices don't refresh inventory in real time while Android does (3★).
  - Source: [Loyverse, App Store TH](https://apps.apple.com/th/app/id1070865387)
- Loyverse PH: "Inventory count across different devices are not balanced" (1★, Jun 2026); "Always having discrepancy in inventory. Even after doing numerous inventory" (1★, 2023, older) — [Loyverse, App Store PH](https://apps.apple.com/ph/app/id1070865387)
- Square: "I have not conducted a single inventory that didn't delete other inventory" (1★, Oct 2026) — [Square POS](https://apps.apple.com/us/app/id335393788)
- Sortly: "Every time I take items off it does not update… Desktop updates straight away app does not" (1★, GB, Feb 2026) — [Sortly, App Store GB](https://apps.apple.com/gb/app/id529353551)
- KiotViet: "the phone app shows inventory incorrectly" (tr.). Three near-identical reviews were posted on 2025-08-25, which suggests an outage — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- Vyapar: "Stock and payment mismatches are also a serious concern" (1★, Sep 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)

**F. Data loss (low count, very high emotion)**
- BukuWarung: "sales data lost and can't be recovered at all… I trusted this app for 5 years" (tr., 1★, Sep 2026). Another review says the app became "not compatible with the device… all recorded data is gone" after 3+ years (tr., 1★, Aug 2026) — [BukuWarung, Play](https://play.google.com/store/apps/details?id=com.bukuwarung)
- Khatabook: "I used it to keep track of my shop's accounts, but everything has vanished on its own" (1★, Jun 2026) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- Loyverse: "This app force closes and you lose all the work you're working on" (1★, US, Jan 2026) — [Loyverse](https://apps.apple.com/us/app/id1070865387)
- Shopify: "Integration was an ever lasting nightmare we lost an incredible amount of customers information" (1★, Oct 2025) — [Shopify POS](https://apps.apple.com/us/app/id686830644)

**G. Wrong profit and reports**
- Vyapar: "profit/loss is not correct. Opening stock is considered profit" (5★ but critical, 76 upvotes, Mar 2024) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- Vyapar: "Split payments (part cash, part online) aren't tracked accurately in downloaded reports" (1★, 410 upvotes, Sep 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- Khatabook: the P&L "shows profit on the basis of purchase price and sales price… but we apply itemwise discount" (2★, Aug 2026) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- KiotViet: "calculates wrong… reports are off by hundreds of times, while I enter data accurately" (tr., 1★, Apr 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- Loyverse (older, 2023): "gross profit not coincide with the manual gross profit" — [Loyverse PH](https://apps.apple.com/ph/app/id1070865387)
- StoreHub (Capterra): "BIR reports doesn't match with back office reports" — [Capterra UK StoreHub](https://www.capterra.co.uk/reviews/146620/storehub)
- myBillBook: "No option to get product wise sales report (only quantity is shown)" (1★, Apr 2026) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
- Shopify: "Fix the net sales function in analytics" (1★, Jun 2025) — [Shopify POS](https://apps.apple.com/us/app/id686830644)

**H. Multi-unit and unit of measure gaps (rare but strongly upvoted)**
- Vyapar: "Secondary conversion: unit shows in decimals (e.g., 0.4756…)" (part of the review with 410 upvotes, Sep 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- Loyverse: "simple to use for a pharmacy but no unit correlations for each item" (5★, US, Jul 2026) — [Loyverse](https://apps.apple.com/us/app/id1070865387)
- Clover: a fabric shop left because Clover could not handle fractional yard quantities (summary of a Shopify Community thread) — [Shopify Community](https://community.shopify.com/t/how-to-transfer-and-track-inventory-from-clover-to-shopify/133324)

**I. Offline and internet dependence**
- Loyverse: "I could see the receipts without internet connection. Now Receipts file suddenly unavailable while offline" (2★, MY, Aug 2025) — [Loyverse MY](https://apps.apple.com/my/app/id1070865387)
- Khatabook: "The app does not open without internet" (2★, 22 upvotes, Nov 2026) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- Square Android: "Hardware devices can not connect without wifi" (1★, Sep 2026) — [Square, Play](https://play.google.com/store/apps/details?id=com.squareup)
- KiotViet: "App opens so slowly… Shopee loads instantly… 5 minutes to open to sell" (tr., 1★, Oct 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)

**J. Setup, onboarding, login and permissions**
- Shopify: "I cannot get past making a pin. It says no staff member found for onboarding" (1★, Mar 2026); "SHOPIFY does not have any kind of training mode" (1★, Sep 2026) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- Khatabook: compulsory "location, SMS, call log permission… otherwise u cant use this app" (1★, 34 upvotes, Aug 2026); an older review on the same theme has 682 upvotes (2023) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- Khatabook: a forced "New app version available" screen appears even when the app is up to date and blocks access to transactions (1★, 13-14 upvotes, Aug-Sep 2026) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- KiotViet: "Why keep forcing users to log in again" (tr., 1★, Jul 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)

**K. Inventory apps: "too complex" or "too many clicks"**
- Zoho Inventory: "Marking an order as 'Fulfilled' takes 4 clicks in different parts of the screen" (1★, Jan 2026) — [Zoho Inventory](https://apps.apple.com/us/app/id1037960494)
- Zoho: "need to be able to scan a barcode in real time and either add or subtract from my current stock" (2★, Jan 2026) — [Zoho Inventory](https://apps.apple.com/us/app/id1037960494)
- inFlow: "they updated it and now there's extra steps to scanning products" (1★, Feb 2025) — [inFlow](https://apps.apple.com/us/app/id1397589892)
- Shopify (UK): "Its a webshop trying to be an epos… to set up combined discounts there 6 unnecessary steps" (1★, Dec 2025) — [Shopify POS GB](https://apps.apple.com/gb/app/id686830644)

### Inferences
- **The most effective "lead-with" pains for a payment-agnostic, phone-first app:**
  - "We never hold your money", because BizManage does not process cards.
  - "Updates won't move your buttons".
  - "A human answers after you pay".
  - "Stock deducts on every sale, on every phone".
- **Funds holds** are a Square and Shopify pain. They help BizManage only as contrast messaging, mainly for markets where those processors operate. They are not a native SEA pain.
- **Data loss and stock not deducting** are the most trust-destroying events. Either one turns a long-time 5★ user into a 1★ user overnight (BukuWarung "5 years", Loyverse TH v3.12).
- **Mistakes to avoid:**
  - Release discipline and offline-safe writes matter more than features.
  - Never block access to existing records behind a forced update, login or permission.
- **Volume versus intensity:** wrong profit and multi-unit complaints are few in number but get very high upvotes (410, 76). They are "considered-buyer" pains. That makes accurate profit (landed cost, discounts, split payments) and multi-unit stock credible differentiators for retailers who compare apps.

### Gaps
- Google Play reviews for StoreHub, Qashier, Moka POS, myBillBook (Android), Sortly (Android) and Kasir Pintar were not collected, because the guessed package IDs returned nothing and the Play search pages could not be parsed. SEA coverage relies on Loyverse (TH, PH, MY, ID, VN), KiotViet (VN), BukuWarung (ID), and the India apps as an analogue.
- The App Store RSS feed returns at most 500 recent reviews per storefront. For Square that window covers only recent months. Older Square themes (e.g. hardware lock-in) are under-sampled.
- No Cambodia-specific app reviews were found for small POS apps. MyLekha POS and "POS CAMBODIA" exist on the App Store but were not mined.

## 2. Switching: what users moved from and to, and why

### Takeaway
Reddit could not be mined directly. Store reviews and forum summaries show four recurring moves:
- **Square to Loyverse:** after Square dropped the merchant, or because of fees.
- **Square to Shopify POS:** for omnichannel inventory.
- **Vyapar and myBillBook, in both directions:** driven by automation versus after-sales support.
- **KiotViet to MISA:** over tax and e-invoice reliability.

The triggers are almost always price or plan changes, account closures, after-sales support, or a missing must-have feature. They are rarely UI preference.

### Cited Findings
- **From Square to Loyverse:**
  - "Square dropped us after nearly 8 years!… found this app… it has been great" (5★, US, Nov 2025) — [Loyverse](https://apps.apple.com/us/app/id1070865387)
  - "I was using another payment brand and POS but with rising prices I moved here" (5★, GB, May 2026) — [Loyverse GB](https://apps.apple.com/gb/app/id1070865387)
- **From Loyverse, or considering leaving, after a paywall:** "no longer possible to download sales data into CSV without paying… we will need to look around the market" (1★, 11 upvotes, Apr 2025) — [Loyverse, Play](https://play.google.com/store/apps/details?id=com.loyverse.sale)
- **Square to Shopify POS:** described as the top migration pattern ("8x") in a Reddit-derived analysis, citing centralised inventory with a Shopify web store. Some users missed Square's "simpler mobile interface". This is second-hand, an AI-generated aggregation — [Discury Reddit report](https://discury.io/report/best-pos-systems-for-small-business-reddit)
- **Shopify regret, wishing for Square:** "My shop was shut down twice in a week before my first market… I should have gone with Square!!!" (1★, Mar 2025) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- **Vyapar to myBillBook:** "Leaving Vyapar after 6 years… Competitors like My Billbook easily scan purchase invoice PDFs to auto-enter data" (1★, 83 upvotes, Jul 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- **myBillBook back toward Vyapar:** "vypar is way ahead in after sales and service i had left vypar app coz its UI" (1★, Jun 2026) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
- **KiotViet to MISA:** "VAT error reported for days, not resolved… Use Misa" (tr., 1★, Jun 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- **KiotViet, abandoned within a month:** "Bought a 1-year plan… less than a month later had to buy another vendor's software" (tr., 1★, Apr 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- **myBillBook, abandoned for another tool:** "I have pay them 7000… because of them I purchased another software" (1★, Jan 2026) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
- **Sortly to other tools after price rises:** reviewers cite a jump "from $1500 per year to $2750" and a "300% price increase with only 30 days supposed notice". Some moved to Fishbowl, which one called "very cumbersome" — [Capterra Sortly](https://www.capterra.com/p/169199/Sortly-Pro/reviews/); [GetApp/Trustpilot via search summary](https://uk.trustpilot.com/review/sortly.com?page=2)
- **Sortly in the App Store:**
  - "Years ago this was the best inventory app – now it's almost $90 AUD a month… Pure greed" (1★, AU, Oct 2026) — [Sortly AU](https://apps.apple.com/au/app/id529353551)
  - "900% price increase in two years! AVOID!" (1★, GB, Sep 2025) — [Sortly GB](https://apps.apple.com/gb/app/id529353551)
- **Clover to Shopify:** no direct inventory migration path (CSV export and import), and hardware often needs replacing. A fabric shop left over fractional quantities — [Shopify Community](https://community.shopify.com/t/how-to-transfer-and-track-inventory-from-clover-to-shopify/133324)
- **Square kept alongside Shopify:** some shops keep Square in-store and Shopify online, bridged by a sync app — [Shopify Community](https://community.shopify.com/t/does-anyone-use-square-pos-for-in-store-and-shopify-for-online/29780)
- **Loyverse on Reddit:** a Reddit-comment aggregator mostly shows praise for Loyverse as free, e.g. "We use loyverse, works pretty good, cost us nothing" — [GummySearch POS](https://gummysearch.com/tools/best-products/pos/)

### Inferences
- **Moments a switch happens:**
  - A price or plan change for existing users.
  - A lockout: account closed, or data stuck behind a paywall.
  - A failed support case after paying.
  - BizManage onboarding should make import from Loyverse, KiotViet and Excel easy for the users who arrive at those moments.
- **Two things users in switching reviews value:** a credible promise of price stability for existing users ("your price won't jump on renewal") and exportable data ("your data is always yours to export"). Both work as acquisition hooks and as retention reassurance.
- **Square-to-Loyverse movers fit BizManage's profile:** small, price-sensitive, phone-first. They should be considered a target segment where BizManage operates.

### Gaps
- No primary Reddit or Facebook-group threads were retrieved. Reddit blocked the JSON API, and site: searches returned only non-Reddit pages. The Discury "8x" figure comes from an automated aggregation and is unverified.
- No SEA-specific switching data was found for StoreHub, Qashier or Moka.

## 3. What happy reviewers praise

### Takeaway
"Easy or simple" is by far the top praise word. "Free" is the decisive reason for the free-first SEA apps (Loyverse, Zoho Inventory free tier, Khatabook). After those come phone-only operation ("all I need is my phone"), speed, a responsive human, and data backup. Feature-rich praise is rare.

### Cited Findings
- Among 2024-2026 five-star App Store reviews (275 across apps), the keyword counts were:
  - Easy or simple: 77 (about 28%).
  - Human or helpful support: 24.
  - Fast: 19.
  - Inventory: 13.
  - Reports: 12.
  - Free: 8, with Loyverse and myBillBook prominent.
  - Source: [Square POS](https://apps.apple.com/us/app/id335393788), [Loyverse](https://apps.apple.com/us/app/id1070865387), [myBillBook](https://apps.apple.com/in/app/id1612498254)
- Loyverse: "BEST FREE POS APP FOR SMALL BUSINESSES… The UI is very simple and not overwhelming" (5★, PH, Oct 2026) — [Loyverse PH](https://apps.apple.com/ph/app/id1070865387)
- Loyverse: "Easy to use, and most importantly free" (tr. from Thai, 5★, Aug 2026) — [Loyverse TH](https://apps.apple.com/th/app/id1070865387)
- Loyverse: "Help videos and AI chat is very intuitive. If the AI doesn't give the right answer the humans are also excellent" (5★, PH, Apr 2026) — [Loyverse PH](https://apps.apple.com/ph/app/id1070865387)
- Loyverse: "good app for new business owners as the UI/UX is very easy… It even have some analytics in the back office" (5★, MY, Oct 2025) — [Loyverse MY](https://apps.apple.com/my/app/id1070865387)
- Square: "Great service, and all I need is my phone!" (5★, Oct 2026); "This was my first pop up and everything went well. It was so easy to use with my phone" (5★, Oct 2026) — [Square POS](https://apps.apple.com/us/app/id335393788)
- Square: "I was always impressed with how fast Square is" (from a 2★ review complaining about a later update, AU, Oct 2026) — [Square POS AU](https://apps.apple.com/au/app/id335393788)
- Khatabook: "App too good user interface, data backup so comfortable" (5★, 695 upvotes, Nov 2026) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- Zoho Inventory: "very easy to use… Few Minutes to take a report out of it" (5★, 271 upvotes, Apr 2025); "Seriously a great free ap" (5★, 236 upvotes, Oct 2024) — [Zoho Inventory, Play](https://play.google.com/store/apps/details?id=com.zoho.inventory)
- Vyapar: "one of the best and easiest business management applications" (5★, Aug 2026); "it's executives are always ready to help" (5★, Sep 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- Loyverse is rated 4.67★ from 375 ratings and Square POS 4.81★ from 607,934 ratings in the US App Store (iTunes Search API, Nov 2026). Loyverse Play reviews (most-relevant sample, 200) were 118 five-star against 18 one-star — [Loyverse](https://apps.apple.com/us/app/id1070865387); [Square](https://apps.apple.com/us/app/id335393788)
- Even happy reviewers ask for things. Five-star reviews often carry a feature request:
  - Unit correlation (Loyverse US).
  - A different currency per store (Loyverse US, Sep 2025).
  - Label printing for cups (Loyverse US).
  - Partial payments (Zoho Inventory, 355 upvotes).
  - Plus/minus stock adjustment without an edit screen (Zoho Inventory, 396 upvotes).
  - Sources: [Loyverse](https://apps.apple.com/us/app/id1070865387); [Zoho Inventory, Play](https://play.google.com/store/apps/details?id=com.zoho.inventory)

### Inferences
- **Value-proposition order for BizManage copy:**
  - Open with "simple enough to start selling in minutes on your phone".
  - Then "know your real profit".
  - Feature lists come last.
- **BizManage cannot win on "free" against Loyverse.** It needs to show visibly what the money buys: the whole team included, profit that is right, and a human who answers.
- **Two highly upvoted Zoho requests are cheap to support:** quick plus/minus stock adjustment and partial payments or credit sales. They are good demo moments.

### Gaps
- Praise counts are keyword-based. Short 5★ reviews ("good app") were not classified.

## 4. SEA micro-shop specifics: language, local currency, Telegram, internet outages, cost in local terms

### Takeaway
SEA reviews point to concrete, fixable gaps:
- **Hardware:** support for cheap Bluetooth printers on iOS.
- **Payments:** local payment methods for the POS itself (bank transfer and QR, not just card) and for paying the subscription.
- **Localisation:** language on iPad and multi-currency per store.
- **Selling style:** pressure-free selling instead of call-centre harassment.
- **Pricing:** "is it free?" anxiety, and complaints about yearly price rises in local currency terms.

Telegram and KHQR come from Cambodian banks (Telegram sales alerts are a bank-side feature there), not from POS reviews. No riel or dong pricing complaints were found in reviews.

### Cited Findings
- **Cheap Bluetooth printers on iOS (PH, MY, TH, ID, VN):**
  - "Xp 58IIH was my printer… there's no other option for other printer bluetooth" (1★, PH, Aug 2026) — [Loyverse PH](https://apps.apple.com/ph/app/id1070865387)
  - "please add support for small printers like PeriPage" (tr. from Thai, 3★, Jun 2026) — [Loyverse TH](https://apps.apple.com/th/app/id1070865387)
  - "update PT210 printer for iPhone" (tr. from Vietnamese, 5★, Apr 2026) — [Loyverse VN](https://apps.apple.com/vn/app/id1070865387)
- **Local payment methods at the till:** "I'd like transfer and QR code payment methods, because most customers pay this way" (tr. from Thai, 3★, Jan 2024) — [Loyverse TH](https://apps.apple.com/th/app/id1070865387)
- **Paying the subscription itself:**
  - "Subscription payment always rejected. Please make an easy subscription via transfer" (tr. from Indonesian, 3★, Jul 2024) — [Loyverse ID](https://apps.apple.com/id/app/id1070865387)
  - "the app always directs me to use a credit card" (tr. from Indonesian, 5★, Dec 2025) — [Loyverse ID](https://apps.apple.com/id/app/id1070865387)
- **"Is it free?" anxiety:**
  - "Is the app free or do I have to pay a membership fee? I want to try but I'm afraid of paying" (tr. from Thai, 3★, Oct 2025) — [Loyverse TH](https://apps.apple.com/th/app/id1070865387)
  - The same question appears again in Nov 2024 (3★) — [Loyverse TH](https://apps.apple.com/th/app/id1070865387)
- **Language and currency:**
  - "using it on iPad, want to change the language to Thai" (tr., 5★, Jul 2025) — [Loyverse TH](https://apps.apple.com/th/app/id1070865387)
  - "if we have few stores in one account, we should be able to pick either same or different currencies" (5★, US, Sep 2025) — [Loyverse](https://apps.apple.com/us/app/id1070865387)
  - Zoho Inventory: "No tiene más idiomas" (it has no other languages; 1★, Sep 2025) — [Zoho Inventory](https://apps.apple.com/us/app/id1037960494)
- **Country availability:** "service is not available in your country… why would a 'free' app be unavailable" (1★, Jul 2026) — [Loyverse, Play](https://play.google.com/store/apps/details?id=com.loyverse.sale)
- **Price rises in local terms (Vietnam):**
  - "Price rises every year unreasonably, raising prices while cutting useful features" (tr., 1★, May 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
  - "An app that costs 10-something million [VND] a year and errors up and down" (tr., 1★, Sep 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- **Sales-call harassment after a trial signup (Vietnam, India):**
  - KiotViet: "Registered a trial, a dozen calls a day, I said no need but they keep calling" (tr., 1★, May 2026). This is 31 of 201 KiotViet negative reviews (about 15%) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
  - myBillBook (Hindi): "if you even look at their app by mistake you'll get a phone call to buy it" (tr., 1★, Apr 2026) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
- **Ads in a paid app:** "Bought the yearly plan, yet there are still lots of ads in the app" (tr., 1★, May 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- **Phone not enough:** "On the phone it doesn't have enough functions, forced to use a computer/laptop" (tr., 1★, Apr 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- **Low-end Android phones and layout:** BukuWarung's Android navigation-bar overlap is the most-upvoted issue in its recent reviews (see 1C). A separate complaint says the app is "not compatible" on Android 12 despite requiring only Android 5 (tr., Aug 2026) — [BukuWarung, Play](https://play.google.com/store/apps/details?id=com.bukuwarung)
- **Tax and e-invoice compliance is a must-have in VN and IN:**
  - KiotViet: "Digital signature errors continuously, not sending invoice info to the tax authority" (tr., 1★, Aug 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
  - myBillBook: "Serious Concerns About GST Compliance" (1★, Mar 2026) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
  - StoreHub: Philippine BIR report mismatch (Capterra) — [Capterra UK StoreHub](https://www.capterra.co.uk/reviews/146620/storehub)
- **Telegram and KHQR in Cambodia (bank side):**
  - BRED Bank offers a free feature to "confirm all your BRED KHQR sales instantly to your own Telegram group" — [BRED Cambodia merchant services](https://www.bredcambodia.com/business-banking/merchant-services)
  - LOLC KHQR offers real-time Telegram alerts (summary of an EAC News article) — [eacnews.asia](https://eacnews.asia/home/details/33016)
  - BIDC Smart POS sends instant KHQR payment notifications — [BIDC Smart POS](https://www.bidc.com.kh/en/page/smart-pos)
  - PayWay requires merchants to give it a webhook URL to receive KHQR payment notifications — [PayWay KHQR guideline](https://developer.payway.com.kh/khqr-guideline-3192101f0.md)
- **Riel support:** MyLekha POS markets itself as a free Cambodian POS that accepts "multi currencies (USD or Riel)" — [MyLekha POS, App Store](https://apps.apple.com/hk/app/mylekha-pos/id1576065840)
- **StoreHub price, Malaysia:** StoreHub Malaysia is listed "From RM1,456/yr (Starter)" in a third-party comparison. Support hours of 8:30 AM - 10:30 PM are cited by a competitor's blog — [getslurp.com guide](https://getslurp.com/?p=18617); [HashMicro StoreHub review](https://www.hashmicro.com/ph/blog/storehub-pos-review)

### Inferences
- **Concrete SEA wins for BizManage:**
  - Cheap Bluetooth thermal printer support on both iOS and Android, with a generic ESC/POS "other printer" option.
  - Non-card ways to pay the subscription.
  - A visible "free for 50 sales, then $9.99 for the whole team" price on the store listing and in onboarding. This answers the "is it free?" fear before it becomes a 1★ review.
- **Telegram sale alerts:** owners in Cambodia already get Telegram sale alerts from their bank's KHQR. A POS that sends a Telegram daily summary (sales, profit, low stock) fits an existing habit. This is an inference; no review explicitly asked a POS for Telegram.
- **Do not copy the KiotViet and myBillBook model of call-centre follow-up after a trial signup.** In those markets it is a top-5 reason for 1★ reviews. Low-pressure, in-app conversion is a differentiator.
- **Tax compliance (VAT e-invoice, GST, BIR) is table stakes in VN, IN and PH.** It is a reason to be careful about promising "bookkeeping" in markets where BizManage does not file to tax portals.

### Gaps
- No reviews mentioning riel, dong or baht pricing complaints for the subscription itself were found. Local price complaints were in VND (KiotViet) and generic.
- No direct evidence was found of POS users asking for Telegram integration in reviews. Telegram evidence is from bank products only.
- Internet-outage complaints were few in reviews (5 regex hits in 2024+). This may reflect that offline-capable apps (Loyverse) dominate the SEA sample, not that the need is low.

## 5. Subscription and paywall complaints: what triggers 1★ reviews at paywall time

### Takeaway
Users rarely give 1★ just because an app charges. They give 1★ in six situations:
1. A feature they already used becomes paid. Sales history, CSV export and sync are the typical cases.
2. A renewal strips features from the plan they bought.
3. They need an extra licence per device or per salesperson.
4. A trial is too short to see value.
5. Cancelling is hard, or auto-pay is opaque.
6. Support vanishes after payment.

BizManage's "50 free sales" model sits right next to trigger 4. Its "whole team, one price" model directly answers trigger 3. *(Corrected 15 Nov 2026: the free cap is 50 sales, not 10. This judgement was made at 10 and is weaker at 50.)*

### Cited Findings
- **1. Previously free feature moved behind a paywall:**
  - Loyverse: "now you can only check it for the period of 30 days! You have to pay to use it now" (2★, PH, Jun 2025) — [Loyverse PH](https://apps.apple.com/ph/app/id1070865387)
  - Loyverse: "More and more options are now required to be paid for… I have to now pay for last month's sales records" (1★, AU, Feb 2025) — [Loyverse AU](https://apps.apple.com/au/app/id1070865387)
  - Loyverse: "I already pay $25 per month just to print tickets… Now I have to pay more for a basic function (sales history)" (1★, Play, Jun 2025) — [Loyverse, Play](https://play.google.com/store/apps/details?id=com.loyverse.sale)
  - Loyverse: "my new account cant export any sales report, and can view sales for last 31 days only" (1★, MY, Apr 2024) — [Loyverse MY](https://apps.apple.com/my/app/id1070865387)
  - Loyverse Thai: "free and good… could see past sales summaries, but now I can't" (tr., 5★ but complaining, Mar 2025) — [Loyverse, Play](https://play.google.com/store/apps/details?id=com.loyverse.sale)
- **Loyverse's current price list:** sales analytics are free only for the last 31 days. "Unlimited sales history" is $5/mo or $50/yr per store. Employee management and advanced inventory are about $25/mo per store each. Third-party sites conflict on employee pricing, with some saying $5 per employee — [Loyverse pricing](https://loyverse.com/pricing); [Merchant Maverick](https://www.merchantmaverick.com/reviews/loyverse-review/)
- **Vyapar, core actions gated:**
  - "now i can't even do that without getting the premium subscription. I can't even add or edit products without paying" (1★, Jul 2025) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
  - "When I add a new sale, it suddenly disappears, and a pop-up… I need to get Gold to unlock synchronization" (2★, Jul 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- **Khatabook:** "dedicated user… for the past three years, the recent implementation of paid features has been quite disappointing" (1★, 157 upvotes, Oct 2026) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
- **Square, a forced bundle upgrade:** "I was paying $10 for the ability to message customers… What turned from a free app… now is just a cash grab" (1★, Oct 2026; title "Didn't want to pay $50 a month") — [Square POS](https://apps.apple.com/us/app/id335393788)
- **Shopify:** "Pay for membership, lacks benefits… automatic discounts work on my website but not on POS" (1★, Dec 2025) — [Shopify POS](https://apps.apple.com/us/app/id686830644)
- **2. Renewal strips features:**
  - Vyapar: "at the time of renewal, they have cunningly removed many important features from the Gold Plan" (1★, Aug 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
  - myBillBook: "bought their enterprise plan… after that purchase they have update their policies, Now… only 2 business" (1★, Sep 2026) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
- **3. Extra licence per device or per staff member:**
  - Vyapar: "my salesman cannot create invoices unless I purchase an additional license for the same organization. For a small business…" (1★, Jul 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
  - Vyapar: "purchased gold plan for sync across device. Now they are asking me to buy for another device also" (1★, Sep 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
  - Loyverse (2023, older): "I'd pay to have that admin and staff account wherein staff cant delete or change prices". This shows that staff roles are something users will pay for — [Loyverse PH](https://apps.apple.com/ph/app/id1070865387)
- **4. Trial too short to see value:**
  - Vyapar: "The trial period of 7 days is way too short. i did 1 sale. There used to be a free version" (1★, Aug 2026) — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
  - myBillBook: "gives you 1st free trial and then asks you to get a subscription plan… this app don't works" (1★, Oct 2025) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
  - KiotViet: "Hardly used it, but forced to pay a fee before I can use it. Bait service" (tr., 1★, Jun 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- **5. Cancellation and auto-pay** (27 regex hits in negative reviews since 2024, led by Square and myBillBook):
  - Khatabook: "If you make payment of 2 rupees then your Autopay of rupees 199 start" (1★, Jun 2026) — [Khatabook, Play](https://play.google.com/store/apps/details?id=com.vaibhavkalpe.android.khatabook)
  - Square: "There's no way to cancel the free trial!! They guide you to subscribe to their premium service instead" (1★, Oct 2026) — [Square POS](https://apps.apple.com/us/app/id335393788)
  - myBillBook: "showing 1 week cancellation at the time of purchase and not at all accepting the cancellation after purchase" (1★, Feb 2026) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
  - myBillBook: "They charged me double amount than what is mentioned on the desktop" (1★, Nov 2025) — [myBillBook](https://apps.apple.com/in/app/id1612498254)
- **6. Support disappears after payment:** see section 1B. In KiotViet's negative reviews, the "before-sale calls, after-sale silence" pattern is explicit, e.g. "Only knows how to collect money at the start, then abandons you" (tr., 1★, Aug 2026) — [KiotViet](https://apps.apple.com/vn/app/id1146695068)
- **Paywalls also break workflows mid-task:** the Vyapar sale "suddenly disappears" when the sync paywall pops up — [Vyapar, Play](https://play.google.com/store/apps/details?id=in.android.vyapar)
- **Sortly, a free tier that feels useless:** "The free tier feels useless and core features are missing or locked behind expensive plans" (1★, CA, Jan 2026); "Cool app, massive pay wall" (1★, CA, Jun 2024) — [Sortly CA](https://apps.apple.com/ca/app/id529353551)

### Inferences
- **The highest-risk moment for BizManage is the 50th or 51st sale.**
  - Vyapar's "I did 1 sale" review shows that a short, usage-capped trial reads as "bait" unless the user has already seen the payoff.
  - Before the cap, the user should have seen at least one profit or income-statement view.
  - The cap should be stated on day 0: "50 free sales, then $9.99/month for the whole team", shown in onboarding and on the listing.
- **Never let the paywall eat in-progress work.**
  - Bad pattern to avoid: the Vyapar sale that disappears.
  - Bad pattern to avoid: Loyverse history hidden after 31 days.
  - Let the 51st sale complete, or save it as a draft, then ask.
  - Keep past data visible and exportable after the subscription lapses. That removes the "hostage data" trigger behind many 1★ reviews.
- **"Whole team, one price" answers the per-device and per-salesperson licence anger seen with Vyapar and Loyverse employee management.** It should be a headline claim, contrasted with "per device" and "per staff" models.
- **Grandfathering avoids the "used to be free" and "renewal removed features" triggers.** Behind both is a broken implicit promise, not the price itself. Grandfathering existing users and announcing plan changes in-app would avoid it.
- **Cancellation and payment:** make cancellation one tap through the store subscription (RevenueCat already relies on Apple and Google billing), and avoid any off-store auto-debit. Store-native billing also sidesteps the Indonesia "credit card only" friction on Android, because Google Play supports carrier billing and e-wallets in many SEA markets. That last point is an inference; confirm per market.

### Gaps
- No quantitative data was found on conversion or 1★ rates at the paywall moment specifically. The evidence is review text only.
- Loyverse's exact date for moving sales history beyond 31 days to paid was not found. Reviews suggest it bit new accounts in 2024 and existing users around early to mid 2025.
- Third-party sources conflict on Loyverse employee-management pricing ($25 per store versus $5 per employee). Check the live pricing page.
