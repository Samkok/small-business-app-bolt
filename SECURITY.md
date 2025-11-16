# Security Documentation - Business Manager Pro

## Overview

This document outlines the security measures, best practices, and protocols implemented in Business Manager Pro to protect user data, prevent unauthorized access, and maintain application integrity.

**Last Updated:** November 2025
**Version:** 2.0

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Input Validation & Sanitization](#input-validation--sanitization)
3. [Rate Limiting & Brute Force Protection](#rate-limiting--brute-force-protection)
4. [Database Security](#database-security)
5. [File Upload Security](#file-upload-security)
6. [Audit Logging](#audit-logging)
7. [Data Privacy](#data-privacy)
8. [Secure Storage](#secure-storage)
9. [API Security](#api-security)
10. [Security Incident Response](#security-incident-response)

---

## Authentication & Authorization

### Password Requirements

All user passwords must meet the following requirements:

- **Minimum Length:** 8 characters
- **Complexity:** Must contain at least:
  - 1 uppercase letter (A-Z)
  - 1 lowercase letter (a-z)
  - 1 number (0-9)
  - 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

### Password Strength Validation

The system validates password strength using a scoring system (0-100):
- **80-100:** Strong (required for account creation)
- **60-79:** Moderate (warning shown)
- **0-59:** Weak (rejected)

Implementation: `src/lib/validation.ts` - `validatePasswordStrength()`

### Session Management

- **Session Duration:** Sessions remain active for 7 days of inactivity
- **Session Storage:** Uses SecureStore on native platforms, encrypted AsyncStorage on web
- **Auto-logout:** Users are automatically logged out after 7 days of inactivity
- **Remember Me:** Optional feature using encrypted storage

### Multi-Factor Authentication (MFA)

Currently not implemented. Recommended for future enhancement for admin users.

### Role-Based Access Control (RBAC)

Two primary roles:
- **Admin:** Full access to all business features, including team management
- **Staff:** Limited access based on business configuration

Implementation: Row Level Security (RLS) policies in Supabase

---

## Input Validation & Sanitization

### Validation Schemas

All user inputs are validated using Zod schemas before processing:

- **Email:** RFC 5322 compliant, max 255 characters
- **Names:** 2-100 characters, letters/spaces/hyphens/apostrophes only
- **Phone Numbers:** International format support, max 20 characters
- **Prices:** Non-negative, max 999,999,999.99
- **Quantities:** Integers, non-negative, max 999,999
- **Barcodes:** Alphanumeric + hyphens, 4-50 characters

Location: `src/lib/validation.ts`

### Search Query Sanitization

All search queries are sanitized to prevent SQL injection:

```typescript
// Escapes special characters: %, _, \
const sanitized = sanitizeSearchQuery(userInput);
// Limits length to 100 characters
// Trims whitespace
```

Implementation: `sanitizeSearchQuery()` in `src/lib/validation.ts`

### XSS Prevention

- All user-generated content is escaped before rendering
- React Native's Text component automatically escapes content
- No `dangerouslySetInnerHTML` usage allowed

---

## Rate Limiting & Brute Force Protection

### Client-Side Rate Limiting

Implemented for critical operations using `RateLimiter` class:

#### Login Attempts
- **Max Attempts:** 5 failed logins
- **Time Window:** 15 minutes
- **Block Duration:** 30 minutes after exceeding limit
- **Storage:** AsyncStorage (client-side)

#### Password Reset
- **Max Attempts:** 3 requests
- **Time Window:** 60 minutes
- **Block Duration:** 60 minutes after exceeding limit

### Server-Side Rate Limiting

Database function `check_rate_limit()` provides server-side protection:

```sql
SELECT check_rate_limit(
  'login',           -- identifier
  user_email,        -- key
  5,                 -- max attempts
  15,                -- window minutes
  30                 -- block minutes
);
```

Location: `supabase/migrations/20251116172604_add_security_audit_logging.sql`

### Implementation

```typescript
// Check rate limit before login
const rateLimitCheck = await loginRateLimiter.checkLimit(email);
if (!rateLimitCheck.allowed) {
  // Show blocked message with remaining time
  return;
}

// Record failed attempt
await loginRateLimiter.recordAttempt(email);

// Reset on successful login
await loginRateLimiter.resetLimit(email);
```

---

## Database Security

### Row Level Security (RLS)

All tables have RLS enabled with restrictive policies:

#### Business Data Isolation
Users can only access data belonging to their business:

```sql
USING (
  business_id IN (
    SELECT business_id FROM user_business_roles
    WHERE user_id = auth.uid()
  )
)
```

#### Admin-Only Access
Certain operations require admin role:

```sql
USING (
  EXISTS (
    SELECT 1 FROM user_business_roles
    WHERE user_id = auth.uid()
    AND business_id = target_business_id
    AND role = 'admin'
  )
)
```

### Database Best Practices

- **Parameterized Queries:** All queries use Supabase client library (automatically parameterized)
- **Input Validation:** All inputs validated before database operations
- **Least Privilege:** Application uses anon key, not service role key
- **No Dynamic SQL:** No string concatenation in queries
- **Prepared Statements:** Supabase client handles automatically

### Sensitive Data Protection

Sensitive fields are access-controlled:
- Customer phone numbers
- Customer addresses
- Financial data
- Audit logs (admin-only)

---

## File Upload Security

### Validation Rules

All uploaded files are validated against:

#### Image Files (Products, Profiles, Business)
- **Max Size:** 5 MB
- **Allowed Types:** JPEG, PNG, GIF, WebP
- **Allowed Extensions:** .jpg, .jpeg, .png, .gif, .webp
- **MIME Type Verification:** Must match file extension

### File Name Sanitization

All file names are sanitized to prevent directory traversal and injection attacks:

```typescript
// Remove dangerous characters
// Replace spaces with underscores
// Limit length to 255 characters
// Remove leading/trailing dots
const sanitized = sanitizeFileName(originalName);
```

### Secure File Names

Generated file names use:
- Timestamp
- Random string
- Business/product ID prefix
- Original extension (validated)

Format: `{prefix}_{timestamp}_{random}.{ext}`

### Storage Security

- **Public URLs:** Generated for allowed files only
- **Bucket Policies:** Configured in Supabase Storage
- **File Deletion:** Old files removed when updated
- **Size Limits:** Enforced at multiple levels

Implementation: `src/lib/fileValidation.ts`

---

## Audit Logging

### Audit Log Table

Comprehensive logging of critical operations:

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  business_id uuid,
  user_id uuid,
  action_type text,  -- create, update, delete, view, export
  entity_type text,  -- product, customer, sale, etc.
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz
);
```

### Security Events Table

Tracks security-specific events:

```sql
CREATE TABLE security_events (
  id uuid PRIMARY KEY,
  event_type text,  -- login_failed, permission_denied, etc.
  user_id uuid,
  email text,
  severity text,    -- low, medium, high, critical
  metadata jsonb,
  created_at timestamptz
);
```

### Logged Events

#### Audit Logs
- Product creation/updates/deletion
- Customer management
- Sales transactions
- Inventory changes
- Settings modifications
- Permission changes

#### Security Events
- Login successes/failures
- Permission denials
- Rate limit violations
- Suspicious activities
- Password resets
- Account lockouts

### Log Retention

- **Audit Logs:** 1 year
- **Security Events:** 6 months
- **Rate Limit Records:** 7 days

Cleanup function: `cleanup_old_security_records()`

### Access Control

- Only business admins can read audit logs
- Security events visible to affected users and admins
- Logs are immutable (insert-only)

---

## Data Privacy

### Personal Information Protection

User data classified and protected:

#### Highly Sensitive
- Passwords (hashed by Supabase Auth)
- Authentication tokens
- Payment information (if implemented)

#### Sensitive
- Email addresses
- Phone numbers
- Physical addresses
- Full names

#### Business Data
- Product information
- Sales records
- Inventory levels
- Financial reports

### Data Access Principles

1. **Least Privilege:** Users access only necessary data
2. **Business Isolation:** Complete separation between businesses
3. **Role-Based:** Access determined by user role
4. **Audit Trail:** All sensitive data access logged

### User Rights

Users have the right to:
- **Access:** View all their personal data
- **Correction:** Update incorrect information
- **Deletion:** Request account deletion
- **Export:** Download data in portable format
- **Portability:** Transfer data to another service

### GDPR Compliance Considerations

- Consent tracking for data processing
- Data breach notification procedures
- Privacy policy acceptance records
- Right to be forgotten implementation
- Data protection by design and default

---

## Secure Storage

### Platform-Specific Storage

#### Native Platforms (iOS/Android)
- **Secure Storage:** Uses Expo SecureStore
- **Encryption:** OS-level keychain/keystore
- **Biometric:** Supported by OS

#### Web Platform
- **Encryption:** AES encryption with CryptoJS
- **Storage:** Encrypted data in localStorage
- **Key Management:** Application-level encryption key

### Stored Sensitive Data

- Remember Me credentials (encrypted)
- Session tokens (SecureStore)
- Last activity timestamp
- Rate limit records

### Implementation

```typescript
// Secure storage wrapper
await SecureStorage.setItem(key, value);
const value = await SecureStorage.getItem(key);
await SecureStorage.removeItem(key);
```

Location: `src/lib/secureStorage.ts`

---

## API Security

### Supabase Client Configuration

```typescript
{
  auth: {
    autoRefreshToken: true,    // Automatic token refresh
    persistSession: true,      // Persist across app restarts
    detectSessionInUrl: false, // Security: disable URL session detection
    storage: CustomAdapter,    // Secure storage adapter
  }
}
```

### API Best Practices

1. **Never expose service role key:** Use anon key only
2. **Validate all inputs:** Before making API calls
3. **Handle errors gracefully:** Don't expose system details
4. **Rate limit requests:** Protect against abuse
5. **Use HTTPS only:** Enforce in production
6. **Timeout requests:** Prevent hanging connections

### Error Handling

- Generic error messages for users
- Detailed errors logged securely
- Stack traces hidden in production
- No database structure exposure

---

## Security Incident Response

### Incident Categories

#### Critical
- Data breach
- Unauthorized access to admin accounts
- SQL injection exploitation
- Authentication bypass

#### High
- Multiple failed login attempts from single IP
- Unusual data access patterns
- Rate limit violations
- Permission escalation attempts

#### Medium
- Individual account lockouts
- Password reset abuse
- File upload violations

#### Low
- Single failed login
- Invalid input attempts
- Normal rate limiting

### Response Procedures

#### 1. Detection
- Monitor security_events table
- Review audit logs regularly
- Set up alerts for critical events
- Track failed authentication attempts

#### 2. Assessment
- Determine incident severity
- Identify affected users/data
- Assess potential damage
- Document timeline

#### 3. Containment
- Block malicious IPs
- Disable compromised accounts
- Rotate exposed credentials
- Isolate affected systems

#### 4. Eradication
- Remove malicious access
- Patch vulnerabilities
- Update security rules
- Deploy fixes

#### 5. Recovery
- Restore from clean backups
- Verify system integrity
- Re-enable services
- Monitor for reoccurrence

#### 6. Post-Incident
- Document lessons learned
- Update security procedures
- Notify affected users
- Report to authorities if required

### Contact Points

- **Security Team:** [Configure based on organization]
- **Database Admin:** [Configure based on organization]
- **Legal/Compliance:** [Configure based on organization]

---

## Security Checklist

### For Developers

- [ ] Validate all user inputs
- [ ] Use parameterized queries
- [ ] Implement proper error handling
- [ ] Add audit logging for critical operations
- [ ] Test RLS policies thoroughly
- [ ] Never expose sensitive data in logs
- [ ] Use secure storage for credentials
- [ ] Implement rate limiting for sensitive operations
- [ ] Follow password requirements
- [ ] Sanitize search queries
- [ ] Validate file uploads
- [ ] Update dependencies regularly

### For Administrators

- [ ] Review audit logs regularly
- [ ] Monitor failed login attempts
- [ ] Check security events weekly
- [ ] Update security policies
- [ ] Perform security audits quarterly
- [ ] Train staff on security practices
- [ ] Implement backup procedures
- [ ] Test incident response plan
- [ ] Review user permissions
- [ ] Update documentation

### For Users

- [ ] Use strong, unique passwords
- [ ] Enable Remember Me only on trusted devices
- [ ] Log out when finished
- [ ] Report suspicious activity
- [ ] Keep contact information updated
- [ ] Review account activity regularly
- [ ] Don't share credentials
- [ ] Use trusted networks only

---

## Additional Resources

### Security Libraries Used

- **@supabase/supabase-js:** Database and authentication
- **expo-secure-store:** Secure credential storage
- **crypto-js:** Client-side encryption
- **zod:** Input validation schemas
- **react-native-url-polyfill:** URL handling

### External Documentation

- [Supabase Security Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Native Security Guide](https://reactnative.dev/docs/security)
- [Expo Security Best Practices](https://docs.expo.dev/guides/security/)

### Security Updates

Check for security updates regularly:
```bash
npm audit
npm audit fix
```

---

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please:

1. **Do not** open a public issue
2. Email security details to: [Configure based on organization]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and provide updates on resolution progress.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Nov 2025 | Added comprehensive security measures, audit logging, rate limiting, enhanced validation |
| 1.0 | Jun 2025 | Initial security implementation with RLS and authentication |

---

**Document Maintained By:** Development Team
**Review Frequency:** Quarterly
**Next Review Date:** February 2026
