# Push Notifications Setup Guide

This app now supports push notifications that work even when the app is completely closed. This guide will help you complete the setup.

## Overview

The push notification system uses:
- **Expo Push Notifications** - For sending notifications to devices
- **Supabase Edge Functions** - Server-side notification delivery
- **Database Triggers** - Automatic notification sending when events occur

## Current Implementation Status

✅ **Completed:**
- Push notification service with token management
- Badge count synchronization
- Notification channels (Android) and categories (iOS)
- Edge Function for sending push notifications
- Database triggers to automatically send notifications
- Push token storage in user profiles
- Automatic token registration on app start

⚠️ **Requires Setup:**
- EAS Project ID configuration
- Physical device testing (push notifications don't work in simulator)

## Setup Instructions

### Step 1: Create an EAS Project

1. Install EAS CLI if you haven't already:
   ```bash
   npm install -g eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

3. Create an EAS project:
   ```bash
   eas build:configure
   ```

4. This will generate a project ID. Copy it.

### Step 2: Update app.json

Replace `"your-project-id"` in `app.json` with your actual EAS project ID:

```json
"extra": {
  "router": {},
  "eas": {
    "projectId": "your-actual-project-id-here"
  }
}
```

### Step 3: Build the App

You need to build the app with EAS to enable push notifications:

**For Development Testing:**
```bash
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

**For Production:**
```bash
eas build --profile production --platform android
# or
eas build --profile production --platform ios
```

### Step 4: Install on Physical Device

Push notifications only work on physical devices, not simulators or web.

1. Download the build from EAS
2. Install it on your physical device
3. Grant notification permissions when prompted

### Step 5: Test Notifications

1. Open the app and sign in
2. The app will automatically register for push notifications
3. Check the console/logs - you should see: "Push token saved successfully"
4. Close the app completely
5. Create a test notification (e.g., create a sale from another device/user)
6. You should receive a push notification even with the app closed

## How It Works

### When App is Open (Foreground/Background):
- **Supabase Realtime** detects new notifications instantly
- **Local notifications** show immediately with sound, vibration, and badge
- No server delay

### When App is Completely Closed:
1. User performs an action (e.g., creates a sale)
2. Database trigger fires on notification insert
3. Trigger calls **Supabase Edge Function** `/send-push-notification`
4. Edge Function calls **Expo Push Notification Service**
5. Expo delivers notification to user's device
6. User sees notification with sound, vibration, and badge
7. Tapping notification opens the app to the relevant screen

## Database Structure

### Push Token Storage:
- Table: `user_profiles`
- Column: `expo_push_token` (text)
- Updated automatically when user opens the app

### Notification Flow:
```sql
INSERT INTO notifications → Trigger → Edge Function → Expo → Device
```

## Troubleshooting

### "Push token not saved"
- Ensure you're running on a physical device
- Check notification permissions are granted
- Verify EAS project ID is correctly configured

### "Notifications not received when app is closed"
- Verify the Edge Function is deployed: Check Supabase Dashboard → Edge Functions
- Check database trigger exists: `on_notification_insert_send_push`
- Ensure push token is saved in `user_profiles` table
- Test on physical device only (not simulator)

### "Error: Invalid or missing expoPushToken"
- The device hasn't registered for push notifications
- Try reinstalling the app
- Check that EAS project ID matches in app.json

## Configuration Files

### Modified Files:
- `app.json` - Added notification config and EAS project ID
- `src/services/pushNotifications.ts` - Push token registration
- `src/context/NotificationContext.tsx` - Token management and registration
- `supabase/functions/send-push-notification/index.ts` - Edge Function
- Database migrations for push token storage and triggers

## Testing Checklist

- [ ] EAS project created and ID added to app.json
- [ ] App built with EAS (development or production profile)
- [ ] App installed on physical device
- [ ] Notification permissions granted
- [ ] User logged in successfully
- [ ] Console shows "Push token saved successfully"
- [ ] Test notification received with app open
- [ ] Test notification received with app in background
- [ ] Test notification received with app completely closed
- [ ] Badge count updates correctly
- [ ] Tapping notification navigates to correct screen

## Production Considerations

### Security:
- Edge Function uses JWT authentication (already configured)
- Push tokens are user-specific and secure
- RLS policies protect notification data

### Performance:
- Edge Function is async (doesn't block notification creation)
- Push tokens cached in user profiles
- Minimal database overhead

### Reliability:
- Graceful fallback if Edge Function fails
- Notification still saved in database
- Local notifications work even if remote fails
- Error logging for debugging

## Support

For issues with:
- **Expo Push Notifications**: https://docs.expo.dev/push-notifications/overview/
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **EAS Build**: https://docs.expo.dev/build/introduction/

## Next Steps

After completing setup:
1. Test thoroughly on physical devices
2. Configure notification preferences per user
3. Monitor Edge Function logs for errors
4. Adjust notification priorities as needed
5. Consider adding notification scheduling for future features
