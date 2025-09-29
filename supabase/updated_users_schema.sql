-- =============================================================================
-- UPDATED USERS TABLE SCHEMA FOR ROLE-BASED REGISTRATION
-- =============================================================================
-- This file updates the users table to match the requirements:
-- - Add verified_status enum with 'no' as default
-- - Add username field
-- - Add role field with proper enum
-- - Ensure proper indexes and constraints
-- =============================================================================

-- Create verified_status enum if it doesn't exist
CREATE TYPE public.verified_status AS ENUM ('no', 'pending', 'yes');

-- Create user_role enum if it doesn't exist  
CREATE TYPE public.user_role AS ENUM ('investor', 'creator');

-- Drop the existing users table and recreate with proper structure
-- WARNING: This will delete all user data - use only in development
DROP TABLE IF EXISTS public.users CASCADE;

-- Create the updated users table
CREATE TABLE public.users (
  id uuid not null default auth.uid (),
  email public.citext not null,
  username text null,
  full_name text null,
  avatar_url text null,
  role public.user_role not null default 'investor'::user_role,
  linkedin_url text null,
  twitter_url text null,
  instagram_url text null,
  is_verified public.verified_status not null default 'no'::verified_status,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_username_key unique (username),
  constraint users_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create indexes for performance
create index IF not exists idx_users_role on public.users using btree (role) TABLESPACE pg_default;
create index IF not exists idx_users_is_verified on public.users using btree (is_verified) TABLESPACE pg_default;
create index IF not exists idx_users_created_at on public.users using btree (created_at) TABLESPACE pg_default;
create index IF not exists idx_users_username on public.users using btree (username) TABLESPACE pg_default;

-- Create function to set updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
create trigger trg_users_set_updated_at BEFORE
update on users for EACH row
execute FUNCTION set_updated_at ();

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;