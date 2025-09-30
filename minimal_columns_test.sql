-- Minimal column additions - add only the most essential columns first
-- Run this FIRST, then test profile saving

-- Add bio column (most commonly used)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add location and phone (basic info)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add social_links JSON column for social media
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

-- Test the update by trying to update a user with bio
-- Replace 'your-user-id-here' with your actual user ID
-- UPDATE public.users SET bio = 'Test bio update' WHERE id = 'your-user-id-here';

-- Check if the update worked
SELECT id, email, full_name, bio, location, phone, social_links 
FROM public.users 
LIMIT 3;