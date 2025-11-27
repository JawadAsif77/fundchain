-- ============================================================
-- FUNDCHAIN – CURRENT DATABASE SCHEMA (PUBLIC)
-- Aligned with live Supabase schema + current React app
-- Minimal RLS, no Phase-3 projects/companies
-- ============================================================

-- Extensions (Supabase usually has these by default, but safe to include)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- (Only ones actually in use right now)
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

-- ============================================================
-- CORE TABLES (PUBLIC)
-- Based on your latest Supabase export
-- ============================================================

---------------------------------------------------------------
-- USERS (profile table linked to auth.users)
---------------------------------------------------------------

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  username text UNIQUE,
  full_name text,
  avatar_url text,
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  bio text,
  location text,
  phone text,
  date_of_birth date,
  social_links jsonb DEFAULT '{}'::jsonb,
  preferences jsonb DEFAULT '{}'::jsonb,
  verification_level integer DEFAULT 0,
  trust_score numeric DEFAULT 0,
  referral_code text UNIQUE,
  last_active_at timestamptz,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  is_accredited_investor boolean DEFAULT false,
  total_invested numeric DEFAULT 0,
  total_campaigns_backed integer DEFAULT 0,
  -- Role & verification come from enums, stored logically here
  role user_role NOT NULL DEFAULT 'investor',
  is_verified verified_status NOT NULL DEFAULT 'no',

  CONSTRAINT users_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
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
  creator_id uuid NOT NULL,
  category_id uuid,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  short_description text,
  image_url text,
  gallery_images text[],
  video_url text,
  funding_goal numeric NOT NULL CHECK (funding_goal > 0),
  current_funding numeric DEFAULT 0,
  min_investment numeric DEFAULT 100 CHECK (min_investment > 0),
  max_investment numeric,
  investor_count integer DEFAULT 0,
  equity_percentage numeric,
  expected_return numeric,
  risk_level integer CHECK (risk_level >= 1 AND risk_level <= 5),
  status campaign_status DEFAULT 'draft',
  start_date timestamptz,
  end_date timestamptz,
  documents jsonb DEFAULT '[]'::jsonb,
  business_plan_url text,
  financial_projections jsonb,
  team_members jsonb DEFAULT '[]'::jsonb,
  location text,
  industry text,
  tags text[],
  featured boolean DEFAULT false,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  campaign_type campaign_type DEFAULT 'donation',
  funding_model funding_model DEFAULT 'all_or_nothing',
  social_sharing_enabled boolean DEFAULT true,
  updates_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  seo_title text,
  seo_description text,
  external_links jsonb DEFAULT '{}'::jsonb,

  CONSTRAINT campaigns_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT campaigns_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- MILESTONES (per-campaign)
---------------------------------------------------------------

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  target_amount numeric,
  target_date date,
  is_completed boolean DEFAULT false,
  completion_date timestamptz,
  completion_notes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT milestones_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

---------------------------------------------------------------
-- INVESTMENTS
---------------------------------------------------------------

CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status investment_status DEFAULT 'pending',
  payment_method text,
  payment_reference text,
  stripe_payment_intent_id text,
  investment_date timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  refunded_at timestamptz,
  refund_amount numeric,
  refund_reason text,
  equity_shares numeric,
  certificate_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT investments_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT investments_investor_id_fkey
    FOREIGN KEY (investor_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- TRANSACTIONS
---------------------------------------------------------------

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  campaign_id uuid,
  investment_id uuid,
  amount numeric NOT NULL,
  type text NOT NULL,
  description text,
  payment_method text,
  payment_reference text,
  stripe_charge_id text,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT transactions_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT transactions_investment_id_fkey
    FOREIGN KEY (investment_id) REFERENCES public.investments(id),
  CONSTRAINT transactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- NOTIFICATIONS
---------------------------------------------------------------

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- FAVORITES (watchlist)
---------------------------------------------------------------

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT favorites_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT favorites_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT favorites_unique UNIQUE (user_id, campaign_id)
);

