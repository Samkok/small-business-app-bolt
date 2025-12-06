# Subscription System Testing Guide

This guide covers how to test the complete subscription system, including IAP, downgrade flows, and read-only mode enforcement.

## Table of Contents
- [TestFlight Setup](#testflight-setup)
- [Sandbox Account Configuration](#sandbox-account-configuration)
- [Testing Each Tier](#testing-each-tier)
- [Downgrade Flow Testing](#downgrade-flow-testing)
- [Read-Only Mode Verification](#read-only-mode-verification)
- [Debug Tools](#debug-tools)
- [Common Issues](#common-issues)

---

## TestFlight Setup

### Prerequisites
1. Enroll in Apple Developer Program
2. Create App Store Connect app record
3. Configure App Store Server Notifications webhook
4. Generate sandbox test account

### Installation Steps

1. **Build for TestFlight**
   ```bash
   eas build --platform ios --profile preview
   ```

2. **Submit to TestFlight**
   - Upload build to App Store Connect
   - Add internal testers
   - Wait for TestFlight processing (10-15 minutes)

3. **Install on Device**
   - Open TestFlight app on iOS device
   - Accept invitation
   - Install latest build

---

## Sandbox Account Configuration

### Create Sandbox Account

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to Users and Access → Sandbox Testers
3. Click + to create new sandbox tester
4. Use format: `test+[name]@yourdomain.com`
5. Set password and security questions
6. Select country/region

### Configure Device

1. Open Settings → App Store
2. Sign out of production Apple ID
3. Launch app in TestFlight
4. When prompted for purchase, sign in with sandbox account
5. Confirm "Environment: Sandbox" appears in transaction dialog

**Important**: Never sign into Settings with sandbox account, only use during IAP flow.

---

## Testing Each Tier

### Free Tier (Default)

**Business Limits:**
- 1 owned business
- 50 sales transactions

**Test Steps:**

1. Create new account
2. Create first business → Should succeed
3. Attempt to create second business → Should be blocked
4. Create 50 sales
5. Attempt 51st sale → Should be blocked with paywall
6. Verify warning banner appears at 49 sales

**Expected Behavior:**
- "Upgrade Plan" button shown
- Cannot create sales beyond limit
- Can still view products, team, reports

---

### Pro Tier

**Business Limits:**
- 1 owned business
- Unlimited sales

**Test Steps:**

1. Purchase Pro subscription (monthly or yearly)
2. Create 51+ sales → Should succeed
3. Attempt to create 2nd business → Should be blocked
4. Can be staff on other businesses

**Subscription Products:**
- `bizmanage.pro.month` - $9.99/month
- `bizmanage.pro.year` - $99.99/year

---

### Pro Plus Tier

**Business Limits:**
- 3 owned businesses
- Unlimited sales

**Test Steps:**

1. Purchase Pro Plus subscription
2. Create 3 businesses → All should succeed
3. Attempt 4th business → Should be blocked
4. Create unlimited sales in all 3 businesses

**Subscription Products:**
- `bizmanage.pro_plus.month` - $19.99/month
- `bizmanage.pro_plus.year` - $199.99/year

---

### Max Tier

**Business Limits:**
- Unlimited owned businesses
- Unlimited sales

**Test Steps:**

1. Purchase Max subscription
2. Create 10+ businesses → All should succeed
3. Create unlimited sales in all businesses

**Subscription Products:**
- `bizmanage.max.month` - $49.99/month
- `bizmanage.max.year` - $499.99/year

---

## Downgrade Flow Testing

### Scenario 1: Pro Plus to Free (3 → 1 Business)

**Setup:**
1. Have active Pro Plus subscription with 3 owned businesses
2. Each business has data (sales, products, team)

**Trigger Downgrade:**
- Option A: Cancel subscription and wait for expiration
- Option B: Request refund
- Option C: Use Debug Tool to expire subscription

**Expected Behavior:**

1. Subscription expires
2. User opens app
3. DowngradePick modal appears immediately
4. Modal cannot be dismissed (no close button, backdrop not tappable)
5. Shows all 3 businesses with:
   - Business name
   - Sales count
   - Team member count
   - Creation date
6. User must select exactly 1 business
7. "Confirm Selection" button disabled until 1 selected
8. After confirmation:
   - Selected business remains active
   - Other 2 businesses set to `read_only_sales`
   - Modal dismisses
   - User can continue using app

**Verify Read-Only Businesses:**
1. Switch to non-selected business
2. Amber banner shown: "Business is in read-only mode"
3. Can view all data
4. Can manage products
5. Can manage team
6. Cannot create sales → Shows error modal
7. "Upgrade" and "Switch Business" buttons present

---

### Scenario 2: Max to Pro Plus (5 → 3 Businesses)

**Setup:**
1. Have Max subscription with 5 owned businesses
2. Downgrade to Pro Plus

**Expected Behavior:**
1. DowngradePick modal appears
2. User must select exactly 3 businesses
3. Checkboxes (not radio buttons) for multi-select
4. Button text: "2 of 3 selected" updates dynamically
5. Remaining 2 businesses become read-only

---

### Accelerated Testing in Sandbox

Apple accelerates subscription durations in sandbox:

| Production Duration | Sandbox Duration |
|---------------------|------------------|
| 1 week              | 3 minutes        |
| 1 month             | 5 minutes        |
| 2 months            | 10 minutes       |
| 3 months            | 15 minutes       |
| 6 months            | 30 minutes       |
| 1 year              | 1 hour           |

**Quick Expiration Test:**
1. Purchase 1-month subscription (5 min in sandbox)
2. Wait 5 minutes
3. Subscription expires automatically
4. Webhook triggers downgrade flow
5. DowngradePick modal appears on app reopen

---

## Read-Only Mode Verification

### Sales Creation Blocked

**Test Steps:**

1. Have business in read-only mode
2. Navigate to Sales screen
3. Attempt to create sale

**Expected Behavior:**
- "Create Sale" button disabled OR
- Error modal shown on attempt:
  - Title: "Sales Read-Only"
  - Message: "This business is in read-only mode. Upgrade or switch to an active business."
  - Buttons: "Upgrade" | "Switch Business" | "Cancel"

### Other Features Accessible

**Verify these features WORK in read-only mode:**

✅ Products Screen
- View products
- Add products
- Edit products
- Archive products
- Update stock

✅ Team Management
- View team members
- Add team members
- Change roles
- Remove members

✅ Reports & Analytics
- View sales reports
- Cash flow
- Income statement
- Top products
- Top customers

✅ Customer Management
- View customers
- Add customers
- Edit customer info

✅ Expenses
- View expenses
- Add expenses
- Edit expenses

**Only blocked:**
❌ Sales creation

---

## Debug Tools

### Accessing Debug Panel

**Development Mode:**
1. Debug panel appears in Settings when `__DEV__ === true`

**Production Mode:**
1. Go to Settings → Subscription
2. Triple-tap on subscription badge
3. Debug panel appears as modal

### Debug Features

**Subscription State:**
- View current tier
- View subscription status
- View expiration date
- View must_choose_businesses flag
- View max_owned_businesses limit

**Simulation Controls:**

1. **Set Sales Count**
   - Set to 48 → Test "2 away" warning
   - Set to 49 → Test "1 away" warning
   - Set to 50 → Test limit reached
   - Reset to 0 → Clear for new tests

2. **Trigger Downgrade Modal**
   - Sets `must_choose_businesses = true`
   - Forces modal to appear
   - Use to test selection flow

3. **Tier Selector**
   - Switch to Free
   - Switch to Pro
   - Switch to Pro Plus
   - Switch to Max
   - Updates database immediately

4. **Expire Subscription**
   - Sets expiration to yesterday
   - Marks status as 'expired'
   - Triggers downgrade if needed

**API Testing:**
- Test `subscription-status` endpoint
- Test `validate-subscription` endpoint
- Test `choose-businesses` endpoint
- View JSON responses

**Logs:**
- Last 50 subscription-related logs
- Filter by severity
- Copy to clipboard

---

## Common Issues

### Issue: Subscription Not Updating

**Symptoms:**
- Purchased subscription but still on Free tier
- Sales limit not removed

**Solution:**
1. Check webhook is configured and receiving events
2. Verify `subscription_product_id` matches in webhook payload
3. Check `user_subscriptions` table updated
4. Check `user_profiles.subscription_tier` updated
5. Force refresh: Pull to refresh on Subscription screen

---

### Issue: Downgrade Modal Won't Appear

**Symptoms:**
- Subscription expired but no modal shown
- Can create sales when shouldn't be able to

**Solution:**
1. Check `user_profiles.must_choose_businesses` is `true`
2. Check realtime subscription connected
3. Check owned businesses count > tier limit
4. Restart app to trigger check
5. Use Debug Tool to manually trigger modal

---

### Issue: Business Stuck in Read-Only

**Symptoms:**
- Business shows as read-only when should be active
- Upgraded but still can't create sales

**Solution:**
1. Check `businesses.access_state` column
2. Should be `'active'` not `'read_only_sales'`
3. Use Debug Tool → Toggle business state
4. Or update directly:
   ```sql
   UPDATE businesses
   SET access_state = 'active'
   WHERE id = '<business_id>';
   ```

---

### Issue: Webhook Not Firing

**Symptoms:**
- Purchase completes but nothing updates
- No entry in `processed_transactions` table

**Solution:**
1. Verify webhook URL in App Store Connect
2. Check Supabase Edge Function deployed
3. Check Edge Function logs:
   ```bash
   supabase functions logs iap-webhook
   ```
4. Test webhook manually with cURL
5. Verify Apple signature validation not failing

---

## Test Checklist

Use this checklist for comprehensive testing:

### Free Tier Tests
- [ ] Can create 1 business
- [ ] Cannot create 2nd business
- [ ] Can create 50 sales
- [ ] Cannot create 51st sale
- [ ] Warning shown at 49 sales
- [ ] Paywall appears on limit

### Pro Tier Tests
- [ ] Can purchase Pro subscription
- [ ] Can create unlimited sales
- [ ] Still limited to 1 business
- [ ] Cannot create 2nd business

### Pro Plus Tier Tests
- [ ] Can purchase Pro Plus
- [ ] Can create 3 businesses
- [ ] Cannot create 4th business
- [ ] Unlimited sales in all

### Max Tier Tests
- [ ] Can purchase Max
- [ ] Can create 10+ businesses
- [ ] Unlimited sales everywhere

### Downgrade Tests
- [ ] Modal appears on expiration
- [ ] Modal cannot be dismissed
- [ ] Must select correct number
- [ ] Confirm button disabled until valid
- [ ] Non-selected become read-only
- [ ] Selected remain active

### Read-Only Tests
- [ ] Cannot create sales
- [ ] Can manage products
- [ ] Can manage team
- [ ] Can view reports
- [ ] Banner shown
- [ ] Upgrade button works
- [ ] Switch button works

### Debug Tool Tests
- [ ] Can access debug panel
- [ ] Sales count simulation works
- [ ] Tier switching works
- [ ] Expire subscription works
- [ ] Trigger modal works
- [ ] API tests return data
- [ ] Logs capture events

---

## Support

For issues during testing:

1. Check Edge Function logs
2. Check database `user_subscriptions` table
3. Check `processed_transactions` table
4. Use Debug Tool to inspect state
5. Verify webhook configuration in App Store Connect

---

**Last Updated:** 2025-12-06
**Version:** 1.0.0
