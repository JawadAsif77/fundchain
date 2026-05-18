-- ==============================================================================
-- SECURITY MIGRATION: RLS + RBAC + Audit Logs
-- Applied: 2026-05-18  |  Patched: 2026-05-18 (enum-aware, full schema)
-- ==============================================================================

-- ==============================================================================
-- BEFORE RUNNING: verify your enum labels match what this migration assumes.
-- Paste these three queries into the Supabase SQL Editor and read the results.
--
--   SELECT unnest(enum_range(NULL::user_role));
--   -- Expected labels used here: creator, investor, admin, customer_support
--
--   SELECT unnest(enum_range(NULL::campaign_status));
--   -- Expected labels used here: active, approved, failed, cancelled, pending, completed
--
--   SELECT unnest(enum_range(NULL::kyc_verification_status));
--   -- Expected labels used here: pending, approved, rejected
--
-- If any label differs from what is used below, update the policy or helper
-- function that references it before running.
-- ==============================================================================

-- ==============================================================================
-- STEP 0: Guard for public.users.role column.
-- In this schema, role is type user_role (enum), which should already exist.
-- The ADD COLUMN branch only fires if the column is entirely missing.
-- It will NOT overwrite an existing user_role column with text.
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    -- Fallback: add as text if enum type does not yet exist.
    -- If user_role enum exists, replace 'text' with 'user_role' before running.
    ALTER TABLE public.users ADD COLUMN role text DEFAULT NULL;
  END IF;
END $$;

-- ==============================================================================
-- PHASE 4: RBAC Helper Functions (enum-safe, SECURITY DEFINER)
--
-- All functions are SECURITY DEFINER so they bypass RLS when querying
-- public.users. This prevents infinite recursion when these functions are
-- called from inside RLS policies on the same table.
--
-- Enum-safety rules applied throughout:
--   role::text     — casts user_role enum to text for string comparison
--   status::text   — casts campaign_status enum to text for string comparison
-- ==============================================================================

-- Returns the caller's role as text (safe to use in any comparison).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role          -- returns the actual enum type; avoids type mismatch in WITH CHECK
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Returns true when the caller's role::text = 'admin'.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role::text = 'admin'
  );
$$;

-- Returns true when the caller's role::text is 'admin' or 'customer_support'.
CREATE OR REPLACE FUNCTION public.is_customer_support()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role::text IN ('admin', 'customer_support')
  );
$$;

-- Returns the stored status of a campaign as campaign_status enum.
-- Used in campaigns_creator_update WITH CHECK to avoid RLS self-recursion.
CREATE OR REPLACE FUNCTION public.get_campaign_status(cid uuid)
RETURNS campaign_status    -- same type as campaigns.status — no cast needed in WITH CHECK
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.campaigns WHERE id = cid;
$$;

-- Returns the stored verification_status of a user's KYC record.
-- Used in kyc_own_update WITH CHECK to avoid RLS self-recursion on user_verifications.
CREATE OR REPLACE FUNCTION public.get_kyc_status_for_user(uid uuid)
RETURNS kyc_verification_status  -- same type as user_verifications.verification_status
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT verification_status FROM public.user_verifications WHERE user_id = uid LIMIT 1;
$$;

-- ==============================================================================
-- PHASE 8: AUDIT LOGS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            bigserial    PRIMARY KEY,
  actor_user_id uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text         NOT NULL,
  target_type   text,
  target_id     text,
  metadata      jsonb        DEFAULT '{}',
  ip_address    text,
  user_agent    text,
  created_at    timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor   ON public.audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action  ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='audit_logs_admin_read') THEN
    CREATE POLICY "audit_logs_admin_read"
      ON public.audit_logs FOR SELECT
      USING (public.is_admin());
  END IF;
  -- No INSERT/UPDATE/DELETE for authenticated role.
  -- Edge Functions write to audit_logs using the service role key.
END $$;

