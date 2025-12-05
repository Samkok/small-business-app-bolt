# IAP Troubleshooting Guide

## Overview

This guide helps you verify whether your app is using **Mock IAP** (for testing in development) or **Real IAP** (connected to App Store/Play Store).

## Quick Check: Which Mode Am I Using?

### Method 1: Check the Debug Screen (Easiest)

1. Open your app
2. Go to **Settings → Debug Subscription**
3. Look at the **IAP Configuration** card:
   - **🧪 MOCK** = Mock mode (testing only)
   - **✅ REAL** = Real IAP (connected to stores)

### Method 2: Check Console Logs

When the app starts, look for these logs:

**Mock Mode:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[IAPService] 🧪 MOCK MODE ACTIVE
[IAPService] This is for testing in Expo Go/Dev builds
[IAPService] Real IAP will work in EAS production builds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Real IAP Mode:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[IAPService] ✅ REAL IAP MODE ACTIVE
[IAPService] Connected to App Store/Play Store
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Method 3: Check for DEV MODE Badge

In Mock mode, the subscription/paywall screens will show a **"DEV MODE"** badge.

## Understanding the Modes

### Mock IAP (Testing Mode)

**When it's used:**
- Running in Expo Go
- Running with `npm start` / `expo start`
- Development builds without proper configuration

**What it does:**
- Simulates purchases without real money
- Stores subscription data locally
- Perfect for rapid development and testing
- Does NOT connect to App Store/Play Store

### Real IAP (Production Mode)

**When it's used:**
- EAS production builds
- EAS preview builds (after proper setup)
- Standalone apps installed from stores

**What it does:**
- Connects to actual App Store/Play Store
- Processes real purchases
- Validates receipts with stores
- Required for production apps

## How to Enable Real IAP

Real IAP ONLY works in EAS builds. You CANNOT use real IAP in Expo Go.

### Step 1: Ensure Plugin is Configured

Check that `app.json` includes the IAP plugin (already done):

```json
{
  "expo": {
    "plugins": [
      "react-native-iap"
    ]
  }
}
```

### Step 2: Build with EAS

#### For iOS:

```bash
# Preview build (for testing)
eas build --profile preview --platform ios

# Production build (for App Store)
eas build --profile production --platform ios
```

#### For Android:

```bash
# Preview build (for testing)
eas build --profile preview --platform android

# Production build (for Play Store)
eas build --profile production --platform android
```

### Step 3: Wait for Build to Complete

EAS Build typically takes 10-30 minutes. You'll get a notification when it's ready.

### Step 4: Install the Build

**iOS (TestFlight):**
1. EAS will submit preview builds to TestFlight automatically
2. Wait for Apple's review (usually 1-24 hours)
3. Install from TestFlight app

**Android (Direct Install):**
1. Download the APK from the EAS build page
2. Install directly on your device
3. May need to enable "Install from Unknown Sources"

### Step 5: Verify Real IAP is Active

Open the app and check the Debug Subscription screen. You should see:

- **IAP Mode:** ✅ REAL
- **App Ownership:** standalone
- **IAP Available:** Yes

## Detection Logic

The app uses this logic to determine which mode to use:

```
1. If Platform is Web → No IAP
2. If react-native-iap not available → Mock IAP
3. If App Ownership = "standalone" → Real IAP ✅
4. If App Ownership = "expo" → Mock IAP (Expo Go)
5. If Execution Context = "standalone" or "bareWorkflow" → Real IAP ✅
6. Default → Mock IAP
```

## Troubleshooting: Still Using Mock IAP?

### Problem: Built with EAS but still showing Mock mode

**Possible causes:**

1. **Running in Expo Go instead of the EAS build**
   - Solution: Make sure you installed the EAS build, NOT opening in Expo Go
   - Expo Go will ALWAYS use Mock IAP

2. **react-native-iap not properly installed in the build**
   - Check build logs for errors related to `react-native-iap`
   - Rebuild with `eas build` after clearing cache

3. **Development build instead of preview/production build**
   - Development builds (`developmentClient: true`) may behave differently
   - Use `--profile preview` or `--profile production` for testing/production

### Problem: App crashes when trying to make a purchase

**Possible causes:**

