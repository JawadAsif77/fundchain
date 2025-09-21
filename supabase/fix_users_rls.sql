-- =============================================================================
-- FIX USERS TABLE RLS POLICIES
-- =============================================================================
-- This file fixes RLS policies for the users table to allow role selection
-- Run this after Phase 3 schema deployment

-- Drop existing policies that might conflict (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view public user info" ON public.users;

-- Add policies for users to manage their own records
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Alternative approach: If the above doesn't work, temporarily disable RLS
-- (uncomment the line below if policies still cause issues)
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;