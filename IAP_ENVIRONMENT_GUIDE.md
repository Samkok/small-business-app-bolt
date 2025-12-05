# In-App Purchase (IAP) Environment Guide

This guide explains how In-App Purchases work across different environments in the BizManage app.

## Overview

The app uses an intelligent IAP service that automatically detects the environment and switches between:
- **Mock IAP**: For fast development and testing in Expo Go
- **Real IAP**: For production builds with actual App Store/Play Store integration

## Environment Detection

The IAP service (`src/services/iapService.ts`) automatically determines which mode to use:

### Mock IAP is used when:
- Running in Expo Go
- Running in development mode without native build
- `react-native-iap` package is not available

### Real IAP is used when:
- Running in a standalone build (EAS Build)
- The app has native code compiled
- Execution context is "bareWorkflow" or "standalone"

## Environments

### 1. Development (Expo Go / Web Preview)

**What happens:**
- Uses Mock IAP for testing subscription flows
- No actual charges
- Instant purchase confirmations
- Mock receipts are validated locally

**How to test:**
```bash
npm start
# or
npx expo start
```

**Features:**
- All 6 subscription tiers available (Pro Monthly/Yearly, Pro Plus Monthly/Yearly, Max Monthly/Yearly)
- Instant activation
- Simulated expiration dates (1 month or 1 year from purchase)
- Can test purchase and restore flows

### 2. Development Build (EAS Development)

**What happens:**
- Uses Real IAP with sandbox environment
- Requires EAS Build
- Tests actual IAP integration

**How to build:**
```bash
# iOS Development Build
eas build --profile development --platform ios

# Android Development Build
eas build --profile development --platform android
```

**Features:**
- Real IAP integration testing
- Sandbox purchases (no actual charges)
- Receipt validation with App Store/Play Store sandbox
- Test with sandbox test accounts

**Setup Required:**
- Create sandbox test accounts in App Store Connect (iOS) or Play Console (Android)
- Configure test accounts on your device
- Ensure product IDs are registered in store consoles

### 3. Preview Build (EAS Preview)

**What happens:**
- Uses Real IAP with sandbox environment
- Internal distribution for testing
- Same as development but easier to share with testers

**How to build:**
```bash
# iOS Preview Build
eas build --profile preview --platform ios

# Android Preview Build
eas build --profile preview --platform android
```

**Features:**
- Full IAP integration
- Sandbox environment testing
- Easy distribution to internal testers via TestFlight (iOS) or internal testing (Android)

### 4. Production Build (EAS Production)

**What happens:**
- Uses Real IAP with production environment
- Actual purchases with real money
- Full receipt validation

**How to build:**
```bash
# iOS Production Build
eas build --profile production --platform ios

# Android Production Build
eas build --profile production --platform android
```

**Features:**
- Real purchases with actual charges
- Production App Store/Play Store
- Full receipt validation
- Automatic version incrementing

## Configuration

### App Configuration (app.json)

The `react-native-iap` plugin is already configured:

```json
{
  "plugins": [
    "react-native-iap"
  ]
}
```

This plugin automatically:
- Links native IAP libraries
- Configures required capabilities for iOS
- Sets up billing permissions for Android

### EAS Configuration (eas.json)

Build profiles are configured for each environment:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

## Product IDs

The following subscription product IDs are configured:

- `bizmanage.pro.month` - Pro Monthly ($4.99)
- `bizmanage.pro.year` - Pro Yearly ($47.99)
- `bizmanage.pro_plus.month` - Pro Plus Monthly ($9.99)
- `bizmanage.pro_plus.year` - Pro Plus Yearly ($95.99)
- `bizmanage.max.month` - Max Monthly ($19.99)
- `bizmanage.max.year` - Max Yearly ($191.99)

### Tier Benefits

**Free Tier:**
- 50 total sales across all businesses
- 1 business allowed

**Pro Tier:**
- Unlimited sales
- 1 business allowed

**Pro Plus Tier:**
- Unlimited sales
- Up to 3 businesses

**Max Tier:**
- Unlimited sales
- Unlimited businesses

## Testing IAP

### Local Development (Mock IAP)

1. Start the app: `npm start`
2. Navigate to Settings > Subscription
3. Select any subscription tier
4. Complete the mock purchase
5. Subscription activates instantly
6. Test restore purchases functionality

### Sandbox Testing (Real IAP)

#### iOS Sandbox Setup:

1. Go to App Store Connect
2. Navigate to Users and Access > Sandbox Testers
3. Create test accounts
4. Sign out of your Apple ID on device
5. Install the preview/development build
6. Make a test purchase (sign in with sandbox account when prompted)

#### Android Sandbox Setup:

1. Go to Google Play Console
2. Navigate to Setup > License Testing
3. Add test email addresses
4. Create a closed testing track
5. Install the preview/development build
6. Make a test purchase

### Production Testing

1. Use TestFlight (iOS) or Internal Testing (Android)
2. Create production builds via EAS
3. Test with real accounts
4. Monitor in App Store Connect / Play Console

## Troubleshooting

### Mock IAP not working
- Ensure you're running in Expo Go or development mode
- Check console logs for "[IAPService] Using mock IAP"

### Real IAP not working in builds
- Verify the build includes native code (not Expo Go)
- Check that products are configured in App Store Connect / Play Console
- Ensure bundle ID matches store configuration
- Verify sandbox test accounts are set up correctly

### Receipt validation failing
- For mock IAP: Check that receipt format is valid JSON
- For real IAP: Ensure edge function `validate-subscription` is deployed
- Check Supabase logs for validation errors

### Products not loading
- Verify product IDs match store configuration
- Check that products are approved and available
- Ensure proper permissions/capabilities are configured

## Development Workflow

### Recommended Approach:

1. **Local Development**: Use mock IAP for rapid testing
   - Fast iteration
   - No need for builds
   - Test all flows instantly

2. **Feature Testing**: Use preview builds for integration testing
   - Test real IAP integration
   - Share with team via TestFlight/Internal Testing
   - Verify sandbox purchases

3. **Pre-Release**: Use preview builds for UAT
   - Full testing with sandbox
   - Verify all subscription tiers
   - Test edge cases

4. **Release**: Use production builds
   - Final verification on production
   - Monitor real transactions

## Monitoring

### Logs to Watch:

```javascript
// Environment detection
[IAPService] Initialized with mock/real IAP

// Connection status
[SubscriptionContext] IAP connection result: true/false

// Purchase flow
[SubscriptionContext] Mock/Real subscription activated successfully

// Restore flow
[SubscriptionContext] Mock/Real subscription restored successfully
```

### Debugging:

Enable verbose logging by checking console output in:
- Metro bundler (development)
- Xcode console (iOS builds)
- Android Studio logcat (Android builds)

## Store Configuration

### iOS App Store Connect:

1. Create in-app purchases for all product IDs
2. Set pricing for each tier
3. Configure subscription groups
4. Add localized descriptions
5. Submit for review with app binary

### Android Play Console:

1. Create subscription products for all product IDs
2. Set pricing for each tier
3. Configure subscription benefits
4. Add localized descriptions
5. Activate products

## Security

- All receipts are validated server-side via Supabase Edge Function
- Mock receipts only validate in development
- Production receipts validate against Apple/Google servers
- Subscriptions are synced to Supabase database with RLS policies

## Support

For issues or questions:
1. Check console logs for error messages
2. Verify store configuration matches product IDs
3. Test with sandbox accounts before production
4. Review Supabase logs for backend issues
