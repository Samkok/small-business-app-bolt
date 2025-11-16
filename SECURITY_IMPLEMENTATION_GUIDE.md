# Security Implementation Guide

This guide provides step-by-step instructions for implementing and maintaining security features in Business Manager Pro.

## Quick Start

### 1. Apply Database Migrations

Run the security audit logging migration:

```bash
# The migration is located at:
# supabase/migrations/20251116172604_add_security_audit_logging.sql

# Apply using Supabase CLI or dashboard
```

### 2. Install Dependencies

```bash
npm install crypto-js @types/crypto-js
```

### 3. Update Environment Variables

Ensure your `.env` file has:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_APP_URL=your_app_url
EXPO_PUBLIC_APP_SCHEME=businessmanager
```

## Implementation Details

### Password Validation

#### Client-Side Validation

```typescript
import { validatePasswordStrength, passwordSchema } from '@/src/lib/validation';

// Validate password format
const result = passwordSchema.safeParse(password);
if (!result.success) {
  // Show error: result.error.errors[0].message
}

// Check password strength
const strength = validatePasswordStrength(password);
if (!strength.isValid) {
  // Show feedback: strength.feedback
  // Show score: strength.score
}
```

#### Requirements Reminder

Display password requirements to users:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Rate Limiting

#### Login Protection

```typescript
import { loginRateLimiter, RateLimiter } from '@/src/lib/rateLimiter';

async function handleLogin(email: string, password: string) {
  // Check if user is rate limited
  const check = await loginRateLimiter.checkLimit(email.toLowerCase());

  if (!check.allowed) {
    const duration = RateLimiter.formatBlockDuration(
      check.blockedUntil - Date.now()
    );
    alert(`Too many attempts. Try again in ${duration}`);
    return;
  }

  // Attempt login
  const { error } = await signIn(email, password);

  if (error) {
    // Record failed attempt
    await loginRateLimiter.recordAttempt(email.toLowerCase());

    // Show remaining attempts
    const remaining = await loginRateLimiter.checkLimit(email.toLowerCase());
    if (remaining.remainingAttempts > 0) {
      alert(`${error.message}\n\nRemaining attempts: ${remaining.remainingAttempts}`);
    }
  } else {
    // Reset on success
    await loginRateLimiter.resetLimit(email.toLowerCase());
  }
}
```

#### Custom Rate Limiters

```typescript
import { RateLimiter } from '@/src/lib/rateLimiter';

// Create custom rate limiter
const apiLimiter = new RateLimiter('api-calls', {
  maxAttempts: 100,      // Max requests
  windowMs: 60000,       // Per minute
  blockDurationMs: 300000 // 5 minute block
});

// Use it
const check = await apiLimiter.checkLimit(userId);
if (check.allowed) {
  await apiLimiter.recordAttempt(userId);
  // Make API call
}
```

### Input Validation

#### Using Validation Schemas

```typescript
import { productSchema, customerSchema, expenseSchema } from '@/src/lib/validation';

// Validate product data
const result = productSchema.safeParse({
  name: productName,
  price: productPrice,
  current_stock: stock,
  business_id: businessId,
  // ... other fields
});

if (!result.success) {
  // Get all errors
  const errors = result.error.errors.map(e => e.message);
  alert(errors.join('\n'));
  return;
}

// Use validated data
const validatedData = result.data;
await createProduct(validatedData);
```

#### Search Query Sanitization

```typescript
import { sanitizeSearchQuery } from '@/src/lib/validation';

// Before using in search
const userInput = searchBox.value;
const sanitized = sanitizeSearchQuery(userInput);

// Use sanitized query
const results = await searchProducts(businessId, sanitized);
```

### Secure Storage

#### Storing Credentials

```typescript
import { SecureStorage } from '@/src/lib/secureStorage';

// Store securely
await SecureStorage.setItem('user_token', token);

// Retrieve
const token = await SecureStorage.getItem('user_token');

// Remove
await SecureStorage.removeItem('user_token');

// Store objects
await SecureStorage.setObject('user_data', { id, email, name });
const userData = await SecureStorage.getObject('user_data');
```

#### Remember Me Feature

```typescript
import {
  setRememberMeCredentials,
  getRememberMeCredentials,
  clearRememberMeCredentials
} from '@/src/lib/secureStorage';

// On login with "Remember Me" checked
if (rememberMe) {
  await setRememberMeCredentials(email);
}

// On app start
const { email, rememberMe } = await getRememberMeCredentials();
if (email && rememberMe) {
  // Pre-fill email
}

