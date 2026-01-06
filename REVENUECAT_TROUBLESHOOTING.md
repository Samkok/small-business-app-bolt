# RevenueCat Troubleshooting Guide

If you're seeing `isRevenueCatAvailable: false`, follow this guide to diagnose and fix the issue.

## Quick Diagnostics

Check your console logs for these key messages:

### 1. Check if Running in Expo Go
Look for:
```
[RevenueCat] ⚠️ Running in Expo Go! RevenueCat requires a development build.
```

**Solution:** RevenueCat requires native code and won't work in Expo Go. You need to create a development build:

```bash
# Option 1: Build with EAS (recommended)
eas build --profile development --platform ios
# or
eas build --profile development --platform android

# Option 2: Build locally
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

### 2. Check Native Module Loading
Look for:
```
[RevenueCat Module Loading] Platform: ios/android
[RevenueCat Module Loading] Execution Environment: ...
```

Expected messages for successful load:
- `✅ Native module loaded successfully and functional`

Failed load messages:
- `❌ Native module loaded but not functional`
- `❌ Failed to load native module`

### 3. Check Configuration
Look for:
```
[RevenueCat configure] Called with userId: ...
[RevenueCat configure] isNativeModuleAvailable: true/false
```

## Common Issues and Solutions

### Issue 1: Running in Expo Go
**Symptom:** Error message about Expo Go

**Solution:** Create a development build (see above)

### Issue 2: Native Module Not Found
**Symptom:**
```
❌ Failed to load native module: Error: Cannot find module 'react-native-purchases'
```

**Solution:**
1. Install the package:
   ```bash
   npm install react-native-purchases
   ```
2. Rebuild your app:
   ```bash
   npx expo prebuild --clean
   npx expo run:ios  # or run:android
   ```

### Issue 3: API Key Not Configured
**Symptom:** Module loads but offerings are empty

**Solution:**
1. Get your API key from [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Add it to `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_API_KEY=your_actual_api_key
   ```
3. Restart your development server

### Issue 4: Products Not Configured in RevenueCat
**Symptom:**
```
[RevenueCat] No packages available in current offering
```

**Solution:**
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Set up your products for iOS/Android
3. Create an offering and add products to it
4. Make sure the offering is set as "Current"

## Development Build Setup

### Using EAS Build (Recommended)

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to EAS:
   ```bash
   eas login
   ```

3. Build for development:
   ```bash
   # iOS
   eas build --profile development --platform ios

   # Android
   eas build --profile development --platform android
   ```

4. Install the build on your device or simulator

### Local Development Build

1. Prebuild native projects:
   ```bash
   npx expo prebuild
   ```

2. Run on device/simulator:
   ```bash
   # iOS
   npx expo run:ios

   # Android
   npx expo run:android
   ```

## Verification Steps

After fixing, you should see these logs in order:

1. Module Loading:
   ```
   [RevenueCat Module Loading] Platform: ios
   [RevenueCat Module Loading] Execution Environment: standalone
   ✅ Native module loaded successfully and functional
   ```

2. Context Initialization:
   ```
   [RevenueCatSubscriptionContext Loading] Service loaded: true
   [RevenueCatSubscriptionContext Loading] isAvailable() returned: true
   ✅ RevenueCat native module loaded and available
   ```

3. Configuration:
   ```
   [RevenueCat configure] Called with userId: ...
   [RevenueCat] SDK configured successfully
   ```

4. Offerings Fetch:
   ```
   [RevenueCat] Fetching offerings from RevenueCat API...
   [RevenueCat] Offerings fetch completed
   [RevenueCat] Current offering: default
   [RevenueCat] Available packages: 3
   ```

## Still Having Issues?

Check the full console output and look for:
1. Platform type (should be ios/android, not web)
2. Execution environment (should be standalone, not storeClient)
3. Any error messages with ❌
4. Whether native module loaded successfully

Share the complete console output for further assistance.