-- ==============================================================================
-- PHASE 3: RLS — CORE TABLES (always present in schema)
-- ==============================================================================

-- ---- USERS -------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_own_select') THEN
    CREATE POLICY "users_own_select"
      ON public.users FOR SELECT
      USING (id = auth.uid() OR public.is_admin() OR public.is_customer_support());
  END IF;

  -- Prevents role self-promotion.
  -- current_user_role() is SECURITY DEFINER and returns user_role enum, matching
  -- the type of the role column — no cast needed, no RLS recursion.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_own_update') THEN
    CREATE POLICY "users_own_update"
      ON public.users FOR UPDATE
      USING (id = auth.uid())
      WITH CHECK (
        id = auth.uid()
        AND (
          role IS NOT DISTINCT FROM public.current_user_role()
          OR public.is_admin()
        )
      );
  END IF;

  -- Admin can update any user row (including role column).
  -- No WITH CHECK restriction — defaults to the USING expression.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_admin_update') THEN
    CREATE POLICY "users_admin_update"
      ON public.users FOR UPDATE
      USING (public.is_admin());
  END IF;
  -- INSERT: handled by Supabase auth trigger running as service role (bypasses RLS).
END $$;

-- ---- WALLETS -----------------------------------------------------------------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wallets' AND policyname='wallets_own_select') THEN
    CREATE POLICY "wallets_own_select"
      ON public.wallets FOR SELECT
      USING (user_id = auth.uid() OR public.is_admin());
  END IF;
  -- No INSERT/UPDATE/DELETE for authenticated role.
  -- All wallet balance changes go through Edge Functions (service role bypasses RLS).
END $$;

-- ---- CAMPAIGNS ---------------------------------------------------------------
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- status::text cast converts campaign_status enum to text for safe IN comparison.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='campaigns_public_read') THEN
    CREATE POLICY "campaigns_public_read"
      ON public.campaigns FOR SELECT
      USING (
        status::text IN ('active', 'approved', 'completed')
        OR creator_id = auth.uid()
        OR public.is_admin()
        OR public.is_customer_support()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='campaigns_creator_insert') THEN
    CREATE POLICY "campaigns_creator_insert"
      ON public.campaigns FOR INSERT
      WITH CHECK (creator_id = auth.uid());
  END IF;

  -- get_campaign_status() is SECURITY DEFINER returning campaign_status enum —
  -- same type as status column, so IS NOT DISTINCT FROM works without any cast.
  -- This prevents RLS self-recursion and blocks creator from self-approving campaigns.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='campaigns_creator_update') THEN
    CREATE POLICY "campaigns_creator_update"
      ON public.campaigns FOR UPDATE
      USING (creator_id = auth.uid())
      WITH CHECK (
        creator_id = auth.uid()
        AND status IS NOT DISTINCT FROM public.get_campaign_status(id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='campaigns_admin_all') THEN
    CREATE POLICY "campaigns_admin_all"
      ON public.campaigns FOR ALL
      USING (public.is_admin());
  END IF;
END $$;

-- ---- INVESTMENTS -------------------------------------------------------------
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investments' AND policyname='investments_own_select') THEN
    CREATE POLICY "investments_own_select"
      ON public.investments FOR SELECT
      USING (investor_id = auth.uid() OR public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='investments' AND policyname='investments_campaign_creator_select') THEN
    CREATE POLICY "investments_campaign_creator_select"
      ON public.investments FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.campaigns
          WHERE campaigns.id = investments.campaign_id
            AND campaigns.creator_id = auth.uid()
        )
      );
  END IF;
  -- No direct INSERT/UPDATE from frontend — invest-in-campaign Edge Function handles this.
END $$;

