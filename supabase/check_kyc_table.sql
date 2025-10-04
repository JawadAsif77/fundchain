-- =============================================================================
-- QUICK USER_VERIFICATIONS TABLE EXISTENCE CHECK
-- =============================================================================
-- Run this in Supabase SQL Editor to check if the table exists
-- If it doesn't exist, you need to run the schema.sql file first
-- =============================================================================

-- Check if user_verifications table exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_verifications'
    ) THEN
        RAISE NOTICE 'user_verifications table EXISTS ✅';
    ELSE
        RAISE NOTICE 'user_verifications table DOES NOT EXIST ❌ - Run schema.sql first!';
    END IF;
END $$;

-- Check the table structure if it exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_verifications'
ORDER BY ordinal_position;

-- Check if verification enums exist
SELECT 
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('kyc_verification_status', 'kyc_verification_type')
GROUP BY typname;