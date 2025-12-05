# Mock IAP Visual Guide

## What You'll See When Mock Mode is Active

### 1. Subscription Paywall

When you open the subscription paywall in Expo Go:

```
┌─────────────────────────────────────┐
│  [DEV MODE - Mock IAP Active]      │  ← New Badge
│                                     │
│       ⚡ PREMIUM                    │
│                                     │
│     Choose Your Plan                │
│  Unlock unlimited sales and more    │
│                                     │
│  ┌─────────────────────────────┐  │
│  │  Pro Plus  $9.99/month      │  │
│  │  Unlimited sales for 3      │  │
│  │  businesses                  │  │
│  └─────────────────────────────┘  │
│                                     │
│       [Subscribe Now]              │
│                                     │
└─────────────────────────────────────┘
```

The blue "DEV MODE - Mock IAP Active" badge appears at the top when using mock IAP.

### 2. Subscription Settings Page

When you navigate to Settings > Subscription:

```
┌─────────────────────────────────────┐
│  ← Subscription                     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ℹ️  Development Mode Active   │ │  ← New Info Card
│  │                                │ │
│  │ Mock IAP is active.           │ │
│  │ Subscriptions are simulated   │ │
│  │ for testing in Expo Go. Build │ │
│  │ with EAS to test real payments│ │
│  └───────────────────────────────┘ │
│                                     │
│  Free Tier                          │
│  ┌───────────────────────────────┐ │
│  │ 0 of 50 sales used            │ │
│  │ [Progress Bar]                │ │
│  └───────────────────────────────┘ │
│                                     │
│  ⚡ Upgrade to Pro                 │
│  [See Plans]                       │
│                                     │
└─────────────────────────────────────┘
```

A blue info card explains that mock mode is active and what it means.

### 3. Console Logs

When mock mode is active, you'll see clear logging:

```bash
# App Start
[SubscriptionContext] react-native-iap not available, using mock IAP
[SubscriptionContext] InitializeIAP Start Here
[MockIAP] Initializing mock IAP connection
[SubscriptionContext] Mock IAP initialized with 6 products

# When Opening Paywall
[MockIAP] Getting mock subscriptions: ["bizmanage.pro.month", ...]

# When Making a Purchase
[MockIAP] Requesting mock subscription: bizmanage.pro_plus.month
[SubscriptionContext] Validating mock receipt
[SubscriptionContext] Mock subscription activated successfully

# When Restoring Purchases
[MockIAP] Getting available mock purchases
[SubscriptionContext] Restoring mock subscription
[SubscriptionContext] Mock subscription restored successfully
```

### 4. After Successful Purchase

```
┌─────────────────────────────────────┐
│  ← Subscription                     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ℹ️  Development Mode Active   │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👑 Pro Plus Active            │ │  ← Subscription Active
│  │                                │ │
│  │ Status: Active                │ │
│  │ Renewal: Jan 15, 2026         │ │
│  │                                │ │
│  │ Your subscription includes:   │ │
│  │ • Unlimited sales              │ │
│  │ • 3 owned businesses          │ │
│  │ • Priority support            │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Manage Subscription]             │
│  [Restore Purchases]               │
│                                     │
└─────────────────────────────────────┘
```

### 5. Supabase Database View

After a mock purchase, check your Supabase `user_subscriptions` table:

```
┌─────────────┬──────────┬───────────┬────────────────┐
│ user_id     │ tier     │ status    │ product_id     │
├─────────────┼──────────┼───────────┼────────────────┤
│ abc123...   │ pro_plus │ active    │ bizmanage.     │
│             │          │           │ pro_plus.month │
├─────────────┼──────────┼───────────┼────────────────┤
│             │          │           │                │
│ Expiration: 2026-01-15 14:30:22    │                │
│ Receipt: {"productId":"bizmanage.pro_plus.month",  │
│           "platform":"mock",...}                    │
└─────────────┴──────────┴───────────┴────────────────┘
```