// On logout
await clearRememberMeCredentials();
```

### File Upload Validation

#### Validating Image Uploads

```typescript
import { validateImageFile, generateSecureFileName } from '@/src/lib/fileValidation';

async function handleImageUpload(file: File | MobileFile) {
  // Validate file
  const validation = validateImageFile(file, {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    allowedExtensions: ['.jpg', '.jpeg', '.png']
  });

  if (!validation.isValid) {
    alert(validation.error);
    return;
  }

  // Generate secure filename
  const secureFileName = generateSecureFileName(
    file.name,
    `product_${productId}`
  );

  // Upload with secure filename
  await uploadImage(file, secureFileName);
}
```

### Audit Logging

#### Client-Side Logging (Future Enhancement)

```typescript
// When creating audit logs from client, call edge function or RPC

async function logAudit(
  action: 'create' | 'update' | 'delete',
  entityType: string,
  entityId: string,
  oldValues?: any,
  newValues?: any
) {
  await supabase.rpc('log_audit_event', {
    p_business_id: currentBusinessId,
    p_user_id: currentUserId,
    p_action_type: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_old_values: oldValues,
    p_new_values: newValues,
    p_metadata: {
      timestamp: new Date().toISOString(),
      platform: Platform.OS
    }
  });
}

// Usage
await logAudit('update', 'product', productId, oldData, newData);
```

#### Security Event Logging

```typescript
async function logSecurityEvent(
  eventType: 'login_failed' | 'permission_denied' | 'rate_limit_exceeded',
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata?: any
) {
  await supabase.rpc('log_security_event', {
    p_event_type: eventType,
    p_user_id: currentUserId,
    p_email: currentUserEmail,
    p_severity: severity,
    p_metadata: metadata
  });
}

// Usage
await logSecurityEvent('login_failed', 'medium', {
  ip_address: clientIp,
  attempts: 3
});
```

### Error Handling

#### Secure Error Display

```typescript
import { getErrorMessage, handleError } from '@/src/lib/errors';

try {
  await riskyOperation();
} catch (error) {
  // Log full error securely
  console.error('Operation failed:', error);

  // Show sanitized message to user
  const userMessage = getErrorMessage(error);
  alert(userMessage);

  // Or convert to AppError
  const appError = handleError(error);
  // Handle based on error type
}
```

#### Custom Error Classes

```typescript
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError
} from '@/src/lib/errors';

// Throw appropriate errors
if (!isValid) {
  throw new ValidationError('Invalid input data');
}

if (!isAuthenticated) {
  throw new AuthenticationError('Please log in');
}

if (!hasPermission) {
  throw new AuthorizationError('Insufficient permissions');
}
```

## Database Functions

### Check Rate Limit (Server-Side)

```sql
-- Call from client via RPC
SELECT check_rate_limit(
  'login',           -- identifier
  'user@example.com', -- key
  5,                 -- max_attempts
  15,                -- window_minutes
  30                 -- block_minutes
);

-- Returns
{
  "allowed": true/false,
  "remaining_attempts": 3,
  "blocked_until": "2025-11-16T18:00:00Z",
  "message": "Rate limit exceeded..."
}
```

### Log Audit Event

```sql
SELECT log_audit_event(
  'business-uuid',    -- business_id
  'user-uuid',        -- user_id
  'update',           -- action_type
  'product',          -- entity_type
  'entity-uuid',      -- entity_id
  '{"price": 10}',    -- old_values (jsonb)
  '{"price": 15}',    -- new_values (jsonb)
  '{"reason": "price_adjustment"}' -- metadata (jsonb)
);
```

### Log Security Event

```sql
SELECT log_security_event(
  'login_failed',     -- event_type
  'user-uuid',        -- user_id
  'user@example.com', -- email
  'medium',           -- severity
  '{"attempts": 3, "ip": "192.168.1.1"}' -- metadata (jsonb)
);
```

## Testing Security Features

### Test Password Validation

```typescript
import { validatePasswordStrength, passwordSchema } from '@/src/lib/validation';

// Test cases
const testPasswords = [
  'weak',                    // Too short
  'NoNumbers!',              // Missing numbers
  'nonumbers123',            // Missing uppercase
  'NOLOWERCASE123!',         // Missing lowercase
  'NoSpecial123',            // Missing special char
  'SecurePass123!',          // Valid strong password
];

