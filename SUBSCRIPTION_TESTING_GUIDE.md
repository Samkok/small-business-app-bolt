# Subscription Testing Guide

This guide explains how to test subscriptions and in-app purchases in your app using the hybrid testing approach.

## Overview

The app supports **two testing modes** that work together:

1. **Supabase Debug Functions** - Fast testing without native builds
2. **RevenueCat Sandbox** - Complete integration testing with real purchase flows

## When to Use Each Mode

### Quick Testing (Expo Go)
**Use: Supabase Debug Functions**

Perfect for:
- Rapid UI/UX iteration
- Testing feature access logic
- Testing business limits
- Frontend development without native setup
- Quick validation of subscription tiers

How to access:
1. Run the app in development mode
2. Go to Settings → Debug Subscription
3. Use the "Supabase Debug" sections to simulate different states

### Integration Testing (Native Build)
**Use: RevenueCat Sandbox Purchases**

Perfect for:
- Testing the complete purchase flow
- Validating webhook integrations
- Testing real App Store/Play Store interactions
- Pre-production validation

How to access:
1. Create a development build: `npx expo prebuild`
2. Build with EAS or locally
3. Use sandbox test accounts (Apple/Google)
4. Go to Settings → Debug Subscription → RevenueCat Testing
5. Use "Open Subscription Screen" to make test purchases
6. Use "Sync from RevenueCat" if data seems delayed

### Production Testing
**Use: TestFlight/Internal Testing**

Perfect for:
- Final validation before release
- Testing with beta users
- Validating production webhooks

How to access:
1. Build production-ready app
2. Upload to TestFlight or Google Play Internal Testing
3. Use sandbox accounts only
4. Debug tools are disabled in production builds

## Debug Screen Features

### Testing Guide Card
Shows you which mode to use for your current context

### Current State
Displays:
- Current sales count
- Subscription tier and status
- Business ownership limits
- RevenueCat App User ID

### IAP Configuration
Shows whether RevenueCat is available and configured

### RevenueCat Testing
Available only in native builds:
- **RevenueCat Status** - Shows connection state
- **Sync from RevenueCat** - Manually refresh subscription data
- **Open Subscription Screen** - Access the paywall for sandbox purchases

### Supabase Debug Functions
Available in all development builds:
- **Simulate Sales Count** - Set sales to specific numbers (49, 50)
- **Simulate Tiers** - Switch between Free, Pro, Pro Plus, Max
- **Simulate States** - Test expired subscriptions
- **Debug Actions** - Log state, reset data

## Best Practices

### During Development
1. Use Supabase debug functions for quick iterations
2. Only create native builds when testing purchase flows
3. Keep debug mode enabled in development

### Before Production
1. Test complete purchase flows with RevenueCat sandbox
2. Validate all subscription tiers
3. Test upgrade, downgrade, and expiration scenarios
4. Verify webhook integrations

### Security Notes
- Debug tools are automatically disabled in production builds
- Never use real payment methods in sandbox testing
- Sandbox purchases don't charge real money

## Troubleshooting

### RevenueCat Shows "Not Available"
- You're in Expo Go - create a native build
- RevenueCat SDK not properly installed
- Check native module loading in console

### Subscription Not Syncing
1. Use "Sync from RevenueCat" button
2. Check webhook configuration
3. Verify RevenueCat dashboard shows the purchase
4. Check console logs for sync errors

### Supabase Functions Not Working
- Ensure you're in development mode (__DEV__ = true)
- Check console for errors
- Verify user and business are properly loaded
- Check database RLS policies

## Additional Resources

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Apple Sandbox Testing](https://developer.apple.com/apple-pay/sandbox-testing/)
- [Google Play Testing](https://developer.android.com/google/play/billing/test)
