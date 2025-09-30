-- =============================================================================
-- FUNDCHAIN INVESTMENT PLATFORM DATABASE SCHEMA
-- =============================================================================
-- Complete schema for the investment/crowdfunding platform
-- Version: Phase 3 Complete + Profile System Enhancement (September 2025)
-- 
-- This schema includes:
-- - Phase 1: Core investment platform functionality
-- - Phase 2: GoFundMe-like social features, media management, verification
-- - Phase 3: Role-based authentication, project creation, KYC verification
-- - Profile System: Enhanced user profiles with display/edit functionality
--   • Two-page profile flow (ProfileDisplay → ProfileEdit)
--   • Enhanced user verification with verified_status enum
--   • Social media integration (LinkedIn, Twitter, Instagram)
--   • Username support for profile identification
--   • Comprehensive profile data management
-- - Enhanced user management with role selection (investor/creator)
-- - Project and company management for creators
-- - Comprehensive error handling and debugging support
-- - Performance optimization with indexes and triggers
-- - Comprehensive RLS security policies
-- - Automatic user record creation triggers
-- 
-- RECENT PROFILE SYSTEM UPDATES:
-- - Added verified_status enum ('no', 'pending', 'yes')
-- - Added username field with unique constraint
-- - Added individual social media URL fields
-- - Modified role field to have default value and NOT NULL constraint
-- - Added profile-specific database indexes
-- - Enhanced user table structure for profile display functionality
-- 
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CORE ENUMS (Phase 1)
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
-- ENHANCED ENUMS (Phase 2)
-- =============================================================================

-- Media types for campaign content
CREATE TYPE media_type AS ENUM ('image', 'video', 'document', 'audio');

-- User verification types for trust and safety
CREATE TYPE verification_type AS ENUM ('email', 'phone', 'identity', 'business', 'bank_account');

-- Verification status tracking
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- Payment method types for user wallets
CREATE TYPE payment_method_type AS ENUM ('card', 'bank_account', 'paypal', 'crypto_wallet');

-- Enhanced campaign types for different funding models
CREATE TYPE campaign_type AS ENUM ('donation', 'equity', 'reward', 'debt');

-- Funding models (All-or-Nothing vs Keep-It-All)
CREATE TYPE funding_model AS ENUM ('all_or_nothing', 'keep_it_all', 'flexible');

-- =============================================================================
-- PHASE 3 ENUMS (Role-based Authentication)
-- =============================================================================

-- User roles for platform access control
CREATE TYPE user_role AS ENUM ('investor', 'creator');

-- User verification status for enhanced verification system
CREATE TYPE verified_status AS ENUM ('no', 'pending', 'yes');

-- Company verification status for creators
CREATE TYPE company_status AS ENUM ('pending', 'verified', 'rejected', 'incomplete');

-- Project status enumeration (similar to campaigns but for Phase 3)
CREATE TYPE project_status AS ENUM (
    'draft',
    'under_review',
    'active',
    'funded',
    'completed',
    'cancelled'
);

-- =============================================================================
-- CORE TABLES (Phase 1)
-- =============================================================================

-- Users table (extends Supabase auth.users)
-- Enhanced with Phase 2 social features, Phase 3 role management, and Profile System
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT UNIQUE, -- Added for profile system
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    phone TEXT,
    date_of_birth DATE,
    
    -- Core verification and investment tracking
    is_verified verified_status DEFAULT 'no', -- Changed from BOOLEAN to enum
    is_accredited_investor BOOLEAN DEFAULT FALSE,
    total_invested DECIMAL(15,2) DEFAULT 0,
    total_campaigns_backed INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Phase 2 Enhanced Fields
    verification_level INTEGER DEFAULT 0,
    trust_score DECIMAL(3,2) DEFAULT 0,
    referral_code TEXT UNIQUE,
    social_links JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    last_active_at TIMESTAMP WITH TIME ZONE,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    
    -- Phase 3 Role Management
    role user_role NOT NULL DEFAULT 'investor', -- Changed from NULL to have default
    
    -- Social Media Links (separate columns for easier access)
    linkedin_url TEXT,
    twitter_url TEXT,
    instagram_url TEXT
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

-- Campaigns table (enhanced with Phase 2 social features)
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
    
    -- Phase 2 Enhanced Fields
    campaign_type campaign_type DEFAULT 'donation',
    funding_model funding_model DEFAULT 'all_or_nothing',
    social_sharing_enabled BOOLEAN DEFAULT TRUE,
    updates_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    seo_title TEXT,
    seo_description TEXT,
    external_links JSONB DEFAULT '{}',
    
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
-- PHASE 2 ENHANCED TABLES (GoFundMe-like Features)
-- =============================================================================

-- Media management for campaigns (images, videos, documents)
CREATE TABLE public.campaign_media (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    type media_type NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    thumbnail_url TEXT,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social interactions - campaign likes
CREATE TABLE public.campaign_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, user_id)
);

