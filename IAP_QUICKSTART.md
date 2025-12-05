# IAP Quick Start Guide

Get started with In-App Purchases in BizManage in 3 simple steps.

## TL;DR

- **Development**: Mock IAP works automatically in Expo Go - just run `npm start`
- **Testing**: Build with `eas build --profile preview` to test real IAP
- **Production**: Build with `eas build --profile production` for store release

## Step 1: Development (Mock IAP)

Test subscriptions locally without any build:

```bash
npm start
# Scan QR code with Expo Go
# Mock IAP is automatically active
```

**What you get:**
- All 6 subscription tiers work
- Instant purchase confirmations
- No actual charges
- Full subscription lifecycle testing

**Visual indicators:**
- "DEV MODE - Mock IAP Active" badge in paywall
- "Development Mode Active" card in settings
- Mock mode logs in console

## Step 2: Testing (Real IAP with Sandbox)

Test actual IAP integration with sandbox purchases:

### Option A: Preview Build (Recommended)

```bash
# Build for iOS
eas build --profile preview --platform ios

# Build for Android
eas build --profile preview --platform android
```

### Option B: Development Build

```bash
# Build for iOS with dev client
eas build --profile development --platform ios

# Build for Android with dev client
eas build --profile development --platform android
```

**Before testing:**

#### iOS Setup:
1. Create sandbox tester in App Store Connect
2. Sign out of App Store on device
3. Install preview/dev build
4. Make test purchase (use sandbox account)

#### Android Setup:
1. Add test email in Play Console > License Testing
2. Install preview/dev build
3. Make test purchase with test account

**What you get:**
- Real IAP integration
- Sandbox environment (no charges)
- Receipt validation
- Full store flow testing

## Step 3: Production (Real IAP)

Deploy to production stores:

```bash
# Build for production
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit to stores
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

**Required setup:**
- Products configured in App Store Connect / Play Console
- All product IDs must match (see [Product IDs](#product-ids))
- Pricing and descriptions set
- App binary submitted with IAP products

## Product IDs

Configure these exact product IDs in both stores:

| Product ID | Name | Price | Type |
|------------|------|-------|------|
| `bizmanage.pro.month` | Pro Monthly | $4.99 | Auto-renewable subscription |
| `bizmanage.pro.year` | Pro Yearly | $47.99 | Auto-renewable subscription |
| `bizmanage.pro_plus.month` | Pro Plus Monthly | $9.99 | Auto-renewable subscription |
| `bizmanage.pro_plus.year` | Pro Plus Yearly | $95.99 | Auto-renewable subscription |
| `bizmanage.max.month` | Max Monthly | $19.99 | Auto-renewable subscription |
| `bizmanage.max.year` | Max Yearly | $191.99 | Auto-renewable subscription |

## How It Works

The app automatically detects the environment:

```
┌─────────────────────────────────────┐
│       Running in Expo Go?           │
│       OR                            │
│       No native code compiled?      │
└─────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
   YES               NO
    │                 │
    v                 v
Mock IAP          Real IAP
(Development)     (Production)
```

## Testing Checklist

### Development Testing (Mock IAP)
- [ ] Run `npm start`
- [ ] Open in Expo Go
- [ ] See "DEV MODE" badge
- [ ] Purchase a subscription
- [ ] Check Settings > Subscription for active status
- [ ] Test "Restore Purchases"
- [ ] Verify in Supabase `user_subscriptions` table

### Sandbox Testing (Real IAP)
- [ ] Create preview/dev build
- [ ] Set up sandbox test account
- [ ] Install build on device
- [ ] No "DEV MODE" badge visible
- [ ] Purchase with sandbox account
- [ ] Verify purchase in Settings
- [ ] Test "Restore Purchases"
- [ ] Check subscription in store console

### Production Testing
- [ ] Create production build
- [ ] Upload to TestFlight/Internal Testing
- [ ] Test with real account
- [ ] Verify receipt validation
- [ ] Monitor in store dashboard
- [ ] Test subscription renewal

## Common Issues

### "Products not loading"
**Development**: Mock products should always load. Check console for errors.
**Production**: Verify products are configured in store console and approved.

### "Purchase failed"
**Development**: Check Supabase connection and console logs.
**Production**: Verify sandbox account setup, internet connection, and store credentials.

### "IAP not available"
**Development**: This is normal - mock IAP will be used automatically.
**Production**: Ensure native code is compiled (not using Expo Go).

### "Receipt validation failed"
**Development**: Mock receipts should always validate. Check console logs.
**Production**: Verify edge function `validate-subscription` is deployed and accessible.

## Console Logs

### Mock IAP (Development)
```
[IAPService] Initialized with mock IAP
[SubscriptionContext] IAP connection result: true
[SubscriptionContext] Mock IAP initialized with 6 products
[SubscriptionContext] Mock subscription activated successfully
```

### Real IAP (Production)
```
[IAPService] Initialized with real IAP
[SubscriptionContext] IAP connection result: true
[SubscriptionContext] IAP initialized with 6 products
Validating receipt with backend...
Receipt validation result: { isValid: true, ... }
```

## Additional Resources

- **Complete Guide**: `IAP_ENVIRONMENT_GUIDE.md` - Full environment documentation
- **Mock IAP**: `MOCK_IAP_SETUP.md` - Mock IAP implementation details
- **Store Setup**: See store-specific documentation in [Product IDs](#product-ids) section

## Need Help?

1. Check console logs for `[IAPService]` messages
2. Review `IAP_ENVIRONMENT_GUIDE.md` for detailed troubleshooting
3. Verify store configuration matches product IDs
4. Test with mock IAP first before production builds
5. Check Supabase logs for backend validation errors

---

**Quick Reference:**
- Development: `npm start` → Mock IAP works automatically
- Testing: `eas build --profile preview` → Real IAP with sandbox
- Production: `eas build --profile production` → Real IAP with live stores