Notice the `platform: "mock"` in the receipt data.

## Comparison: Mock Mode vs. Real IAP

### Visual Differences

| Feature | Mock Mode (Expo Go) | Real IAP (EAS Build) |
|---------|---------------------|----------------------|
| Dev Mode Badge | ✅ Visible | ❌ Hidden |
| Info Card | ✅ Visible | ❌ Hidden |
| Console Prefix | `[MockIAP]` | `[IAP]` |
| Purchase Flow | Instant (~1s) | Real Apple/Google UI |
| Receipt | JSON mock | Real encrypted receipt |

### Functional Differences

| Feature | Mock Mode | Real IAP |
|---------|-----------|----------|
| Purchase Products | ✅ Works | ✅ Works |
| Restore Purchases | ✅ Works | ✅ Works |
| Get Products | ✅ Works | ✅ Works |
| Subscription Data | Supabase Direct | Apple/Google → Supabase |
| Validation | Client-side | Server-side (Edge Function) |

## Testing Scenarios

### Scenario 1: Free User Upgrading

```
1. Open app in Expo Go
2. Navigate to Settings > Subscription
3. See "Development Mode Active" card
4. Tap "See Plans"
5. See "DEV MODE - Mock IAP Active" badge
6. Select "Pro Plus" tier
7. Choose "Monthly" billing
8. Tap "Subscribe Now"
9. Wait ~1 second
10. See success alert
11. Return to settings
12. See active subscription with Pro Plus badge
```

### Scenario 2: Testing Expired Subscription

```
1. Purchase a mock subscription (as above)
2. Open Supabase dashboard
3. Go to user_subscriptions table
4. Find your subscription
5. Edit subscription_expiration_date to yesterday
6. Save changes
7. Refresh app
8. See "Subscription Expired" status
9. See upgrade prompts re-appear
```

### Scenario 3: Restore Purchases

```
1. Have an active mock subscription
2. Tap "Restore Purchases" in settings
3. See restoring indicator
4. See success message
5. Subscription remains active
```

## Color Codes

### Mock Mode Indicators (Blue Theme)

- **Badge Background**: Light Blue (`#dbeafe`)
- **Badge Text**: Dark Blue (`#1e40af`)
- **Border**: Blue (`#93c5fd`)

These colors make it immediately clear you're in development mode.

### Subscription Status (Normal)

- **Active**: Blue/Green
- **Expired**: Red/Orange
- **Cancelled**: Gray

## Pro Tips

1. **Look for the Badge**: If you see the blue DEV MODE badge, mock IAP is active
2. **Check Console**: All mock operations log with `[MockIAP]` prefix
3. **Inspect Database**: Mock subscriptions have `platform: "mock"` in receipt_data
4. **Test Expiration**: Manually update dates in Supabase to test expired states
5. **Fast Testing**: Mock purchases complete in ~1 second vs. real IAP dialogs

## What to Expect

### In Expo Go
✅ See mock mode indicators
✅ Instant purchase flow
✅ Direct Supabase storage
✅ Fast iteration

### In EAS Build
❌ No mock mode indicators
✅ Real purchase dialogs
✅ Apple/Google validation
✅ Production-ready

## Troubleshooting Visual Cues

### If you DON'T see mock mode badges in Expo Go:

1. Check console for error messages
2. Verify `react-native-iap` is not somehow loading
3. Clear Metro cache and restart
4. Check that mock services are imported correctly

### If you DO see mock mode badges in EAS build:

1. This shouldn't happen
2. Check build logs
3. Verify `react-native-iap` is in dependencies
4. Rebuild with clean cache

## Summary

Mock IAP gives you:
- Clear visual indicators when active
- Realistic purchase flows
- Fast development iteration
- Easy transition to production

You'll always know when you're using mock IAP thanks to:
1. Blue "DEV MODE" badge in paywall
2. Info card in subscription settings
3. `[MockIAP]` console logs
4. `platform: "mock"` in database
