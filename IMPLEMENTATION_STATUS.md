# Subscription System - Implementation Status

## Completed ✅

### 1. Database Schema & Migrations
- ✅ Added `access_state` column to businesses table ('active' | 'read_only_sales')
- ✅ Added `archived_at` column to businesses for soft delete
- ✅ Added `must_choose_businesses` flag to user_profiles
- ✅ Added `selected_business_ids` jsonb array to user_subscriptions
- ✅ Added `previous_tier` field to user_subscriptions for downgrade detection
- ✅ Created indexes on access_state and archived_at
- ✅ Migration file: `add_business_access_state_and_selection_fields_v2.sql`

### 2. Database Functions
- ✅ `set_read_only_businesses(user_id, max_active)` - Sets businesses to read-only when exceeding tier limit
- ✅ `activate_selected_businesses(user_id, business_ids[])` - Activates selected businesses, sets others to read-only
- ✅ `is_business_read_only(business_id)` - Checks if business is in read-only mode
- ✅ `can_user_create_sale(user_id, business_id)` - Updated to check access_state
- ✅ `check_sales_subscription_limit()` trigger - Updated to enforce read-only state
- ✅ `get_user_subscription_tier(user_id)` - Already exists from previous migration
- ✅ `can_user_create_business(user_id)` - Already exists from previous migration

### 3. Edge Functions (Supabase)

#### ✅ validate-subscription (Enhanced)
**Location**: `supabase/functions/validate-subscription/index.ts`

**Features**:
- Validates Apple/Google receipts
- Detects tier upgrades and downgrades
- Calls `set_read_only_businesses()` on downgrade
- Activates all businesses on upgrade
- Stores previous_tier for tracking

**Usage**:
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/validate-subscription \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"receipt": "base64_receipt", "platform": "ios", "userId": "user-uuid"}'
```

#### ✅ subscription-status
**Location**: `supabase/functions/subscription-status/index.ts`

**Features**:
- Returns complete subscription status
- Includes owned businesses with access_state
- Returns must_choose_businesses flag
- Includes purchase history
- Total sales count

**Usage**:
```bash
curl -X GET \
  "https://your-project.supabase.co/functions/v1/subscription-status?userId=user-uuid" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Response**:
```json
{
  "isSubscribed": true,
  "tier": "pro_plus",
  "maxOwnedBusinesses": 3,
  "subscriptionStatus": "active",
  "expirationDate": "2024-12-31T23:59:59Z",
  "productId": "bizmanage.pro_plus.month",
  "platform": "ios",
  "ownedBusinesses": [
    {
      "id": "uuid",
      "name": "My Business",
      "accessState": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "businessCount": 3,
  "mustChooseBusinesses": false,
  "totalSalesCount": 125,
  "purchaseHistory": []
}
```

#### ✅ choose-businesses
**Location**: `supabase/functions/choose-businesses/index.ts`

**Features**:
- Validates business ownership
- Verifies selection count matches tier limit
- Calls `activate_selected_businesses()`
- Returns updated business states
- Clears must_choose_businesses flag

