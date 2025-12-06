# Apple App Store Server Notifications Webhook Setup

This guide explains how to configure and test the IAP webhook system that handles subscription events from Apple.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Deploying the Edge Function](#deploying-the-edge-function)
- [Configuring App Store Connect](#configuring-app-store-connect)
- [Event Types](#event-types)
- [Testing Webhooks](#testing-webhooks)
- [Monitoring](#monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Overview

The IAP webhook receives notifications from Apple when subscription events occur:
- Initial purchase
- Renewals
- Cancellations
- Expirations
- Refunds

The webhook automatically updates user subscription status and triggers downgrade flows when needed.

---

## Prerequisites

1. **Supabase Project**
   - Edge Functions enabled
   - Database with subscription schema

2. **Apple Developer Account**
   - App Store Connect access
   - App configured with IAP products

3. **Supabase CLI**
   ```bash
   npm install -g supabase
   ```

---

## Deploying the Edge Function

### 1. Verify Function Code

Check that `/supabase/functions/iap-webhook/index.ts` exists with the correct implementation.

### 2. Deploy to Supabase

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy iap-webhook
```

### 3. Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs iap-webhook
```

### 4. Get Function URL

Your webhook URL will be:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/iap-webhook
```

**Important:** Save this URL - you'll need it for App Store Connect.

---

## Configuring App Store Connect

### 1. Navigate to Webhook Settings

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **General** → **App Information**
4. Scroll to **App Store Server Notifications**

### 2. Configure Production URL

1. Click **Add Server URL**
2. Enter your Supabase Edge Function URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/iap-webhook
   ```
3. Select **Version 2** (important!)
4. Click **Save**

### 3. Configure Sandbox URL

1. Add another server URL for sandbox testing
2. Use the same URL (Edge Function handles both environments)
3. Mark as **Sandbox** environment

### 4. Verify Configuration

Apple will send a test notification to verify the endpoint:
- Status should show "Active" (green)
- If "Failed" (red), check Edge Function logs

---

## Event Types

The webhook handles these notification types:

### INITIAL_BUY
**Triggered:** User purchases subscription for first time

**Actions:**
- Update `user_profiles.subscription_tier` based on product ID
- Set `subscription_status = 'active'`
- Set `subscription_expiration_date`
- Set `max_owned_businesses` for tier
- Clear `must_choose_businesses` flag
- Set all owned businesses to `active`

### DID_RENEW
**Triggered:** Subscription auto-renews

**Actions:**
- Update `subscription_expiration_date` to new period
- Ensure `subscription_status = 'active'`
- Log renewal

### DID_CHANGE_RENEWAL_STATUS
**Triggered:** User cancels auto-renew (but subscription stays active until expiration)

**Actions:**
- Set `subscription_status = 'cancelled'`
- Keep access until expiration date
- Send notification about non-renewal

### EXPIRED
**Triggered:** Subscription reaches expiration date

**Actions:**
- Set `subscription_tier = 'free'`
- Set `subscription_status = 'expired'`
- Set `max_owned_businesses = 1`
- If user owns > 1 business:
  - Call `set_read_only_businesses(user_id, 1)`
  - Set `must_choose_businesses = true`
  - Trigger DowngradePick modal on next app open

### REFUND
**Triggered:** Apple processes refund for subscription

**Actions:**
- Immediate downgrade to free tier
- Set `subscription_tier = 'free'`
- Set `subscription_status = 'expired'`
- If user owns > 1 business:
  - Call `set_read_only_businesses(user_id, 1)`
  - Set `must_choose_businesses = true`
- Revoke premium access immediately

---

## Testing Webhooks

### Testing in Sandbox

Apple provides accelerated subscription durations in sandbox:
- 1 month subscription → 5 minutes
- 1 year subscription → 1 hour

**Test Flow:**

1. **Setup:**
   ```bash
   # Start watching logs
   supabase functions logs iap-webhook --follow
   ```

2. **Purchase in Sandbox:**
   - Use TestFlight app
   - Sign in with sandbox account
   - Purchase subscription
   - Watch logs for INITIAL_BUY event

3. **Wait for Renewal:**
   - Wait 5 minutes for 1-month sub
   - Watch logs for DID_RENEW event

4. **Cancel Subscription:**
   - Open Settings → Subscriptions
   - Cancel subscription
   - Watch logs for DID_CHANGE_RENEWAL_STATUS

5. **Wait for Expiration:**
   - Wait remaining time
   - Watch logs for EXPIRED event
   - Verify downgrade logic triggered

### Manual Testing with cURL

Create test payload:

```bash
# Test endpoint is reachable
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/iap-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "signedPayload": "test_payload"
  }'
```

**Note:** Real webhooks from Apple include JWT-signed payloads. Manual testing won't trigger full processing but verifies endpoint is reachable.

### Simulating Events (Development)

For development testing without waiting for real events:

1. **Use Debug Tool:**
   - Open app in dev mode
   - Navigate to Subscription Debug
   - Use "Expire Subscription Now" button
   - Use "Trigger Downgrade Modal" button

2. **Direct Database Updates:**
   ```sql
   -- Simulate expiration
   UPDATE user_profiles
   SET
     subscription_status = 'expired',
     subscription_expiration_date = NOW() - INTERVAL '1 day',
     subscription_tier = 'free',
     max_owned_businesses = 1
   WHERE id = '<user_id>';

   -- Trigger downgrade modal
   UPDATE user_profiles
   SET must_choose_businesses = true
   WHERE id = '<user_id>';
   ```

---

## Monitoring

### View Webhook Logs

```bash
# Real-time logs
supabase functions logs iap-webhook --follow

# Last 100 entries
supabase functions logs iap-webhook --limit 100

# Filter by error
supabase functions logs iap-webhook | grep ERROR
```

### Important Log Patterns

**Successful Processing:**
```
Received Apple webhook: { signedPayload: "..." }
Decoded notification type: INITIAL_BUY
Activating subscription for user abc123: pro
Subscription activated for user abc123
```

**Duplicate Transaction:**
```
Transaction already processed: 123456789
```

**User Not Found:**
```
No user found for transaction: original_transaction_id
```

**Downgrade Triggered:**
```
User abc123 has 3 businesses, downgrade modal triggered
Subscription expired for user abc123, downgraded to free tier
```

### Database Monitoring

**Check Processed Transactions:**
```sql
SELECT
  transaction_id,
  notification_type,
  processed_at
FROM processed_transactions
ORDER BY processed_at DESC
LIMIT 20;
```

**Check User Subscriptions:**
```sql
SELECT
  user_id,
  subscription_tier,
  subscription_status,
  subscription_expiration_date,
  must_choose_businesses
FROM user_profiles
WHERE subscription_tier != 'free'
ORDER BY subscription_expiration_date DESC;
```

**Check Read-Only Businesses:**
```sql
SELECT
  b.name,
  b.access_state,
  b.owner_user_id,
  up.subscription_tier
FROM businesses b
JOIN user_profiles up ON b.owner_user_id = up.id
WHERE b.access_state = 'read_only_sales';
```

---

## Security

### JWT Signature Verification

The webhook uses Apple's public key to verify JWT signatures:

```typescript
function decodeJWT(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  // Decode and verify signature
  // ...
}
```

**Important:** Never process unsigned or invalid payloads.

### Idempotency

Webhook uses `processed_transactions` table to prevent duplicate processing:

```typescript
const { data: existingTransaction } = await supabase
  .from('processed_transactions')
  .select('id')
  .eq('transaction_id', transactionId)
  .maybeSingle();

if (existingTransaction) {
  return { status: 'already_processed' };
}
```

### Environment Variables

Required environment variables (auto-configured in Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Never** expose service role key in client code.

---

## Troubleshooting

### Issue: Webhook Shows "Failed" in App Store Connect

**Possible Causes:**
1. Edge Function not deployed
2. Edge Function returning non-200 status
3. Network connectivity issues

**Solution:**
```bash
# Check function is deployed
supabase functions list

# Check logs for errors
supabase functions logs iap-webhook

# Redeploy if needed
supabase functions deploy iap-webhook --no-verify-jwt
```

---

### Issue: Events Not Processing

**Symptoms:**
- Webhook receives event (shows in logs)
- But database not updating

**Solution:**

1. **Check logs for errors:**
   ```bash
   supabase functions logs iap-webhook | grep -i error
   ```

2. **Verify user exists:**
   ```sql
   SELECT * FROM user_profiles
   WHERE subscription_product_id = 'original_transaction_id';
   ```

3. **Check RLS policies:**
   - Service role key should bypass RLS
   - Verify Edge Function using service role key

4. **Verify database functions:**
   ```sql
   -- Test set_read_only_businesses
   SELECT set_read_only_businesses('<user_id>', 1);
   ```

---

### Issue: Duplicate Event Processing

**Symptoms:**
- Same transaction processed multiple times
- User downgraded multiple times

**Solution:**

1. **Check processed_transactions table:**
   ```sql
   SELECT
     transaction_id,
     COUNT(*) as count
   FROM processed_transactions
   GROUP BY transaction_id
   HAVING COUNT(*) > 1;
   ```

2. **Verify idempotency check:**
   - Should query `processed_transactions` before processing
   - Should insert transaction ID after processing

3. **Add unique constraint (if missing):**
   ```sql
   ALTER TABLE processed_transactions
   ADD CONSTRAINT processed_transactions_transaction_id_unique
   UNIQUE (transaction_id);
   ```

---

### Issue: Downgrade Not Triggering

**Symptoms:**
- Subscription expired
- User still has access to all businesses
- No downgrade modal

**Solution:**

1. **Check EXPIRED event received:**
   ```bash
   supabase functions logs iap-webhook | grep EXPIRED
   ```

2. **Verify must_choose_businesses set:**
   ```sql
   SELECT
     id,
     subscription_tier,
     must_choose_businesses,
     max_owned_businesses
   FROM user_profiles
   WHERE subscription_tier = 'free'
   AND must_choose_businesses = false;
   ```

3. **Manually trigger if needed:**
   ```sql
   UPDATE user_profiles
   SET must_choose_businesses = true
   WHERE id = '<user_id>';
   ```

4. **Check owned business count:**
   ```sql
   SELECT
     owner_user_id,
     COUNT(*) as owned_count
   FROM businesses
   WHERE owner_user_id = '<user_id>'
   GROUP BY owner_user_id;
   ```

---

## Best Practices

### 1. Always Return 200 OK

Apple expects 200 status even for errors:
```typescript
catch (error) {
  console.error('Error:', error);
  // Still return 200 to prevent retries
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 200 }
  );
}
```

### 2. Log Everything

Comprehensive logging helps debug issues:
```typescript
console.log('Received webhook:', payload);
console.log('Decoded type:', notificationType);
console.log('Transaction ID:', transactionId);
console.log('Processing for user:', userId);
```

### 3. Handle All Event Types

Even if you don't need certain events, acknowledge them:
```typescript
default:
  console.log('Unhandled notification type:', type);
  // Still return success
  break;
```

### 4. Test Regularly

- Test with sandbox at least monthly
- Verify webhook still active in App Store Connect
- Check logs for any errors
- Monitor database for anomalies

---

## Reference Links

- [Apple Server Notifications Documentation](https://developer.apple.com/documentation/appstoreservernotifications)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [JWT Verification](https://jwt.io/)

---

**Last Updated:** 2025-12-06
**Version:** 1.0.0
