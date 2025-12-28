# Migration Guide: react-native-iap to RevenueCat

This guide explains how to migrate your BizManage app from react-native-iap to RevenueCat SDK.

## Why Migrate to RevenueCat?

### Benefits
- **Simplified Purchase Management**: RevenueCat handles receipt validation, webhook processing, and subscription lifecycle automatically
- **Server-Side Receipt Validation**: More secure than client-side validation
- **Cross-Platform Purchase Restoration**: Seamless restore across iOS and Android
- **Native Paywall UI**: Pre-built, customizable paywalls with A/B testing
- **Customer Center**: Self-service subscription management
- **Real-Time Webhook Updates**: Instant subscription status updates
- **Better Analytics**: Comprehensive subscription metrics and insights
- **Reduced Code Complexity**: Less boilerplate code to maintain

### What Changes
- Purchase flow uses RevenueCat SDK instead of react-native-iap
- Receipt validation happens server-side via RevenueCat
- Subscription status updates via webhooks instead of polling
- Native Paywall UI replaces custom implementation (optional)
- Customer Center for subscription management

## Migration Steps

### Phase 1: Install and Configure (Completed ✅)

The following has been implemented:

1. **Installed Packages**
   ```bash
   npm install react-native-purchases@8.2.3 react-native-purchases-ui@8.2.3
   ```

2. **Created RevenueCat Service**
   - `src/services/revenueCatService.ts` - Core RevenueCat integration
   - Handles configuration, purchases, restore, entitlements

3. **Created New Context**
   - `src/context/RevenueCatSubscriptionContext.tsx` - New subscription context using RevenueCat
   - Manages subscription state, customer info, and purchase flow

4. **Created UI Components**
   - `src/components/subscription/RevenueCatPaywall.tsx` - Native paywall integration
   - `src/components/subscription/CustomerCenter.tsx` - Self-service subscription management

5. **Created Webhook Handler**
   - `supabase/functions/revenuecat-webhook/index.ts` - Processes RevenueCat events

6. **Added Translations**
   - Updated `src/locales/en.json` with Customer Center strings

### Phase 2: Switch to RevenueCat (Action Required)

#### Step 1: Update App Root Layout

In `app/_layout.tsx`, switch from old to new context:

**Before:**
```typescript
import { SubscriptionProvider } from '@/src/context/SubscriptionContext';

export default function RootLayout() {
  return (
    <SubscriptionProvider>
      {/* Your app content */}
    </SubscriptionProvider>
  );
}
```

**After:**
```typescript
import { RevenueCatSubscriptionProvider } from '@/src/context/RevenueCatSubscriptionContext';

export default function RootLayout() {
  return (
    <RevenueCatSubscriptionProvider>
      {/* Your app content */}
    </RevenueCatSubscriptionProvider>
  );
}
```

#### Step 2: Deploy Webhook Function

Deploy the RevenueCat webhook handler to Supabase:

```bash
supabase functions deploy revenuecat-webhook
```

Get the function URL:
```
https://[YOUR-PROJECT-ID].supabase.co/functions/v1/revenuecat-webhook
```

#### Step 3: Configure RevenueCat Dashboard

1. **Create Products** in App Store Connect / Google Play Console:
   - `bizmanage.pro.month`
   - `bizmanage.pro.year`
   - `bizmanage.pro_plus.month`
   - `bizmanage.pro_plus.year`
   - `bizmanage.max.month`
   - `bizmanage.max.year`

2. **Create Entitlements** in RevenueCat Dashboard:
   - `bizmanage_pro`
   - `bizmanage_pro_plus`
   - `bizmanage_max`

3. **Attach Products to Entitlements**:
   - Pro products → `bizmanage_pro`
   - Pro Plus products → `bizmanage_pro_plus`
   - Max products → `bizmanage_max`

4. **Create Offering**:
   - Create "default" offering
   - Add all 6 products as packages

5. **Configure Webhook**:
   - Go to Integrations → Webhooks
   - Add your webhook URL
   - Enable events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE

#### Step 4: Test the Integration

1. **Build Development App**:
   ```bash
   npx expo prebuild
   npx expo run:ios  # or run:android
   ```

2. **Test Purchase Flow**:
   - Open the app
   - Navigate to Settings → Subscription
   - Tap "See Plans" to open paywall
   - Make a test purchase with sandbox account
   - Verify subscription activates

3. **Test Restore**:
   - Tap "Restore Purchases"
   - Verify subscription is restored

4. **Test Customer Center**:
   - Tap "Manage Subscription"
   - Verify Customer Center opens
   - Check subscription details display correctly

5. **Test Webhook**:
   - Make a purchase
   - Check Supabase function logs: `supabase functions logs revenuecat-webhook`
   - Verify `user_subscriptions` table updates

### Phase 3: Production Migration (Action Required)

#### For New Users
New users will automatically use RevenueCat. No action needed.

#### For Existing Subscribers

**Option A: Gradual Migration (Recommended)**
1. Keep both systems running
2. New purchases use RevenueCat
3. Existing subscribers continue with old system
4. Migrate existing subscribers one-by-one

