# App Store privacy updates for the Meta integration (2.9.x)

What changed in the app: the Meta (Facebook) SDK is in the build, the iOS tracking
question is asked after sign-in, the app reports a fixed funnel to Meta, and the server
reports the first paid subscription to Meta's Conversions API with the price.

Three places must agree: the App Store Connect "App Privacy" answers, the privacy
manifest inside the build, and the public privacy policy page. The manifest is done in
code; the other two are App Store Connect and website edits.

## 1. App Store Connect → App Privacy

Current label (published a year ago): Name, Email Address (linked, app functionality),
Photos or Videos (not linked, app functionality). App Store Connect already shows the
warning that the build asks for tracking permission but no data type is marked as used
for tracking, so the label cannot stay as it is.

### Tracking question

"Do you or your third-party partners use data for tracking?" → **Yes**.

### Data types to add

| Category | Data type | Linked to the user | Used for tracking | Purposes |
|---|---|---|---|---|
| Identifiers | Device ID | Yes | Yes | Third-Party Advertising, Analytics, App Functionality |
| Identifiers | User ID | Yes | Yes | App Functionality, Analytics, Developer's Advertising or Marketing |
| Purchases | Purchase History | Yes | Yes | App Functionality, Analytics, Developer's Advertising or Marketing |
| Usage Data | Product Interaction | Yes | Yes | Analytics, Developer's Advertising or Marketing |
| Usage Data | Advertising Data | Yes | Yes | Developer's Advertising or Marketing |
| Diagnostics | Crash Data | No | No | App Functionality |
| Other Data | Other Data Types | No | No | Analytics |

Why each one:

- Device ID: the Meta SDK reads the advertising identifier when the user allows
  tracking. Meta's own privacy manifest declares it as tracking, linked, with these three
  purposes, so the label must match.
- User ID: the app gives Meta the account id as the event user id, and the server sends
  a hashed account id with Subscribe. RevenueCat also keys purchases by it (this one was
  already missing from the label before Meta).
- Purchase History: the server sends Subscribe with the price to Meta; RevenueCat stores
  every purchase (also missing before).
- Product Interaction: CompletedRegistration, BusinessCreated, FirstSale, ViewedContent,
  InitiatedCheckout, plus the SDK's app-open events.
- Advertising Data: the SDK's install attribution (which ad led to the install).
- Crash Data and Other Data Types: declared by the Meta SDK's manifest for its own
  diagnostics and analytics; not linked, not tracking.

### Existing entries

Name, Email Address and Photos or Videos stay exactly as they are. Do not mark them as
used for tracking: Meta never receives them (advanced matching is off).

### Privacy Policy URL

Keep `https://bizmanage.xtremon.com/privacy`, but the page must carry version 2.0.0 before
the 2.9 review (section 3 below). User Privacy Choices URL can stay empty.

## 2. Privacy manifest in the build (done)

`app.json` → `ios.privacyManifests` now declares tracking = true with the tracking domain
`ep1.facebook.com` (Apple rejects tracking = true with no domain as ITMS-91064 "Invalid
Binary"; build 93 hit this) and the seven data types above (minus the two the Meta SDK
declares itself). Expo merges it with the
required-reason API entries it generates. The Meta frameworks ship their own manifests
(tracking domain `ep1.facebook.com`, Device ID, crash data) and Apple combines them into
the app's privacy report. Verified by regenerating the iOS project. Ships with the next build.

## 3. Website privacy policy (must be done before submitting 2.9)

`https://bizmanage.xtremon.com/privacy` is still **version 1.1.0 of November 25, 2025**
and states: "We do not integrate third-party advertising SDKs or share your business
data with marketing or advertising companies." The 2.9 build contradicts the first half
of that sentence, and this URL is what App Review and Meta both read.

Replace the page with the in-app policy 2.0.0. The full text is exported ready to paste in
`docs/privacy-policy-2.0.0-website.md` (same document the app shows under Settings →
Privacy). The page lives in the landing-page repository, not this one.

## 4. App Review notes (optional but helps)

Add to the "Notes" field of the 2.9 submission:

> This version adds the Meta (Facebook) SDK for measuring our own advertising. The app
> asks for tracking permission (ATT) after sign-in. Declining changes nothing in the app.
> Only app-funnel events (registration, first business, first sale, paywall view, checkout,
> subscription) are reported; no user content, customer data or sales data is shared.

## 5. Not needed

- No new permission strings: the tracking usage description is already in the build.
- Age rating, export compliance and the Terms of Service are unaffected.
- Android/Google Play Data safety form: do this when the Play listing is created; the
  same seven data types apply, with "Advertising ID" in place of Device ID.
