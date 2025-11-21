# Business Removal Auto-Switch Fix

## Problems
1. **No Automatic Navigation**: When a user was removed from their current business (while actively using the app), nothing was happening. The user wasn't automatically redirected to their previous business or the business creation page, even though the automatic switching logic was implemented.

2. **Guest Customer Error**: After manual refresh when switching businesses, users encountered: `Guest customer not found for business` error, preventing them from using instant checkout functionality.

## Root Cause
The issue was caused by **stale closures** in the real-time subscription effect:

1. **Stale Dependencies**: The `DELETE` event handler in the real-time subscription was using stale references to `currentBusiness`, `userBusinesses`, and `businessAccessHistory` from when the subscription was first created.

2. **Effect Recreation**: The effect had `currentBusiness` in its dependency array (line 493), causing the subscription to be recreated every time the business changed, which interrupted the automatic switching logic.

3. **Missing Functions**: The `selectBestAvailableBusiness` and `switchBusiness` functions were defined later in the code and were being used in the DELETE handler through closure, but with stale values.

## Solution

### 1. Added Refs for Latest Values
Created refs to always access the most current state:
```typescript
const businessAccessHistoryRef = useRef<BusinessAccessHistory>({});
const userBusinessesRef = useRef<Business[]>([]);
const currentBusinessRef = useRef<Business | null>(null);
```

### 2. Moved Function Definitions Earlier
Moved `selectBestAvailableBusiness` and `switchBusiness` function definitions before the real-time subscription effect so they're available when needed.

### 3. Updated Function Implementation
Modified `switchBusiness` to:
- Use `userBusinessesRef.current` instead of the stale `userBusinesses` prop
- Update both state and ref when access history changes
- Ensure refs are always in sync with state

### 4. Updated DELETE Handler
Modified the DELETE event handler to:
- Use refs instead of stale closure values: `currentBusinessRef.current`, `userBusinessesRef.current`, `businessAccessHistoryRef.current`
- Remove `currentBusiness` from the effect dependency array
- Include `selectBestAvailableBusiness` and `switchBusiness` in dependencies

### 5. Sync Refs with State
Added effects to keep refs synchronized:
```typescript
useEffect(() => {
  businessAccessHistoryRef.current = businessAccessHistory;
}, [businessAccessHistory]);

useEffect(() => {
  userBusinessesRef.current = userBusinesses;
}, [userBusinesses]);

useEffect(() => {
  currentBusinessRef.current = currentBusiness;
}, [currentBusiness]);
```

## Changes Made

### Files Modified:
1. **src/context/AuthContext.tsx**
   - Added refs for businessAccessHistory, userBusinesses, and currentBusiness
   - Moved `selectBestAvailableBusiness` and `switchBusiness` definitions before real-time effect
   - Updated DELETE handler to use refs instead of stale closure values
   - Updated effect dependencies to include functions but not state variables
   - Added sync effects to keep refs up-to-date
   - Removed duplicate function definitions
   - **Added explicit navigation after business switch**: Forces router.replace to dashboard or onboarding
   - Uses dynamic imports to avoid circular dependencies with expo-router

2. **src/services/customers.ts**
   - Modified `getGuestCustomer()` to auto-create guest customer if not found
   - Added try-catch for guest customer creation
   - Logs warning when guest customer needs to be created
   - Ensures every business has a guest customer on-demand
   - Gracefully handles edge cases where migration didn't run

3. **src/utils/businessAccessHistory.ts** (Already created in previous step)
   - No additional changes needed

## How It Works Now

**When a user is removed from their current business:**

1. Real-time DELETE event fires
2. Handler uses `currentBusinessRef.current` to check if it was the current business
3. Handler uses `userBusinessesRef.current` to get the most recent business list
4. Handler uses `businessAccessHistoryRef.current` to select the best alternative
5. Calls `switchBusiness()` which uses `userBusinessesRef.current` for lookup
6. Successfully switches to the alternative business
7. **Explicitly navigates to dashboard** using `router.replace('/(app)/(tabs)')`
8. Shows alert notification to the user after navigation
9. User is immediately on the new business's dashboard

**If user has no other businesses:**
1. Sets `currentBusiness` to `null`
2. **Explicitly navigates to business onboarding** using `router.replace('/(app)/business-onboarding')`
3. Shows alert about no remaining businesses after navigation
4. User can immediately create a new business

**When guest customer is missing:**
1. `getGuestCustomer()` is called for the new business
2. If not found, automatically creates a new guest customer
3. Logs warning for monitoring
4. Returns the newly created guest customer
5. User can use instant checkout immediately

## Testing Scenarios

### Scenario 1: User removed while on any page
- ✅ Real-time DELETE detected immediately
- ✅ Automatic switch to best alternative business
- ✅ **Explicit navigation to dashboard** (no refresh needed)
- ✅ User sees alert notification
- ✅ Guest customer auto-created if missing
- ✅ Instant checkout works immediately

### Scenario 2: User removed with no other businesses
- ✅ Real-time DELETE detected immediately
- ✅ Current business cleared
- ✅ **Explicit navigation to business onboarding** (no refresh needed)
- ✅ User sees alert about no businesses
- ✅ User can immediately create new business

### Scenario 3: User removed from non-current business
- ✅ Real-time DELETE detected
- ✅ Business removed from list
- ✅ User stays on current business
- ✅ No alerts shown (background cleanup)
- ✅ No navigation triggered

### Scenario 4: Switching to business without guest customer
- ✅ `getGuestCustomer()` called automatically
- ✅ Guest customer created on-demand
- ✅ No error thrown to user
- ✅ Instant checkout functionality available immediately

## Key Lessons

1. **Closures and Stale State**: Real-time subscriptions that live for the entire component lifecycle must use refs for values that change frequently
2. **Effect Dependencies**: Including state variables in effect dependencies can cause unwanted recreation; use refs instead
3. **Function Hoisting**: Define functions before they're used in effects to avoid hoisting issues
4. **Ref Synchronization**: Always sync refs with state using effects to ensure consistency
5. **Explicit Navigation**: State changes alone don't always trigger navigation; explicitly call `router.replace()` when needed
6. **Defensive Data Patterns**: Auto-create missing required data (like guest customers) instead of throwing errors
7. **Dynamic Imports**: Use dynamic imports (`await import('expo-router')`) to avoid circular dependencies in real-time handlers

## Benefits of This Fix

✅ **Immediate Response**: User is redirected as soon as they're removed (no refresh needed)
✅ **No Stale Data**: Always uses the most current business list and history
✅ **Seamless UX**: User doesn't get stuck on inaccessible pages
✅ **Explicit Navigation**: Forces navigation to correct screen automatically
✅ **Clear Feedback**: Appropriate alerts inform user what happened
✅ **Resilient Data**: Auto-creates guest customers when missing
✅ **No Errors**: Gracefully handles edge cases without breaking user flow
✅ **Graceful Degradation**: Falls back to navigation guard if automatic switch fails
