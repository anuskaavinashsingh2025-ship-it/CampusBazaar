# Google Account → Password Setup Flow Audit

## Implementation Status

### ✅ Completed
1. **Created `/reset-password` route** (`src/routes/reset-password.tsx`)
   - Detects PASSWORD_RECOVERY session from Supabase
   - Accepts Supabase recovery tokens from URL hash
   - Calls `supabase.auth.updateUser({ password })`
   - Shows success state
   - Redirects to login after completion
   - Full diagnostics logging

2. **Added Google-only account detection** (`src/routes/login.tsx`)
   - Checks user identities for Google provider
   - Checks if user lacks email/password identity
   - Shows "Set up password" prompt for Google-only users

3. **Added password setup trigger** (`src/routes/login.tsx`)
   - "Set up password" button in login page
   - Calls `supabase.auth.resetPasswordForEmail()`
   - Full logging of email, response, and redirect URL
   - Surfaces real errors (no fake success messages)

4. **Added diagnostics logging**
   - Login page: logs email, resetPasswordForEmail response, redirect URL
   - Reset password page: logs session, recovery token, auth errors

## Required Supabase Configuration

### Redirect URLs
The following redirect URLs must be configured in your Supabase project dashboard:

**Development:**
- `http://localhost:8080/reset-password`
- `http://localhost:8081/reset-password`
- `http://localhost:5173/reset-password`

**Production:**
- `https://your-production-domain.com/reset-password`

### Site URL
Configure in Supabase dashboard:
- Development: `http://localhost:8080` or `http://localhost:8081`
- Production: `https://your-production-domain.com`

### Email Template
Ensure the password recovery email template includes:
- Recovery link pointing to `/reset-password`
- Correct `redirectTo` value passed in the resetPasswordForEmail call

## Flow Verification

### Expected Flow:
1. User signs up using Google OAuth
2. User has no password initially (Google-only account)
3. Login page detects Google-only account
4. Shows: "Signed up with Google? Set up a password"
5. User clicks "Set up password"
6. App calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
7. Supabase sends password recovery email
8. User receives email with recovery link
9. Email link redirects to `/reset-password#access_token=...`
10. Reset password page detects recovery token
11. User enters new password
12. App calls `supabase.auth.updateUser({ password })`
13. Password is attached to the SAME Supabase user
14. User can now login with either Google OAuth or Email + Password

### Diagnostics
All steps include console logging with `[PasswordSetup]` prefix for easy debugging.

## Testing Instructions

1. **Test with Google-only account:**
   - Sign up with Google (don't set password)
   - Logout
   - Visit login page
   - Verify "Set up password" prompt appears
   - Click "Set up password"
   - Check console for logging
   - Check email inbox for recovery email
   - Click recovery link
   - Verify reset password page loads
   - Check console for recovery token logging
   - Enter new password
   - Verify success message
   - Try logging in with email + password

2. **Check console logs:**
   - `[PasswordSetup] User identities:` - should show Google identity
   - `[PasswordSetup] Has password identity: false` - should be false for Google-only
   - `[PasswordSetup] Initiating password setup for:` - should show email
   - `[PasswordSetup] Redirect URL:` - should show correct URL
   - `[PasswordSetup] resetPasswordForEmail response:` - should show success
   - `[ResetPassword] Access token present:` - should be true on reset page

## Root Cause Analysis

If any step fails:
1. **Email not received:** Check Supabase email settings, redirect URLs, and spam folder
2. **Recovery link invalid:** Check redirect URLs in Supabase dashboard match exactly
3. **Reset page shows error:** Check console for specific error message
4. **Password update fails:** Check if user has valid session, check Supabase logs
