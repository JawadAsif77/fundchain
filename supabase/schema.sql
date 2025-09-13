-- =============================================================================
-- INVESTMENT PLATFORM DATABASE SCHEMA
-- =============================================================================
-- Complete schema for the investment/crowdfunding platform
-- Includes all tables, relationships, RLS policies, and functions
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Campaign status enumeration
CREATE TYPE campaign_status AS ENUM (
    'draft',
    'pending_review',
    'active',
    'successful',
    'failed',
    'cancelled'
);

-- Investment status enumeration
CREATE TYPE investment_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'refunded'
);

-- Transaction type enumeration
CREATE TYPE transaction_type AS ENUM (
    'investment',
    'refund',
    'payout',
    'fee'
);

-- Notification type enumeration
CREATE TYPE notification_type AS ENUM (
    'campaign_update',
    'investment_confirmed',
    'milestone_completed',
    'campaign_successful',
    'campaign_failed',
    'payout_received'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    phone TEXT,
    date_of_birth DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_accredited_investor BOOLEAN DEFAULT FALSE,
    total_invested DECIMAL(15,2) DEFAULT 0,
    total_campaigns_backed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table
CREATE TABLE public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE public.campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    image_url TEXT,
    gallery_images TEXT[], -- Array of image URLs
    video_url TEXT,
    funding_goal DECIMAL(15,2) NOT NULL CHECK (funding_goal > 0),
    current_funding DECIMAL(15,2) DEFAULT 0,
    min_investment DECIMAL(10,2) DEFAULT 100 CHECK (min_investment > 0),
    max_investment DECIMAL(15,2),
    investor_count INTEGER DEFAULT 0,
    equity_percentage DECIMAL(5,2), -- For equity campaigns
    expected_return DECIMAL(5,2), -- Expected annual return percentage
    risk_level INTEGER CHECK (risk_level BETWEEN 1 AND 5), -- 1 = Low, 5 = High
    status campaign_status DEFAULT 'draft',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    documents JSONB DEFAULT '[]', -- Array of document objects
    business_plan_url TEXT,
    financial_projections JSONB,
    team_members JSONB DEFAULT '[]', -- Array of team member objects
    location TEXT,
    industry TEXT,
    tags TEXT[],
    featured BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_dates CHECK (end_date > start_date),
    CONSTRAINT valid_funding CHECK (current_funding <= funding_goal),
    CONSTRAINT valid_investment_range CHECK (max_investment IS NULL OR max_investment >= min_investment)
);

-- Campaign updates/milestones table
CREATE TABLE public.milestones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_amount DECIMAL(15,2),
    target_date DATE,
    is_completed BOOLEAN DEFAULT FALSE,
    completion_date TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    attachments JSONB DEFAULT '[]', -- Array of attachment objects
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investments table
CREATE TABLE public.investments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    investor_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    status investment_status DEFAULT 'pending',
    payment_method TEXT,
    payment_reference TEXT,
    stripe_payment_intent_id TEXT,
    investment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(15,2),
    refund_reason TEXT,
    equity_shares DECIMAL(10,4), -- Number of shares if equity investment
    certificate_url TEXT, -- URL to investment certificate
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique investment per user per campaign (if needed)
    UNIQUE(investor_id, campaign_id)
);

-- Transaction history table
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    type transaction_type NOT NULL,
    description TEXT,
    payment_method TEXT,
    payment_reference TEXT,
    stripe_charge_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional data for the notification
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites/Watchlist table
CREATE TABLE public.favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, campaign_id)
);

