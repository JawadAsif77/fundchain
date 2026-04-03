-- ============================================================
-- SECURITY HARDENING (APR 2026)
-- Purpose: lock sensitive data access and remove broad public reads
-- ============================================================

-- ----------------------------
-- 1) USERS TABLE HARDENING
-- ----------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Helper to avoid recursive users-table policy checks.
CREATE OR REPLACE FUNCTION public.is_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = target_user_id
      AND u.role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Allow public read access to user profiles" ON public.users;
DROP POLICY IF EXISTS "Allow anonymous read access to user profiles" ON public.users;
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;

-- Keep own-profile and admin access from existing scripts; re-create defensively
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public verified creators are readable" ON public.users;
CREATE POLICY "Public verified creators are readable"
ON public.users
FOR SELECT
TO anon, authenticated
USING (role = 'creator' AND is_verified = 'verified');

DROP POLICY IF EXISTS "Admin can read all users" ON public.users;
CREATE POLICY "Admin can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.is_admin_user(auth.uid())
);

-- ----------------------------
-- 2) WALLETS + TRANSACTIONS
-- ----------------------------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own
ON public.wallets
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS wallets_insert_own ON public.wallets;
CREATE POLICY wallets_insert_own
ON public.wallets
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
CREATE POLICY wallets_update_own
ON public.wallets
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS token_transactions_select_own ON public.token_transactions;
CREATE POLICY token_transactions_select_own
ON public.token_transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own
ON public.transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ----------------------------
-- 3) INVESTMENT PRIVACY
-- ----------------------------
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investments_select_own ON public.investments;
CREATE POLICY investments_select_own
ON public.investments
FOR SELECT
TO authenticated
USING (investor_id = auth.uid());

ALTER TABLE public.campaign_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_investments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_investments_select_own ON public.campaign_investments;
CREATE POLICY campaign_investments_select_own
ON public.campaign_investments
FOR SELECT
TO authenticated
USING (investor_id = auth.uid());

-- ----------------------------
-- 4) SYSTEM WALLET PROTECTION
-- ----------------------------
ALTER TABLE public.platform_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wallet FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_wallet_admin_only ON public.platform_wallet;
CREATE POLICY platform_wallet_admin_only
ON public.platform_wallet
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

ALTER TABLE public.campaign_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_wallets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_wallets_creator_or_admin ON public.campaign_wallets;
CREATE POLICY campaign_wallets_creator_or_admin
ON public.campaign_wallets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = campaign_wallets.campaign_id
      AND (
        c.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.role = 'admin'
        )
      )
  )
);

NOTIFY pgrst, 'reload schema';
