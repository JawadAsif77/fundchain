-- ============================================================
-- FIX ROLE SELECTION FLOW FOR NEW SIGNUPS
-- Purpose: prevent automatic investor role assignment
-- ============================================================

-- New users must choose role explicitly in /role-selection
ALTER TABLE public.users
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.users
  ALTER COLUMN role DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