-- Social sharing tracking for viral growth
CREATE TABLE public.campaign_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    platform TEXT, -- 'facebook', 'twitter', 'linkedin', 'email'
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced commenting system with likes
CREATE TABLE public.comment_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- User verification system for trust and safety
CREATE TABLE public.user_verifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    verification_type verification_type NOT NULL,
    status verification_status DEFAULT 'pending',
    document_url TEXT,
    verified_by UUID REFERENCES public.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User payment methods for seamless transactions
CREATE TABLE public.user_payment_methods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type payment_method_type NOT NULL,
    provider TEXT, -- 'stripe', 'paypal', 'bank'
    external_id TEXT, -- Stripe customer ID, etc.
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign updates/announcements for ongoing communication
CREATE TABLE public.campaign_updates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    media_urls TEXT[],
    sent_to_investors BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral and tracking system for growth
CREATE TABLE public.referrals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    referrer_id UUID REFERENCES public.users(id),
    referred_id UUID REFERENCES public.users(id),
    campaign_id UUID REFERENCES public.campaigns(id),
    source TEXT, -- 'social', 'email', 'direct'
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    conversion_at TIMESTAMP WITH TIME ZONE,
    reward_amount DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved search filters for user convenience
CREATE TABLE public.search_filters (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    name TEXT,
    filters JSONB NOT NULL,
    is_saved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email campaigns and newsletters for marketing
CREATE TABLE public.email_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id),
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    recipient_type TEXT, -- 'all', 'investors', 'followers'
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User following system for social networking
CREATE TABLE public.user_follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK(follower_id != following_id)
);

-- Campaign views tracking for analytics
CREATE TABLE public.campaign_views (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- PHASE 3 SPECIFIC TABLES (Role-based Features)
-- =============================================================================

-- Companies table for creator KYC and verification
CREATE TABLE public.companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    company_name TEXT NOT NULL,
    company_type TEXT, -- 'LLC', 'Corporation', 'Partnership', etc.
    registration_number TEXT,
    tax_id TEXT,
    website TEXT,
    description TEXT,
    industry TEXT,
    founded_date DATE,
    headquarters_location TEXT,
    employees_count INTEGER,
    annual_revenue DECIMAL(15,2),
    
    -- Contact Information
    contact_email TEXT,
    contact_phone TEXT,
    contact_address JSONB, -- {street, city, state, zip, country}
    
    -- Legal Documentation
    incorporation_documents JSONB DEFAULT '[]', -- Array of document URLs
    tax_documents JSONB DEFAULT '[]',
    financial_statements JSONB DEFAULT '[]',
    
    -- Verification Status
    verified BOOLEAN DEFAULT FALSE,
    verification_status company_status DEFAULT 'pending',
    verification_notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES public.users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one company per user for now
    UNIQUE(owner_id)
);

-- Projects table (Phase 3 evolution of campaigns)
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    
    -- Basic Project Information
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    
    -- Media
    featured_image TEXT,
    gallery_images TEXT[],
    video_url TEXT,
    pitch_deck_url TEXT,
    
    -- Funding Details
    funding_goal DECIMAL(15,2) NOT NULL CHECK (funding_goal > 0),
    current_funding DECIMAL(15,2) DEFAULT 0,
    min_investment DECIMAL(10,2) DEFAULT 1000 CHECK (min_investment > 0),
    max_investment DECIMAL(15,2),
    
    -- Investment Terms
    equity_percentage DECIMAL(5,2), -- Percentage of equity offered
    pre_money_valuation DECIMAL(15,2),
    investment_type TEXT DEFAULT 'equity', -- 'equity', 'convertible_note', 'safe'
    use_of_funds JSONB, -- Breakdown of how funds will be used
    
    -- Timeline
    funding_deadline TIMESTAMP WITH TIME ZONE,
    estimated_completion DATE,
    
    -- Status and Tracking
    status project_status DEFAULT 'draft',
    investor_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    
    -- Team and Documents
    team_members JSONB DEFAULT '[]',
    business_plan_url TEXT,
    financial_projections JSONB,
    legal_documents JSONB DEFAULT '[]',
    
    -- Metadata
    featured BOOLEAN DEFAULT FALSE,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_funding CHECK (current_funding <= funding_goal),
    CONSTRAINT valid_investment_range CHECK (max_investment IS NULL OR max_investment >= min_investment),
    CONSTRAINT valid_equity CHECK (equity_percentage IS NULL OR equity_percentage BETWEEN 0 AND 100)
);

