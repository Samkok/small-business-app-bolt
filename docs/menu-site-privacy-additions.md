# Online menu website: privacy page additions (2026-10-06)

The app's Privacy Policy 2.0.0 (settings/privacy.tsx, section 7A) now describes how the online
menu handles a shop's customers' data. The menu website's own privacy page
(`~/Desktop/Development/bizmanage_menu`, `src/app/privacy`) should say the same thing in the
customer's voice. Suggested wording, to be added by whoever maintains that site:

**Who is responsible for your order.** The shop whose menu you are using receives your order
and is responsible for your information. BizManage provides the menu on the shop's behalf and
uses your information only to pass the order to the shop and to keep the service safe.

**What we collect.** The name, phone number, delivery address and note you type, the items
you order, and a hashed form of your IP address used only to limit abuse. We keep the order
with the shop's records; the shop can delete it. Orders that are never completed are marked
abandoned after 7 days.

**Bot protection.** The order form may use Cloudflare Turnstile, which processes your IP
address and browser details to tell people from automated scripts. Cloudflare's privacy policy
applies: https://www.cloudflare.com/privacypolicy/

**Hosting.** This website is hosted by Vercel, which records standard request data such as
your IP address: https://vercel.com/legal/privacy-policy

**No advertising tracking.** This website carries no advertising pixel and no analytics
tracker. BizManage's own advertising measurement applies to the BizManage app, not to shop
customers.

**Your rights.** To correct or delete your information, contact the shop. If you believe a
shop is misusing the menu, contact BizManage through the app's support channels.
