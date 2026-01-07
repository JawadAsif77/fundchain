-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy if it exists
DROP POLICY IF EXISTS "Allow public read access to user profiles" ON public.users;

-- Create policy to allow all authenticated users to read all user profiles
-- This is needed for the user search feature and public profiles
CREATE POLICY "Allow public read access to user profiles"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- Optionally, if you want unauthenticated users to also search:
DROP POLICY IF EXISTS "Allow anonymous read access to user profiles" ON public.users;

CREATE POLICY "Allow anonymous read access to user profiles"
ON public.users
FOR SELECT
TO anon
USING (true);
