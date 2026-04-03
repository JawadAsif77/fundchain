-- ============================================================
-- ENABLE RLS FOR USERS TABLE
-- Created: January 7, 2026
-- Purpose: Fix CORS-like errors by enabling Row Level Security
-- ============================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper to avoid recursive users-table policy checks.
-- SECURITY DEFINER allows checking admin role without triggering policy recursion.
CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = target_user_id
      AND u.role = 'admin'
  );
$$;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Admin can read all users" ON public.users;
DROP POLICY IF EXISTS "Admin can update any user" ON public.users;
DROP POLICY IF EXISTS "Admin can delete users" ON public.users;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile (for new signups)
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy: Public profiles are viewable by everyone (for creator/campaign pages)
CREATE POLICY "Public users are viewable by everyone"
ON public.users
FOR SELECT
USING (true);

-- Policy: Admin can read all users
CREATE POLICY "Admin can read all users"
ON public.users
FOR SELECT
USING (
  public.is_admin_user(auth.uid())
);

-- Policy: Admin can update any user
CREATE POLICY "Admin can update any user"
ON public.users
FOR UPDATE
USING (
  public.is_admin_user(auth.uid())
);

-- Policy: Admin can delete users
CREATE POLICY "Admin can delete users"
ON public.users
FOR DELETE
USING (
  public.is_admin_user(auth.uid())
);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
