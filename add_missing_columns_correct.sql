-- Corrected SQL based on your actual table structure
-- Your table already has: id, email, username, full_name, avatar_url, role, 
-- linkedin_url, twitter_url, instagram_url, is_verified (enum), created_at, updated_at

-- Add the missing columns that your profile form needs
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add JSON columns for social links and preferences
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Add Phase 2 enhanced fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_level INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trust_score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Add investment tracking columns (using boolean type for new columns)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_accredited_investor BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_invested DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_campaigns_backed INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON public.users(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_bio ON public.users(bio);
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(location);

-- Update existing records to have default values (correctly handling the enum type)
UPDATE public.users 
SET 
    verification_level = COALESCE(verification_level, 0),
    trust_score = COALESCE(trust_score, 0),
    total_invested = COALESCE(total_invested, 0),
    total_campaigns_backed = COALESCE(total_campaigns_backed, 0),
    followers_count = COALESCE(followers_count, 0),
    following_count = COALESCE(following_count, 0),
    is_accredited_investor = COALESCE(is_accredited_investor, FALSE),
    social_links = COALESCE(social_links, '{}'),
    preferences = COALESCE(preferences, '{}')
WHERE 
    verification_level IS NULL 
    OR trust_score IS NULL 
    OR total_invested IS NULL 
    OR total_campaigns_backed IS NULL 
    OR followers_count IS NULL 
    OR following_count IS NULL 
    OR is_accredited_investor IS NULL 
    OR social_links IS NULL 
    OR preferences IS NULL;