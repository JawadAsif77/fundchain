-- =============================================================================
-- CREATE ADMIN USER FOR FUNDCHAIN
-- =============================================================================
-- This script creates an admin user account with login credentials
-- =============================================================================

-- First, insert into auth.users (this is the authentication table)
-- Note: You'll need to run this in Supabase SQL Editor and then 
-- manually create the auth user through Supabase Auth or use the dashboard

-- Step 1: Create the auth user first (do this through Supabase Dashboard Auth section)
-- Email: admin@fundchain.com
-- Password: AdminFund2024!
-- Confirm email: Yes

-- Step 2: After creating the auth user, get the user ID and run this:
-- (Replace the UUID below with the actual UUID from auth.users table)

-- You can get the auth user ID by running:
-- SELECT id, email FROM auth.users WHERE email = 'admin@fundchain.com';

-- Step 3: Insert into public.users table
-- Replace 'YOUR_AUTH_USER_ID_HERE' with the actual UUID from step 2

INSERT INTO public.users (
    id,
    email,
    username,
    full_name,
    role,
    is_verified,
    created_at,
    updated_at
) VALUES (
    'YOUR_AUTH_USER_ID_HERE'::uuid,  -- Replace with actual auth.users UUID
    'admin@fundchain.com',
    'admin',
    'FundChain Administrator',
    'admin',
    'yes',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_verified = 'yes',
    updated_at = NOW();

-- Verification query
SELECT 
    u.id,
    u.email,
    u.username,
    u.full_name,
    u.role,
    u.is_verified,
    u.created_at
FROM public.users u
WHERE u.email = 'admin@fundchain.com';

-- =============================================================================
-- ADMIN LOGIN CREDENTIALS
-- =============================================================================
-- Email: admin@fundchain.com
-- Password: AdminFund2024!
-- Role: admin
-- =============================================================================

-- Alternative: If you want to create everything programmatically (advanced)
-- You would need to use Supabase Admin API or create via the dashboard first