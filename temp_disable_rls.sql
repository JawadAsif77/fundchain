-- TEMPORARY FIX: Disable RLS to resolve infinite recursion
-- Run this immediately in Supabase SQL Editor to fix the profile loading issue

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- This will allow the profile data to load properly
-- After confirming it works, we can re-enable RLS with better policies