-- Project milestones (enhanced version of milestones table)
CREATE TABLE public.project_milestones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    funding_percentage DECIMAL(5,2) NOT NULL CHECK (funding_percentage BETWEEN 0 AND 100),
    target_amount DECIMAL(15,2) NOT NULL CHECK (target_amount > 0),
    target_date DATE,
    deliverables JSONB DEFAULT '[]', -- Array of deliverable objects
    
    -- Progress Tracking
    is_completed BOOLEAN DEFAULT FALSE,
    completion_date TIMESTAMP WITH TIME ZONE,
    completion_evidence JSONB DEFAULT '[]', -- Proof of completion
    investor_approval_required BOOLEAN DEFAULT TRUE,
    investor_approval_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Funding Release
    funds_released BOOLEAN DEFAULT FALSE,
    funds_released_amount DECIMAL(15,2) DEFAULT 0,
    funds_released_at TIMESTAMP WITH TIME ZONE,
    
    -- Ordering and Metadata
    milestone_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure milestone percentages add up correctly (handled by trigger)
    CONSTRAINT valid_funding_percentage CHECK (funding_percentage > 0)
);

-- Project investments (enhanced version of investments table)
CREATE TABLE public.project_investments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    investor_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    
    -- Investment Terms
    equity_shares DECIMAL(10,6), -- Precise equity percentage acquired
    share_price DECIMAL(10,2),
    investment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Status and Processing
    status investment_status DEFAULT 'pending',
    payment_method TEXT,
    payment_reference TEXT,
    stripe_payment_intent_id TEXT,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- Legal and Documentation
    investment_agreement_url TEXT,
    shareholder_certificate_url TEXT,
    
    -- Refund Information
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(15,2),
    refund_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Business Rules
    UNIQUE(investor_id, project_id) -- One investment per investor per project
);

-- User authentication trigger table to create users automatically
CREATE TABLE public.auth_user_creation_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

-- Core table indexes (Phase 1)
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

-- Phase 2 Enhanced indexes for social features and performance
-- Media management indexes
CREATE INDEX idx_campaign_media_campaign ON public.campaign_media(campaign_id);
CREATE INDEX idx_campaign_media_type ON public.campaign_media(type);
CREATE INDEX idx_campaign_media_featured ON public.campaign_media(is_featured) WHERE is_featured = true;

-- Social interaction indexes
CREATE INDEX idx_campaign_likes_campaign ON public.campaign_likes(campaign_id);
CREATE INDEX idx_campaign_likes_user ON public.campaign_likes(user_id);
CREATE INDEX idx_campaign_shares_campaign ON public.campaign_shares(campaign_id);
CREATE INDEX idx_comment_likes_comment ON public.comment_likes(comment_id);

-- User verification indexes
CREATE INDEX idx_user_verifications_user ON public.user_verifications(user_id);
CREATE INDEX idx_user_verifications_type ON public.user_verifications(verification_type);
CREATE INDEX idx_user_verifications_status ON public.user_verifications(status);

-- Payment method indexes
CREATE INDEX idx_user_payment_methods_user ON public.user_payment_methods(user_id);
CREATE INDEX idx_user_payment_methods_default ON public.user_payment_methods(user_id, is_default) WHERE is_default = true;

-- Campaign updates indexes
CREATE INDEX idx_campaign_updates_campaign ON public.campaign_updates(campaign_id);
CREATE INDEX idx_campaign_updates_public ON public.campaign_updates(is_public) WHERE is_public = true;

-- Following system indexes
CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);

-- Views tracking indexes
CREATE INDEX idx_campaign_views_campaign ON public.campaign_views(campaign_id);
CREATE INDEX idx_campaign_views_date ON public.campaign_views(viewed_at);

-- Referral tracking indexes
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_campaign ON public.referrals(campaign_id);

-- Search and discovery indexes
CREATE INDEX idx_users_verification_level ON public.users(verification_level);
CREATE INDEX idx_users_trust_score ON public.users(trust_score);
CREATE INDEX idx_campaigns_type ON public.campaigns(campaign_type);
CREATE INDEX idx_campaigns_funding_model ON public.campaigns(funding_model);
CREATE INDEX idx_campaigns_view_count ON public.campaigns(view_count);
CREATE INDEX idx_campaigns_likes_count ON public.campaigns(likes_count);

-- Phase 3 Enhanced indexes for role-based features
-- User role and verification indexes
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_role_verification ON public.users(role, verification_level) WHERE role IS NOT NULL;

-- Profile System indexes (added for enhanced profile functionality)
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_updated_at ON public.users(updated_at);
CREATE INDEX idx_users_bio ON public.users(bio) WHERE bio IS NOT NULL;
CREATE INDEX idx_users_location ON public.users(location) WHERE location IS NOT NULL;
CREATE INDEX idx_users_is_verified ON public.users(is_verified);

-- Companies indexes
CREATE INDEX idx_companies_owner ON public.companies(owner_id);
CREATE INDEX idx_companies_verified ON public.companies(verified) WHERE verified = true;
CREATE INDEX idx_companies_status ON public.companies(verification_status);
CREATE INDEX idx_companies_industry ON public.companies(industry);

