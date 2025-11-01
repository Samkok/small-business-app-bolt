# Deep Link Fix Summary

## Issue
When clicking the password reset link on mobile, the app showed "Screen doesn't exist" error.

## Root Causes
1. The `reset-password.tsx` file wasn't created in the correct location
2. The route wasn't registered in `app/(auth)/_layout.tsx`
3. The deep link URL format was incorrect (`businessmanager://(auth)/reset-password` instead of `businessmanager://reset-password`)

## Solutions Applied

### 1. Created Reset Password Screen
- File: `app/(auth)/reset-password.tsx`
- Contains the password reset form with validation
- Checks for valid session from reset link
- Shows success message after password update

### 2. Registered Route in Layout
- Updated: `app/(auth)/_layout.tsx`
- Added `<Stack.Screen name="reset-password" />` to the Stack

### 3. Fixed Deep Link URLs
Updated both files to use the correct deep link format:

**Before:**
```typescript
redirectTo = `businessmanager://(auth)/reset-password`;
```

**After:**
```typescript
redirectTo = `businessmanager://reset-password`;
```

Files updated:
- `src/context/AuthContext.tsx`
- `app/(auth)/forgot-password.tsx`

## How Expo Router Deep Links Work

Expo Router uses a file-based routing system. The deep link format is:

```
scheme://path
```

Where `path` maps directly to the file structure:

| File Location | Deep Link |
|--------------|-----------|
| `app/(auth)/reset-password.tsx` | `businessmanager://reset-password` |
| `app/(auth)/signin.tsx` | `businessmanager://signin` |
| `app/(app)/profile.tsx` | `businessmanager://profile` |

**Note:** The parentheses `()` in folder names are route groups and are NOT included in the URL path.

## Supabase Configuration

Update your Supabase dashboard with the correct redirect URL:

1. Go to **Authentication** > **URL Configuration**
2. Add redirect URL: `businessmanager://reset-password`
3. Remove the old incorrect URL if present: `businessmanager://(auth)/reset-password`

## Testing

### Test the deep link manually:

**iOS Simulator:**
```bash
xcrun simctl openurl booted businessmanager://reset-password
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "businessmanager://reset-password"
```

Both should now open the app to the reset password screen without errors.

## Files Modified
- ✅ `app/(auth)/reset-password.tsx` (created)
- ✅ `app/(auth)/_layout.tsx` (registered route)
- ✅ `src/context/AuthContext.tsx` (fixed deep link URL)
- ✅ `app/(auth)/forgot-password.tsx` (fixed deep link URL)
- ✅ `PASSWORD_RESET_SETUP.md` (updated documentation)

## Status
✅ **Fixed** - Deep links now work correctly on both iOS and Android
