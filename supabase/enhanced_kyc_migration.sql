-- Enhanced KYC Migration Script
-- Adds additional fields to user_verifications table for comprehensive KYC

-- Add new columns to user_verifications table
ALTER TABLE public.user_verifications
  -- Additional personal information
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS source_of_funds text,
  ADD COLUMN IF NOT EXISTS purpose_of_platform text,
  
  -- Enhanced address fields (still keeping legal_address as JSONB for flexibility)
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS province_state text,
  ADD COLUMN IF NOT EXISTS country_code text, -- ISO country code
  
  -- Phone verification
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_otp_code text,
  ADD COLUMN IF NOT EXISTS phone_otp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_otp_attempts integer DEFAULT 0,
  
  -- ID document details
  ADD COLUMN IF NOT EXISTS id_type text CHECK (id_type IN ('passport', 'national_id', 'drivers_license', 'residence_permit')),
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS id_issue_date date,
  ADD COLUMN IF NOT EXISTS id_expiry_date date,
  ADD COLUMN IF NOT EXISTS id_issuing_country text,
  
  -- Additional documents
  ADD COLUMN IF NOT EXISTS proof_of_address_url text,
  ADD COLUMN IF NOT EXISTS additional_documents jsonb DEFAULT '[]'::jsonb,
  
  -- Emergency contact
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  
  -- Risk assessment
  ADD COLUMN IF NOT EXISTS risk_level text CHECK (risk_level IN ('low', 'medium', 'high')) DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS pep_status boolean DEFAULT false, -- Politically Exposed Person
  ADD COLUMN IF NOT EXISTS sanctions_check boolean DEFAULT false,
  
  -- Metadata
  ADD COLUMN IF NOT EXISTS submission_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_verifications_phone_verified ON public.user_verifications(phone_verified);
CREATE INDEX IF NOT EXISTS idx_user_verifications_country_code ON public.user_verifications(country_code);
CREATE INDEX IF NOT EXISTS idx_user_verifications_risk_level ON public.user_verifications(risk_level);

-- Create a table for phone verification logs
CREATE TABLE IF NOT EXISTS public.phone_verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  otp_code text NOT NULL,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_logs_user_id ON public.phone_verification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verification_logs_phone ON public.phone_verification_logs(phone);

-- Create a function to generate OTP
CREATE OR REPLACE FUNCTION generate_otp()
RETURNS text AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create a function to send phone OTP (placeholder - actual SMS integration needed)
CREATE OR REPLACE FUNCTION send_phone_otp(
  p_user_id uuid,
  p_phone text,
  p_country_code text
)
RETURNS jsonb AS $$
DECLARE
  v_otp text;
  v_expires_at timestamptz;
  v_result jsonb;
BEGIN
  -- Generate 6-digit OTP
  v_otp := generate_otp();
  v_expires_at := now() + interval '10 minutes';
  
  -- Update user_verifications with OTP
  UPDATE public.user_verifications
  SET 
    phone_otp_code = v_otp,
    phone_otp_expires_at = v_expires_at,
    phone_otp_attempts = 0,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the OTP request
  INSERT INTO public.phone_verification_logs (
    user_id,
    phone,
    otp_code,
    expires_at
  ) VALUES (
    p_user_id,
    p_phone,
    v_otp,
    v_expires_at
  );
  
  -- TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
  -- For now, return OTP in response (ONLY FOR DEVELOPMENT)
  v_result := jsonb_build_object(
    'success', true,
    'message', 'OTP sent successfully',
    'expires_at', v_expires_at,
    'otp', v_otp  -- REMOVE THIS IN PRODUCTION
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to verify phone OTP
CREATE OR REPLACE FUNCTION verify_phone_otp(
  p_user_id uuid,
  p_otp text
)
RETURNS jsonb AS $$
DECLARE
  v_stored_otp text;
  v_expires_at timestamptz;
  v_attempts integer;
  v_result jsonb;
BEGIN
  -- Get stored OTP data
  SELECT phone_otp_code, phone_otp_expires_at, phone_otp_attempts
  INTO v_stored_otp, v_expires_at, v_attempts
  FROM public.user_verifications
  WHERE user_id = p_user_id;
  
  -- Check if OTP exists
  IF v_stored_otp IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No OTP request found. Please request a new OTP.'
    );
  END IF;
  
  -- Check if OTP has expired
  IF v_expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'OTP has expired. Please request a new OTP.'
    );
  END IF;
  
  -- Check if too many attempts
  IF v_attempts >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Too many failed attempts. Please request a new OTP.'
    );
  END IF;
  
  -- Verify OTP
  IF v_stored_otp = p_otp THEN
    -- OTP is correct
    UPDATE public.user_verifications
    SET 
      phone_verified = true,
      phone_verified_at = now(),
      phone_otp_code = NULL,
      phone_otp_expires_at = NULL,
      phone_otp_attempts = 0,
      updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Update log
    UPDATE public.phone_verification_logs
    SET verified = true, verified_at = now()
    WHERE user_id = p_user_id AND otp_code = p_otp;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Phone verified successfully'
    );
  ELSE
    -- OTP is incorrect
    UPDATE public.user_verifications
    SET 
      phone_otp_attempts = phone_otp_attempts + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid OTP. Please try again.',
      'attempts_remaining', 5 - v_attempts - 1
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_phone_otp(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_phone_otp(uuid, text) TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN public.user_verifications.date_of_birth IS 'User date of birth for age verification';
COMMENT ON COLUMN public.user_verifications.phone_verified IS 'Whether phone number has been verified via OTP';
COMMENT ON COLUMN public.user_verifications.id_type IS 'Type of government-issued ID document';
COMMENT ON COLUMN public.user_verifications.pep_status IS 'Politically Exposed Person status for compliance';
COMMENT ON COLUMN public.user_verifications.risk_level IS 'KYC risk assessment level';
