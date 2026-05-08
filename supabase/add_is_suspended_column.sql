-- Add is_suspended column to users table
ALTER TABLE public.users 
ADD COLUMN is_suspended boolean DEFAULT false;

-- Create an index on is_suspended for better query performance
CREATE INDEX idx_users_is_suspended ON public.users(is_suspended);
