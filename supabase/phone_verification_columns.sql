-- Quick Phone Verification Columns Migration
-- Add only the essential columns needed for phone verification

-- Add phone verification columns if they don't exist
DO $$ 
BEGIN
    -- Add phone_country_code column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_verifications' 
                   AND column_name='phone_country_code') THEN
        ALTER TABLE public.user_verifications ADD COLUMN phone_country_code text;
    END IF;

    -- Add phone_verified column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_verifications' 
                   AND column_name='phone_verified') THEN
        ALTER TABLE public.user_verifications ADD COLUMN phone_verified boolean DEFAULT false;
    END IF;

    -- Add phone_verified_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_verifications' 
                   AND column_name='phone_verified_at') THEN
        ALTER TABLE public.user_verifications ADD COLUMN phone_verified_at timestamptz;
    END IF;

    -- Add phone_otp_code column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_verifications' 
                   AND column_name='phone_otp_code') THEN
        ALTER TABLE public.user_verifications ADD COLUMN phone_otp_code text;
    END IF;

    -- Add phone_otp_expires_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_verifications' 
                   AND column_name='phone_otp_expires_at') THEN
        ALTER TABLE public.user_verifications ADD COLUMN phone_otp_expires_at timestamptz;
    END IF;

    -- Add phone_otp_attempts column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_verifications' 
                   AND column_name='phone_otp_attempts') THEN
        ALTER TABLE public.user_verifications ADD COLUMN phone_otp_attempts integer DEFAULT 0;
    END IF;
END $$;

-- Create index for phone verification queries
CREATE INDEX IF NOT EXISTS idx_user_verifications_phone_verified 
ON public.user_verifications(phone_verified);