-- ---- TRANSACTIONS ------------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='transactions_own_select') THEN
    CREATE POLICY "transactions_own_select"
      ON public.transactions FOR SELECT
      USING (user_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- ---- USER VERIFICATIONS (KYC) -----------------------------------------------
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_verifications' AND policyname='kyc_own_select') THEN
    CREATE POLICY "kyc_own_select"
      ON public.user_verifications FOR SELECT
      USING (user_id = auth.uid() OR public.is_customer_support());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_verifications' AND policyname='kyc_own_upsert') THEN
    CREATE POLICY "kyc_own_upsert"
      ON public.user_verifications FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- get_kyc_status_for_user() is SECURITY DEFINER returning kyc_verification_status
  -- enum — same type as verification_status column, no cast needed, no recursion.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_verifications' AND policyname='kyc_own_update') THEN
    CREATE POLICY "kyc_own_update"
      ON public.user_verifications FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (
        user_id = auth.uid()
        AND (
          verification_status IS NOT DISTINCT FROM public.get_kyc_status_for_user(auth.uid())
          OR public.is_customer_support()
        )
      );
  END IF;

  -- Admin / customer_support can set verification_status (approve/reject KYC).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_verifications' AND policyname='kyc_support_update') THEN
    CREATE POLICY "kyc_support_update"
      ON public.user_verifications FOR UPDATE
      USING (public.is_customer_support());
  END IF;
END $$;

-- ==============================================================================
-- PHASE 3: RLS — OPTIONAL TABLES (skip gracefully if table absent)
-- ==============================================================================

-- ---- TOKEN TRANSACTIONS ------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='token_transactions') THEN
    EXECUTE 'ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='token_transactions' AND policyname='token_transactions_own_select') THEN
      EXECUTE 'CREATE POLICY "token_transactions_own_select"
        ON public.token_transactions FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- NOTIFICATIONS -----------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_own_select') THEN
      EXECUTE 'CREATE POLICY "notifications_own_select"
        ON public.notifications FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_own_update') THEN
      EXECUTE 'CREATE POLICY "notifications_own_update"
        ON public.notifications FOR UPDATE
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- FUND_TRANSACTIONS -------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fund_transactions') THEN
    EXECUTE 'ALTER TABLE public.fund_transactions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fund_transactions' AND policyname='fund_transactions_own_select') THEN
      EXECUTE 'CREATE POLICY "fund_transactions_own_select"
        ON public.fund_transactions FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- CAMPAIGN WALLETS (escrow) -----------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_wallets') THEN
    EXECUTE 'ALTER TABLE public.campaign_wallets ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_wallets' AND policyname='campaign_wallets_creator_select') THEN
      EXECUTE $pol$CREATE POLICY "campaign_wallets_creator_select"
        ON public.campaign_wallets FOR SELECT
        USING (
          public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_wallets.campaign_id
              AND campaigns.creator_id = auth.uid()
          )
        )$pol$;
    END IF;
  END IF;
END $$;

-- ---- CAMPAIGN INVESTMENTS ----------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_investments') THEN
    EXECUTE 'ALTER TABLE public.campaign_investments ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_investments' AND policyname='campaign_investments_own_select') THEN
      EXECUTE $pol$CREATE POLICY "campaign_investments_own_select"
        ON public.campaign_investments FOR SELECT
        USING (
          investor_id = auth.uid()
          OR public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_investments.campaign_id
              AND campaigns.creator_id = auth.uid()
          )
        )$pol$;
    END IF;
  END IF;
END $$;

