-- =============================================================================
-- PROFILE SYSTEM DATABASE MIGRATION
-- =============================================================================
-- This file documents all the database schema updates made for the Profile System
-- Date: September 30, 2025
-- Version: 3.1.0 Profile System Enhancement
--
-- These changes have been incorporated into the main schema.sql file
-- Run this migration if you have an existing database that needs updating
-- =============================================================================

-- 1. Add verified_status enum (if not exists)
DO $$ BEGIN
    CREATE TYPE verified_status AS ENUM ('no', 'pending', 'yes');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add missing columns to users table for profile system
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- 3. Modify is_verified column to use enum instead of boolean
-- WARNING: This will lose existing boolean data - run only if acceptable
-- ALTER TABLE public.users ALTER COLUMN is_verified TYPE verified_status USING 
--   CASE 
--     WHEN is_verified = true THEN 'yes'::verified_status 
--     WHEN is_verified = false THEN 'no'::verified_status 
--     ELSE 'no'::verified_status 
--   END;

-- 4. Update role column to have default value instead of NULL
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'investor';

-- 5. Update existing NULL roles to default value
UPDATE public.users SET role = 'investor' WHERE role IS NULL;

-- 6. Make role column NOT NULL
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;

-- 7. Create new indexes for profile system
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON public.users(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_bio ON public.users(bio) WHERE bio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON public.users(is_verified);

-- 8. Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
AND column_name IN (
    'username', 'linkedin_url', 'twitter_url', 'instagram_url', 
    'is_verified', 'role', 'bio', 'location', 'social_links', 'preferences'
)
ORDER BY column_name;

-- =============================================================================
-- SUMMARY OF CHANGES
-- =============================================================================
--
-- New Enums:
-- - verified_status: ('no', 'pending', 'yes') - replaces boolean is_verified
--
-- Updated users table columns:
-- - username TEXT UNIQUE - for profile display
-- - linkedin_url TEXT - direct social media link
-- - twitter_url TEXT - direct social media link  
-- - instagram_url TEXT - direct social media link
-- - is_verified: changed from BOOLEAN to verified_status enum
-- - role: changed from NULL default to 'investor' default and NOT NULL
--
-- New Indexes:
-- - idx_users_username - for profile lookups
-- - idx_users_email - for user searches
-- - idx_users_updated_at - for recent activity
-- - idx_users_bio - for profile content searches
-- - idx_users_location - for location-based features
-- - idx_users_is_verified - for verification status filtering
--
-- =============================================================================