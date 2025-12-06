# Subscription System Implementation Guide

## Overview

Complete subscription system with tiered business limits, downgrade selection UX, and server-side enforcement.

## Product IDs (Already configured in App Store Connect)

```
bizmanage.pro.month - Pro Monthly ($4.99)
bizmanage.pro.year - Pro Yearly ($47.99)
bizmanage.pro_plus.month - Pro Plus Monthly ($9.99)
bizmanage.pro_plus.year - Pro Plus Yearly ($95.99)
bizmanage.max.month - Max Monthly ($19.99)
bizmanage.max.year - Max Yearly ($191.99)
```

## Tier Limits

| Tier | Owned Business Limit | Sales Limit | Price |
|------|---------------------|-------------|-------|
| Free | Unlimited (staff access) | 50 total | $0 |
| Pro | 1 business | Unlimited | $4.99/mo or $47.99/yr |
| Pro Plus | 3 businesses | Unlimited | $9.99/mo or $95.99/yr |
| Max | Unlimited businesses | Unlimited | $19.99/mo or $191.99/yr |

**Important**: Business limits apply to OWNED businesses only. Staff members can access unlimited businesses regardless of their tier.

## Database Schema

### New Fields Added

#### `businesses` table:
- `access_state` (text): 'active' | 'read_only_sales'
- `archived_at` (timestamptz): Soft delete timestamp

#### `user_profiles` table:
- `must_choose_businesses` (boolean): Flag for downgrade selection modal

#### `user_subscriptions` table:
- `tier` (text): 'free' | 'pro' | 'pro_plus' | 'max'
- `max_owned_businesses` (integer): Derived from tier
- `selected_business_ids` (jsonb): Selected businesses during downgrade
- `previous_tier` (text): Previous tier for downgrade detection

## Key Functions

### Server-Side (Database)

1. **`can_user_create_business(user_id)`**: Checks business limit
2. **`can_user_create_sale(user_id, business_id)`**: Checks sales limit and read-only state
3. **`set_read_only_businesses(user_id, max_active)`**: Sets businesses to read-only
4. **`activate_selected_businesses(user_id, business_ids[])`**: Activates selected businesses
5. **`is_business_read_only(business_id)`**: Checks if business is read-only

### Triggers

- **Sales validation trigger**: Prevents sales creation when limits are reached or business is read-only

## Edge Functions (To Be Created)

### 1. `validate-receipt` (POST)
Validates Apple/Google receipt and updates subscription.

**Request**:
```json
{
  "userId": "uuid",
  "receiptBase64": "string",
  "platform": "ios" | "android"
}
```

**Response**:
```json
{
  "success": true,
  "subscriptionActive": true,
  "tier": "pro_plus",
  "expirationDate": "2024-01-01T00:00:00Z",
  "productId": "bizmanage.pro_plus.month"
}
```

### 2. `iap-webhook` (POST)
Handles App Store Server Notifications (ASN) for subscription events.

**Events Handled**:
- INITIAL_BUY
- DID_RENEW
- DID_FAIL_TO_RENEW
- DID_CHANGE_RENEWAL_STATUS
- REFUND
- CANCEL

### 3. `subscription-status` (GET)
Returns complete subscription status including mustChooseBusinesses flag.

**Request**: `?userId=uuid`

**Response**:
```json
{
  "isSubscribed": true,
  "tier": "pro_plus",
  "maxOwnedBusinesses": 3,
  "subscriptionStatus": "active",
  "expirationDate": "2024-01-01T00:00:00Z",
  "ownedBusinesses": [
    {
      "id": "uuid",
      "name": "Business 1",
      "accessState": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "businessCount": 3,
  "mustChooseBusinesses": false,
  "purchaseHistory": []
}
```

### 4. `choose-businesses` (POST)
Saves user's business selection during downgrade.

**Request**:
```json
{
  "userId": "uuid",
  "selectedBusinessIds": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "success": true,
  "activeBusinesses": ["uuid1", "uuid2"]
}
```

## Downgrade Flow

### Scenario: User downgrades from Max to Pro

1. User initiates downgrade in App Store
2. App receives purchase event via `iapService.getAvailablePurchases()`
3. Client calls `validate-receipt` edge function
4. Server detects downgrade (previous_tier=max, new_tier=pro)
5. Server checks owned business count (e.g., 5 businesses)
6. Since 5 > 1 (Pro limit):
   - Server sets `must_choose_businesses = true` in user_profiles
   - Calls `set_read_only_businesses(userId, 1)` to set oldest business as active, others read-only
