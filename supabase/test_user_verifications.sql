-- =============================================================================
-- TEST USER VERIFICATIONS TABLE SETUP
-- =============================================================================
-- This script tests if the user_verifications table exists and creates test data
-- =============================================================================

-- First, check if the table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_verifications';

-- Check if the enums exist
SELECT typname 
FROM pg_type 
WHERE typname IN ('kyc_verification_status', 'kyc_verification_type');

-- If the table exists, check the structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_verifications'
ORDER BY ordinal_position;

-- Check for any existing pending verifications
SELECT COUNT(*) as pending_count
FROM user_verifications 
WHERE verification_status = 'pending';

-- Insert a test verification record if needed (replace with actual user ID)
-- First, get a creator user ID
SELECT id, email, role 
FROM public.users 
WHERE role = 'creator' 
LIMIT 1;

-- Insert test data (uncomment and update user_id if you want to test)
/*
INSERT INTO public.user_verifications (
    user_id,
    legal_name,
    legal_address,
    phone,
    legal_email,
    verification_type,
    verification_status
) VALUES (
    'YOUR_CREATOR_USER_ID_HERE'::uuid,  -- Replace with actual creator user ID
    'Test Creator',
    '{"line1": "123 Test St", "city": "Test City", "state": "TS", "postal_code": "12345", "country": "Test Country"}',
    '+1234567890',
    'testcreator@example.com',
    'individual',
    'pending'
);
*/