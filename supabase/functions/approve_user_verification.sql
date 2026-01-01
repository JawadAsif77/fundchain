-- ============================================================
-- FUNCTION: approve_user_verification
-- Purpose: Approve a user's KYC verification and update their status
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_user_verification(
  verification_id uuid,
  admin_notes_param text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the user_id from the verification record
  SELECT user_id INTO v_user_id
  FROM public.user_verifications
  WHERE id = verification_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Verification record not found';
  END IF;

  -- Update the verification record
  UPDATE public.user_verifications
  SET 
    verification_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_notes = admin_notes_param,
    updated_at = now()
  WHERE id = verification_id;

  -- Update the user's verification status in the users table
  UPDATE public.users
  SET 
    is_verified = 'verified',
    verification_level = 1,
    updated_at = now()
  WHERE id = v_user_id;

  -- Optional: Log the approval action
  -- INSERT INTO admin_audit_log (action, target_user_id, admin_id, details)
  -- VALUES ('approve_kyc', v_user_id, auth.uid(), jsonb_build_object('verification_id', verification_id));

END;
$$;

-- Grant execute permission to authenticated users (admin will be checked by RLS if needed)
GRANT EXECUTE ON FUNCTION public.approve_user_verification(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.approve_user_verification IS 
'Approves a KYC verification and updates the user verification status to verified';