7. Client refreshes subscription status via `subscription-status` endpoint
8. Client sees `mustChooseBusinesses = true`
9. Client shows `DowngradePick` modal with list of owned businesses
10. User selects 1 business to keep active
11. Client calls `choose-businesses` endpoint with selection
12. Server calls `activate_selected_businesses(userId, [selectedId])`
13. Server sets selected business to 'active', others to 'read_only_sales'
14. Server clears `must_choose_businesses` flag
15. Client refreshes and modal dismisses

## Read-Only Mode (Sales Only)

When `business.access_state = 'read_only_sales'`:

### Blocked Actions:
- Create/edit/delete sales

### Allowed Actions:
- View sales, invoices, reports
- View inventory, products, customers
- Add/edit expenses
- Manage team members
- Edit business profile
- View all analytics

## Client Components

### 1. DowngradePick Modal
Shows when `must_choose_businesses = true`. Lets user select which businesses to keep active.

**Features**:
- Multi-select list of owned businesses
- Shows business name, creation date, last activity
- Indicates how many to select (based on new tier limit)
- "Confirm Selection" CTA
- Blocks app usage until selection is made

### 2. Enhanced Paywall
- Shows all 6 products with localized pricing
- Highlights Pro Plus as "Most Popular"
- Highlights Max as "Best Value"
- Shows percent saved for yearly plans
- Monthly/Yearly toggle per tier
- Purchase and restore buttons
- Detects downgrade and shows warning

### 3. Read-Only Banner
Shows in business header when `accessState = 'read_only_sales'`.

**Message**: "This business is in read-only mode. Upgrade to continue creating sales."

### 4. SubscriptionDebug
Hidden debug screen (only in `__DEV__`) to simulate scenarios:
- Set sales count to 49/50
- Toggle subscription active/inactive
- Change tier
- Force downgrade flow
- View raw receipts

## Testing Scenarios

### Scenario 1: Free Tier Limit
1. Create 49 sales
2. Create 50th sale → success
3. Attempt 51st sale → Error: "FREE_TIER_LIMIT: Free tier limit of 50 sales reached"

### Scenario 2: Downgrade from Max to Pro
1. User has 5 owned businesses on Max tier
2. User downgrades to Pro (1 business limit)
3. App shows DowngradePick modal
4. User selects 1 business
5. Other 4 businesses become read-only
6. User can view sales but not create new ones in read-only businesses

### Scenario 3: Subscription Expiry
1. User's subscription expires
2. Webhook updates tier to 'free'
3. User has 3 owned businesses
4. Server sets all but oldest business to read-only
5. User sees `mustChooseBusinesses = true`
6. App shows modal to select 1 business (free tier = staff access, no owned limit enforcement)

### Scenario 4: Purchase Restore
1. User reinstalls app
2. User taps "Restore Purchases"
3. Client calls `iapService.getAvailablePurchases()`
4. Client calls `validate-receipt` with receipt
5. Server validates and restores subscription
6. All owned businesses become active again

## API Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `FREE_TIER_LIMIT` | 50 sales limit reached | 403 |
| `BUSINESS_SALES_LIMIT` | Business exceeds tier limit | 403 |
| `BUSINESS_READ_ONLY` | Business in read-only mode | 403 |
| `INVALID_RECEIPT` | Receipt validation failed | 400 |
| `SUBSCRIPTION_EXPIRED` | Subscription has expired | 402 |

## Postman Collection