-- ---- MILESTONE VOTES ---------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='milestone_votes') THEN
    EXECUTE 'ALTER TABLE public.milestone_votes ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestone_votes' AND policyname='milestone_votes_investor_select') THEN
      EXECUTE 'CREATE POLICY "milestone_votes_investor_select"
        ON public.milestone_votes FOR SELECT
        USING (investor_id = auth.uid() OR public.is_admin())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestone_votes' AND policyname='milestone_votes_investor_insert') THEN
      EXECUTE 'CREATE POLICY "milestone_votes_investor_insert"
        ON public.milestone_votes FOR INSERT
        WITH CHECK (investor_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- REPORTS -----------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reports') THEN
    EXECUTE 'ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='reports_own_select') THEN
      EXECUTE 'CREATE POLICY "reports_own_select"
        ON public.reports FOR SELECT
        USING (reporter_user_id = auth.uid() OR public.is_admin())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='reports_authenticated_insert') THEN
      EXECUTE 'CREATE POLICY "reports_authenticated_insert"
        ON public.reports FOR INSERT
        WITH CHECK (reporter_user_id = auth.uid())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='reports_admin_update') THEN
      EXECUTE 'CREATE POLICY "reports_admin_update"
        ON public.reports FOR UPDATE
        USING (public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- MILESTONES --------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='milestones') THEN
    EXECUTE 'ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestones' AND policyname='milestones_public_read') THEN
      EXECUTE $pol$CREATE POLICY "milestones_public_read"
        ON public.milestones FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = milestones.campaign_id
              AND campaigns.status::text IN ('active', 'approved', 'completed')
          )
          OR public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = milestones.campaign_id
              AND campaigns.creator_id = auth.uid()
          )
        )$pol$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestones' AND policyname='milestones_creator_insert') THEN
      EXECUTE $pol$CREATE POLICY "milestones_creator_insert"
        ON public.milestones FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = milestones.campaign_id
              AND campaigns.creator_id = auth.uid()
          )
          OR public.is_admin()
        )$pol$;
    END IF;
  END IF;
END $$;

-- ---- CATEGORIES --------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='categories') THEN
    EXECUTE 'ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='categories_public_read') THEN
      EXECUTE 'CREATE POLICY "categories_public_read"
        ON public.categories FOR SELECT
        USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='categories_admin_write') THEN
      EXECUTE 'CREATE POLICY "categories_admin_write"
        ON public.categories FOR ALL
        USING (public.is_admin())';
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- PHASE 3: RLS — NEWLY ADDED SENSITIVE TABLES
-- Assumption notes: column names below are assumed from typical schema conventions.
-- If your actual column name differs, update the policy before running.
-- ==============================================================================

-- ---- WALLET_WITHDRAWALS ------------------------------------------------------
-- Assumption: has user_id uuid column referencing the requester.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wallet_withdrawals') THEN
    EXECUTE 'ALTER TABLE public.wallet_withdrawals ENABLE ROW LEVEL SECURITY';

    -- Users can see their own withdrawal requests; admin sees all.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wallet_withdrawals' AND policyname='wallet_withdrawals_own_select') THEN
      EXECUTE 'CREATE POLICY "wallet_withdrawals_own_select"
        ON public.wallet_withdrawals FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;

    -- Users can submit their own withdrawal requests.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wallet_withdrawals' AND policyname='wallet_withdrawals_own_insert') THEN
      EXECUTE 'CREATE POLICY "wallet_withdrawals_own_insert"
        ON public.wallet_withdrawals FOR INSERT
        WITH CHECK (user_id = auth.uid())';
    END IF;

    -- Only admin can approve/reject (UPDATE) withdrawal requests.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wallet_withdrawals' AND policyname='wallet_withdrawals_admin_update') THEN
      EXECUTE 'CREATE POLICY "wallet_withdrawals_admin_update"
        ON public.wallet_withdrawals FOR UPDATE
        USING (public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- PHONE_VERIFICATION_LOGS -------------------------------------------------
-- Assumption: has user_id uuid column.
-- OTP codes are in this table — normal users must NOT read them.
-- Only admin/customer_support can SELECT (for support purposes).
-- All writes go through Edge Functions (service role).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='phone_verification_logs') THEN
    EXECUTE 'ALTER TABLE public.phone_verification_logs ENABLE ROW LEVEL SECURITY';

    -- Restrict reads to support staff only — normal users cannot read OTP codes.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='phone_verification_logs' AND policyname='phone_verification_logs_support_select') THEN
      EXECUTE 'CREATE POLICY "phone_verification_logs_support_select"
        ON public.phone_verification_logs FOR SELECT
        USING (public.is_customer_support())';
    END IF;
    -- No INSERT/UPDATE/DELETE from frontend — Edge Functions use service role.
  END IF;
