# Google OAuth Flow - Clean Implementation

## How It Works

### 1. User Clicks "Sign in with Google"
- OAuth popup opens
- User authorizes with Google
- Google redirects back to app

### 2. Auth State Change Detected
**File: `AuthContext.jsx`**
- Supabase detects new session
- Calls `loadUserData(userId, sessionUser)`

### 3. Check if User Exists in Database
**File: `AuthContext.jsx` → `loadUserData()`**

```javascript
// Try to get user from database
const { data: existingProfile } = await userApi.getProfile(userId);

if (!existingProfile) {
  // NEW USER - Create with role = NULL
  const newUser = {
    id: userId,
    email: sessionUser.email,
    full_name: sessionUser.user_metadata?.name || '',
    username: `user_${userId.substring(0, 8)}`,
    role: null,  // ← Always NULL for new users
    avatar_url: sessionUser.user_metadata?.picture || null,
    is_verified: 'no'
  };
  
  await userApi.createUser(newUser);
}
```

### 4. Routing Logic
**File: `ProtectedRoute.jsx`**

```javascript
// Priority check - Role selection FIRST
if (needsRoleSelection) {  // This is TRUE when profile.role === null
  if (currentPath === '/role-selection') {
    return children; // Stay on role selection page
  }
  return <Navigate to="/role-selection" replace />;
}
```

### 5. User Selects Role
**File: `RoleSelection.jsx`**

```javascript
const handleSubmit = async (e) => {
  // Update user role in database
  await userApi.updateProfile(user.id, { role: selectedRole });
  
  // Refresh profile to get updated role
  await refreshProfile();
  
  // Redirect to dashboard
  navigate('/dashboard', { replace: true });
};
```

### 6. After Role Selected
- Profile now has `role: 'investor'` or `role: 'creator'`
- `needsRoleSelection` becomes `false`
- ProtectedRoute allows access to dashboard
- User can use the app normally

## Flow Diagram

```
Google Sign In
     ↓
Session Created
     ↓
loadUserData() called
     ↓
Check: User exists in DB?
     ↓
     ├─ NO → Create user with role=NULL
     │        ↓
     │   needsRoleSelection = true
     │        ↓
     │   Redirect to /role-selection
     │        ↓
     │   User selects role
     │        ↓
     │   Role saved to DB
     │        ↓
     └─ YES → Load existing profile
              ↓
         Check: Has role?
              ↓
              ├─ NO → Redirect to /role-selection
              │
              └─ YES → Allow access to dashboard
```

## Key Files Modified

1. **`AuthContext.jsx`**
   - `loadUserData()` - Creates users with role=NULL
   - `needsRoleSelection` - Checks if `profile.role` is null

2. **`ProtectedRoute.jsx`**
   - Priority: Role selection check happens first
   - Redirects to `/role-selection` if role is NULL

3. **`RoleSelection.jsx`**
   - UI for selecting Investor or Creator
   - Updates `users.role` in database

4. **`Login.jsx`**
   - Checks profile.role after auth
   - Redirects to role selection or dashboard

5. **`api.js`**
   - `getProfile()` - Uses `.maybeSingle()` to avoid errors
   - `createUser()` - Inserts new user into database

## Testing

1. **Clear cache**: `localStorage.clear()` in browser console
2. **Sign out** if logged in
3. **Click "Sign in with Google"**
4. **Expected**:
   - First time: See role selection page
   - Select role → Go to dashboard
   - Sign out and sign in again → Go directly to dashboard

## Database Schema

```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  username TEXT UNIQUE,
  role TEXT,  -- NULL | 'investor' | 'creator' | 'admin'
  avatar_url TEXT,
  is_verified TEXT DEFAULT 'no'
);
```

## Important Notes

- **Role is always NULL for new Google users**
- **Existing users (by email) load their saved role**
- **Role selection is mandatory** - can't access app without it
- **Once role is selected, it's permanent** (can't change later)
