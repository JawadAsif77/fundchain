-- =============================================================================
-- UPDATE USER ROLE ENUM TO INCLUDE ADMIN
-- =============================================================================
-- This adds the 'admin' role to the existing user_role enum
-- Required for the user_verifications RLS policies to work
-- =============================================================================

-- Add 'admin' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';

-- Optional: Create a default admin user (update with your actual admin email)
-- You can run this after creating the admin user account in Supabase Auth
/*
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin@fundchain.com'; -- Replace with your admin email
*/

COMMENT ON TYPE public.user_role IS 'User roles: investor, creator, admin';