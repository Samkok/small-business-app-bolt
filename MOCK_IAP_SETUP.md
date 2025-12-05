# Mock IAP Setup - Quick Reference

## What Was Implemented

A complete Mock In-App Purchase (IAP) system that automatically activates when `react-native-iap` is not available (like in Expo Go).

## Key Features

1. **Automatic Detection**: Detects when to use mock IAP vs real IAP
2. **Full Feature Parity**: All subscription operations work identically
3. **Visual Indicators**: Clear badges show when mock mode is active
4. **Supabase Integration**: Mock subscriptions stored in real database
5. **Zero Configuration**: Works immediately in Expo Go

## Files Created

1. **`src/services/mockIapService.ts`** (New)
   - Implements mock IAP API compatible with `react-native-iap`
   - Handles purchase, restore, and product listing
   - Validates mock receipts with proper expiration dates

2. **`src/services/mockSubscriptionStorage.ts`** (New)
   - Utilities for mock mode persistence
   - Storage helpers for development flags

3. **`MOCK_IAP_GUIDE.md`** (New)
   - Comprehensive developer documentation
   - Usage examples and troubleshooting

## Files Modified

1. **`src/context/SubscriptionContext.tsx`**
   - Added mock IAP detection and fallback
   - Added `isMockMode` to context
   - Updated purchase/restore functions to handle mock receipts
   - Enhanced logging for mock operations

2. **`src/components/subscription/Paywall.tsx`**
   - Added "DEV MODE - Mock IAP Active" badge
   - Styled mock mode indicator

3. **`app/(app)/(tabs)/settings/subscription.tsx`**
   - Added mock mode info card
   - Shows development mode status

4. **`src/services/index.ts`**
   - Exports mock services

## How to Use

### In Expo Go (Development)

```bash
npm start
# Scan QR code in Expo Go
# Mock IAP is automatically active
# Test subscriptions normally
```

### With EAS Build (Real IAP Testing)

```bash
eas build --platform ios --profile preview
# Install build on device
# Real IAP is automatically used
```

## Testing Checklist

- [ ] Open app in Expo Go
- [ ] See "DEV MODE" badge in paywall
- [ ] Purchase a mock subscription
- [ ] Verify subscription in Settings
- [ ] Test restore purchases
- [ ] Check Supabase database for subscription record
- [ ] Test expired subscription (modify date in Supabase)

## Console Log Examples

When mock mode is active:
```
[SubscriptionContext] react-native-iap not available, using mock IAP
[SubscriptionContext] InitializeIAP Start Here
[MockIAP] Initializing mock IAP connection
[SubscriptionContext] Mock IAP initialized with 6 products
[MockIAP] Getting mock subscriptions: [...]
[MockIAP] Requesting mock subscription: bizmanage.pro.month
[SubscriptionContext] Validating mock receipt
[SubscriptionContext] Mock subscription activated successfully
```

## Architecture

```
User Action (Purchase)
    ↓
SubscriptionContext
    ↓
Detects IAP availability
    ↓
    ├─→ Real IAP Available
    │   └─→ react-native-iap
    │       └─→ Apple/Google Servers
    │
    └─→ No IAP (Expo Go)
        └─→ mockIapService
            └─→ Supabase (Direct)
```

## Benefits

1. **Instant Testing**: No build required for subscription UI development
2. **Realistic Flow**: Mock purchases feel like real ones (with delays)
3. **Database Integration**: Test full subscription lifecycle
4. **Easy Debugging**: Clear logs and indicators
5. **Production Ready**: Seamlessly switches to real IAP when available

## Important Notes

- Mock receipts have `platform: 'mock'` in their JSON
- Mock subscriptions expire based on product ID (monthly/yearly)
- All subscription data is stored in Supabase `user_subscriptions` table
- Mock mode ONLY activates when `react-native-iap` fails to load
- In production builds, real IAP is always used

## Next Steps

1. Test the implementation in Expo Go
2. Try purchasing different subscription tiers
3. Verify data in Supabase dashboard
4. Test restore purchases functionality
5. When ready for real testing, create an EAS build

## Support

For detailed information, see `MOCK_IAP_GUIDE.md`.

For issues:
1. Check console logs for `[MockIAP]` messages
2. Verify Supabase connection
3. Inspect `user_subscriptions` table
4. Review the troubleshooting section in the guide