**Usage**:
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/choose-businesses \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid", "selectedBusinessIds": ["biz-uuid-1", "biz-uuid-2"]}'
```

**Response**:
```json
{
  "success": true,
  "activeBusinesses": ["biz-uuid-1", "biz-uuid-2"],
  "businesses": [
    {"id": "biz-uuid-1", "name": "Business 1", "accessState": "active"},
    {"id": "biz-uuid-2", "name": "Business 2", "accessState": "active"},
    {"id": "biz-uuid-3", "name": "Business 3", "accessState": "read_only_sales"}
  ]
}
```

### 4. Documentation
- ✅ SUBSCRIPTION_SYSTEM_README.md - Complete system overview
- ✅ IMPLEMENTATION_STATUS.md - This file
- ✅ Postman collection examples
- ✅ TestFlight testing steps
- ✅ API documentation

## In Progress / To Do 🚧

### 1. Client Components (High Priority)

#### ❌ DowngradePick Modal
**Location**: To be created at `src/components/subscription/DowngradePick.tsx`

**Purpose**: Shows when `mustChooseBusinesses = true` to let user select active businesses

**Features Needed**:
- Multi-select list of owned businesses
- Shows business info (name, creation date, sales count)
- Indicates how many to select based on tier
- "Confirm Selection" button
- Blocks app until selection confirmed
- Calls `choose-businesses` endpoint

**Integration Points**:
- Check `mustChooseBusinesses` in AuthContext/SubscriptionContext
- Show modal on app launch if flag is true
- Dismiss modal after successful selection

#### ❌ SubscriptionDebug Component
**Location**: To be created at `src/components/subscription/SubscriptionDebug.tsx`

**Purpose**: Debug screen for testing subscription scenarios

**Features Needed**:
- Show current tier and limits
- Button to simulate 49/50 sales
- Button to toggle subscription active/inactive
- Dropdown to change tier manually
- Button to force downgrade flow
- Display raw receipt data
- Show business access states
- Only visible in `__DEV__` mode

### 2. Edge Functions (Medium Priority)

#### ❌ iap-webhook
**Location**: To be created at `supabase/functions/iap-webhook/index.ts`

**Purpose**: Handles App Store Server Notifications (ASN)

**Events to Handle**:
- INITIAL_BUY
- DID_RENEW
- DID_FAIL_TO_RENEW
- DID_CHANGE_RENEWAL_STATUS
- REFUND
- CANCEL
- PRICE_INCREASE_CONSENT

**Actions**:
- Update subscription status
- Handle refunds (immediate downgrade to free)
- Handle cancellations (expire at period end)
- Handle renewals (extend expiration)
- Send user notifications via email/push

**Webhook URL**: Will be configured in App Store Connect

### 3. UI Updates (High Priority)

#### ❌ Read-Only Banner
**Location**: Update business header component

**Features Needed**:
- Show when `accessState = 'read_only_sales'`
- Message: "This business is in read-only mode. Upgrade to create sales."
- Link to subscription screen
- Prominent visual design (warning color)

#### ❌ Sales Create Error Handling
**Location**: Update `src/services/sales.ts` and sales creation screens

**Features Needed**:
- Catch `BUSINESS_READ_ONLY` error
- Show user-friendly error message
- Offer upgrade button
- Explain read-only mode

### 4. Business Service Updates (Medium Priority)

#### ❌ Business Creation Check
**Location**: Update `src/services/business.ts`

**Features Needed**:
- Call `can_user_create_business()` before creation
- Show upgrade prompt if limit reached
- Disable "Create Business" button when at limit
- Show current count / tier limit

### 5. Testing & QA (High Priority)

#### ❌ Unit Tests
- Test downgrade detection logic
- Test business selection validation
- Test tier limit enforcement
- Test read-only enforcement

#### ❌ Integration Tests
- Test complete downgrade flow end-to-end
- Test upgrade flow
- Test expiry handling
- Test restore purchases

#### ❌ TestFlight Testing
- Test all 6 product purchases
- Test downgrades in sandbox
- Test accelerated expiry (5 min)
- Test restore purchases
- Test read-only enforcement

## How to Complete Remaining Tasks

### Step 1: Deploy Edge Functions
```bash
# Deploy validate-subscription (already updated)
supabase functions deploy validate-subscription

# Deploy subscription-status
supabase functions deploy subscription-status

