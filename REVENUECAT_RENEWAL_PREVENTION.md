# RevenueCat Configuration: Preventing Duplicate Subscription Renewals

## Overview

This document explains how to configure RevenueCat to prevent the previous subscription plan from renewing after a user upgrades or downgrades their subscription.

## The Problem

When a user changes their subscription plan (upgrade or downgrade), there's a risk that both the old and new subscriptions could remain active, leading to:
- Duplicate charges to the user
- Inconsistent subscription state in your database
- Confusion about which plan the user actually has

## The Solution

RevenueCat provides built-in mechanisms to handle subscription changes properly. The key is ensuring your subscription products are configured correctly in the RevenueCat dashboard.

## Configuration Steps

### 1. Set Up Subscription Groups (iOS)

For iOS App Store subscriptions:

1. Navigate to **RevenueCat Dashboard** → **Products**
2. Ensure all your subscription tiers (Pro, Pro Plus, Max) are in the **same subscription group**
3. When subscriptions are in the same group, iOS automatically:
   - Cancels the old subscription
   - Starts the new subscription
   - Handles proration based on your settings

### 2. Configure Product Behavior

In RevenueCat Dashboard → **Products** → Select your product:

- **Upgrade Behavior**: Set to "Immediate" for instant upgrades
- **Downgrade Behavior**: Set based on your business logic:
  - "Immediate": Downgrade takes effect immediately
  - "At end of period": Downgrade takes effect when current subscription expires

### 3. Verify Webhook Configuration

Ensure your RevenueCat webhook is properly configured to handle subscription changes:

1. Go to **RevenueCat Dashboard** → **Settings** → **Integrations** → **Webhooks**
2. Verify your webhook URL is correct
3. Ensure these events are enabled:
   - `INITIAL_PURCHASE`
   - `RENEWAL`
   - `PRODUCT_CHANGE`
   - `CANCELLATION`
   - `EXPIRATION`
   - `UNCANCELLATION`

### 4. Test in Sandbox Mode

Before going live, test subscription changes in sandbox mode:

1. Create a test user in RevenueCat
2. Purchase the Pro subscription
3. Upgrade to Pro Plus or Max
4. Verify in RevenueCat Dashboard that:
   - Only ONE active subscription shows
   - The old subscription status is "expired" or "cancelled"
   - The new subscription is "active"

5. Check your database:
   - `subscription_product_id` should match the new subscription
   - `tier` should match the new tier
   - Only ONE `user_subscriptions` record should exist per user

## How It Works

### On the App Store/Play Store Side

**iOS (App Store):**
- Subscriptions in the same subscription group are mutually exclusive
- When a user subscribes to a different product in the group, iOS automatically:
  - Cancels the old subscription
  - Issues a refund (if applicable based on upgrade/downgrade rules)
  - Starts the new subscription

**Android (Play Store):**
- Use the `prorate` parameter when calling `purchase()`:
  ```typescript
  await Purchases.purchaseStoreProduct(
    product,
    {
      oldProductIdentifier: currentProductId,
      prorationMode: PRORATION_MODE.IMMEDIATE_AND_CHARGE_PRORATED_PRICE
    }
  );
  ```

### On the RevenueCat Side

RevenueCat automatically:
1. Detects the subscription change
2. Sends a `PRODUCT_CHANGE` webhook event
3. Updates the user's entitlements
4. Marks the old subscription as replaced

### On Your Backend Side

Your webhook handler (now fixed) will:
1. Receive the `PRODUCT_CHANGE` event
2. Update `subscription_product_id` to the new product
3. Update `tier` to the new tier
4. Adjust business access based on the new tier limits
5. Handle business selection if needed

## Monitoring and Verification

### Check for Duplicate Active Subscriptions

Run this query periodically to detect any users with multiple active subscriptions:

```sql
SELECT
  user_id,
  COUNT(*) as active_count
FROM user_subscriptions
WHERE subscription_status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1;
```

If this returns any results, investigate immediately.

### Verify RevenueCat Consistency

1. Log into RevenueCat Dashboard
2. Navigate to **Customers**
3. Search for a user who recently changed plans
4. Verify:
   - Only ONE active subscription
   - Old subscription is marked as "expired" or "cancelled"
   - New subscription shows correct product and tier

### Monitor Webhook Logs

Check your Edge Function logs for any errors:
- Look for `[RevenueCat Webhook]` log entries
- Verify `subscription_product_id` is being updated correctly
- Check for any error messages related to subscription updates

## Common Issues and Solutions

### Issue 1: Old Subscription Still Renewing

**Symptoms:**
- User has two active subscriptions
- User is being charged twice

**Solution:**
1. Verify subscriptions are in the same subscription group (iOS)
2. Check that the upgrade/downgrade was done correctly in the app
3. On Android, ensure `oldProductIdentifier` is passed to `purchase()`

### Issue 2: Subscription Product ID Not Updating

**Symptoms:**
- Webhook is called but `subscription_product_id` stays as the old value
- Database shows old subscription after upgrade

**Solution:**
- This was the original issue and has been fixed in the updated webhook
- The webhook now validates `product_id` and uses fallback logic
- Check logs for `[RevenueCat Webhook] Validated Product ID:` to verify

### Issue 3: User Can't Access Features After Upgrade

**Symptoms:**
- User upgrades but businesses stay in read-only mode
- UI shows upgraded plan but restrictions remain

**Solution:**
- This was also fixed - the UI now checks actual business `access_state` from database
- Ensure webhook processed the upgrade (check logs)
- Verify business `access_state` is set to 'active' in database

## Best Practices

1. **Always Use the Same Subscription Group (iOS)**: Don't create separate groups for different tiers
2. **Test Thoroughly in Sandbox**: Test every upgrade/downgrade path before going live
3. **Monitor Webhooks**: Set up alerts for webhook failures
4. **Implement Idempotency**: Your webhook should handle duplicate events gracefully
5. **Log Everything**: Comprehensive logging helps diagnose issues quickly
6. **Validate Data**: Always verify database state matches RevenueCat state

## Additional Resources

- [RevenueCat Subscription Lifecycle](https://docs.revenuecat.com/docs/subscription-guidance)
- [Managing Subscriptions](https://docs.revenuecat.com/docs/managing-subscriptions)
- [Webhooks Documentation](https://docs.revenuecat.com/docs/webhooks)
- [Subscription Groups (iOS)](https://developer.apple.com/app-store/subscriptions/#groups)
- [Subscription Replacement (Android)](https://developer.android.com/google/play/billing/subscriptions#upgrade-downgrade)

## Summary

The key to preventing duplicate subscription renewals is:

1. ✅ **Correct product configuration in stores** (same subscription group)
2. ✅ **Proper implementation of upgrade/downgrade in app** (passing oldProductIdentifier)
3. ✅ **Reliable webhook processing** (now fixed with proper validation)
4. ✅ **Regular monitoring** (check for duplicate active subscriptions)

With the fixes implemented in this update, your subscription system should now properly handle all subscription changes without duplicate renewals.
