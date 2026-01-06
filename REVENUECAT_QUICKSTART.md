# RevenueCat Quick Start Guide

Get up and running with RevenueCat in your BizManage app in minutes.

## Prerequisites

- RevenueCat account (free tier available)
- App Store Connect account (for iOS)
- Google Play Console account (for Android)
- Supabase project set up

## 3-Step Setup

### Step 1: Configure RevenueCat Dashboard (15 minutes)

1. **Create Project**
   - Go to https://app.revenuecat.com
   - Create new project "BizManage"
   - Add iOS and/or Android apps

2. **Add Products**
   ```
   Product IDs:
   - bizmanage.pro.month
   - bizmanage.pro.year
   - bizmanage.pro_plus.month
   - bizmanage.pro_plus.year
   - bizmanage.max.month
   - bizmanage.max.year
   ```

3. **Create Entitlements**
   ```
   - bizmanage_pro
   - bizmanage_pro_plus
   - bizmanage_max
   ```

4. **Link Products to Entitlements**
   - Pro products → bizmanage_pro
   - Pro Plus products → bizmanage_pro_plus
   - Max products → bizmanage_max

5. **Create Default Offering**
   - Add all 6 products as packages
   - Set as current offering

### Step 2: Deploy Webhook (5 minutes)

1. **Deploy Function**
   ```bash
   cd /path/to/your/project
   supabase functions deploy revenuecat-webhook
   ```

2. **Get Webhook URL**
   ```
   https://[YOUR-PROJECT-ID].supabase.co/functions/v1/revenuecat-webhook
   ```

3. **Configure in RevenueCat**
   - Dashboard → Integrations → Webhooks
   - Add webhook URL
   - Enable: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE

### Step 3: Switch to RevenueCat Context (2 minutes)

Update your app root to use RevenueCat:

**File: `app/_layout.tsx`**

```typescript
// Before
import { SubscriptionProvider } from '@/src/context/SubscriptionContext';

export default function RootLayout() {
  return (
    <SubscriptionProvider>
      {/* ... */}
    </SubscriptionProvider>
  );
}

// After
import { RevenueCatSubscriptionProvider } from '@/src/context/RevenueCatSubscriptionContext';

export default function RootLayout() {
  return (
    <RevenueCatSubscriptionProvider>
      {/* ... */}
    </RevenueCatSubscriptionProvider>
  );
}
```

## Testing

### Build Development App
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Test Purchase Flow
1. Navigate to Settings → Subscription
2. Tap "See Plans"
3. Select a tier and billing period
4. Complete purchase with sandbox account
5. Verify subscription activates

### Verify Webhook
```bash
# Check function logs
supabase functions logs revenuecat-webhook

# Check database
supabase db pull
# Check user_subscriptions table
```

## Common Issues

### Issue: "No offerings found"
**Solution**: Make sure you've created a default offering in RevenueCat dashboard and it's set as current.

### Issue: Purchases not completing
**Solution**:
- Verify product IDs match exactly in RevenueCat dashboard and App Store Connect
- Check RevenueCat logs for errors
- Ensure app bundle ID matches RevenueCat project

### Issue: Webhook not firing
**Solution**:
- Test webhook URL manually: `curl -X POST https://your-url/functions/v1/revenuecat-webhook`
- Check RevenueCat webhook logs in dashboard
- Verify function is deployed: `supabase functions list`

### Issue: "IAP not available"
**Solution**: You need to build the app with EAS Build. RevenueCat doesn't work in Expo Go:
```bash
eas build --profile development --platform ios
```

## Usage Examples

### Check if User is Subscribed
```typescript
import { useSubscription } from '@/src/context/SubscriptionContext';

function MyComponent() {
  const { isSubscribed, tierInfo } = useSubscription();

  if (isSubscribed) {
    console.log('User tier:', tierInfo.tier); // 'pro', 'pro_plus', or 'max'
  }
}
```

### Show Paywall
```typescript
import { useSubscription } from '@/src/context/SubscriptionContext';

function UpgradeButton() {
  const { showPaywall } = useSubscription();

  return (
    <Button onPress={showPaywall}>
      Upgrade to Pro
    </Button>
  );
}
```

### Check Feature Access
```typescript
import { useSubscription } from '@/src/context/SubscriptionContext';

function CreateSaleButton() {
  const { canAccessFeature } = useSubscription();

  if (!canAccessFeature) {
    return <UpgradePrompt />;
  }

  return <Button>Create Sale</Button>;
}
```

### Restore Purchases
```typescript
import { useSubscription } from '@/src/context/SubscriptionContext';

function RestoreButton() {
  const { restorePurchases } = useSubscription();

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      Alert.alert('Success', 'Purchases restored!');
    }
  };

  return <Button onPress={handleRestore}>Restore Purchases</Button>;
}
```

## Next Steps

✅ **You're Done!** Your app now has:
- Automatic subscription management
- Native paywall UI
- Customer Center for self-service
- Webhook-driven updates
- Cross-platform support

### Optional Customizations

1. **Customize Paywall**
   - RevenueCat Dashboard → Paywalls
   - Design custom templates
   - A/B test different designs

2. **Add Analytics**
   - Set user attributes: `revenueCatService.setAttributes({ role: 'admin' })`
   - View charts in RevenueCat dashboard
   - Track conversion rates

3. **Promotional Offers**
   - Configure in App Store Connect
   - Add to RevenueCat dashboard
   - Display in paywall

## Resources

- 📖 Full Setup Guide: `REVENUECAT_SETUP.md`
- 🔄 Migration Guide: `REVENUECAT_MIGRATION.md`
- 🌐 RevenueCat Docs: https://www.revenuecat.com/docs
- 💬 Community: https://community.revenuecat.com

## Support

Need help? Check:
1. RevenueCat Community Forum
2. This project's GitHub Issues
3. RevenueCat Support (support@revenuecat.com)

---

**Happy Building! 🚀**