-- Projects indexes
CREATE INDEX idx_projects_creator ON public.projects(creator_id);
CREATE INDEX idx_projects_company ON public.projects(company_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_featured ON public.projects(featured) WHERE featured = true;
CREATE INDEX idx_projects_deadline ON public.projects(funding_deadline);
CREATE INDEX idx_projects_category ON public.projects(category_id);
CREATE INDEX idx_projects_current_funding ON public.projects(current_funding);

-- Project milestones indexes
CREATE INDEX idx_project_milestones_project ON public.project_milestones(project_id);
CREATE INDEX idx_project_milestones_order ON public.project_milestones(project_id, milestone_order);
CREATE INDEX idx_project_milestones_completed ON public.project_milestones(is_completed);

-- Project investments indexes
CREATE INDEX idx_project_investments_investor ON public.project_investments(investor_id);
CREATE INDEX idx_project_investments_project ON public.project_investments(project_id);
CREATE INDEX idx_project_investments_status ON public.project_investments(status);
CREATE INDEX idx_project_investments_date ON public.project_investments(investment_date);

-- Auth creation log indexes
CREATE INDEX idx_auth_creation_log_user ON public.auth_user_creation_log(user_id);
CREATE INDEX idx_auth_creation_log_date ON public.auth_user_creation_log(created_at);
CREATE INDEX idx_auth_creation_log_success ON public.auth_user_creation_log(success);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Core function to update updated_at timestamp
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

-- Phase 2: Function to update campaign social stats (likes, shares, comments)
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'campaign_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE public.campaigns 
            SET likes_count = likes_count + 1 
            WHERE id = NEW.campaign_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.campaigns 
            SET likes_count = likes_count - 1 
            WHERE id = OLD.campaign_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'campaign_shares' THEN
        UPDATE public.campaigns 
        SET shares_count = shares_count + 1 
        WHERE id = NEW.campaign_id;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE public.campaigns 
            SET comments_count = comments_count + 1 
            WHERE id = NEW.campaign_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.campaigns 
            SET comments_count = comments_count - 1 
            WHERE id = OLD.campaign_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'campaign_updates' THEN
        UPDATE public.campaigns 
        SET updates_count = updates_count + 1 
        WHERE id = NEW.campaign_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Phase 2: Function to update user follow stats
CREATE OR REPLACE FUNCTION update_user_follow_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update follower's following count
        UPDATE public.users 
        SET following_count = following_count + 1 
        WHERE id = NEW.follower_id;
        
        -- Update following user's followers count
        UPDATE public.users 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.following_id;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Update follower's following count
        UPDATE public.users 
        SET following_count = following_count - 1 
        WHERE id = OLD.follower_id;
        
        -- Update following user's followers count
        UPDATE public.users 
        SET followers_count = followers_count - 1 
        WHERE id = OLD.following_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER CREATION
-- =============================================================================

-- Core updated_at triggers
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

-- Phase 2: Social interaction triggers
CREATE TRIGGER update_campaign_likes_stats
    AFTER INSERT OR DELETE ON public.campaign_likes
    FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

CREATE TRIGGER update_campaign_shares_stats
    AFTER INSERT ON public.campaign_shares
    FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

CREATE TRIGGER update_campaign_comments_stats
    AFTER INSERT OR DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

CREATE TRIGGER update_campaign_updates_stats
    AFTER INSERT ON public.campaign_updates
    FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

CREATE TRIGGER update_user_follow_stats_trigger
    AFTER INSERT OR DELETE ON public.user_follows
    FOR EACH ROW EXECUTE FUNCTION update_user_follow_stats();

-- =============================================================================
-- PHASE 3 FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to automatically create user records when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    
    -- Log the creation
    INSERT INTO public.auth_user_creation_log (user_id, email, success)
    VALUES (NEW.id, NEW.email, TRUE);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        INSERT INTO public.auth_user_creation_log (user_id, email, success, error_message)
        VALUES (NEW.id, NEW.email, FALSE, SQLERRM);
        RETURN NEW; -- Don't fail the auth process
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update project funding when investment is confirmed
CREATE OR REPLACE FUNCTION update_project_funding()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
        -- Add to project funding
        UPDATE public.projects 
        SET 
            current_funding = current_funding + NEW.amount,
            investor_count = investor_count + 1,
            updated_at = NOW()
        WHERE id = NEW.project_id;
        
    ELSIF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
        -- Remove from project funding (refund case)
        UPDATE public.projects 
        SET 
            current_funding = current_funding - OLD.amount,
            investor_count = investor_count - 1,
            updated_at = NOW()
        WHERE id = OLD.project_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate milestone percentages add up to 100%
CREATE OR REPLACE FUNCTION validate_milestone_percentages()
RETURNS TRIGGER AS $$
DECLARE
    total_percentage DECIMAL(5,2);
BEGIN
    -- Calculate total percentage for the project
    SELECT COALESCE(SUM(funding_percentage), 0)
    INTO total_percentage
    FROM public.project_milestones
    WHERE project_id = NEW.project_id AND id != COALESCE(OLD.id, uuid_nil());
    
    -- Add the new/updated milestone percentage
    total_percentage := total_percentage + NEW.funding_percentage;
    
    -- Check if total exceeds 100%
    IF total_percentage > 100 THEN
        RAISE EXCEPTION 'Total milestone funding percentages cannot exceed 100%%. Current total would be: %', total_percentage;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create user records
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger for project funding updates
CREATE TRIGGER update_project_funding_trigger
    AFTER INSERT OR UPDATE ON public.project_investments
    FOR EACH ROW EXECUTE FUNCTION update_project_funding();

-- Trigger for milestone percentage validation
CREATE TRIGGER validate_milestone_percentages_trigger
    BEFORE INSERT OR UPDATE ON public.project_milestones
    FOR EACH ROW EXECUTE FUNCTION validate_milestone_percentages();

-- Phase 3 updated_at triggers
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON public.companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON public.projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Phase 2 enhanced tables
ALTER TABLE public.campaign_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_views ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Phase 3 tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user_creation_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CORE TABLE POLICIES (Phase 1)
-- =============================================================================

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
-- PHASE 2 ENHANCED POLICIES (Social & Media Features)
-- =============================================================================

-- Campaign media policies
CREATE POLICY "Anyone can view media of visible campaigns" ON public.campaign_media
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id 
            AND status IN ('active', 'successful', 'failed')
        )
    );

