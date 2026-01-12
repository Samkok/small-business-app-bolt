# RevenueCat Integration Guide for BizManage

This document explains how to configure and use RevenueCat for subscription management in the BizManage app.

## Overview

BizManage uses RevenueCat SDK for managing in-app subscriptions, providing:
- Seamless purchase flow
- Automatic receipt validation
- Native Paywall UI
- Customer Center for self-service
- Webhook integration for real-time updates
- Cross-platform support (iOS/Android)

## Setup Steps

### 1. RevenueCat Dashboard Configuration

#### Create Products
In your RevenueCat dashboard, create the following products:

**iOS Products (App Store Connect):**
- `premium.pro.month` - Pro Monthly
- `premium.pro.year` - Pro Yearly
- `premium.pro_plus.month` - Pro Plus Monthly
- `premium.pro_plus.year` - Pro Plus Yearly
- `premium.max.month` - Max Monthly
- `premium.max.year` - Max Yearly

**Android Products (Google Play Console):**
- Same product IDs as iOS

#### Create Entitlements
Create three entitlement identifiers:
- `bizmanage_pro` - Grants access to Pro tier (1 business)
- `bizmanage_pro_plus` - Grants access to Pro Plus tier (3 businesses)
- `bizmanage_max` - Grants access to Max tier (unlimited businesses)

#### Attach Products to Entitlements
- Pro Monthly & Pro Yearly → `bizmanage_pro`
- Pro Plus Monthly & Pro Plus Yearly → `bizmanage_pro_plus`
- Max Monthly & Max Yearly → `bizmanage_max`

#### Create Offerings
Create a default offering with all packages:
1. Go to Offerings in RevenueCat dashboard
2. Create a new offering named "default"
3. Add all 6 products as packages:
   - Monthly packages (3)
   - Annual packages (3)

### 2. Webhook Configuration

#### Deploy the Webhook Function
The webhook function is already created at:
```
supabase/functions/revenuecat-webhook/index.ts
```

Deploy it to Supabase:
```bash
supabase functions deploy revenuecat-webhook
```

#### Configure Webhook in RevenueCat
1. Go to RevenueCat Dashboard → Integrations → Webhooks
2. Add a new webhook endpoint:
   ```
   https://[YOUR-PROJECT-ID].supabase.co/functions/v1/revenuecat-webhook
   ```
3. Select the following events:
   - INITIAL_PURCHASE
   - RENEWAL
   - CANCELLATION
   - EXPIRATION
   - PRODUCT_CHANGE
   - BILLING_ISSUE
   - UNCANCELLATION

### 3. App Configuration

#### Environment Variables
The API key is already configured in the code:
```typescript
const REVENUECAT_API_KEY = 'test_fkrdKDZMZCmmDvjIvjAjVnSaROY';
```

For production, update this in `src/services/revenueCatService.ts` with your production API key.

#### Switch to RevenueCat Context
To enable RevenueCat, update your app's root layout to use the new context:

In `app/_layout.tsx`, replace:
```typescript
import { SubscriptionProvider } from '@/src/context/SubscriptionContext';
```

With:
```typescript
import { RevenueCatSubscriptionProvider } from '@/src/context/RevenueCatSubscriptionContext';
```

And wrap your app with `RevenueCatSubscriptionProvider` instead of `SubscriptionProvider`.

### 4. Testing

#### Sandbox Testing (iOS)
1. Create a sandbox tester account in App Store Connect
2. Sign out of the App Store on your device
3. Run the app and make a purchase
4. When prompted, sign in with your sandbox account

#### Sandbox Testing (Android)
1. Add test accounts in Google Play Console
2. Create a closed testing track
3. Add your test account to the testing track
4. Install the app from the testing track and make purchases

### 5. Paywall Configuration

#### Using RevenueCat's Native Paywall
The app now uses RevenueCat's native Paywall component which provides:
- Automatic product display
- Built-in purchase flow
- Restore purchases button
- Error handling

To customize the Paywall appearance:
1. Go to RevenueCat Dashboard → Paywalls
2. Create a custom paywall template
3. Configure colors, fonts, and layout
4. The app will automatically use your custom design

