-- =============================================================================
-- USER VERIFICATIONS TABLE FOR KYC FUNCTIONALITY
-- =============================================================================
-- This creates a comprehensive user verification system for KYC compliance
-- Includes legal name, address, contact info, documents, and admin approval
-- =============================================================================

-- Drop everything in reverse order to avoid dependency issues
DROP TABLE IF EXISTS public.user_verifications CASCADE;
DROP FUNCTION IF EXISTS approve_user_verification(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS reject_user_verification(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_user_verifications_updated_at() CASCADE;
DROP FUNCTION IF EXISTS set_user_verification_pending() CASCADE;
DROP TYPE IF EXISTS kyc_verification_status CASCADE;
DROP TYPE IF EXISTS kyc_verification_type CASCADE;

-- Create verification status enum
CREATE TYPE kyc_verification_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- Create verification type enum  
CREATE TYPE kyc_verification_type AS ENUM ('individual', 'business');

-- Create the user_verifications table
CREATE TABLE public.user_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- KYC Information
    legal_name TEXT NOT NULL,
    legal_address JSONB NOT NULL, -- {line1, line2, city, state, postal_code, country}
    phone TEXT NOT NULL,
    legal_email CITEXT NOT NULL,
    business_email CITEXT NULL, -- Optional business email
    
    -- Document URLs (stored in Supabase Storage)
    id_document_url TEXT NULL, -- Government ID (front/back or combined) - optional for now
    selfie_image_url TEXT NULL, -- Selfie for identity verification - optional for now
    
    -- Verification Details
    verification_type kyc_verification_type NOT NULL DEFAULT 'individual',
    verification_status kyc_verification_status NOT NULL DEFAULT 'pending',
    
    -- Admin Review Fields
    reviewed_by UUID NULL, -- Admin user ID who reviewed
    reviewed_at TIMESTAMP WITH TIME ZONE NULL,
    rejection_reason TEXT NULL, -- Reason if rejected
    admin_notes TEXT NULL, -- Internal admin notes
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT user_verifications_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT user_verifications_reviewed_by_fkey 
        FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT user_verifications_user_id_unique 
        UNIQUE (user_id), -- One verification per user
    
    -- JSON validation for legal_address
    CONSTRAINT legal_address_structure CHECK (
        legal_address ? 'line1' AND
        legal_address ? 'city' AND 
        legal_address ? 'state' AND
        legal_address ? 'postal_code' AND
        legal_address ? 'country'
    )
);

-- Create indexes for performance
CREATE INDEX idx_user_verifications_user_id 
    ON user_verifications(user_id);
CREATE INDEX idx_user_verifications_status 
    ON user_verifications(verification_status);
CREATE INDEX idx_user_verifications_legal_email 
    ON user_verifications(legal_email);
CREATE INDEX idx_user_verifications_business_email 
    ON user_verifications(business_email);
CREATE INDEX idx_user_verifications_submitted_at 
    ON user_verifications(submitted_at);
CREATE INDEX idx_user_verifications_reviewed_by 
    ON user_verifications(reviewed_by);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_user_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trg_user_verifications_updated_at 
    BEFORE UPDATE ON user_verifications
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_verifications_updated_at();

-- Enable Row Level Security
ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Policy: Users can view their own verification record
CREATE POLICY "user_verifications_select_own" ON user_verifications
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own verification record
CREATE POLICY "user_verifications_insert_own" ON user_verifications
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own verification record (only if pending)
CREATE POLICY "user_verifications_update_own" ON user_verifications
    FOR UPDATE 
    USING (
        auth.uid() = user_id AND 
        verification_status = 'pending'
    )
    WITH CHECK (
        auth.uid() = user_id AND 
        verification_status = 'pending'
    );

-- Policy: Admins can view all verification records
CREATE POLICY "user_verifications_admin_select" ON user_verifications
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy: Admins can update verification records (for approval/rejection)
CREATE POLICY "user_verifications_admin_update" ON user_verifications
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy: Admins can delete verification records
CREATE POLICY "user_verifications_admin_delete" ON user_verifications
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to approve a user verification
CREATE OR REPLACE FUNCTION approve_user_verification(
    verification_id UUID,
    admin_notes_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user_id for this verification
    SELECT user_id INTO target_user_id 
    FROM user_verifications 
    WHERE id = verification_id;
    
    IF target_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update verification record
    UPDATE user_verifications 
    SET 
        verification_status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        admin_notes = admin_notes_param
    WHERE id = verification_id;
    
    -- Update user's verification status
    UPDATE public.users 
    SET is_verified = 'yes'
    WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a user verification
CREATE OR REPLACE FUNCTION reject_user_verification(
    verification_id UUID,
    rejection_reason_param TEXT,
    admin_notes_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user_id for this verification
    SELECT user_id INTO target_user_id 
    FROM user_verifications 
    WHERE id = verification_id;
    
    IF target_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update verification record
    UPDATE user_verifications 
    SET 
        verification_status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        rejection_reason = rejection_reason_param,
        admin_notes = admin_notes_param
    WHERE id = verification_id;
    
    -- Update user's verification status back to 'no'
    UPDATE public.users 
    SET is_verified = 'no'
    WHERE id = target_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically set user to 'pending' when KYC is submitted
CREATE OR REPLACE FUNCTION set_user_verification_pending()
RETURNS TRIGGER AS $$
BEGIN
    -- Set user verification status to 'pending' when KYC is submitted
    UPDATE public.users 
    SET is_verified = 'pending'
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set user to pending on KYC submission
CREATE TRIGGER trg_set_user_pending_on_kyc_submit
    AFTER INSERT ON user_verifications
    FOR EACH ROW 
    EXECUTE FUNCTION set_user_verification_pending();

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Grant permissions
GRANT ALL ON user_verifications TO authenticated;
GRANT SELECT ON user_verifications TO anon;
GRANT EXECUTE ON FUNCTION approve_user_verification(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_user_verification(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_verification_pending() TO authenticated;

-- =============================================================================
-- STORAGE BUCKET FOR KYC DOCUMENTS
-- =============================================================================

-- Create storage bucket for KYC documents (run this in Supabase Dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Create storage policies for KYC documents
-- CREATE POLICY "Users can upload their KYC documents" ON storage.objects
--     FOR INSERT WITH CHECK (
--         bucket_id = 'kyc-documents' AND 
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- CREATE POLICY "Users can view their KYC documents" ON storage.objects
--     FOR SELECT USING (
--         bucket_id = 'kyc-documents' AND 
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- CREATE POLICY "Admins can view all KYC documents" ON storage.objects
--     FOR SELECT USING (
--         bucket_id = 'kyc-documents' AND
--         EXISTS (
--             SELECT 1 FROM public.users 
--             WHERE users.id = auth.uid() 
--             AND users.role = 'admin'
--         )
--     );

COMMENT ON TABLE user_verifications IS 'KYC verification records for user identity verification';
COMMENT ON COLUMN user_verifications.legal_address IS 'JSON object with address fields: {line1, line2?, city, state, postal_code, country}';
COMMENT ON COLUMN user_verifications.id_document_url IS 'URL to government ID document in Supabase Storage';
COMMENT ON COLUMN user_verifications.selfie_image_url IS 'URL to selfie photo for identity verification';