CREATE POLICY "Campaign creators can manage their media" ON public.campaign_media
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id AND creator_id = auth.uid()
        )
    );

-- Campaign likes policies
CREATE POLICY "Anyone can view likes on visible campaigns" ON public.campaign_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id 
            AND status IN ('active', 'successful', 'failed')
        )
    );

CREATE POLICY "Authenticated users can manage their own likes" ON public.campaign_likes
    FOR ALL USING (auth.uid() = user_id);

-- Campaign shares policies
CREATE POLICY "Anyone can view shares on visible campaigns" ON public.campaign_shares
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id 
            AND status IN ('active', 'successful', 'failed')
        )
    );

CREATE POLICY "Authenticated users can create shares" ON public.campaign_shares
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comment likes policies
CREATE POLICY "Anyone can view comment likes" ON public.comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their comment likes" ON public.comment_likes
    FOR ALL USING (auth.uid() = user_id);

-- User follows policies
CREATE POLICY "Users can view all follows" ON public.user_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON public.user_follows
    FOR ALL USING (auth.uid() = follower_id);

-- Payment methods policies
CREATE POLICY "Users can manage their own payment methods" ON public.user_payment_methods
    FOR ALL USING (auth.uid() = user_id);

-- User verifications policies
CREATE POLICY "Users can view their own verifications" ON public.user_verifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own verifications" ON public.user_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Campaign updates policies
CREATE POLICY "Anyone can view public updates" ON public.campaign_updates
    FOR SELECT USING (is_public = true);

CREATE POLICY "Campaign creators can manage their updates" ON public.campaign_updates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id AND creator_id = auth.uid()
        )
    );

-- Search filters policies
CREATE POLICY "Users can manage their own search filters" ON public.search_filters
    FOR ALL USING (auth.uid() = user_id);

-- Email campaigns policies (admin only)
CREATE POLICY "Admins can manage email campaigns" ON public.email_campaigns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND verification_level >= 5
        )
    );

-- Referrals policies
CREATE POLICY "Users can view their own referrals" ON public.referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can create referrals" ON public.referrals
    FOR INSERT WITH CHECK (true);

-- Campaign views policies (analytics)
CREATE POLICY "Campaign creators can view their campaign analytics" ON public.campaign_views
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE id = campaign_id AND creator_id = auth.uid()
        )
    );

CREATE POLICY "System can track campaign views" ON public.campaign_views
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- PHASE 3 RLS POLICIES (Role-based Features)
-- =============================================================================

-- Companies policies
CREATE POLICY "Users can view their own company" ON public.companies
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own company" ON public.companies
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own company" ON public.companies
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Verified companies are publicly viewable" ON public.companies
    FOR SELECT USING (verified = true);

-- Projects policies
CREATE POLICY "Anyone can view active projects" ON public.projects
    FOR SELECT USING (status IN ('active', 'funded', 'completed'));

CREATE POLICY "Project creators can view their own projects" ON public.projects
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Project creators can manage their own projects" ON public.projects
    FOR ALL USING (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can create projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Project milestones policies
CREATE POLICY "Anyone can view milestones of visible projects" ON public.project_milestones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_id 
            AND (status IN ('active', 'funded', 'completed') OR creator_id = auth.uid())
        )
    );

CREATE POLICY "Project creators can manage their milestones" ON public.project_milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_id AND creator_id = auth.uid()
        )
    );