END $$;

-- ---- PLATFORM_WALLET ---------------------------------------------------------
-- Global treasury/fee wallet. No normal user should read or write this.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_wallet') THEN
    EXECUTE 'ALTER TABLE public.platform_wallet ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_wallet' AND policyname='platform_wallet_admin_select') THEN
      EXECUTE 'CREATE POLICY "platform_wallet_admin_select"
        ON public.platform_wallet FOR SELECT
        USING (public.is_admin())';
    END IF;
    -- All writes go through Edge Functions (service role bypasses RLS).
  END IF;
END $$;

-- ---- ADMIN_ACTIONS -----------------------------------------------------------
-- Internal admin operation log. No normal user access at all.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='admin_actions') THEN
    EXECUTE 'ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_actions' AND policyname='admin_actions_admin_all') THEN
      EXECUTE 'CREATE POLICY "admin_actions_admin_all"
        ON public.admin_actions FOR ALL
        USING (public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- RECOMMENDATION_EVENTS ---------------------------------------------------
-- Assumption: has user_id uuid column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recommendation_events') THEN
    EXECUTE 'ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recommendation_events' AND policyname='recommendation_events_own_select') THEN
      EXECUTE 'CREATE POLICY "recommendation_events_own_select"
        ON public.recommendation_events FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recommendation_events' AND policyname='recommendation_events_own_insert') THEN
      EXECUTE 'CREATE POLICY "recommendation_events_own_insert"
        ON public.recommendation_events FOR INSERT
        WITH CHECK (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- CHAT_MESSAGES -----------------------------------------------------------
-- Assumption: has user_id uuid column for the message sender.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chat_messages') THEN
    EXECUTE 'ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_own_select') THEN
      EXECUTE 'CREATE POLICY "chat_messages_own_select"
        ON public.chat_messages FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_own_insert') THEN
      EXECUTE 'CREATE POLICY "chat_messages_own_insert"
        ON public.chat_messages FOR INSERT
        WITH CHECK (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- DOC_EMBEDDINGS ----------------------------------------------------------
-- Vector embeddings for the chatbot. Should NEVER be directly readable by
-- normal users — only accessed by Edge Functions via service role (pgvector RPC).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='doc_embeddings') THEN
    EXECUTE 'ALTER TABLE public.doc_embeddings ENABLE ROW LEVEL SECURITY';

    -- Admin-only direct read for debugging. Chatbot searches via Edge Function + service role.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='doc_embeddings' AND policyname='doc_embeddings_admin_select') THEN
      EXECUTE 'CREATE POLICY "doc_embeddings_admin_select"
        ON public.doc_embeddings FOR SELECT
        USING (public.is_admin())';
    END IF;
    -- Writes go through Edge Functions (service role bypasses RLS).
  END IF;
END $$;

