# Password Reset Configuration Guide

This guide explains how to configure password reset functionality to work across mobile (iOS/Android) and web platforms.

## Overview

The password reset system now supports:
- **Web**: HTTP/HTTPS URLs (e.g., `https://yourdomain.com/reset-password`)
- **Mobile**: Deep link URLs (e.g., `businessmanager://reset-password`)

## Environment Variables

The following environment variables control password reset behavior:

### `.env` Configuration

```bash
# App URL for web platform (production)
EXPO_PUBLIC_APP_URL=http://localhost:8081

# Deep link scheme for mobile apps (must match app.json)
EXPO_PUBLIC_APP_SCHEME=businessmanager
```

### Development vs Production

**Development (.env):**
```bash
EXPO_PUBLIC_APP_URL=http://localhost:8081
EXPO_PUBLIC_APP_SCHEME=businessmanager
```

**Production (.env.production):**
```bash
EXPO_PUBLIC_APP_URL=https://yourdomain.com
EXPO_PUBLIC_APP_SCHEME=businessmanager
```

## Supabase Dashboard Configuration

### 1. Configure Site URL

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **URL Configuration**
3. Set the **Site URL** to your production web domain:
   ```
   https://yourdomain.com
   ```

### 2. Configure Redirect URLs

Add the following redirect URLs to allow password reset from all platforms:

1. **Web (Development)**:
   ```
   http://localhost:8081/reset-password
   ```

2. **Web (Production)**:
   ```
   https://yourdomain.com/reset-password
   ```

3. **Mobile (iOS/Android)**:
   ```
   businessmanager://reset-password
   ```

**Steps:**
1. Go to **Authentication** > **URL Configuration**
2. Under **Redirect URLs**, click **Add URL**
3. Add each URL listed above
4. Click **Save**

### 3. Email Templates (Optional)

The email templates automatically use the correct redirect URL based on the `resetPasswordForEmail` configuration. No manual changes needed.

## How It Works

### Platform Detection

The system automatically detects the platform and uses the appropriate URL format:

```typescript
if (Platform.OS === 'web') {
  // Use HTTP/HTTPS URL
  redirectTo = `${window.location.origin}/reset-password`;
} else {
  // Use deep link for mobile
  redirectTo = `${appScheme}://reset-password`;
}
```

### Password Reset Flow

1. **User requests password reset**
   - User enters email on forgot-password screen
   - System sends email with platform-specific reset link

2. **User clicks link in email**
   - **Web**: Opens browser to `/reset-password`
   - **Mobile**: Opens app via deep link to `reset-password` screen

3. **User enters new password**
   - Password is validated (min 6 characters)
   - Confirmation field must match
   - Password is updated in Supabase

4. **Success**
   - User is redirected to sign-in screen
   - Can now log in with new password

## Deep Linking Setup

### iOS Configuration

The deep link scheme is configured in `app.json`:

```json
{
  "expo": {
    "scheme": "businessmanager",
    "ios": {
      "bundleIdentifier": "com.businessmanager.pro"
    }
  }
}
```

### Android Configuration

The scheme is automatically configured via `app.json`:

```json
{
  "expo": {
    "scheme": "businessmanager",
    "android": {
      "package": "com.businessmanager.pro"
    }
  }
}
```

## Testing

### Test on Web

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open browser to `http://localhost:8081`

3. Navigate to forgot password screen

4. Enter your email

5. Check your email inbox

6. Click the reset link (should open to `http://localhost:8081/reset-password`)

7. Enter new password

### Test on Mobile (iOS/Android)

1. Build a development version:
   ```bash
   # iOS
   npm run ios

   # Android
   npm run android
   ```

2. Request password reset from the app

3. Check your email on the device

4. Click the reset link

5. The link should open the app directly to the reset password screen

### Test Deep Link Manually

You can test the deep link directly on a device:

**iOS (Simulator):**
```bash
xcrun simctl openurl booted businessmanager://reset-password
```

**Android (Emulator):**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "businessmanager://reset-password"
```

## Troubleshooting

### "Screen doesn't exist" error when clicking deep link

**Issue**: Deep link opens app but shows "Screen doesn't exist"

**Solution**:
- Verify `reset-password.tsx` exists in `app/(auth)/` directory
- Check that the route is registered in `app/(auth)/_layout.tsx`
- Ensure the deep link uses the correct format: `businessmanager://reset-password` (not `businessmanager://(auth)/reset-password`)
- Restart the development server after making changes

### Email contains localhost URL on mobile

**Issue**: Mobile users receive reset links with `localhost` URLs

**Solution**:
- Ensure `EXPO_PUBLIC_APP_URL` and `EXPO_PUBLIC_APP_SCHEME` are set in `.env`
- Verify the forgot-password screen uses platform detection
- Check that Supabase redirect URLs include the mobile deep link

### Deep link doesn't open app

**Issue**: Clicking the reset link on mobile doesn't open the app

**Solution**:
- Verify the scheme in `app.json` matches `EXPO_PUBLIC_APP_SCHEME`
- Check that the URL is added to Supabase redirect URLs
- Rebuild the app after changing `app.json`
- Test the deep link manually using the commands above

### Reset link says "invalid or expired"

**Issue**: The reset password screen shows an error

**Solution**:
- Reset links expire after 1 hour
- Request a new password reset
- Ensure the Supabase session is being detected properly

## Production Deployment

### Web Deployment

1. Update `.env.production`:
   ```bash
   EXPO_PUBLIC_APP_URL=https://yourdomain.com
   ```

2. Build for production:
   ```bash
   npm run build:web
   ```

3. Deploy the build output to your hosting provider

4. Update Supabase redirect URLs with your production domain

### Mobile Deployment

1. Update app version in `app.json`

2. Build for stores:
   ```bash
   # iOS
   eas build --platform ios --profile production

   # Android
   eas build --platform android --profile production
   ```

3. Submit to App Store / Play Store

4. Ensure Supabase redirect URLs include your deep link scheme

## Security Considerations

- Reset links expire after 1 hour
- Links can only be used once
- Password must be at least 6 characters
- Confirmation field prevents typos
- All password updates go through Supabase auth
- Deep links only open the reset screen (no direct password in URL)

## Support

For issues or questions, refer to:
- [Expo Deep Linking Documentation](https://docs.expo.dev/guides/linking/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [React Navigation Linking](https://reactnavigation.org/docs/deep-linking/)