-- Project investments policies
CREATE POLICY "Users can view their own project investments" ON public.project_investments
    FOR SELECT USING (auth.uid() = investor_id);

CREATE POLICY "Project creators can view investments in their projects" ON public.project_investments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_id AND creator_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create project investments" ON public.project_investments
    FOR INSERT WITH CHECK (auth.uid() = investor_id);

CREATE POLICY "Users can update their own project investments" ON public.project_investments
    FOR UPDATE USING (auth.uid() = investor_id);

-- Auth user creation log policies (admin/system only)
CREATE POLICY "System can log user creation" ON public.auth_user_creation_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view user creation logs" ON public.auth_user_creation_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND verification_level >= 5
        )
    );

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

-- Generate referral codes for existing users (Phase 2 enhancement)
-- This will be handled by a trigger for new users
UPDATE public.users 
SET referral_code = substr(md5(random()::text), 0, 9)
WHERE referral_code IS NULL;

-- =============================================================================
-- VIEWS FOR EASIER QUERYING
-- =============================================================================

-- Enhanced campaign statistics view (Phase 2)
CREATE VIEW campaign_stats AS
SELECT 
    c.*,
    u.full_name as creator_name,
    u.avatar_url as creator_avatar,
    u.verification_level as creator_verification_level,
    u.trust_score as creator_trust_score,
    cat.name as category_name,
    cat.color as category_color,
    cat.icon as category_icon,
    ROUND((c.current_funding / c.funding_goal) * 100, 2) as funding_percentage,
    CASE 
        WHEN c.end_date < NOW() AND c.current_funding < c.funding_goal THEN 'failed'
        WHEN c.current_funding >= c.funding_goal THEN 'successful'
        ELSE c.status::text
    END as computed_status,
    EXTRACT(DAYS FROM (c.end_date - NOW())) as days_remaining,
    -- Phase 2 social metrics
    c.likes_count,
    c.shares_count,
    c.view_count,
    c.comments_count,
    c.updates_count,
    -- Engagement rate calculation
    CASE 
        WHEN c.view_count > 0 THEN 
            ROUND(((c.likes_count + c.shares_count + c.comments_count) * 100.0 / c.view_count), 2)
        ELSE 0
    END as engagement_rate
FROM public.campaigns c
LEFT JOIN public.users u ON c.creator_id = u.id
LEFT JOIN public.categories cat ON c.category_id = cat.id;

-- User profile statistics view (Phase 2)
CREATE VIEW user_stats AS
SELECT 
    u.*,
    -- Investment statistics
    COUNT(DISTINCT i.id) as total_investments,
    COUNT(DISTINCT c.id) as total_campaigns_created,
    COUNT(DISTINCT f.id) as total_favorites,
    -- Social statistics
    u.followers_count,
    u.following_count,
    -- Verification status
    CASE 
        WHEN u.verification_level >= 5 THEN 'verified_business'
        WHEN u.verification_level >= 3 THEN 'verified_identity'
        WHEN u.verification_level >= 1 THEN 'verified_email'
        ELSE 'unverified'
    END as verification_status,
    -- Activity metrics
    COUNT(DISTINCT cl.id) as total_likes_given,
    COUNT(DISTINCT co.id) as total_comments_made
FROM public.users u
LEFT JOIN public.investments i ON u.id = i.investor_id
LEFT JOIN public.campaigns c ON u.id = c.creator_id
LEFT JOIN public.favorites f ON u.id = f.user_id
LEFT JOIN public.campaign_likes cl ON u.id = cl.user_id
LEFT JOIN public.comments co ON u.id = co.user_id
GROUP BY u.id;

-- Popular campaigns view for discovery (Phase 2)
CREATE VIEW popular_campaigns AS
SELECT 
    cs.*,
    -- Popularity score calculation
    (
        (cs.funding_percentage * 0.3) +
        (cs.likes_count * 0.2) +
        (cs.shares_count * 0.15) +
        (cs.comments_count * 0.15) +
        (cs.view_count * 0.1) +
        (cs.investor_count * 0.1)
    ) as popularity_score
FROM campaign_stats cs
WHERE cs.status = 'active'
ORDER BY popularity_score DESC;

-- Trending campaigns view (Phase 2)
CREATE VIEW trending_campaigns AS
SELECT 
    cs.*,
    -- Recent activity score (last 7 days)
    COALESCE(recent_activity.recent_score, 0) as trend_score