-- Comments table
CREATE TABLE public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE, -- For nested comments
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Performance indexes
CREATE INDEX idx_campaigns_creator ON public.campaigns(creator_id);
CREATE INDEX idx_campaigns_category ON public.campaigns(category_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_featured ON public.campaigns(featured) WHERE featured = true;
CREATE INDEX idx_campaigns_end_date ON public.campaigns(end_date);
CREATE INDEX idx_campaigns_current_funding ON public.campaigns(current_funding);

CREATE INDEX idx_investments_investor ON public.investments(investor_id);
CREATE INDEX idx_investments_campaign ON public.investments(campaign_id);
CREATE INDEX idx_investments_status ON public.investments(status);
CREATE INDEX idx_investments_date ON public.investments(investment_date);

CREATE INDEX idx_milestones_campaign ON public.milestones(campaign_id);
CREATE INDEX idx_milestones_order ON public.milestones(campaign_id, order_index);

CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_campaign ON public.transactions(campaign_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_date ON public.transactions(created_at);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_comments_campaign ON public.comments(campaign_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update campaign funding when investment is confirmed
CREATE OR REPLACE FUNCTION update_campaign_funding()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
        -- Add to campaign funding
        UPDATE public.campaigns 
        SET 
            current_funding = current_funding + NEW.amount,
            investor_count = investor_count + 1,
            updated_at = NOW()
        WHERE id = NEW.campaign_id;
        
        -- Update user total invested
        UPDATE public.users
        SET 
            total_invested = total_invested + NEW.amount,
            total_campaigns_backed = total_campaigns_backed + 1,
            updated_at = NOW()
        WHERE id = NEW.investor_id;
        
    ELSIF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
        -- Remove from campaign funding (refund case)
        UPDATE public.campaigns 
        SET 
            current_funding = current_funding - OLD.amount,
            investor_count = investor_count - 1,
            updated_at = NOW()
        WHERE id = OLD.campaign_id;
        
        -- Update user total invested
        UPDATE public.users
        SET 
            total_invested = total_invested - OLD.amount,
            total_campaigns_backed = total_campaigns_backed - 1,
            updated_at = NOW()
        WHERE id = OLD.investor_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to check if campaign goal is reached
CREATE OR REPLACE FUNCTION check_campaign_goal()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_funding >= NEW.funding_goal AND OLD.current_funding < OLD.funding_goal THEN
        -- Campaign has reached its goal
        UPDATE public.campaigns
        SET status = 'successful'
        WHERE id = NEW.id AND status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated at triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON public.campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at 
    BEFORE UPDATE ON public.milestones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at 
    BEFORE UPDATE ON public.investments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Business logic triggers
CREATE TRIGGER update_campaign_funding_trigger
    AFTER INSERT OR UPDATE ON public.investments
    FOR EACH ROW EXECUTE FUNCTION update_campaign_funding();

CREATE TRIGGER check_campaign_goal_trigger
    AFTER UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION check_campaign_goal();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles" ON public.users
    FOR SELECT USING (true); -- Allow viewing basic user info

-- Campaigns policies
CREATE POLICY "Anyone can view published campaigns" ON public.campaigns
    FOR SELECT USING (status IN ('active', 'successful', 'failed'));

CREATE POLICY "Campaign creators can view their own campaigns" ON public.campaigns
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Campaign creators can update their own campaigns" ON public.campaigns
    FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can create campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Milestones policies
CREATE POLICY "Anyone can view milestones of visible campaigns" ON public.milestones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id 
            AND (status IN ('active', 'successful', 'failed') OR creator_id = auth.uid())
        )
    );

CREATE POLICY "Campaign creators can manage milestones" ON public.milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id AND creator_id = auth.uid()
        )
    );

-- Investments policies
CREATE POLICY "Users can view their own investments" ON public.investments
    FOR SELECT USING (auth.uid() = investor_id);

CREATE POLICY "Campaign creators can view investments in their campaigns" ON public.investments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id AND creator_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create investments" ON public.investments
    FOR INSERT WITH CHECK (auth.uid() = investor_id);

CREATE POLICY "Users can update their own investments" ON public.investments
    FOR UPDATE USING (auth.uid() = investor_id);

-- Transactions policies
CREATE POLICY "Users can view their own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (true); -- System-generated

-- Favorites policies
CREATE POLICY "Users can manage their own favorites" ON public.favorites
    FOR ALL USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can view comments on visible campaigns" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id 
            AND status IN ('active', 'successful', 'failed')
        )
    );

CREATE POLICY "Authenticated users can create comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

-- Categories policies (public read)
CREATE POLICY "Anyone can view categories" ON public.categories
    FOR SELECT USING (true);

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert default categories
INSERT INTO public.categories (name, description, icon, color) VALUES
('Technology', 'Software, hardware, and tech innovations', 'laptop', '#3B82F6'),
('Healthcare', 'Medical devices, health tech, and wellness', 'heart', '#EF4444'),
('Fintech', 'Financial technology and services', 'banknote', '#10B981'),
('E-commerce', 'Online retail and marketplace platforms', 'shopping-cart', '#F59E0B'),
('Real Estate', 'Property development and real estate tech', 'building', '#8B5CF6'),
('Energy', 'Renewable energy and sustainability', 'lightning-bolt', '#06B6D4'),
('Food & Beverage', 'Food tech, restaurants, and beverages', 'cake', '#F97316'),
('Education', 'EdTech and educational platforms', 'academic-cap', '#84CC16'),
('Entertainment', 'Gaming, media, and entertainment', 'film', '#EC4899'),
('Transportation', 'Mobility and transportation solutions', 'truck', '#6B7280');

-- =============================================================================
-- VIEWS (Optional - for easier querying)
-- =============================================================================

-- View for campaign statistics
CREATE VIEW campaign_stats AS
SELECT 
    c.*,
    u.full_name as creator_name,
    u.avatar_url as creator_avatar,
    cat.name as category_name,
    cat.color as category_color,
    ROUND((c.current_funding / c.funding_goal) * 100, 2) as funding_percentage,
    CASE 
        WHEN c.end_date < NOW() AND c.current_funding < c.funding_goal THEN 'failed'
        WHEN c.current_funding >= c.funding_goal THEN 'successful'
        ELSE c.status::text
    END as computed_status,
    EXTRACT(DAYS FROM (c.end_date - NOW())) as days_remaining
FROM public.campaigns c
LEFT JOIN public.users u ON c.creator_id = u.id
LEFT JOIN public.categories cat ON c.category_id = cat.id;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.users IS 'Extended user profiles for investment platform users';
COMMENT ON TABLE public.campaigns IS 'Investment campaigns/opportunities';
COMMENT ON TABLE public.investments IS 'User investments in campaigns';
COMMENT ON TABLE public.milestones IS 'Campaign milestones and updates';
COMMENT ON TABLE public.transactions IS 'Financial transaction history';
COMMENT ON TABLE public.notifications IS 'User notifications';
COMMENT ON TABLE public.favorites IS 'User favorite campaigns';
COMMENT ON TABLE public.comments IS 'Campaign comments and discussions';
COMMENT ON TABLE public.categories IS 'Campaign categories';

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================