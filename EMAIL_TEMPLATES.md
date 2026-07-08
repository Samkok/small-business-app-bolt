# BizManage - Supabase Auth Email Templates

## How to Apply

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** > **Email Templates**
3. For each template below, select the matching template type
4. Replace the **Subject** field with the provided subject
5. Replace the **Body** field with the provided HTML
6. Click **Save**

---

## 1. Confirm Sign Up

**Subject:** `Confirm your BizManage account`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #2563eb; letter-spacing: -0.5px;">BizManage</h1>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827;">Confirm your email address</h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                Welcome to BizManage! Please confirm your email address by clicking the button below to activate your account.
              </p>
              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #2563eb; border-radius: 8px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Confirm Email</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #2563eb; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                You received this email because someone signed up for a BizManage account with this email address. If this wasn't you, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Invite User

**Subject:** `You've been invited to join a team on BizManage`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team invitation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #2563eb; letter-spacing: -0.5px;">BizManage</h1>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827;">You've been invited</h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                A team on BizManage has invited you to collaborate. Accept the invitation below to join the team and start managing the business together.
              </p>
              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #2563eb; border-radius: 8px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #2563eb; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                You received this email because a BizManage user invited you to their team. If you don't recognize this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Magic Link / OTP

**Subject:** `Your BizManage sign-in code`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to BizManage</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #2563eb; letter-spacing: -0.5px;">BizManage</h1>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827;">Sign in to your account</h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                Use the code below to sign in to your BizManage account. This code expires in 10 minutes.
              </p>
              <!-- OTP Code -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f3f4f6; border-radius: 8px; padding: 20px;">
                    <span style="font-size: 32px; font-weight: 700; color: #111827; letter-spacing: 6px; font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;">{{ .Token }}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                Or click the button below to sign in directly:
              </p>
              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #2563eb; border-radius: 8px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Sign In</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #2563eb; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                You received this email because a sign-in was requested for your BizManage account. If this wasn't you, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Change Email Address

**Subject:** `Confirm your new email address`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm email change</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #2563eb; letter-spacing: -0.5px;">BizManage</h1>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827;">Confirm your new email</h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                We received a request to change the email address associated with your BizManage account. Please confirm this change by clicking the button below.
              </p>
              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #2563eb; border-radius: 8px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Confirm Email Change</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #2563eb; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                If you did not request this email change, please secure your account immediately by changing your password. Contact support if you need help.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 5. Reset Password

**Subject:** `Reset your BizManage password`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #2563eb; letter-spacing: -0.5px;">BizManage</h1>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827;">Reset your password</h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                We received a request to reset the password for your BizManage account. Click the button below to set a new password.
              </p>
              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #2563eb; border-radius: 8px;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <!-- Security notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #fef3c7; border-radius: 8px; padding: 12px 16px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">
                      This link will expire in 24 hours. If you didn't request a password reset, no action is needed.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #2563eb; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                You received this email because a password reset was requested for your BizManage account. If you did not make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 6. Reauthentication

**Subject:** `BizManage security verification`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #2563eb; letter-spacing: -0.5px;">BizManage</h1>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #111827;">Security verification</h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #374151;">
                To complete a sensitive action on your BizManage account, please verify your identity using the code below. This code expires in 10 minutes.
              </p>
              <!-- OTP Code -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f3f4f6; border-radius: 8px; padding: 20px;">
                    <span style="font-size: 32px; font-weight: 700; color: #111827; letter-spacing: 6px; font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;">{{ .Token }}</span>
                  </td>
                </tr>
              </table>
              <!-- Security notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 0 0;">
                <tr>
                  <td style="background-color: #eff6ff; border-radius: 8px; padding: 12px 16px; border-left: 4px solid #2563eb;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1e40af;">
                      Never share this code with anyone. BizManage will never ask you for this code via phone or chat.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                You received this email because a verification was required on your BizManage account. If you did not initiate this, please change your password immediately.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