---------------------------------------------------------------
-- COMMENTS
---------------------------------------------------------------

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid,
  content text NOT NULL,
  is_edited boolean DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT comments_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT comments_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.comments(id)
);

-- ============================================================
-- PHASE 2-STYLE SOCIAL / MEDIA / GROWTH TABLES
-- (All based on your current Supabase schema)
-- ============================================================

---------------------------------------------------------------
-- CAMPAIGN MEDIA
---------------------------------------------------------------

CREATE TABLE public.campaign_media (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  type text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  thumbnail_url text,
  caption text,
  sort_order integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now(),

  CONSTRAINT campaign_media_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

---------------------------------------------------------------
-- CAMPAIGN LIKES
---------------------------------------------------------------

CREATE TABLE public.campaign_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  user_id uuid,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT campaign_likes_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT campaign_likes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT campaign_likes_unique UNIQUE (campaign_id, user_id)
);

---------------------------------------------------------------
-- CAMPAIGN SHARES
---------------------------------------------------------------

CREATE TABLE public.campaign_shares (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  user_id uuid,
  platform text,
  shared_at timestamptz DEFAULT now(),

  CONSTRAINT campaign_shares_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT campaign_shares_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- COMMENT LIKES
---------------------------------------------------------------

CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid,
  user_id uuid,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT comment_likes_comment_id_fkey
    FOREIGN KEY (comment_id) REFERENCES public.comments(id),
  CONSTRAINT comment_likes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id)
);

---------------------------------------------------------------
-- USER VERIFICATIONS (KYC) – simplified version you now use
---------------------------------------------------------------

CREATE TABLE public.user_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  legal_name text NOT NULL,
  legal_address jsonb NOT NULL CHECK (
    legal_address ? 'line1'
    AND legal_address ? 'city'
    AND legal_address ? 'state'
    AND legal_address ? 'postal_code'
    AND legal_address ? 'country'
  ),
  phone text NOT NULL,
  legal_email text NOT NULL,
  business_email text,
  id_document_url text,
  selfie_image_url text,
  verification_type kyc_verification_type NOT NULL DEFAULT 'individual',
  verification_status kyc_verification_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  admin_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_verifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_verifications_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);

---------------------------------------------------------------
-- USER PAYMENT METHODS
---------------------------------------------------------------

CREATE TABLE public.user_payment_methods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  type payment_method_type NOT NULL,
  provider text,
  external_id text,
  is_default boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT user_payment_methods_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- CAMPAIGN UPDATES
---------------------------------------------------------------

CREATE TABLE public.campaign_updates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  author_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  is_public boolean DEFAULT true,
  media_urls text[],
  sent_to_investors boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT campaign_updates_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT campaign_updates_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- REFERRALS
---------------------------------------------------------------

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id uuid,
  referred_id uuid,
  campaign_id uuid,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  conversion_at timestamptz,
  reward_amount numeric,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT referrals_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT referrals_referrer_id_fkey
    FOREIGN KEY (referrer_id) REFERENCES public.users(id),
  CONSTRAINT referrals_referred_id_fkey
    FOREIGN KEY (referred_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- SAVED SEARCH FILTERS
---------------------------------------------------------------

CREATE TABLE public.search_filters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text,
  filters jsonb NOT NULL,
  is_saved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT search_filters_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- EMAIL CAMPAIGNS
---------------------------------------------------------------

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  subject text NOT NULL,
  content text NOT NULL,
  recipient_type text,
  sent_count integer DEFAULT 0,
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT email_campaigns_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT email_campaigns_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id)
);

---------------------------------------------------------------
-- USER FOLLOWS
---------------------------------------------------------------

