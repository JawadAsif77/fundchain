-- ============================================================
-- FUNDCHAIN – COMPLETE DATABASE SCHEMA (PUBLIC)
-- Updated: December 11, 2025
-- Includes: Solana Integration, Wallet System, Investment Flow
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('investor', 'creator', 'admin');

CREATE TYPE verified_status AS ENUM ('no', 'pending', 'verified');

CREATE TYPE kyc_verification_type AS ENUM ('individual', 'company');

CREATE TYPE kyc_verification_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE campaign_status AS ENUM (
  'draft',
  'active',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE campaign_type AS ENUM ('donation', 'equity', 'loan');

CREATE TYPE funding_model AS ENUM ('all_or_nothing', 'flexible');

CREATE TYPE investment_status AS ENUM (
  'pending',
  'confirmed',
  'refunded',
  'failed'
);

CREATE TYPE notification_type AS ENUM (
  'campaign_update',
  'investment_confirmed',
  'investment_refunded',
  'milestone_completed',
  'admin_message'
);

CREATE TYPE payment_method_type AS ENUM (
  'credit_card',
  'bank_transfer',
  'easypaisa',
  'jazzcash',
  'paypal'
);

CREATE TYPE media_type AS ENUM ('image', 'video', 'document', 'audio');

CREATE TYPE transaction_type AS ENUM (
  'buy_fc',
  'invest_fc',
  'refund_fc',
  'release_fc',
  'withdraw_fc'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

---------------------------------------------------------------
-- USERS
---------------------------------------------------------------

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  username text UNIQUE,
  full_name text,
  email text,
  avatar_url text,
  bio text,
  location text,
  phone text,
  date_of_birth date,
  
  -- Social links
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  social_links jsonb DEFAULT '{}'::jsonb,
  
  -- Settings
  preferences jsonb DEFAULT '{}'::jsonb,
  
  -- Verification
  role user_role NOT NULL DEFAULT 'investor',
  is_verified verified_status NOT NULL DEFAULT 'no',
  verification_level integer DEFAULT 0,
  trust_score numeric DEFAULT 0,
  
  -- Referral
  referral_code text UNIQUE,
  
  -- Statistics
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  is_accredited_investor boolean DEFAULT false,
  total_invested numeric DEFAULT 0,
  total_campaigns_backed integer DEFAULT 0,
  
  -- Solana Integration
  wallet_address text,
  
  -- Timestamps
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

---------------------------------------------------------------
-- CATEGORIES
---------------------------------------------------------------

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  color text,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- CAMPAIGNS
---------------------------------------------------------------

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id),
  
  -- Basic info
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  short_description text,
  
  -- Media
  image_url text,
  gallery_images text[],
  video_url text,
  
  -- Funding details
  funding_goal numeric NOT NULL CHECK (funding_goal > 0),
  current_funding numeric DEFAULT 0,
  total_raised numeric DEFAULT 0,
  min_investment numeric DEFAULT 100 CHECK (min_investment > 0),
  max_investment numeric,
  investor_count integer DEFAULT 0,
  
  -- Investment type
  campaign_type campaign_type DEFAULT 'donation',
  funding_model funding_model DEFAULT 'all_or_nothing',
  equity_percentage numeric,
  expected_return numeric,
  risk_level integer CHECK (risk_level >= 1 AND risk_level <= 5),
  
  -- Status and dates
  status campaign_status DEFAULT 'draft',
  start_date timestamptz,
  end_date timestamptz,
  
  -- Additional data
  documents jsonb DEFAULT '[]'::jsonb,
  business_plan_url text,
  financial_projections jsonb,
  team_members jsonb DEFAULT '[]'::jsonb,
  location text,
  industry text,
  tags text[],
  
  -- Features
  featured boolean DEFAULT false,
  verified boolean DEFAULT false,
  social_sharing_enabled boolean DEFAULT true,
  
  -- Counts
  updates_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  
  -- SEO
  seo_title text,
  seo_description text,
  external_links jsonb DEFAULT '{}'::jsonb,
  
  -- Risk scoring (AI/ML)
  ml_scam_score double precision,
  plagiarism_score double precision,
  wallet_risk_score double precision,
  final_risk_score double precision,
  admin_risk_override double precision,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- WALLETS (User FC Token Balances)
---------------------------------------------------------------

CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance_fc numeric NOT NULL DEFAULT 0 CHECK (balance_fc >= 0),
  locked_fc numeric NOT NULL DEFAULT 0 CHECK (locked_fc >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------------------------
-- PLATFORM WALLET (System Wallet)
---------------------------------------------------------------

CREATE TABLE public.platform_wallet (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  balance_fc numeric NOT NULL DEFAULT 0,
  locked_fc numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------------------------
-- CAMPAIGN WALLETS (Escrow)
---------------------------------------------------------------

CREATE TABLE public.campaign_wallets (
  campaign_id uuid PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
  escrow_balance_fc numeric NOT NULL DEFAULT 0,
  released_fc numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------------------------
-- INVESTMENTS
---------------------------------------------------------------

CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status investment_status DEFAULT 'pending',
  
  -- Payment
  payment_method text,
  payment_reference text,
  stripe_payment_intent_id text,
  
  -- Timestamps
  investment_date timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  refunded_at timestamptz,
  
  -- Refund details
  refund_amount numeric,
  refund_reason text,
  
  -- Equity
  equity_shares numeric,
  certificate_url text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- CAMPAIGN INVESTMENTS (Aggregated per user per campaign)
---------------------------------------------------------------

CREATE TABLE public.campaign_investments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_fc numeric NOT NULL CHECK (amount_fc > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(campaign_id, investor_id)
);

---------------------------------------------------------------
-- CAMPAIGN INVESTORS (Unique investor tracking)
---------------------------------------------------------------

CREATE TABLE public.campaign_investors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_invested numeric NOT NULL DEFAULT 0,
  first_investment_at timestamptz DEFAULT now(),
  last_investment_at timestamptz DEFAULT now(),
  
  UNIQUE(campaign_id, investor_id)
);

---------------------------------------------------------------
-- TRANSACTIONS (General transaction log)
---------------------------------------------------------------

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  investment_id uuid REFERENCES public.investments(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type transaction_type NOT NULL,
  description text,
  payment_method text,
  payment_reference text,
  stripe_charge_id text,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- TOKEN TRANSACTIONS (FC Token movements)
---------------------------------------------------------------

CREATE TABLE public.token_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE CASCADE,
  amount_fc numeric NOT NULL,
  type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------------------------
-- FUND TRANSACTIONS (Solana Payment Records)
---------------------------------------------------------------

CREATE TABLE public.fund_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_fc numeric NOT NULL CHECK (amount_fc > 0),
  amount_sol numeric NOT NULL CHECK (amount_sol > 0),
  solana_tx_signature text NOT NULL UNIQUE,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------------------------
-- MILESTONES
---------------------------------------------------------------

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  target_amount numeric,
  target_date date,
  is_completed boolean DEFAULT false,
  completion_date timestamptz,
  completion_notes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  order_index integer NOT NULL,
  is_voting_open boolean DEFAULT false,
  approval_percentage numeric DEFAULT 0,
  rejection_percentage numeric DEFAULT 0,
  voting_result text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- MILESTONE VOTES
---------------------------------------------------------------

CREATE TABLE public.milestone_votes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  vote boolean NOT NULL,
  investment_weight numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(milestone_id, investor_id)
);

---------------------------------------------------------------
-- CAMPAIGN MEDIA
---------------------------------------------------------------

CREATE TABLE public.campaign_media (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type media_type NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  thumbnail_url text,
  caption text,
  sort_order integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- CAMPAIGN UPDATES
---------------------------------------------------------------

CREATE TABLE public.campaign_updates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  is_public boolean DEFAULT true,
  media_urls text[],
  sent_to_investors boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- CAMPAIGN LIKES
---------------------------------------------------------------

CREATE TABLE public.campaign_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(campaign_id, user_id)
);

---------------------------------------------------------------
-- CAMPAIGN SHARES
---------------------------------------------------------------

CREATE TABLE public.campaign_shares (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  platform text,
  shared_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- CAMPAIGN VIEWS
---------------------------------------------------------------

CREATE TABLE public.campaign_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ip_address inet,
  user_agent text,
  viewed_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- COMMENTS
---------------------------------------------------------------

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_edited boolean DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- COMMENT LIKES
---------------------------------------------------------------

CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(comment_id, user_id)
);

---------------------------------------------------------------
-- FAVORITES
---------------------------------------------------------------

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, campaign_id)
);

---------------------------------------------------------------
-- USER FOLLOWS
---------------------------------------------------------------

CREATE TABLE public.user_follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(follower_id, following_id)
);