#### Using Custom Paywall (Fallback)
If you need custom UI, the original Paywall component is still available at:
```
src/components/subscription/Paywall.tsx
```

### 6. Customer Center

The Customer Center provides self-service subscription management:
- View active subscriptions
- Cancel/modify subscriptions
- Restore purchases
- View billing history

It's automatically available on the subscription settings screen for business owners.

## Usage in Code

### Check Entitlements
```typescript
import { revenueCatService } from '@/src/services/revenueCatService';

// Check if user has a specific entitlement
const hasProAccess = await revenueCatService.hasEntitlement('bizmanage_pro');

// Get current tier
const tier = await revenueCatService.getCurrentTier(); // 'free', 'pro', 'pro_plus', 'max'

// Get max businesses allowed
const maxBusinesses = await revenueCatService.getMaxBusinesses(); // null, 1, 3, or 999999
```

### Show Paywall
```typescript
import { useSubscription } from '@/src/context/SubscriptionContext';

const { showPaywall } = useSubscription();

// Show paywall
showPaywall();
```

### Make a Purchase
```typescript
const { purchaseSubscription } = useSubscription();

// Purchase a specific product
const success = await purchaseSubscription('premium.pro.month');
```

### Restore Purchases
```typescript
const { restorePurchases } = useSubscription();

const success = await restorePurchases();
```

## Database Schema

The webhook automatically updates the following table:

### user_subscriptions
```sql
- user_id (uuid, primary key)
- subscription_status (text) - 'active', 'cancelled', 'expired', 'trial'
- subscription_product_id (text) - The RevenueCat product ID
- subscription_expiration_date (timestamptz) - When subscription expires
- platform (text) - 'ios' or 'android'
- subscription_tier (text) - 'free', 'pro', 'pro_plus', 'max'
- max_owned_businesses (integer) - Business limit for tier
- updated_at (timestamptz)
```

## Webhook Events

The webhook handles the following events:

### INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION
- Updates `user_subscriptions` table
- Sets subscription to active
- Updates tier and business limits

### CANCELLATION / EXPIRATION
- Updates subscription status
- Resets tier to 'free'
- Triggers business selection if user owns multiple businesses

### BILLING_ISSUE
- Creates a notification for the user
- Alerts them to update payment method

## Migration from react-native-iap

To fully migrate from the old IAP system:

1. **Keep both systems running temporarily** for existing subscribers
2. **New users** will automatically use RevenueCat
3. **Gradually migrate existing users** by:
   - Syncing their purchases to RevenueCat
   - Verifying entitlements match
   - Switching them to RevenueCat flow

4. **Remove old IAP code** once all users are migrated:
   - Delete `src/services/iapService.ts`
   - Remove `react-native-iap` package
   - Delete old `SubscriptionContext.tsx`

## Troubleshooting

### Purchases not showing up
1. Verify products are configured in App Store Connect / Google Play Console
2. Check that products are added to RevenueCat dashboard
3. Ensure entitlements are properly attached to products
4. Verify offerings include the products

### Webhook not receiving events
1. Check webhook URL is correct
2. Verify webhook is deployed and accessible
3. Check RevenueCat webhook logs for errors
4. Ensure Supabase function has proper permissions

### Customer info not syncing
1. Check that user is logged in with `revenueCatService.setUserId()`
2. Verify customer info listener is set up
3. Check realtime subscription is active
4. Review Supabase logs for errors

## Production Checklist

Before going to production:

- [ ] Replace test API key with production API key
- [ ] Configure all products in App Store Connect
- [ ] Configure all products in Google Play Console
- [ ] Set up all entitlements in RevenueCat
- [ ] Create and configure offerings
- [ ] Deploy webhook function
- [ ] Configure webhook URL in RevenueCat
- [ ] Test complete purchase flow on both platforms
- [ ] Test subscription cancellation
- [ ] Test restore purchases
- [ ] Test Customer Center
- [ ] Verify database updates from webhooks
- [ ] Set up monitoring and alerts

## Support

For RevenueCat-specific issues:
- RevenueCat Documentation: https://www.revenuecat.com/docs
- RevenueCat Support: https://community.revenuecat.com

For app-specific issues:
- Check the troubleshooting section above
- Review Supabase function logs
- Check RevenueCat webhook logs in dashboard