**Option B: One-Time Migration**
1. Export all active subscriptions from your database
2. Create a migration script to sync with RevenueCat
3. Use RevenueCat's REST API to record existing subscriptions
4. Verify all subscriptions are synced
5. Switch all users to RevenueCat

#### Migration Script Example
```typescript
// Example migration script (not implemented)
async function migrateExistingSubscribers() {
  // 1. Get all active subscribers from Supabase
  const { data: subscribers } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('subscription_status', 'active');

  // 2. For each subscriber, sync with RevenueCat
  for (const subscriber of subscribers) {
    // Use RevenueCat REST API to record subscription
    // This requires RevenueCat's REST API key
    await syncSubscriptionToRevenueCat(subscriber);
  }
}
```

### Phase 4: Cleanup (After Migration Complete)

Once all users are on RevenueCat:

1. **Remove Old Dependencies**:
   ```bash
   npm uninstall react-native-iap
   ```

2. **Delete Old Files**:
   ```bash
   rm src/services/iapService.ts
   rm src/context/SubscriptionContext.tsx
   ```

3. **Update Imports**:
   - Search for imports of `SubscriptionContext` and replace with `RevenueCatSubscriptionContext`
   - Remove imports of `iapService`

4. **Clean Up Code**:
   - Remove IAP-specific logic
   - Remove product ID constants
   - Update any IAP-specific error handling

## Code Comparison

### Old Way (react-native-iap)

```typescript
// Initialize
import { iapService } from '@/src/services/iapService';
await iapService.initConnection();
const products = await iapService.getSubscriptions({ skus: PRODUCT_IDS });

// Purchase
const purchase = await iapService.requestSubscription({ sku: productId });
const validation = await iapService.validateReceipt(purchase.transactionReceipt, platform);

// Restore
const purchases = await iapService.getAvailablePurchases();
```

### New Way (RevenueCat)

```typescript
// Initialize
import { revenueCatService } from '@/src/services/revenueCatService';
await revenueCatService.configure(userId);
const offerings = await revenueCatService.getOfferings();

// Purchase
const { customerInfo } = await revenueCatService.purchasePackage(package);

// Restore
const customerInfo = await revenueCatService.restorePurchases();

// Check entitlements
const hasPro = await revenueCatService.hasEntitlement('bizmanage_pro');
const tier = await revenueCatService.getCurrentTier();
```

## API Mapping

| Old API | New API |
|---------|---------|
| `iapService.initConnection()` | `revenueCatService.configure(userId)` |
| `iapService.getSubscriptions()` | `revenueCatService.getOfferings()` |
| `iapService.requestSubscription()` | `revenueCatService.purchasePackage()` |
| `iapService.getAvailablePurchases()` | `revenueCatService.restorePurchases()` |
| `iapService.validateReceipt()` | Automatic via RevenueCat |
| Manual subscription status check | `revenueCatService.hasEntitlement()` |

## Database Changes

### Before
```sql
-- Manual subscription management
user_subscriptions (
  user_id,
  subscription_status,
  subscription_product_id,
  subscription_expiration_date,
  platform
)
```

### After
```sql
-- Webhook-driven updates
user_subscriptions (
  user_id,
  subscription_status,
  subscription_product_id,
  subscription_expiration_date,
  platform,
  subscription_tier,        -- NEW: Automatic tier detection
  max_owned_businesses      -- NEW: Business limits
)
```

## Testing Checklist

Before deploying to production:

- [ ] Test sandbox purchases on iOS
- [ ] Test sandbox purchases on Android
- [ ] Test restore purchases
- [ ] Test subscription cancellation
- [ ] Test subscription expiration
- [ ] Test webhook receives events
- [ ] Test database updates from webhook
- [ ] Test Customer Center opens
- [ ] Test native Paywall displays
- [ ] Test entitlement checking
- [ ] Test tier limits
- [ ] Verify analytics in RevenueCat dashboard

## Rollback Plan

If issues arise, you can rollback:

1. **Switch back to old context** in `app/_layout.tsx`:
   ```typescript
   import { SubscriptionProvider } from '@/src/context/SubscriptionContext';
   ```

2. **Keep webhook disabled** until ready to retry

3. **Old system continues working** for existing subscribers

## Support and Resources

- **RevenueCat Documentation**: https://www.revenuecat.com/docs
- **RevenueCat React Native SDK**: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- **RevenueCat Community**: https://community.revenuecat.com
- **App Setup Guide**: See `REVENUECAT_SETUP.md`

## Questions?

Common questions during migration:

### Do existing subscribers lose access?
No. The webhook will sync their status, or they can restore purchases.

### Can I test without affecting production?
Yes. Use RevenueCat's sandbox environment with test accounts.

### What happens to in-flight purchases during migration?
Both systems can run simultaneously, so no purchases are lost.

### How do I migrate existing subscriber data?
Use RevenueCat's REST API to record existing subscriptions, or let users restore purchases naturally.

### Can I customize the Paywall?
Yes. Use RevenueCat's dashboard to customize the native Paywall, or continue using the custom component.