---------------------------------------------------------------
-- NOTIFICATIONS
---------------------------------------------------------------

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- USER VERIFICATIONS (KYC)
---------------------------------------------------------------

CREATE TABLE public.user_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal info
  legal_name text NOT NULL,
  legal_address jsonb NOT NULL CHECK (
    legal_address ? 'line1' AND 
    legal_address ? 'city' AND 
    legal_address ? 'state' AND 
    legal_address ? 'postal_code' AND 
    legal_address ? 'country'
  ),
  phone text NOT NULL,
  legal_email text NOT NULL,
  business_email text,
  
  -- Documents
  id_document_url text,
  selfie_image_url text,
  
  -- Verification
  verification_type kyc_verification_type NOT NULL DEFAULT 'individual',
  verification_status kyc_verification_status NOT NULL DEFAULT 'pending',
  
  -- Review
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  admin_notes text,
  
  -- Timestamps
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

---------------------------------------------------------------
-- USER PAYMENT METHODS
---------------------------------------------------------------

CREATE TABLE public.user_payment_methods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type payment_method_type NOT NULL,
  provider text,
  external_id text,
  is_default boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- REFERRALS
---------------------------------------------------------------

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  conversion_at timestamptz,
  reward_amount numeric,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- SEARCH FILTERS
