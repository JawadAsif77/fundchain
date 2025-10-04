-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.campaign_likes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaign_likes_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_likes_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.campaign_media (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  type USER-DEFINED NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  thumbnail_url text,
  caption text,
  sort_order integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaign_media_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_media_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.campaign_shares (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  user_id uuid,
  platform text,
  shared_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaign_shares_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_shares_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.campaign_updates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  author_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  is_public boolean DEFAULT true,
  media_urls ARRAY,
  sent_to_investors boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaign_updates_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_updates_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.campaign_views (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  user_id uuid,
  ip_address inet,
  user_agent text,
  viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaign_views_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_views_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  creator_id uuid NOT NULL,
  category_id uuid,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  short_description text,
  image_url text,
  gallery_images ARRAY,
  video_url text,
  funding_goal numeric NOT NULL CHECK (funding_goal > 0::numeric),
  current_funding numeric DEFAULT 0,
  min_investment numeric DEFAULT 100 CHECK (min_investment > 0::numeric),
  max_investment numeric,
  investor_count integer DEFAULT 0,
  equity_percentage numeric,
  expected_return numeric,
  risk_level integer CHECK (risk_level >= 1 AND risk_level <= 5),
  status USER-DEFINED DEFAULT 'draft'::campaign_status,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  documents jsonb DEFAULT '[]'::jsonb,
  business_plan_url text,
  financial_projections jsonb,
  team_members jsonb DEFAULT '[]'::jsonb,
  location text,
  industry text,
  tags ARRAY,
  featured boolean DEFAULT false,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  campaign_type USER-DEFINED DEFAULT 'donation'::campaign_type,
  funding_model USER-DEFINED DEFAULT 'all_or_nothing'::funding_model,
  social_sharing_enabled boolean DEFAULT true,
  updates_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  seo_title text,
  seo_description text,
  external_links jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comment_likes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  comment_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid,
  content text NOT NULL,
  is_edited boolean DEFAULT false,
  edited_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id)
);
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  registration_number text,
  country text NOT NULL,
  website text,
  verified boolean DEFAULT false,
  verification_notes text,
  verified_at timestamp with time zone,
  verified_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.email_campaigns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  subject text NOT NULL,
  content text NOT NULL,
  recipient_type text,
  sent_count integer DEFAULT 0,
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT email_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.favorites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.investments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  investor_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  status USER-DEFINED DEFAULT 'pending'::investment_status,
  payment_method text,
  payment_reference text,
  stripe_payment_intent_id text,
  investment_date timestamp with time zone DEFAULT now(),
  confirmed_at timestamp with time zone,
  refunded_at timestamp with time zone,
  refund_amount numeric,
  refund_reason text,
  equity_shares numeric,
  certificate_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT investments_pkey PRIMARY KEY (id),
  CONSTRAINT investments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.milestones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  target_amount numeric,
  target_date date,
  is_completed boolean DEFAULT false,
  completion_date timestamp with time zone,
  completion_notes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT milestones_pkey PRIMARY KEY (id),
  CONSTRAINT milestones_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project_docs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid,
  company_id uuid,
  document_type USER-DEFINED NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_docs_pkey PRIMARY KEY (id),
  CONSTRAINT project_docs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_docs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.project_investments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  status text DEFAULT 'initiated'::text CHECK (status = ANY (ARRAY['initiated'::text, 'completed'::text, 'cancelled'::text])),
  payment_method text,
  payment_reference text,
  investment_date timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_investments_pkey PRIMARY KEY (id),
  CONSTRAINT project_investments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.project_milestones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  milestone_index integer NOT NULL,
  name text NOT NULL,
  description text,
  payout_percentage numeric NOT NULL CHECK (payout_percentage > 0::numeric AND payout_percentage <= 100::numeric),
  target_amount numeric,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_milestones_pkey PRIMARY KEY (id),
  CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  creator_id uuid NOT NULL,
  company_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text NOT NULL,
  description text,
  category text NOT NULL,
  goal_amount numeric NOT NULL CHECK (goal_amount > 0::numeric),
  current_raised numeric DEFAULT 0 CHECK (current_raised >= 0::numeric),
  deadline timestamp with time zone NOT NULL,
  status USER-DEFINED DEFAULT 'draft'::project_status,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  referrer_id uuid,
  referred_id uuid,
  campaign_id uuid,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  conversion_at timestamp with time zone,
  reward_amount numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.search_filters (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text,
  filters jsonb NOT NULL,
  is_saved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT search_filters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  campaign_id uuid,
  investment_id uuid,
  amount numeric NOT NULL,
  type USER-DEFINED NOT NULL,
  description text,
  payment_method text,
  payment_reference text,
  stripe_charge_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT transactions_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id)
);
CREATE TABLE public.user_follows (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  follower_id uuid,
  following_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_follows_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_payment_methods (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  type USER-DEFINED NOT NULL,
  provider text,
  external_id text,
  is_default boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_payment_methods_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  legal_name text NOT NULL,
  legal_address jsonb NOT NULL CHECK (legal_address ? 'line1'::text AND legal_address ? 'city'::text AND legal_address ? 'state'::text AND legal_address ? 'postal_code'::text AND legal_address ? 'country'::text),
  phone text NOT NULL,
  legal_email USER-DEFINED NOT NULL,
  business_email USER-DEFINED,
  id_document_url text,
  selfie_image_url text,
  verification_type USER-DEFINED NOT NULL DEFAULT 'individual'::kyc_verification_type,
  verification_status USER-DEFINED NOT NULL DEFAULT 'pending'::kyc_verification_status,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  admin_notes text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT user_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT auth.uid(),
  email USER-DEFINED NOT NULL UNIQUE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  role USER-DEFINED NOT NULL DEFAULT 'investor'::user_role,
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  is_verified USER-DEFINED NOT NULL DEFAULT 'no'::verified_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  bio text,
  location text,
  phone text,
  date_of_birth date,
  social_links jsonb DEFAULT '{}'::jsonb,
  preferences jsonb DEFAULT '{}'::jsonb,
  verification_level integer DEFAULT 0,
  trust_score numeric DEFAULT 0,
  referral_code text UNIQUE,
  last_active_at timestamp with time zone,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  is_accredited_investor boolean DEFAULT false,
  total_invested numeric DEFAULT 0,
  total_campaigns_backed integer DEFAULT 0,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);