```json
{
  "info": {
    "name": "BizManage Subscription API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Validate Receipt",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{supabase_anon_key}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"userId\": \"{{user_id}}\",\n  \"receiptBase64\": \"{{receipt}}\",\n  \"platform\": \"ios\"\n}"
        },
        "url": {
          "raw": "{{supabase_url}}/functions/v1/validate-receipt",
          "host": ["{{supabase_url}}"],
          "path": ["functions", "v1", "validate-receipt"]
        }
      }
    },
    {
      "name": "Get Subscription Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{supabase_anon_key}}"
          }
        ],
        "url": {
          "raw": "{{supabase_url}}/functions/v1/subscription-status?userId={{user_id}}",
          "host": ["{{supabase_url}}"],
          "path": ["functions", "v1", "subscription-status"],
          "query": [
            {
              "key": "userId",
              "value": "{{user_id}}"
            }
          ]
        }
      }
    },
    {
      "name": "Choose Businesses",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{supabase_anon_key}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"userId\": \"{{user_id}}\",\n  \"selectedBusinessIds\": [\"{{business_id_1}}\"]\n}"
        },
        "url": {
          "raw": "{{supabase_url}}/functions/v1/choose-businesses",
          "host": ["{{supabase_url}}"],
          "path": ["functions", "v1", "choose-businesses"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "supabase_url",
      "value": "https://your-project.supabase.co"
    },
    {
      "key": "supabase_anon_key",
      "value": "your-anon-key"
    },
    {
      "key": "user_id",
      "value": "user-uuid"
    },
    {
      "key": "business_id_1",
      "value": "business-uuid"
    },
    {
      "key": "receipt",
      "value": "base64-receipt-data"
    }
  ]
}
```

## TestFlight Sandbox Testing Steps

### 1. Setup Sandbox Account
1. Go to App Store Connect → Users and Access → Sandbox Testers
2. Create a new sandbox tester account
3. Use a unique email (doesn't need to be real)
4. Set country to match your products

### 2. Prepare Test Device
1. Sign out of real Apple ID in Settings → App Store
2. DON'T sign in to sandbox account yet
3. Install TestFlight build
4. Launch app

### 3. Test Free Tier
1. Create 50 sales across all businesses
2. Verify 51st sale is blocked
3. Check error message

### 4. Test Purchase Flow
1. Navigate to subscription screen
2. Tap "Pro Plus" tier
3. When prompted, sign in with sandbox account
4. Complete purchase (no charge)
5. Verify subscription activated
6. Create 51st sale → should succeed

### 5. Test Downgrade Flow
1. In sandbox: Subscribe to Max tier
2. Create 5 businesses
3. In App Store settings: Downgrade to Pro
4. Reopen app
5. Verify DowngradePick modal appears
6. Select 1 business
7. Verify other 4 are read-only

### 6. Test Expiry
1. In sandbox: subscription expires after 5 minutes (accelerated time)
2. Wait for expiry
3. Reopen app
4. Verify downgrade to free tier
5. Verify businesses become read-only

### 7. Test Restore
1. Delete app
2. Reinstall from TestFlight
3. Sign in
4. Tap "Restore Purchases"
5. Verify subscription restored

## Production Deployment Checklist

- [ ] All 6 products configured in App Store Connect
- [ ] Products are "Ready to Submit"
- [ ] Subscription group created
- [ ] App Store Server Notifications configured (webhook URL)
- [ ] Edge functions deployed to Supabase
- [ ] Database migrations applied
- [ ] Environment variables set (APPLE_SHARED_SECRET, etc.)
- [ ] TestFlight testing completed
- [ ] Sandbox accounts tested all flows
- [ ] App Store review submission notes prepared

## Next Steps

1. **Implement Edge Functions** (Priority 1)
   - validate-receipt
   - subscription-status
   - choose-businesses
   - iap-webhook

2. **Create Client Components** (Priority 2)
   - DowngradePick modal
   - Enhanced Paywall
   - Read-Only banner
   - SubscriptionDebug

3. **Update Business Service** (Priority 3)
   - Add check for business limit before creation
   - Show read-only state in UI

4. **Update Sales Service** (Priority 4)
   - Handle read-only errors gracefully
   - Show upgrade prompt

5. **Testing** (Priority 5)
   - Unit tests for functions
   - Integration tests for flows
   - TestFlight beta testing

## Support & Troubleshooting

### Issue: Purchases not restoring
- Check receipt validation is working
- Verify webhook is receiving notifications
- Check database user_subscriptions table

### Issue: Downgrade modal not showing
- Check `must_choose_businesses` flag in user_profiles
- Verify subscription-status endpoint returns correct data
- Check client polling/realtime subscription

### Issue: Read-only not enforced
- Verify `access_state` field updated correctly
- Check sales trigger is active
- Verify `can_user_create_sale` function logic

## Analytics Hooks (To Be Implemented)

Track these events:
- `subscription_purchased`
- `subscription_cancelled`
- `subscription_renewed`
- `downgrade_initiated`
- `businesses_selected`
- `free_tier_limit_reached`
- `upgrade_prompt_shown`
- `restore_purchases_tapped`

Use your analytics provider (Mixpanel, Amplitude, etc.) to track conversion funnels and churn.
