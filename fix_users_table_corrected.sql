-- Add missing columns to users table if they don't exist
-- Note: Some of these might already exist, PostgreSQL will skip existing columns

-- Basic profile columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Username column (important for profile completion)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Social and metadata columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Phase 2 enhanced fields
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS verification_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trust_score DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Investment tracking columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_accredited_investor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_invested DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_campaigns_backed INTEGER DEFAULT 0;

-- Role column (Phase 3)
-- Create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('investor', 'creator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role user_role;

-- Timestamps
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON public.users(updated_at);

-- Update existing records to have default values (with proper type handling)
-- First, let's handle the columns that might have type conflicts
DO $$ 
BEGIN
    -- Check if is_verified column exists and update it
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'users' 
               AND column_name = 'is_verified' 
               AND data_type = 'boolean') THEN
        UPDATE public.users 
        SET is_verified = COALESCE(is_verified, FALSE)
        WHERE is_verified IS NULL;
    END IF;
    
    -- Check if is_accredited_investor column exists and update it
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'users' 
               AND column_name = 'is_accredited_investor' 
               AND data_type = 'boolean') THEN
        UPDATE public.users 
        SET is_accredited_investor = COALESCE(is_accredited_investor, FALSE)
        WHERE is_accredited_investor IS NULL;
    END IF;
END $$;

-- Update other columns safely
UPDATE public.users 
SET 
    verification_level = COALESCE(verification_level, 0),
    trust_score = COALESCE(trust_score, 0),
    total_invested = COALESCE(total_invested, 0),
    total_campaigns_backed = COALESCE(total_campaigns_backed, 0),
    followers_count = COALESCE(followers_count, 0),
    following_count = COALESCE(following_count, 0),
    social_links = COALESCE(social_links, '{}'),
    preferences = COALESCE(preferences, '{}'),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE 
    verification_level IS NULL 
    OR trust_score IS NULL 
    OR total_invested IS NULL 
    OR total_campaigns_backed IS NULL 
    OR followers_count IS NULL 
    OR following_count IS NULL 
    OR social_links IS NULL 
    OR preferences IS NULL 
    OR created_at IS NULL 
    OR updated_at IS NULL;