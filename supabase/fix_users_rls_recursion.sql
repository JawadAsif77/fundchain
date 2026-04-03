-- ============================================================
-- FIX: users table RLS recursion causing 500 on profile SELECT
-- Run this once in Supabase SQL Editor (production and dev DB)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper function for admin checks without recursive policy evaluation
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

-- Drop recursive admin policies on users table
DROP POLICY IF EXISTS "Admin can read all users" ON public.users;
DROP POLICY IF EXISTS "Admin can update any user" ON public.users;
DROP POLICY IF EXISTS "Admin can delete users" ON public.users;

-- Recreate non-recursive admin policies
CREATE POLICY "Admin can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin can update any user"
ON public.users
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin can delete users"
ON public.users
FOR DELETE
TO authenticated
USING (public.is_admin_user(auth.uid()));

NOTIFY pgrst, 'reload schema';
