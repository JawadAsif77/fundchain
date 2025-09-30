-- Quick fix for RLS infinite recursion
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;