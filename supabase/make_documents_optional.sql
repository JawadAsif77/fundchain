-- =============================================================================
-- MAKE DOCUMENT UPLOADS OPTIONAL IN USER_VERIFICATIONS TABLE
-- =============================================================================
-- This script updates the user_verifications table to make document uploads
-- optional until the Supabase storage bucket is properly configured
-- =============================================================================

-- Make id_document_url and selfie_image_url nullable
ALTER TABLE public.user_verifications 
ALTER COLUMN id_document_url DROP NOT NULL;

ALTER TABLE public.user_verifications 
ALTER COLUMN selfie_image_url DROP NOT NULL;

-- Add comments to document the change
COMMENT ON COLUMN public.user_verifications.id_document_url IS 'Government ID document URL - optional until storage is configured';
COMMENT ON COLUMN public.user_verifications.selfie_image_url IS 'Selfie image URL - optional until storage is configured';

-- Verification: Check that the columns are now nullable
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'user_verifications' 
AND column_name IN ('id_document_url', 'selfie_image_url');