-- ---- USER_PREFERENCES --------------------------------------------------------
-- Assumption: has user_id uuid column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_preferences') THEN
    EXECUTE 'ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_preferences' AND policyname='user_preferences_own_select') THEN
      EXECUTE 'CREATE POLICY "user_preferences_own_select"
        ON public.user_preferences FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_preferences' AND policyname='user_preferences_own_insert') THEN
      EXECUTE 'CREATE POLICY "user_preferences_own_insert"
        ON public.user_preferences FOR INSERT
        WITH CHECK (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_preferences' AND policyname='user_preferences_own_update') THEN
      EXECUTE 'CREATE POLICY "user_preferences_own_update"
        ON public.user_preferences FOR UPDATE
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- USER_PAYMENT_METHODS ----------------------------------------------------
-- Assumption: has user_id uuid column. Sensitive financial data — no cross-user access.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_payment_methods') THEN
    EXECUTE 'ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_payment_methods' AND policyname='user_payment_methods_own_select') THEN
      EXECUTE 'CREATE POLICY "user_payment_methods_own_select"
        ON public.user_payment_methods FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin())';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_payment_methods' AND policyname='user_payment_methods_own_insert') THEN
      EXECUTE 'CREATE POLICY "user_payment_methods_own_insert"
        ON public.user_payment_methods FOR INSERT
        WITH CHECK (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_payment_methods' AND policyname='user_payment_methods_own_update') THEN
      EXECUTE 'CREATE POLICY "user_payment_methods_own_update"
        ON public.user_payment_methods FOR UPDATE
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- CAMPAIGN_INVESTORS ------------------------------------------------------
-- Assumption: has investor_id uuid and campaign_id uuid columns.
-- (Distinct from campaign_investments — may be a summary/join table.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_investors') THEN
    EXECUTE 'ALTER TABLE public.campaign_investors ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_investors' AND policyname='campaign_investors_own_select') THEN
      EXECUTE $pol$CREATE POLICY "campaign_investors_own_select"
        ON public.campaign_investors FOR SELECT
        USING (
          investor_id = auth.uid()
          OR public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_investors.campaign_id
              AND campaigns.creator_id = auth.uid()
          )
        )$pol$;
    END IF;
    -- Direct frontend writes blocked — investments processed via Edge Function.
  END IF;
END $$;

-- ==============================================================================
-- PHASE 3: RLS — OPTIONAL SOCIAL / CONTENT TABLES
-- ==============================================================================

-- ---- CAMPAIGN_LIKES ----------------------------------------------------------
-- Assumption: has user_id uuid and campaign_id uuid columns.
-- Like counts are public; who liked is public (common UX pattern).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_likes') THEN
    EXECUTE 'ALTER TABLE public.campaign_likes ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_likes' AND policyname='campaign_likes_public_select') THEN
      EXECUTE 'CREATE POLICY "campaign_likes_public_select" ON public.campaign_likes FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_likes' AND policyname='campaign_likes_own_insert') THEN
      EXECUTE 'CREATE POLICY "campaign_likes_own_insert" ON public.campaign_likes FOR INSERT WITH CHECK (user_id = auth.uid())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_likes' AND policyname='campaign_likes_own_delete') THEN
      EXECUTE 'CREATE POLICY "campaign_likes_own_delete" ON public.campaign_likes FOR DELETE USING (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- FAVORITES ---------------------------------------------------------------
-- Assumption: has user_id uuid column. Private — users see only their own.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='favorites') THEN
    EXECUTE 'ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='favorites' AND policyname='favorites_own_select') THEN
      EXECUTE 'CREATE POLICY "favorites_own_select" ON public.favorites FOR SELECT USING (user_id = auth.uid())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='favorites' AND policyname='favorites_own_insert') THEN
      EXECUTE 'CREATE POLICY "favorites_own_insert" ON public.favorites FOR INSERT WITH CHECK (user_id = auth.uid())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='favorites' AND policyname='favorites_own_delete') THEN
      EXECUTE 'CREATE POLICY "favorites_own_delete" ON public.favorites FOR DELETE USING (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ---- CAMPAIGN_QUESTIONS ------------------------------------------------------
-- Assumption: has user_id uuid column for the question author.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_questions') THEN
    EXECUTE 'ALTER TABLE public.campaign_questions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_questions' AND policyname='campaign_questions_public_select') THEN
      EXECUTE 'CREATE POLICY "campaign_questions_public_select" ON public.campaign_questions FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_questions' AND policyname='campaign_questions_own_insert') THEN
      EXECUTE 'CREATE POLICY "campaign_questions_own_insert" ON public.campaign_questions FOR INSERT WITH CHECK (user_id = auth.uid())';
    END IF;
    -- Creator/admin can hide or update questions (moderation).
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_questions' AND policyname='campaign_questions_admin_update') THEN
      EXECUTE 'CREATE POLICY "campaign_questions_admin_update" ON public.campaign_questions FOR UPDATE USING (public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- CAMPAIGN_ANSWERS --------------------------------------------------------