---------------------------------------------------------------

CREATE TABLE public.search_filters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name text,
  filters jsonb NOT NULL,
  is_saved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

---------------------------------------------------------------
-- EMAIL CAMPAIGNS
---------------------------------------------------------------

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  subject text NOT NULL,
  content text NOT NULL,
  recipient_type text,
  sent_count integer DEFAULT 0,
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_wallet_address ON public.users(wallet_address);

-- Campaigns
CREATE INDEX idx_campaigns_creator ON public.campaigns(creator_id);
CREATE INDEX idx_campaigns_category ON public.campaigns(category_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_slug ON public.campaigns(slug);
CREATE INDEX idx_campaigns_featured ON public.campaigns(featured);
CREATE INDEX idx_campaigns_end_date ON public.campaigns(end_date);

-- Investments
CREATE INDEX idx_investments_investor ON public.investments(investor_id);
CREATE INDEX idx_investments_campaign ON public.investments(campaign_id);
CREATE INDEX idx_investments_status ON public.investments(status);
CREATE INDEX idx_investments_date ON public.investments(investment_date);

-- Campaign Investments
CREATE INDEX idx_campaign_investments_campaign ON public.campaign_investments(campaign_id);
CREATE INDEX idx_campaign_investments_investor ON public.campaign_investments(investor_id);

-- Campaign Investors
CREATE INDEX idx_campaign_investors_campaign ON public.campaign_investors(campaign_id);
CREATE INDEX idx_campaign_investors_investor ON public.campaign_investors(investor_id);

-- Transactions
CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_campaign ON public.transactions(campaign_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- Token Transactions
CREATE INDEX idx_token_transactions_user ON public.token_transactions(user_id);
CREATE INDEX idx_token_transactions_campaign ON public.token_transactions(campaign_id);

-- Fund Transactions (Solana)
CREATE INDEX idx_fund_transactions_user ON public.fund_transactions(user_id);
CREATE INDEX idx_fund_transactions_signature ON public.fund_transactions(solana_tx_signature);
CREATE INDEX idx_fund_transactions_created_at ON public.fund_transactions(created_at DESC);

-- Milestones
CREATE INDEX idx_milestones_campaign ON public.milestones(campaign_id);
CREATE INDEX idx_milestones_order ON public.milestones(campaign_id, order_index);

-- Comments
CREATE INDEX idx_comments_campaign ON public.comments(campaign_id);
CREATE INDEX idx_comments_user ON public.comments(user_id);
CREATE INDEX idx_comments_parent ON public.comments(parent_id);

-- Notifications
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, is_read);

-- Campaign Media
CREATE INDEX idx_campaign_media_campaign ON public.campaign_media(campaign_id);

-- Favorites
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_favorites_campaign ON public.favorites(campaign_id);

-- User Follows
CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER investments_updated_at BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER milestones_updated_at BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER platform_wallet_updated_at BEFORE UPDATE ON public.platform_wallet
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaign_wallets_updated_at BEFORE UPDATE ON public.campaign_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on milestone_votes
ALTER TABLE public.milestone_votes ENABLE ROW LEVEL SECURITY;

-- Investor can vote
CREATE POLICY investor_can_vote
ON public.milestone_votes
FOR INSERT
WITH CHECK (auth.uid() = investor_id);

-- Investor can read own vote
CREATE POLICY investor_read_own_vote
ON public.milestone_votes
FOR SELECT
USING (auth.uid() = investor_id);

-- Admin can read all votes
CREATE POLICY admin_read_all_votes
ON public.milestone_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role = 'admin'
  )
);

-- ============================================================
-- ATE TRIGGER user_verifications_updated_at BEFORE UPDATE ON public.user_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Ensure platform_wallet has exactly one row
INSERT INTO public.platform_wallet (balance_fc, locked_fc)
SELECT 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.platform_wallet);

-- Backfill wallets for all existing users
INSERT INTO public.wallets (user_id)
SELECT u.id
FROM public.users u
LEFT JOIN public.wallets w ON w.user_id = u.id
WHERE w.user_id IS NULL;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
