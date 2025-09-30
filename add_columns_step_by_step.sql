-- Step-by-step approach to add columns safely
-- Run these one by one if the combined script has issues

-- Step 1: Add basic profile columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Step 2: Add username (might need to handle uniqueness separately)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;

-- Step 3: Add JSON columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Step 4: Add numeric columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_level INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trust_score DECIMAL(3,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_invested DECIMAL(15,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_campaigns_backed INTEGER DEFAULT 0;

-- Step 5: Add text columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Step 6: Add boolean columns (this is where the error occurred)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_accredited_investor BOOLEAN DEFAULT FALSE;

-- Step 7: Add timestamp columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 8: Create enum and add role column
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('investor', 'creator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role user_role;

-- Step 9: Add unique constraints (after columns exist)
DO $$ 
BEGIN
    -- Add unique constraint to username if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'users_username_key' 
                   AND table_name = 'users' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
    
    -- Add unique constraint to referral_code if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'users_referral_code_key' 
                   AND table_name = 'users' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
    END IF;
END $$;

-- Step 10: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON public.users(updated_at);