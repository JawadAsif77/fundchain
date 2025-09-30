-- Quick test to see if the database update worked
-- Run this after running the add_missing_columns_correct.sql

-- Check what columns exist now
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Sample the data to see what exists
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    bio,
    location,
    is_verified,
    created_at
FROM public.users 
LIMIT 5;