1. **Products not configured in App Store Connect / Play Console**
   - Verify all 6 product IDs are configured correctly
   - Ensure products are "Ready to Submit" (iOS) or "Active" (Android)

2. **Bundle ID / Package name mismatch**
   - Verify `com.businessmanager.pro` matches your store configuration
   - Check `app.json` → `ios.bundleIdentifier` and `android.package`

3. **Sandbox testing not configured (iOS)**
   - Add a sandbox tester account in App Store Connect
   - Sign in with sandbox account on device
   - Sign out of real Apple ID before testing

4. **License tester not configured (Android)**
   - Add your Google account as a license tester
   - Ensure app is in testing track

### Problem: Purchases work but validation fails

**Possible causes:**

1. **Supabase edge function not deployed**
   - Verify `validate-subscription` edge function is deployed
   - Check edge function logs for errors

2. **Receipt validation endpoint issues**
   - Check Supabase logs for validation errors
   - Verify the validation logic is correct

## Console Log Reference

### Detection Info Log

```
[IAPService] 🔍 Detection info: {
  appOwnership: "standalone",      // or "expo" for Expo Go
  executionContext: "standalone",  // or other values
  isRealIAPAvailable: true,        // is react-native-iap loaded
  platform: "ios",                 // or "android"
  __DEV__: false                   // is dev mode
}
```

### What Each Field Means

- **appOwnership**: The most reliable indicator
  - `"standalone"` = EAS build → Real IAP
  - `"expo"` = Expo Go → Mock IAP

- **executionContext**: Secondary indicator
  - `"standalone"` or `"bareWorkflow"` = Real IAP
  - Other values = Mock IAP

- **isRealIAPAvailable**: Is `react-native-iap` package available
  - `true` = Package loaded successfully
  - `false` = Package not available (will use Mock)

- **platform**: Operating system
  - `"ios"` or `"android"` = Mobile (IAP supported)
  - `"web"` = Web (IAP not supported)

- **__DEV__**: Development mode flag
  - `true` = Development build
  - `false` = Production build

## Store Configuration Checklist

### iOS (App Store Connect)

- [ ] App created with bundle ID `com.businessmanager.pro`
- [ ] Subscription group created
- [ ] All 6 subscription products configured:
  - `bizmanage.pro.month`
  - `bizmanage.pro.yearly`
  - `bizmanage.pro_plus.month`
  - `bizmanage.pro_plus.yearly`
  - `bizmanage.max.month`
  - `bizmanage.max.yearly`
- [ ] Products are "Ready to Submit"
- [ ] Sandbox tester account created
- [ ] TestFlight build uploaded

### Android (Play Console)

- [ ] App created with package name `com.businessmanager.pro`
- [ ] Subscription group created (optional but recommended)
- [ ] All 6 subscription products configured (same IDs as iOS)
- [ ] Products are "Active"
- [ ] License tester added
- [ ] App in testing track (Internal/Closed/Open Beta)

## Best Practices

1. **Development**: Use Mock IAP with `expo start`
   - Fast iteration
   - No need to rebuild
   - Perfect for UI/UX development

2. **Testing**: Use Real IAP with EAS preview builds
   - Test actual purchase flow
   - Verify store integration
   - Test on real devices

3. **Production**: Use Real IAP with EAS production builds
   - Full store validation
   - Receipt verification
   - Real purchases with real money

## Getting Help

If you're still experiencing issues:

1. Check the Debug Subscription screen for IAP diagnostic info
2. Review console logs for detailed detection information
3. Verify your EAS build configuration
4. Confirm store product configuration
5. Test with sandbox/test accounts before production

## Summary

| Environment | Build Type | IAP Mode | Use Case |
|------------|-----------|----------|----------|
| Expo Go | N/A | Mock | Development |
| npm start | N/A | Mock | Development |
| EAS Dev Build | Development | Mock* | Development |
| EAS Preview | Preview | **Real** | Testing |
| EAS Production | Production | **Real** | Production |
| TestFlight | Production | **Real** | Beta Testing |
| App Store | Production | **Real** | Production |
| Play Store | Production | **Real** | Production |

*Dev builds may use Real IAP depending on configuration

**Remember**: Real IAP requires an actual EAS build installed on a device. It will NEVER work in Expo Go!
