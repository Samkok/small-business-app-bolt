# Real-Time Subscription System - Test Plan

## Quick Start Testing

### 1. Test Database Migrations

Open Supabase Dashboard → SQL Editor and run:

```sql
-- Check if realtime is enabled for the tables
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('user_subscriptions', 'user_sales_counts');

-- Should return 2 rows showing both tables are enabled
```

### 2. Test Realtime Connection

In your app's browser console, you should see:

```
[SubscriptionContext] Setting up realtime subscription
[SubscriptionContext] Realtime subscription status: SUBSCRIBED
[SubscriptionContext] ✓ Connected to realtime
[SubscriptionContext] Setting up sales count realtime
[SubscriptionContext] Sales count realtime status: SUBSCRIBED
```

### 3. Test Live Updates

**Test A: Update subscription status**

In Supabase SQL Editor:
```sql
-- Replace 'your-user-id' with actual user ID
UPDATE user_subscriptions
SET subscription_status = 'active',
    updated_at = now()
WHERE user_id = 'your-user-id';
```

**Expected:**
- Console shows: `[SubscriptionContext] Received realtime update:`
- UI updates within 1 second
- No page refresh needed

**Test B: Update sales count**

Make a sale in the app or run:
```sql
UPDATE user_sales_counts
SET sales_count = sales_count + 1,
    updated_at = now()
WHERE user_id = 'your-user-id' AND business_id = 'your-business-id';
```

**Expected:**
- Console shows: `[SubscriptionContext] Sales count changed:`
- Sales count in UI updates instantly

### 4. Test Multi-Device Sync

1. Open app in two browser tabs (Tab A and Tab B)
2. In Tab A, make a purchase or update subscription
3. Watch Tab B - it should update within 1 second
4. Both tabs should show the same subscription status

### 5. Test Push Notifications

**Prerequisites:**
- App must be running on iOS/Android device
- User must have granted notification permissions
- Push token must be registered

**Test:**
```sql
-- In Supabase SQL Editor
UPDATE user_subscriptions
SET subscription_status = 'expired',
    updated_at = now()
WHERE user_id = 'your-user-id';
```

**Expected:**
- User receives push notification: "Subscription Expired"
- Database logs show: `Push notification sent for subscription change`

### 6. Test Receipt Validation

**Test on iOS/Android device only (not web):**

1. Click "Subscribe" in app
2. Complete purchase in App Store/Play Store
3. App receives receipt
4. Watch console logs:

```
Validating receipt with backend: {platform: 'ios', receiptLength: xxx}
Receipt validation result: {isValid: true, expiresDate: '...', productId: '...'}
[SubscriptionContext] Received realtime update:
```

**Expected:**
- Receipt validated successfully
- Database updated
- Realtime event fires
- UI updates to show active subscription

### 7. Test Polling Removal

Check that polling is no longer happening:

```javascript
// In browser console
// Should NOT see repeated requests every 3 minutes

// Search for "Polling" in logs - should find nothing
// Old logs would show: "[SubscriptionContext] Polling subscription status"
```

**Expected:**
- No periodic polling logs
- Only 1 database request on initial load
- Subsequent updates come via WebSocket

## Debugging Tools

### Check Realtime Connection Status

```javascript
// In browser console
supabase.getChannels().forEach(channel => {
  console.log('Channel:', channel.topic, 'State:', channel.state);
});

// Should show channels for:
// - subscription-changes-{userId}
// - sales-count-{userId}-{businessId}
```

### Monitor WebSocket Traffic

1. Open browser DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Look for connection to Supabase Realtime
4. Click on connection → Messages tab
5. You should see messages when data changes

### Check Database Triggers

```sql
-- List all triggers on user_subscriptions
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'user_subscriptions';

-- Should show:
-- - on_subscription_change (BEFORE INSERT OR UPDATE)
-- - on_subscription_push_notification (AFTER INSERT OR UPDATE)
```

### Check Push Notification Logs

In Supabase Dashboard → Database → Logs, search for:
```
Push notification sent for subscription change
```

## Performance Testing

### Test 1: Latency Measurement

```javascript
// In browser console
const startTime = Date.now();

// Update in Supabase SQL Editor
// UPDATE user_subscriptions SET subscription_status = 'active' WHERE ...

// In app, add this to the realtime listener:
console.log('Update received in', Date.now() - startTime, 'ms');

// Expected: < 1000ms (under 1 second)
```

### Test 2: Database Load

Before realtime (polling every 3 minutes):
- 20 requests per hour per user
- 1000 users = 20,000 requests/hour

After realtime:
- 1 request per hour per user (initial load)
- 1000 users = 1,000 requests/hour
- **95% reduction!**

Verify by checking Supabase Dashboard → Database → Usage

## Common Issues & Solutions

### Issue 1: "Realtime subscription status: CHANNEL_ERROR"

**Solution:**
- Check internet connection
- Verify Supabase URL is correct
- Check RLS policies allow user to SELECT from tables

### Issue 2: Updates not received

**Solution:**
- Verify realtime is enabled: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`
- Check browser console for connection errors
- Verify RLS policies allow user to view their data

### Issue 3: Push notifications not sent

**Solution:**
- Check database settings are configured:
  ```sql
  SHOW app.settings.supabase_url;
  SHOW app.settings.supabase_anon_key;
  ```
- Verify push token is registered in user_profiles
- Check edge function logs in Supabase Dashboard

### Issue 4: Multiple tabs not syncing

**Solution:**
- Check broadcast is properly configured in channel setup
- Verify both tabs have active WebSocket connections
- Look for broadcast events in DevTools → Network → WS → Messages

## Success Criteria

✅ **Realtime Connection:**
- Channels connect with status "SUBSCRIBED"
- No polling logs in console

✅ **Instant Updates:**
- Subscription changes reflect in < 1 second
- Sales count updates in < 1 second

✅ **Multi-Device Sync:**
- All tabs/devices update within 1 second
- No manual refresh needed

✅ **Push Notifications:**
- Notifications received when app closed
- Correct message content

✅ **Performance:**
- 95% reduction in database queries
- Sub-second latency for updates

## Rollback Procedure

If critical issues are found:

1. **Emergency rollback (keep realtime, add polling back):**
   ```typescript
   // In SubscriptionContext, add polling alongside realtime as backup
   ```

2. **Full rollback (remove realtime):**
   ```sql
   -- Remove tables from realtime publication
   ALTER PUBLICATION supabase_realtime DROP TABLE user_subscriptions;
   ALTER PUBLICATION supabase_realtime DROP TABLE user_sales_counts;
   ```

   ```typescript
   // Re-enable polling in SubscriptionContext
   // Comment out realtime setup
   ```

## Next Steps After Testing

1. Monitor logs for 24 hours
2. Check error rates in production
3. Verify battery usage on mobile devices
4. Monitor WebSocket connection stability
5. Collect user feedback on responsiveness

## Contact

For issues or questions about the realtime system, check:
- `REALTIME_SUBSCRIPTION_GUIDE.md` - Complete documentation
- Supabase Realtime docs: https://supabase.com/docs/guides/realtime
- Edge Functions docs: https://supabase.com/docs/guides/functions
