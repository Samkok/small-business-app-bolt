# Real-Time Subscription System - Implementation Guide

## Overview

This document explains the event-driven, pub-sub architecture for real-time subscription updates in the Business Manager Pro app. The system eliminates polling and uses WebSocket-based real-time updates for instant subscription state changes.

## Architecture

### Traditional Polling (Before)
- Client polls server every 3 minutes
- High database load
- Up to 3 minutes latency
- Unnecessary battery drain
- 20+ requests per hour per user

### Event-Driven Pub-Sub (Now)
- Client opens one WebSocket connection
- Server pushes updates instantly
- Sub-second latency
- Minimal battery usage
- 1 request per hour (initial load only)
- 95% reduction in database load

## Components

### 1. Database Layer

#### Enabled Realtime Tables
Located in: `supabase/migrations/*_enable_realtime_subscriptions.sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE user_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_sales_counts;
```

**What this does:**
- Tells Supabase Realtime to monitor these tables
- Any INSERT/UPDATE/DELETE triggers a WebSocket broadcast
- RLS policies automatically filter events to authorized users

#### Database Triggers
Located in: `supabase/migrations/*_subscription_update_triggers.sql`

```sql
CREATE OR REPLACE FUNCTION notify_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RAISE LOG 'Subscription changed for user: %, status: %', NEW.user_id, NEW.subscription_status;
  RETURN NEW;
END;
$$;
```

**What this does:**
- Fires BEFORE every INSERT/UPDATE
- Updates the `updated_at` timestamp
- The timestamp change triggers Realtime to broadcast the event
- Guaranteed to fire regardless of how the data is modified

### 2. Push Notification Layer

#### Push Notification Trigger
Located in: `supabase/migrations/*_subscription_push_notification_trigger.sql`

```sql
CREATE OR REPLACE FUNCTION send_subscription_push_notification()
RETURNS TRIGGER
AS $$
BEGIN
  -- When subscription status changes to active/expired
  -- Send push notification via edge function
END;
$$;
```

**What this does:**
- Fires AFTER subscription status changes
- Sends push notification via Edge Function
- Notifies users even when app is closed
- Uses pg_net for non-blocking async HTTP calls

#### Edge Function: send-push-notification
Located in: `supabase/functions/send-push-notification/index.ts`

**What this does:**
- Accepts push token, title, body, and data
- Validates token format
- Sends to Expo Push Notification service
- Handles both success and error cases

### 3. Receipt Validation Layer

#### Edge Function: validate-subscription
Located in: `supabase/functions/validate-subscription/index.ts`

**What this does:**
- Validates iOS App Store receipts with Apple
- Validates Android Play Store receipts with Google
- Updates subscription in database upon success
- Database trigger automatically fires, broadcasting to all connected clients

**Flow:**
```
Client purchases → Edge function validates receipt →
Database updated → Trigger fires →
Realtime broadcasts → All devices receive update →
Push notification sent
```

### 4. Client Layer

#### SubscriptionContext
Located in: `src/context/SubscriptionContext.tsx`

**Key Features:**

1. **Realtime Subscription Listener**
```typescript
const channel = supabase
  .channel(`subscription-changes-${user.id}`)
  .on('postgres_changes', {
    event: '*',
    table: 'user_subscriptions',
    filter: `user_id=eq.${user.id}`
  }, async (payload) => {
    // Optimistically update UI from payload
    // Then verify with server
  })
  .on('broadcast', { event: 'subscription_updated' }, async (payload) => {
    // Another tab/device made a purchase
    // Refresh our data
  })
  .subscribe();
```

2. **Sales Count Realtime Listener**
```typescript
const channel = supabase
  .channel(`sales-count-${user.id}-${currentBusiness.id}`)
  .on('postgres_changes', {
    event: '*',
    table: 'user_sales_counts',
    filter: `user_id=eq.${user.id}`
  }, async (payload) => {
    // Update sales count instantly when sale is made
    // Check if user hit free tier limit
  })
  .subscribe();
```

3. **Broadcast for Multi-Device Sync**
```typescript
// When user makes a purchase
if (realtimeChannelRef.current) {
  await realtimeChannelRef.current.send({
    type: 'broadcast',
    event: 'subscription_updated',
    payload: { userId: user.id, status: 'active' }
  });
}
```

**What this does:**
- Notifies all other tabs/devices logged in as the same user
- Creates seamless multi-device experience
- All screens update within 1 second