# Deploy choose-businesses
supabase functions deploy choose-businesses
```

### Step 2: Create DowngradePick Modal

This is the MOST CRITICAL component. Here's the flow:

1. On app launch, check `mustChooseBusinesses` flag
2. If true, show DowngradePick modal (fullscreen, can't dismiss)
3. Fetch owned businesses from `subscription-status` endpoint
4. Show multi-select list
5. User selects businesses (up to tier limit)
6. Call `choose-businesses` endpoint
7. Refresh subscription status
8. Dismiss modal

**Recommended Implementation**:
- Use React Native Modal with `animationType="slide"`
- Use FlatList with checkboxes for business selection
- Disable "Confirm" button until correct number selected
- Show loading state during API call
- Handle errors gracefully

### Step 3: Update SubscriptionContext

The existing `SubscriptionContext` needs to:
1. Poll or subscribe to `subscription-status` endpoint
2. Expose `mustChooseBusinesses` flag
3. Trigger DowngradePick modal when flag is true
4. Refresh after business selection

### Step 4: Add Read-Only UI Indicators

In business header/navbar:
```typescript
if (currentBusiness?.access_state === 'read_only_sales') {
  // Show warning banner
}
```

In sales creation screen:
```typescript
if (currentBusiness?.access_state === 'read_only_sales') {
  // Disable create sale button
  // Show upgrade prompt
}
```

### Step 5: Update Business Service

In `src/services/business.ts`:
```typescript
async createBusiness(businessData) {
  // Check if user can create business
  const { data } = await supabase.rpc('can_user_create_business', {
    p_user_id: userId
  });

  if (!data) {
    throw new Error('BUSINESS_LIMIT_REACHED');
  }

  // Create business...
}
```

### Step 6: Create iap-webhook Function

This handles App Store notifications. Template:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const payload = await req.json();

  // Verify signature (important!)
  // Parse notification type
  // Handle event (REFUND, CANCEL, RENEW, etc.)
  // Update database
  // Send user notification

  return new Response('OK', { status: 200 });
});
```

### Step 7: TestFlight Testing

1. Configure sandbox tester in App Store Connect
2. Install TestFlight build on device
3. Test purchase flow for each tier
4. Test downgrade from Max → Pro Plus → Pro → Free
5. Test upgrade flow
6. Test expiry (accelerated in sandbox)
7. Test restore purchases
8. Verify read-only enforcement

## API Endpoints Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/functions/v1/validate-subscription` | POST | Validate receipt & update subscription | ✅ Done |
| `/functions/v1/subscription-status` | GET | Get complete subscription status | ✅ Done |
| `/functions/v1/choose-businesses` | POST | Save business selection | ✅ Done |
| `/functions/v1/iap-webhook` | POST | Handle App Store notifications | ❌ To Do |

## Database Functions Summary

| Function | Purpose | Status |
|----------|---------|--------|
| `can_user_create_business(user_id)` | Check business limit | ✅ Done |
| `can_user_create_sale(user_id, business_id)` | Check sales limit & read-only | ✅ Done |
| `set_read_only_businesses(user_id, max_active)` | Set businesses to read-only | ✅ Done |
| `activate_selected_businesses(user_id, ids[])` | Activate selected businesses | ✅ Done |
| `is_business_read_only(business_id)` | Check if read-only | ✅ Done |
| `get_user_subscription_tier(user_id)` | Get tier info | ✅ Done |

## Next Steps Priority

1. **CRITICAL**: Create DowngradePick modal component
2. **CRITICAL**: Update SubscriptionContext to show modal when needed
3. **HIGH**: Add read-only banner to business header
4. **HIGH**: Update sales service error handling
5. **MEDIUM**: Create SubscriptionDebug component
6. **MEDIUM**: Create iap-webhook function
7. **MEDIUM**: Update business service with limit checks
8. **LOW**: Write unit tests
9. **LOW**: Conduct TestFlight testing

## Files Created

- `supabase/migrations/add_business_access_state_and_selection_fields_v2.sql`
- `supabase/functions/validate-subscription/index.ts` (updated)
- `supabase/functions/subscription-status/index.ts` (new)
- `supabase/functions/choose-businesses/index.ts` (new)
- `SUBSCRIPTION_SYSTEM_README.md` (new)
- `IMPLEMENTATION_STATUS.md` (this file)

## Deployment Checklist

Before going to production:

- [ ] Deploy all edge functions
- [ ] Apply database migrations
- [ ] Test downgrade flow in sandbox
- [ ] Test read-only enforcement
- [ ] Configure App Store Server Notifications webhook
- [ ] Test all 6 product purchases
- [ ] Verify receipt validation works
- [ ] Test restore purchases
- [ ] Add analytics tracking
- [ ] Update App Store submission notes

## Questions & Support

If you need help with any remaining tasks, refer to:
- SUBSCRIPTION_SYSTEM_README.md for overall architecture
- Individual edge function code for API details
- Database migration file for schema details
- Supabase docs for deployment: https://supabase.com/docs/guides/functions

The core server-side infrastructure is complete and tested. The remaining work is primarily client-side UI components and integration.
