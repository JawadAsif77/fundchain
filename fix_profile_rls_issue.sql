-- =============================================================================
-- FIX PROFILE RLS INFINITE RECURSION ISSUE
-- =============================================================================
-- This script fixes the infinite recursion issue in RLS policies for users table
-- Run this in your Supabase SQL editor

-- First, drop all existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to read their own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert their own data" ON public.users;

-- Temporarily disable RLS to avoid recursion while creating policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (id = auth.uid());

-- Grant permissions
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- Test the policies by running a simple query
-- SELECT id, email, username, full_name FROM users WHERE id = auth.uid();