# Mock IAP Development Guide

This project includes a Mock In-App Purchase (IAP) system that allows you to develop and test subscription features in Expo Go without building the app.

## Overview

When `react-native-iap` is not available (like in Expo Go), the app automatically falls back to a mock IAP system that:
- Simulates all IAP operations (purchase, restore, get products)
- Stores subscription data directly in Supabase
- Provides realistic subscription flows for testing
- Shows clear indicators when mock mode is active

## How It Works

### Automatic Detection

The system automatically detects if `react-native-iap` is available:

```typescript
// In SubscriptionContext.tsx
let IAP: any = null;
let useMockIAP = false;

if (Platform.OS !== 'web') {
  try {
    IAP = require('react-native-iap');
    console.log('Using real react-native-iap');
  } catch (error) {
    console.warn('react-native-iap not available, using mock IAP');
    useMockIAP = true;
    IAP = mockIapService;
  }
}
```

### Mock Mode Indicators

When mock mode is active, you'll see:

1. **In the Paywall**: A blue "DEV MODE - Mock IAP Active" badge at the top
2. **In Settings > Subscription**: An info card explaining mock mode is active
3. **In Console Logs**: All mock IAP operations are logged with `[MockIAP]` prefix

## Development Workflow

### 1. Daily Development (Expo Go)

When developing in Expo Go:

1. Open the app in Expo Go
2. Mock IAP is automatically active
3. All subscription features work normally
4. Test different subscription tiers by "purchasing" them
5. Subscriptions are stored in Supabase for testing

### 2. Testing a Subscription Purchase

```
1. Navigate to Settings > Subscription
2. Tap "See Plans" or "Upgrade to Pro"
3. Select a subscription tier (Pro, Pro Plus, or Max)
4. Choose monthly or yearly billing
5. Tap "Subscribe"
6. The mock purchase completes after ~1 second
7. Your subscription is activated in Supabase
```

### 3. Testing Subscription Features

With an active mock subscription, you can test:

- Unlimited sales (bypassing the 50-sale free tier limit)
- Business ownership limits (1, 3, or unlimited based on tier)
- Subscription status UI
- Expired subscription handling (by setting past expiration dates in Supabase)
- Restore purchases functionality

### 4. Pre-Release Testing (EAS Build)

When you need to test real IAP:

1. Create an EAS build:
   ```bash
   eas build --platform ios --profile preview
   # or
   eas build --platform android --profile preview
   ```

2. Install the build on your device
3. `react-native-iap` will be available
4. Mock mode automatically disables
5. Test with real sandbox subscriptions

## Mock Subscription Tiers

The mock system includes all subscription tiers:

### Pro Monthly ($4.99/month)
- **Product ID**: `bizmanage.pro.month`
- **Features**: Unlimited sales for 1 business
- **Expiration**: 1 month from purchase

### Pro Yearly ($47.99/year)
- **Product ID**: `bizmanage.pro.year`
- **Features**: Unlimited sales for 1 business
- **Expiration**: 1 year from purchase

### Pro Plus Monthly ($9.99/month)
- **Product ID**: `bizmanage.pro_plus.month`
- **Features**: Unlimited sales for 3 businesses
- **Expiration**: 1 month from purchase

### Pro Plus Yearly ($95.99/year)
- **Product ID**: `bizmanage.pro_plus.year`
- **Features**: Unlimited sales for 3 businesses
- **Expiration**: 1 year from purchase

### Max Monthly ($19.99/month)
- **Product ID**: `bizmanage.max.month`
- **Features**: Unlimited sales and businesses
- **Expiration**: 1 month from purchase

### Max Yearly ($191.99/year)
- **Product ID**: `bizmanage.max.year`
- **Features**: Unlimited sales and businesses
- **Expiration**: 1 year from purchase

## Advanced Testing

### Testing Expired Subscriptions

To test expired subscription behavior:

1. Purchase a mock subscription
2. Open your Supabase dashboard
3. Navigate to the `user_subscriptions` table
4. Find your subscription record
5. Update `subscription_expiration_date` to a past date
6. Refresh the app to see expired subscription UI

### Testing Restore Purchases

1. Purchase a mock subscription
2. Tap "Restore Purchases" in Settings > Subscription
3. The mock system retrieves the active subscription from Supabase
4. Your subscription is restored

### Manual Subscription Management

You can manually manage subscriptions via Supabase:

1. Open Supabase dashboard
2. Go to Table Editor > `user_subscriptions`
3. Directly edit subscription records:
   - Change `tier` (free, pro, pro_plus, max)
   - Update `subscription_status` (active, expired, cancelled, trial)
   - Modify `subscription_expiration_date`
   - Adjust `max_owned_businesses`

## Files

The mock IAP system consists of:

- **`src/services/mockIapService.ts`**: Mock IAP implementation
- **`src/services/mockSubscriptionStorage.ts`**: Mock mode storage utilities
- **`src/context/SubscriptionContext.tsx`**: Auto-detects and uses mock IAP
- **`src/components/subscription/Paywall.tsx`**: Shows mock mode badge
- **`app/(app)/(tabs)/settings/subscription.tsx`**: Shows mock mode info card

## Troubleshooting

### Mock mode not activating in Expo Go

Check console logs for:
```
[SubscriptionContext] react-native-iap not available, using mock IAP
[MockIAP] Initializing mock IAP connection
```

If you don't see these, the real IAP might be loading.

### Subscription not persisting

1. Check Supabase connection
2. Verify user is authenticated
3. Check console for errors with `[MockIAP]` prefix
4. Inspect `user_subscriptions` table in Supabase dashboard

### Mock mode still active in EAS build

This shouldn't happen. If it does:
1. Rebuild with `eas build`
2. Check build logs for `react-native-iap` installation
3. Verify the package is in `dependencies`, not `devDependencies`

## Benefits

1. **Fast Iteration**: Test subscription UI instantly without builds
2. **No Setup Required**: Works immediately in Expo Go
3. **Real Data**: Subscriptions stored in Supabase like production
4. **Clear Indicators**: Always know when using mock mode
5. **Easy Transition**: Automatically uses real IAP when available

## Production Considerations

- Mock IAP only activates when `react-native-iap` is not available
- In production builds, real IAP is always used
- Mock receipts have a `platform: 'mock'` field for identification
- Supabase data is compatible with both mock and real subscriptions

## Need Help?

- Check console logs with `[MockIAP]` prefix
- Inspect Supabase `user_subscriptions` table
- Review this guide's troubleshooting section
- Test in a fresh Expo Go session