CREATE TABLE public.user_follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid,
  following_id uuid,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT user_follows_follower_id_fkey
    FOREIGN KEY (follower_id) REFERENCES public.users(id),
  CONSTRAINT user_follows_following_id_fkey
    FOREIGN KEY (following_id) REFERENCES public.users(id),
  CONSTRAINT user_follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT user_follows_self_check CHECK (follower_id IS NULL OR following_id IS NULL OR follower_id <> following_id)
);

---------------------------------------------------------------
-- CAMPAIGN VIEWS
---------------------------------------------------------------

CREATE TABLE public.campaign_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  user_id uuid,
  ip_address inet,
  user_agent text,
  viewed_at timestamptz DEFAULT now(),

  CONSTRAINT campaign_views_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT campaign_views_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ============================================================
-- INDEXES (CORE ONLY – minimal but useful)
-- ============================================================

CREATE INDEX idx_campaigns_creator ON public.campaigns(creator_id);
CREATE INDEX idx_campaigns_category ON public.campaigns(category_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_end_date ON public.campaigns(end_date);
CREATE INDEX idx_campaigns_current_funding ON public.campaigns(current_funding);

CREATE INDEX idx_investments_investor ON public.investments(investor_id);
CREATE INDEX idx_investments_campaign ON public.investments(campaign_id);
CREATE INDEX idx_investments_status ON public.investments(status);

CREATE INDEX idx_milestones_campaign ON public.milestones(campaign_id);
CREATE INDEX idx_milestones_order ON public.milestones(campaign_id, order_index);

CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_campaign ON public.transactions(campaign_id);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_comments_campaign ON public.comments(campaign_id);

CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);

CREATE INDEX idx_campaign_views_campaign ON public.campaign_views(campaign_id);

CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_updated_at ON public.users(updated_at);
CREATE INDEX idx_users_is_verified ON public.users(is_verified);

-- ============================================================
-- FUNCTIONS & TRIGGERS (MINIMAL)
-- with FIXED search_path for security
-- ============================================================

---------------------------------------------------------------
-- Generic updated_at trigger
---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

---------------------------------------------------------------
-- Update campaign funding when investments change
---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_campaign_funding()
RETURNS trigger
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'confirmed' THEN
      UPDATE public.campaigns
      SET
        current_funding = current_funding + NEW.amount,
        investor_count = investor_count + 1,
        updated_at = now()
      WHERE id = NEW.campaign_id;

      UPDATE public.users
      SET
        total_invested = total_invested + NEW.amount,
        total_campaigns_backed = total_campaigns_backed + 1,
        updated_at = now()
      WHERE id = NEW.investor_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'confirmed' AND NEW.status = 'confirmed' THEN
      UPDATE public.campaigns
      SET
        current_funding = current_funding + NEW.amount,
        investor_count = investor_count + 1,
        updated_at = now()
      WHERE id = NEW.campaign_id;

      UPDATE public.users
      SET
        total_invested = total_invested + NEW.amount,
        total_campaigns_backed = total_campaigns_backed + 1,
        updated_at = now()
      WHERE id = NEW.investor_id;
    ELSIF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
      UPDATE public.campaigns
      SET
        current_funding = current_funding - OLD.amount,
        investor_count = GREATEST(investor_count - 1, 0),
        updated_at = now()
      WHERE id = OLD.campaign_id;

      UPDATE public.users
      SET
        total_invested = total_invested - OLD.amount,
        total_campaigns_backed = GREATEST(total_campaigns_backed - 1, 0),
        updated_at = now()
      WHERE id = OLD.investor_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

---------------------------------------------------------------
-- Update campaign social stats (likes/shares/comments/updates)
---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_campaign_stats()
RETURNS trigger
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'campaign_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.campaigns
      SET likes_count = likes_count + 1
      WHERE id = NEW.campaign_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.campaigns
      SET likes_count = GREATEST(likes_count - 1, 0)
      WHERE id = OLD.campaign_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'campaign_shares' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.campaigns
      SET shares_count = shares_count + 1
      WHERE id = NEW.campaign_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.campaigns
      SET comments_count = comments_count + 1
      WHERE id = NEW.campaign_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.campaigns
      SET comments_count = GREATEST(comments_count - 1, 0)
      WHERE id = OLD.campaign_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'campaign_updates' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.campaigns
      SET updates_count = updates_count + 1
      WHERE id = NEW.campaign_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

