-- =============================================================================
-- USER PROFILE CREATION FUNCTION
-- =============================================================================
-- This function can be called to create a user profile, bypassing RLS issues
-- =============================================================================

-- Function to create user profile (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_username TEXT DEFAULT NULL,
  user_full_name TEXT DEFAULT NULL,
  user_role user_role DEFAULT 'investor',
  user_verified verified_status DEFAULT 'no'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with elevated privileges
AS $$
DECLARE
  result_data JSON;
BEGIN
  -- Insert the user profile
  INSERT INTO public.users (
    id, 
    email, 
    username, 
    full_name, 
    role, 
    is_verified,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_username,
    user_full_name,
    user_role,
    user_verified,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, users.username),
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW()
  RETURNING to_json(users.*) INTO result_data;
  
  RETURN result_data;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
      'error', TRUE,
      'message', SQLERRM,
      'code', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;