## Data Flow

### Scenario 1: User Makes Purchase

```
1. User clicks "Subscribe" in app
2. IAP.requestSubscription() triggers App Store/Play Store
3. User completes purchase
4. App receives receipt
5. App calls validateReceiptWithBackend()
6. Edge function validates with Apple/Google
7. Edge function updates database
8. Database trigger fires
9. Realtime broadcasts to all connected clients
10. Push notification trigger fires
11. All devices receive update within 1 second
12. User receives push notification (if app closed)
```

### Scenario 2: Subscription Expires

```
1. Cron job (or manual process) updates subscription status to 'expired'
2. Database trigger fires
3. Realtime broadcasts to all connected clients
4. Push notification trigger fires
5. All user's devices receive update
6. User receives push notification: "Subscription expired"
7. App shows paywall/upgrade prompt
```

### Scenario 3: User Makes Sale (Free Tier)

```
1. User completes sale
2. Sales count incremented in database
3. Database trigger fires on user_sales_counts
4. Realtime broadcasts to client
5. UI updates sales count instantly
6. If at limit (50 sales), UI shows upgrade prompt
7. Feature access automatically restricted
```

## Performance Improvements

### Before (Polling)
- Database queries: 20/hour × 1000 users = 20,000 queries/hour
- Latency: 0-180 seconds (average 90 seconds)
- Battery: Moderate drain from periodic requests
- Bandwidth: Multiple KB every 3 minutes

### After (Realtime)
- Database queries: 1/hour × 1000 users = 1,000 queries/hour (95% reduction)
- Latency: < 1 second
- Battery: Minimal (passive WebSocket)
- Bandwidth: ~100 bytes per event (only when changes occur)

## Testing

### Test 1: Realtime Connection
```sql
-- In Supabase SQL Editor
UPDATE user_subscriptions
SET subscription_status = 'active'
WHERE user_id = 'your-user-id';
```
**Expected:** App updates within 1 second, no page refresh needed

### Test 2: Multi-Device Sync
1. Open app in two browser tabs
2. Make purchase in tab 1
3. **Expected:** Tab 2 updates within 1 second

### Test 3: Push Notification
1. Close app completely
2. Update subscription via SQL or admin panel
3. **Expected:** Receive push notification

### Test 4: Sales Count
1. Make a sale
2. **Expected:** Sales count updates instantly without refresh

## Configuration

### Database Settings
The push notification trigger requires database settings to be configured:

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';
```

These should be set by a database administrator or via the Supabase dashboard.

### Edge Function Secrets
Configure in Supabase Dashboard → Edge Functions → Secrets:

- `APPLE_SHARED_SECRET`: Your Apple App Store shared secret
- Google Play credentials (for Android validation)

## Debugging

### Enable Realtime Logs
```typescript
const channel = supabase.channel('my-channel');
channel.subscribe((status) => {
  console.log('Status:', status);
  // SUBSCRIBED = connected
  // CHANNEL_ERROR = connection failed
});
```

### Check Database Logs
In Supabase Dashboard → Database → Logs, look for:
```
Subscription changed for user: xxx, status: active
```

### Verify Realtime Publication
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

Should show `user_subscriptions` and `user_sales_counts`.

## Security

### Row Level Security (RLS)
Realtime respects RLS policies. Users only receive events for their own data:

```sql
CREATE POLICY "Users can view own subscription"
ON user_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

### Edge Function Authentication
All edge functions validate JWT tokens and user identity.

### Push Token Security
Push tokens stored in user_profiles with RLS, only accessible to the user.

## Rollback Plan

If issues arise, you can temporarily revert to polling:

1. Comment out realtime setup in SubscriptionContext
2. Uncomment polling code
3. Rebuild and deploy

The database triggers are harmless and can remain active.

## Future Enhancements

1. **Offline Support**: Queue subscription updates when offline
2. **Optimistic UI**: Show pending state during purchase
3. **Receipt Polling**: Periodic receipt revalidation
4. **Analytics**: Track realtime connection health
5. **Error Recovery**: Auto-reconnect on network issues

## Conclusion

This pub-sub architecture provides:
- Instant updates across all devices
- 95% reduction in database load
- Push notifications for offline users
- Seamless multi-device synchronization
- Better user experience
- Lower infrastructure costs

The system is production-ready and scales efficiently to thousands of concurrent users.