testPasswords.forEach(pwd => {
  const validation = passwordSchema.safeParse(pwd);
  const strength = validatePasswordStrength(pwd);
  console.log(`Password: ${pwd}`);
  console.log(`Valid: ${validation.success}`);
  console.log(`Strength: ${strength.score}/100`);
  console.log(`Feedback: ${strength.feedback.join(', ')}`);
});
```

### Test Rate Limiting

```typescript
// Test rate limiter behavior
const testLimiter = new RateLimiter('test', {
  maxAttempts: 3,
  windowMs: 60000,
  blockDurationMs: 120000
});

// Simulate multiple attempts
for (let i = 0; i < 5; i++) {
  const check = await testLimiter.checkLimit('test-user');
  console.log(`Attempt ${i + 1}: ${check.allowed ? 'Allowed' : 'Blocked'}`);

  if (check.allowed) {
    await testLimiter.recordAttempt('test-user');
  }
}
```

### Test Input Sanitization

```typescript
import { sanitizeSearchQuery } from '@/src/lib/validation';

// Test malicious inputs
const maliciousInputs = [
  "'; DROP TABLE users; --",
  "../../etc/passwd",
  "<script>alert('xss')</script>",
  "%'; UNION SELECT * FROM users; --"
];

maliciousInputs.forEach(input => {
  const sanitized = sanitizeSearchQuery(input);
  console.log(`Input: ${input}`);
  console.log(`Sanitized: ${sanitized}`);
  console.log(`Safe: ${sanitized !== input}`);
});
```

## Monitoring & Maintenance

### Regular Security Checks

```sql
-- Check failed login attempts (last 24 hours)
SELECT COUNT(*), email, MAX(created_at) as last_attempt
FROM security_events
WHERE event_type = 'login_failed'
AND created_at > now() - interval '24 hours'
GROUP BY email
HAVING COUNT(*) > 5
ORDER BY COUNT(*) DESC;

-- Check rate limit violations
SELECT COUNT(*), identifier, key
FROM rate_limit_records
WHERE blocked_until > now()
GROUP BY identifier, key
ORDER BY COUNT(*) DESC;

-- Review recent audit logs
SELECT action_type, entity_type, COUNT(*)
FROM audit_logs
WHERE created_at > now() - interval '7 days'
GROUP BY action_type, entity_type
ORDER BY COUNT(*) DESC;
```

### Cleanup Old Records

```sql
-- Run cleanup function (should be scheduled)
SELECT cleanup_old_security_records();

-- Verify cleanup
SELECT
  'audit_logs' as table_name,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  COUNT(*) as total_records
FROM audit_logs
UNION ALL
SELECT
  'security_events',
  MIN(created_at),
  MAX(created_at),
  COUNT(*)
FROM security_events
UNION ALL
SELECT
  'rate_limit_records',
  MIN(created_at),
  MAX(created_at),
  COUNT(*)
FROM rate_limit_records;
```

## Common Issues & Solutions

### Issue: Rate Limiter Not Working on Web

**Solution:** Ensure AsyncStorage is available:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Test AsyncStorage
try {
  await AsyncStorage.setItem('test', 'value');
  await AsyncStorage.removeItem('test');
} catch (error) {
  console.error('AsyncStorage not available:', error);
}
```

### Issue: Secure Storage Fails on Web

**Solution:** crypto-js must be installed:

```bash
npm install crypto-js @types/crypto-js
```

### Issue: Password Validation Too Strict

**Solution:** Adjust requirements in `src/lib/validation.ts`:

```typescript
export const passwordRequirements = {
  minLength: 8,                    // Adjust as needed
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,        // Set to false if too strict
};
```

### Issue: File Upload Validation Rejecting Valid Files

**Solution:** Check and adjust validation options:

```typescript
const validation = validateImageFile(file, {
  maxSizeBytes: 10 * 1024 * 1024,  // Increase to 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/heic'                     // Add more types
  ],
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.heic'
  ]
});
```

## Next Steps

1. ✅ Apply database migrations
2. ✅ Update authentication screens
3. ✅ Test password validation
4. ✅ Test rate limiting
5. ⏳ Implement audit logging in critical operations
6. ⏳ Add MFA for admin users
7. ⏳ Set up monitoring alerts
8. ⏳ Schedule regular security audits
9. ⏳ Train team on security practices
10. ⏳ Document incident response procedures

## Additional Resources

- Main Security Documentation: `SECURITY.md`
- Validation Library: `src/lib/validation.ts`
- Rate Limiter: `src/lib/rateLimiter.ts`
- Secure Storage: `src/lib/secureStorage.ts`
- File Validation: `src/lib/fileValidation.ts`
- Error Handling: `src/lib/errors.ts`

## Support

For security questions or concerns, refer to `SECURITY.md` for reporting procedures.