FROM campaign_stats cs
LEFT JOIN (
    SELECT 
        campaign_id,
        (
            COUNT(DISTINCT cl.id) * 3 +
            COUNT(DISTINCT cs2.id) * 5 +
            COUNT(DISTINCT co.id) * 2 +
            COUNT(DISTINCT i.id) * 10
        ) as recent_score
    FROM public.campaigns c
    LEFT JOIN public.campaign_likes cl ON c.id = cl.campaign_id 
        AND cl.created_at > NOW() - INTERVAL '7 days'
    LEFT JOIN public.campaign_shares cs2 ON c.id = cs2.campaign_id 
        AND cs2.shared_at > NOW() - INTERVAL '7 days'
    LEFT JOIN public.comments co ON c.id = co.campaign_id 
        AND co.created_at > NOW() - INTERVAL '7 days'
    LEFT JOIN public.investments i ON c.id = i.campaign_id 
        AND i.investment_date > NOW() - INTERVAL '7 days'
    GROUP BY campaign_id
) recent_activity ON cs.id = recent_activity.campaign_id
WHERE cs.status = 'active'
ORDER BY trend_score DESC;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

-- Core table comments
COMMENT ON TABLE public.users IS 'Extended user profiles for investment platform users - Enhanced with Phase 2 social features';
COMMENT ON TABLE public.campaigns IS 'Investment campaigns/opportunities - Enhanced with Phase 2 social and media features';
COMMENT ON TABLE public.investments IS 'User investments in campaigns';
COMMENT ON TABLE public.milestones IS 'Campaign milestones and updates';
COMMENT ON TABLE public.transactions IS 'Financial transaction history';
COMMENT ON TABLE public.notifications IS 'User notifications';
COMMENT ON TABLE public.favorites IS 'User favorite campaigns';
COMMENT ON TABLE public.comments IS 'Campaign comments and discussions';
COMMENT ON TABLE public.categories IS 'Campaign categories';

-- Phase 2 table comments
COMMENT ON TABLE public.campaign_media IS 'Media files (images, videos, documents) for campaigns';
COMMENT ON TABLE public.campaign_likes IS 'User likes on campaigns for social engagement';
COMMENT ON TABLE public.campaign_shares IS 'Social sharing tracking for viral growth';
COMMENT ON TABLE public.comment_likes IS 'Likes on individual comments';
COMMENT ON TABLE public.user_verifications IS 'User verification documents and status for trust & safety';
COMMENT ON TABLE public.user_payment_methods IS 'User saved payment methods for seamless transactions';
COMMENT ON TABLE public.campaign_updates IS 'Campaign updates and announcements for ongoing communication';
COMMENT ON TABLE public.referrals IS 'Referral tracking and rewards for growth';
COMMENT ON TABLE public.search_filters IS 'Saved search filters for user convenience';
COMMENT ON TABLE public.email_campaigns IS 'Email campaigns and newsletters for marketing';
COMMENT ON TABLE public.user_follows IS 'User following relationships for social networking';
COMMENT ON TABLE public.campaign_views IS 'Campaign view tracking for analytics';

-- View comments
COMMENT ON VIEW campaign_stats IS 'Enhanced campaign statistics with social metrics and engagement rates';
COMMENT ON VIEW user_stats IS 'Comprehensive user statistics including social and investment metrics';
COMMENT ON VIEW popular_campaigns IS 'Popular campaigns ranked by engagement and funding success';
COMMENT ON VIEW trending_campaigns IS 'Trending campaigns based on recent activity and growth';

-- =============================================================================
-- SCHEMA VERSION AND METADATA
-- =============================================================================

-- Create a metadata table to track schema versions
CREATE TABLE public.schema_metadata (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    version TEXT NOT NULL,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by TEXT
);

-- Insert current schema version
INSERT INTO public.schema_metadata (version, description, applied_by) VALUES
('2.0.0', 'Phase 2 Enhanced Schema: GoFundMe-like social features, media management, verification system, and performance optimizations', 'System');

-- =============================================================================
-- END OF FUNDCHAIN ENHANCED SCHEMA
-- =============================================================================
/*
SCHEMA SUMMARY:
- Core Tables: 9 (users, campaigns, investments, etc.)
- Enhanced Tables: 12 (media, social features, verification, etc.)
- Total Tables: 21
- Enums: 10 (including Phase 2 additions)
- Indexes: 35+ (optimized for performance)
- Triggers: 8 (automated stats and business logic)
- RLS Policies: 50+ (comprehensive security)
- Views: 4 (enhanced analytics and discovery)
- Functions: 5 (business logic and automation)

FEATURES SUPPORTED:
✅ Core investment platform (Phase 1)
✅ Social interactions (likes, shares, follows)
✅ Media management (images, videos, documents)
✅ User verification and trust system
✅ Campaign updates and communication
✅ Referral tracking and growth
✅ Advanced search and discovery
✅ Email marketing campaigns
✅ Analytics and reporting
✅ Performance optimization
✅ Comprehensive security (RLS)

PHASE 3 ENHANCEMENTS (September 2025):
✅ Role-based authentication (investor/creator)
✅ Automatic user record creation
✅ Company registration and KYC verification
✅ Project creation with milestone management
✅ Enhanced investment tracking
✅ Creator dashboard and tools
✅ Error boundary and debugging support
✅ Authentication flow improvements
✅ Database triggers for user creation
*/

