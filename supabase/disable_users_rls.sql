-- =============================================================================
-- QUICK FIX: DISABLE RLS ON USERS TABLE TEMPORARILY
-- =============================================================================
-- This temporarily disables RLS on users table to allow role selection
-- WARNING: This removes security - only for development/testing

-- Disable RLS on users table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Note: In production, you should add proper RLS policies instead of disabling RLS