-- Assumption: has user_id uuid column for the answer author.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_answers') THEN
    EXECUTE 'ALTER TABLE public.campaign_answers ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_answers' AND policyname='campaign_answers_public_select') THEN
      EXECUTE 'CREATE POLICY "campaign_answers_public_select" ON public.campaign_answers FOR SELECT USING (true)';
    END IF;
    -- Campaign creator or admin can post answers.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_answers' AND policyname='campaign_answers_creator_insert') THEN
      EXECUTE $pol$CREATE POLICY "campaign_answers_creator_insert"
        ON public.campaign_answers FOR INSERT
        WITH CHECK (user_id = auth.uid() OR public.is_admin())$pol$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_answers' AND policyname='campaign_answers_own_update') THEN
      EXECUTE 'CREATE POLICY "campaign_answers_own_update" ON public.campaign_answers FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- CAMPAIGN_UPDATES --------------------------------------------------------
-- Assumption: has campaign_id uuid column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_updates') THEN
    EXECUTE 'ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_updates' AND policyname='campaign_updates_public_select') THEN
      EXECUTE 'CREATE POLICY "campaign_updates_public_select" ON public.campaign_updates FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_updates' AND policyname='campaign_updates_creator_insert') THEN
      EXECUTE $pol$CREATE POLICY "campaign_updates_creator_insert"
        ON public.campaign_updates FOR INSERT
        WITH CHECK (
          public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_updates.campaign_id
              AND campaigns.creator_id = auth.uid()
          )
        )$pol$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaign_updates' AND policyname='campaign_updates_creator_update') THEN
      EXECUTE $pol$CREATE POLICY "campaign_updates_creator_update"
        ON public.campaign_updates FOR UPDATE
        USING (
          public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_updates.campaign_id
              AND campaigns.creator_id = auth.uid()
          )
        )$pol$;
    END IF;
  END IF;
END $$;

-- ---- COMMENTS ----------------------------------------------------------------
-- Assumption: has user_id uuid column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='comments') THEN
    EXECUTE 'ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_public_select') THEN
      EXECUTE 'CREATE POLICY "comments_public_select" ON public.comments FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_own_insert') THEN
      EXECUTE 'CREATE POLICY "comments_own_insert" ON public.comments FOR INSERT WITH CHECK (user_id = auth.uid())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_own_update') THEN
      EXECUTE 'CREATE POLICY "comments_own_update" ON public.comments FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_own_delete') THEN
      EXECUTE 'CREATE POLICY "comments_own_delete" ON public.comments FOR DELETE USING (user_id = auth.uid() OR public.is_admin())';
    END IF;
  END IF;
END $$;

-- ---- COMMENT_LIKES -----------------------------------------------------------
-- Assumption: has user_id uuid column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='comment_likes') THEN
    EXECUTE 'ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comment_likes' AND policyname='comment_likes_public_select') THEN
      EXECUTE 'CREATE POLICY "comment_likes_public_select" ON public.comment_likes FOR SELECT USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comment_likes' AND policyname='comment_likes_own_insert') THEN
      EXECUTE 'CREATE POLICY "comment_likes_own_insert" ON public.comment_likes FOR INSERT WITH CHECK (user_id = auth.uid())';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comment_likes' AND policyname='comment_likes_own_delete') THEN
      EXECUTE 'CREATE POLICY "comment_likes_own_delete" ON public.comment_likes FOR DELETE USING (user_id = auth.uid())';
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- Grant execute on all helper functions to authenticated users
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.current_user_role()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_customer_support()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_status(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kyc_status_for_user(uuid)   TO authenticated;
