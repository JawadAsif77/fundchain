-- =============================================================================
-- BYPASS RLS WITH RPC FUNCTIONS FOR PROFILE OPERATIONS
-- =============================================================================
-- These functions will bypass RLS and work directly with security definer rights
-- Run this in Supabase SQL Editor

-- Function to get user profile (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_profile(user_id uuid)
RETURNS TABLE (
  id uuid,
  email citext,
  username text,
  full_name text,
  avatar_url text,
  role user_role,
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  is_verified verified_status,
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT 
    u.id,
    u.email,
    u.username,
    u.full_name,
    u.avatar_url,
    u.role,
    u.linkedin_url,
    u.twitter_url,
    u.instagram_url,
    u.is_verified,
    u.created_at,
    u.updated_at
  FROM public.users u 
  WHERE u.id = user_id;
$$;

-- Function to update user profile (bypasses RLS)
CREATE OR REPLACE FUNCTION update_user_profile(
  user_id uuid,
  p_full_name text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_linkedin_url text DEFAULT NULL,
  p_twitter_url text DEFAULT NULL,
  p_instagram_url text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email citext,
  username text,
  full_name text,
  role user_role,
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  is_verified verified_status,
  updated_at timestamptz
)
SECURITY DEFINER
LANGUAGE sql
AS $$
  UPDATE public.users 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    username = COALESCE(p_username, username),
    linkedin_url = COALESCE(p_linkedin_url, linkedin_url),
    twitter_url = COALESCE(p_twitter_url, twitter_url),
    instagram_url = COALESCE(p_instagram_url, instagram_url),
    updated_at = NOW()
  WHERE id = user_id
  RETURNING 
    id,
    email,
    username,
    full_name,
    role,
    linkedin_url,
    twitter_url,
    instagram_url,
    is_verified,
    updated_at;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile(uuid, text, text, text, text, text) TO authenticated;