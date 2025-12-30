# Google OAuth Setup Instructions

## Critical: Supabase Dashboard Configuration

You MUST configure the OAuth redirect URLs in your Supabase dashboard:

### Steps:

1. **Go to Supabase Dashboard**
   - URL: https://app.supabase.com/project/bceogezhbvgmjlzpcvde/auth/url-configuration

2. **Add Redirect URLs** (in "Redirect URLs" section):
   ```
   http://localhost:5173/**
   http://localhost:5173/dashboard
   http://localhost:5173/role-selection
   ```

3. **Add Site URL**:
   ```
   http://localhost:5173
   ```

4. **Enable Google Provider**:
   - Go to: https://app.supabase.com/project/bceogezhbvgmjlzpcvde/auth/providers
   - Enable "Google" provider
   - Add your Google OAuth credentials (Client ID and Secret)

### Google Cloud Console Setup:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   ```
   https://bceogezhbvgmjlzpcvde.supabase.co/auth/v1/callback
   ```
4. Copy Client ID and Secret to Supabase

## Testing the Flow:

After configuration:

1. Clear browser cache and localStorage
2. Open browser console (F12) to see auth logs
3. Click "Continue with Google"
4. Watch for console logs:
   - `[OAuth] Initiating Google sign-in...`
   - `[Auth] Auth Event: SIGNED_IN`
   - `[Auth] Session detected: {userId, email, provider}`
   - `[Auth] Profile loaded:` or `[Auth] Creating new profile:`

## Expected Flow:

**For NEW Google users (no role):**
1. Sign in with Google → redirected to `/dashboard`
2. ProtectedRoute detects no role → redirects to `/role-selection`
3. User selects role → role saved → redirected to `/dashboard`

**For EXISTING users (with role):**
1. Sign in with Google → redirected to `/dashboard`
2. ProtectedRoute sees valid role → stays on `/dashboard`

## Troubleshooting:

### If stuck on home page:
- Check browser console for errors
- Verify redirect URLs in Supabase match exactly
- Clear localStorage: `localStorage.clear()` in console
- Check if user was created in Supabase database

### If "No user added":
- Check Supabase Auth → Users table
- Look for email: 221074@students.au.edu.pk
- Check console logs for profile creation errors
- Verify database permissions allow INSERT on users table

### Common Issues:
1. **Redirect URL mismatch**: URLs in Supabase must match your local dev server
2. **Missing Google credentials**: Provider must be enabled with valid Client ID/Secret
3. **RLS policies**: Ensure users table has INSERT policy for authenticated users
4. **Session not persisting**: Clear cache and retry

## Database Policy Check:

Run this in Supabase SQL Editor to verify policies:

```sql
-- Check if users table allows inserts
SELECT * FROM pg_policies WHERE tablename = 'users';

-- If no INSERT policy exists, create one:
CREATE POLICY "Users can insert own record"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);
```

## Changes Made:

1. ✅ OAuth redirects to `/dashboard` (not home)
2. ✅ ProtectedRoute redirects to `/role-selection` if no role
3. ✅ User creation sets `role = null` for OAuth users
4. ✅ Added comprehensive logging for debugging
5. ✅ Fixed Supabase client to use PKCE flow for OAuth