-- =============================================================================
-- PHASE 3 VIEWS AND ADDITIONAL HELPERS
-- =============================================================================

-- Project statistics view
CREATE VIEW project_stats AS
SELECT 
    p.*,
    u.full_name as creator_name,
    u.avatar_url as creator_avatar,
    u.verification_level as creator_verification_level,
    c.company_name,
    c.verified as company_verified,
    cat.name as category_name,
    cat.color as category_color,
    ROUND((p.current_funding / p.funding_goal) * 100, 2) as funding_percentage,
    EXTRACT(DAYS FROM (p.funding_deadline - NOW())) as days_remaining,
    -- Milestone progress
    (SELECT COUNT(*) FROM public.project_milestones WHERE project_id = p.id) as total_milestones,
    (SELECT COUNT(*) FROM public.project_milestones WHERE project_id = p.id AND is_completed = true) as completed_milestones
FROM public.projects p
LEFT JOIN public.users u ON p.creator_id = u.id
LEFT JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.categories cat ON p.category_id = cat.id;

-- User role and onboarding status view
CREATE VIEW user_onboarding_status AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.verification_level,
    CASE 
        WHEN u.role IS NULL THEN 'needs_role_selection'
        WHEN u.role = 'creator' AND NOT EXISTS (SELECT 1 FROM public.companies WHERE owner_id = u.id AND verified = true) THEN 'needs_kyc'
        WHEN u.role = 'investor' THEN 'fully_onboarded'
        WHEN u.role = 'creator' AND EXISTS (SELECT 1 FROM public.companies WHERE owner_id = u.id AND verified = true) THEN 'fully_onboarded'
        ELSE 'unknown'
    END as onboarding_status,
    -- Company info for creators
    c.id as company_id,
    c.company_name,
    c.verified as company_verified,
    c.verification_status as company_verification_status
FROM public.users u
LEFT JOIN public.companies c ON u.id = c.owner_id AND u.role = 'creator';

-- =============================================================================
-- UTILITY FUNCTIONS FOR PHASE 3
-- =============================================================================

-- Function to check if user needs role selection
CREATE OR REPLACE FUNCTION user_needs_role_selection(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = user_id AND role IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if creator needs KYC
CREATE OR REPLACE FUNCTION creator_needs_kyc(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = user_id 
        AND u.role = 'creator'
        AND NOT EXISTS (
            SELECT 1 FROM public.companies c 
            WHERE c.owner_id = u.id AND c.verified = true
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's complete role status
CREATE OR REPLACE FUNCTION get_user_role_status(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    user_record RECORD;
    company_record RECORD;
BEGIN
    -- Get user info
    SELECT * INTO user_record FROM public.users WHERE id = user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'hasRole', false,
            'role', null,
            'isKYCVerified', false,
            'companyData', null,
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Base result
    result := jsonb_build_object(
        'hasRole', user_record.role IS NOT NULL,
        'role', user_record.role,
        'success', true
    );
    
    -- Handle different roles
    IF user_record.role = 'investor' THEN
        result := result || jsonb_build_object('isKYCVerified', true, 'companyData', null);
    ELSIF user_record.role = 'creator' THEN
        -- Get company info
        SELECT * INTO company_record FROM public.companies WHERE owner_id = user_id;
        
        result := result || jsonb_build_object(
            'isKYCVerified', COALESCE(company_record.verified, false),
            'companyData', CASE 
                WHEN company_record.id IS NOT NULL THEN
                    jsonb_build_object(
                        'id', company_record.id,
                        'company_name', company_record.company_name,
                        'verified', company_record.verified,
                        'verification_status', company_record.verification_status
                    )
                ELSE null
            END
        );
    ELSE
        result := result || jsonb_build_object('isKYCVerified', false, 'companyData', null);
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SCHEMA COMPLETION NOTES
-- =============================================================================

/*
SCHEMA DEPLOYMENT CHECKLIST:

1. Run this entire schema.sql file in Supabase SQL editor
2. Verify all tables, indexes, and triggers are created
3. Test RLS policies are working correctly
4. Confirm the handle_new_user() trigger is active
5. Insert test data if needed
6. Update application .env.local with Supabase credentials

PHASE 3 SPECIFIC FEATURES:
✅ Automatic user record creation on auth signup
✅ Role-based authentication with investor/creator roles
✅ Company registration and KYC verification system
✅ Project creation with milestone management
✅ Enhanced investment tracking with equity calculations
✅ Comprehensive error handling and debugging support
✅ Performance optimized with proper indexes
✅ Secure with comprehensive RLS policies

FOR DEBUGGING:
- Check auth_user_creation_log table for user creation issues
- Use the utility functions for role status checking
- Monitor the project_stats and user_onboarding_status views
- All tables have proper created_at/updated_at timestamps

NEXT STEPS:
- Test authentication flow end-to-end
- Verify role selection and KYC processes
- Test project creation and investment workflows
- Add any additional business logic as needed
*/