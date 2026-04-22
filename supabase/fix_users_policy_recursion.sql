-- Fix infinite recursion in users-related RLS checks
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admin can read all users" ON public.users;
CREATE POLICY "Admin can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.current_user_is_admin());

DROP POLICY IF EXISTS platform_wallet_admin_only ON public.platform_wallet;
CREATE POLICY platform_wallet_admin_only
ON public.platform_wallet
FOR SELECT
TO authenticated
USING (public.current_user_is_admin());

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
        OR public.current_user_is_admin()
      )
  )
);

NOTIFY pgrst, 'reload schema';