---------------------------------------------------------------
-- Update user follower/following counts
---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_user_follow_stats()
RETURNS trigger
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users
    SET following_count = following_count + 1
    WHERE id = NEW.follower_id;

    UPDATE public.users
    SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users
    SET following_count = GREATEST(following_count - 1, 0)
    WHERE id = OLD.follower_id;

    UPDATE public.users
    SET followers_count = GREATEST(followers_count - 1, 0)
    WHERE id = OLD.following_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

---------------------------------------------------------------
-- Triggers
---------------------------------------------------------------

-- updated_at triggers
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_investments_updated_at
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- campaign funding trigger
CREATE TRIGGER trg_investments_campaign_funding
  AFTER INSERT OR UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_funding();

-- social stats triggers
CREATE TRIGGER trg_campaign_likes_stats
  AFTER INSERT OR DELETE ON public.campaign_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_stats();

CREATE TRIGGER trg_campaign_shares_stats
  AFTER INSERT ON public.campaign_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_stats();

CREATE TRIGGER trg_campaign_comments_stats
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_stats();

CREATE TRIGGER trg_campaign_updates_stats
  AFTER INSERT ON public.campaign_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_stats();

-- follower/following stats
CREATE TRIGGER trg_user_follows_stats
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.update_user_follow_stats();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) – MINIMAL BUT SAFE
-- ============================================================

-- Enable RLS on key tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
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

---------------------------------------------------------------
-- USERS – minimal but practical
---------------------------------------------------------------

-- User can see their own full profile
CREATE POLICY users_select_own
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Public can see basic profiles (for campaign cards, creator info)
CREATE POLICY users_select_public
ON public.users
FOR SELECT
USING (true);

-- User can update their own profile
CREATE POLICY users_update_own
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- User can insert their own row (if you create profile manually)
CREATE POLICY users_insert_own
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

---------------------------------------------------------------
-- CATEGORIES – public read
---------------------------------------------------------------

CREATE POLICY categories_select_public
ON public.categories
FOR SELECT
USING (true);

---------------------------------------------------------------
-- CAMPAIGNS
---------------------------------------------------------------

-- Anyone can view campaigns
CREATE POLICY campaigns_select_public
ON public.campaigns
FOR SELECT
USING (true);

-- Creator can insert campaigns
CREATE POLICY campaigns_insert_creator
ON public.campaigns
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- Creator can update their own campaigns
CREATE POLICY campaigns_update_creator
ON public.campaigns
FOR UPDATE
USING (auth.uid() = creator_id);

---------------------------------------------------------------
-- MILESTONES
---------------------------------------------------------------

CREATE POLICY milestones_select_public
ON public.milestones
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = campaign_id
  )
);

CREATE POLICY milestones_manage_creator
ON public.milestones
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
      AND c.creator_id = auth.uid()
  )
);

---------------------------------------------------------------
-- INVESTMENTS
---------------------------------------------------------------

-- Investors see their own investments
CREATE POLICY investments_select_investor
ON public.investments
FOR SELECT
USING (auth.uid() = investor_id);

-- Creators see investments into their campaigns
CREATE POLICY investments_select_creator
ON public.investments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
      AND c.creator_id = auth.uid()
  )
);

-- Authenticated users create investments for themselves
CREATE POLICY investments_insert_investor
ON public.investments
FOR INSERT
WITH CHECK (auth.uid() = investor_id);

---------------------------------------------------------------
-- TRANSACTIONS
---------------------------------------------------------------

CREATE POLICY transactions_select_own
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY transactions_insert_own
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- NOTIFICATIONS
---------------------------------------------------------------

CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY notifications_insert_system
ON public.notifications
FOR INSERT
WITH CHECK (true); -- typically created via service_role

---------------------------------------------------------------
-- FAVORITES
---------------------------------------------------------------

CREATE POLICY favorites_all_own
ON public.favorites
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- COMMENTS
---------------------------------------------------------------

CREATE POLICY comments_select_public
ON public.comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
  )
);

CREATE POLICY comments_insert_own
ON public.comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY comments_update_own
ON public.comments
FOR UPDATE
USING (auth.uid() = user_id);

---------------------------------------------------------------
-- CAMPAIGN MEDIA
---------------------------------------------------------------

CREATE POLICY campaign_media_select_public
ON public.campaign_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
  )
);

CREATE POLICY campaign_media_manage_creator
ON public.campaign_media
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
      AND c.creator_id = auth.uid()
  )
);

---------------------------------------------------------------
-- CAMPAIGN LIKES
---------------------------------------------------------------

CREATE POLICY campaign_likes_select_public
ON public.campaign_likes
FOR SELECT
USING (true);

CREATE POLICY campaign_likes_manage_own
ON public.campaign_likes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- CAMPAIGN SHARES
---------------------------------------------------------------

CREATE POLICY campaign_shares_select_public
ON public.campaign_shares
FOR SELECT
USING (true);

CREATE POLICY campaign_shares_insert_own
ON public.campaign_shares
FOR INSERT
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- COMMENT LIKES
---------------------------------------------------------------

CREATE POLICY comment_likes_select_public
ON public.comment_likes
FOR SELECT
USING (true);

CREATE POLICY comment_likes_manage_own
ON public.comment_likes
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- USER VERIFICATIONS (user sees own)
---------------------------------------------------------------

CREATE POLICY user_verifications_select_own
ON public.user_verifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY user_verifications_insert_own
ON public.user_verifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- USER PAYMENT METHODS
---------------------------------------------------------------

CREATE POLICY user_payment_methods_all_own
ON public.user_payment_methods
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- CAMPAIGN UPDATES
---------------------------------------------------------------

CREATE POLICY campaign_updates_select_public
ON public.campaign_updates
FOR SELECT
USING (is_public = true);

CREATE POLICY campaign_updates_manage_creator
ON public.campaign_updates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
      AND c.creator_id = auth.uid()
  )
);

---------------------------------------------------------------
-- SEARCH FILTERS
---------------------------------------------------------------

CREATE POLICY search_filters_all_own
ON public.search_filters
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

---------------------------------------------------------------
-- REFERRALS
---------------------------------------------------------------

CREATE POLICY referrals_select_own
ON public.referrals
FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY referrals_insert_system
ON public.referrals
FOR INSERT
WITH CHECK (true);

---------------------------------------------------------------
-- EMAIL CAMPAIGNS (likely admin/system only, keep simple)
---------------------------------------------------------------

CREATE POLICY email_campaigns_select_public
ON public.email_campaigns
FOR SELECT
USING (true);

CREATE POLICY email_campaigns_insert_system
ON public.email_campaigns
FOR INSERT
WITH CHECK (true);

---------------------------------------------------------------
-- USER FOLLOWS
---------------------------------------------------------------

CREATE POLICY user_follows_select_public
ON public.user_follows
FOR SELECT
USING (true);

CREATE POLICY user_follows_manage_own
ON public.user_follows
FOR ALL
USING (auth.uid() = follower_id)
WITH CHECK (auth.uid() = follower_id);

---------------------------------------------------------------
-- CAMPAIGN VIEWS (analytics – system insert, creator read)
---------------------------------------------------------------

CREATE POLICY campaign_views_select_creator
ON public.campaign_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
      AND c.creator_id = auth.uid()
  )
);

CREATE POLICY campaign_views_insert_system
ON public.campaign_views
FOR INSERT
WITH CHECK (true);

-- ============================================================
-- END OF CURRENT FUNDCHAIN SCHEMA
-- ============================================================
