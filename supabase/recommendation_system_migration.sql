-- Recommendation system core tables (restored)
-- Step 2: only create missing tables used by existing code.

-- Stores explicit user recommendation preferences.
CREATE TABLE IF NOT EXISTS public.user_preferences (
	user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	preferred_categories uuid[] DEFAULT '{}'::uuid[],
	preferred_regions text[] DEFAULT '{}'::text[],
	risk_tolerance text DEFAULT 'MEDIUM' CHECK (risk_tolerance IN ('LOW', 'MEDIUM', 'HIGH')),
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now()
);

-- Stores recommendation interaction events and impressions.
CREATE TABLE IF NOT EXISTS public.recommendation_events (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
	event_type text NOT NULL CHECK (event_type IN ('impression', 'view', 'click', 'invest')),
	source text,
	score numeric,
	position integer,
	metadata jsonb DEFAULT '{}'::jsonb,
	created_at timestamptz DEFAULT now()
);

-- Backward compatibility: if tables already existed, ensure required columns exist.
ALTER TABLE public.user_preferences
	ADD COLUMN IF NOT EXISTS preferred_categories uuid[] DEFAULT '{}'::uuid[];
ALTER TABLE public.user_preferences
	ADD COLUMN IF NOT EXISTS preferred_regions text[] DEFAULT '{}'::text[];
ALTER TABLE public.user_preferences
	ADD COLUMN IF NOT EXISTS risk_tolerance text DEFAULT 'MEDIUM';
ALTER TABLE public.user_preferences
	ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.user_preferences
	ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.recommendation_events
	ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.recommendation_events
	ADD COLUMN IF NOT EXISTS score numeric;
ALTER TABLE public.recommendation_events
	ADD COLUMN IF NOT EXISTS position integer;
ALTER TABLE public.recommendation_events
	ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.recommendation_events
	ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure event type check exists on old schemas too.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'recommendation_events_event_type_check'
		AND conrelid = 'public.recommendation_events'::regclass
	) THEN
		ALTER TABLE public.recommendation_events
			ADD CONSTRAINT recommendation_events_event_type_check
			CHECK (event_type IN ('impression', 'view', 'click', 'invest'));
	END IF;
END $$;

-- Step 3: indexes for recommendation query patterns.
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_created_at
	ON public.recommendation_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_campaign_id
	ON public.recommendation_events(campaign_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_event_type
	ON public.recommendation_events(event_type);

-- user_preferences already has PK on user_id; keep indexes minimal.

-- Step 3: enable RLS.
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;

-- user_preferences policies (own rows only).
DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own
	ON public.user_preferences
	FOR SELECT
	TO authenticated
	USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own
	ON public.user_preferences
	FOR INSERT
	TO authenticated
	WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own
	ON public.user_preferences
	FOR UPDATE
	TO authenticated
	USING (auth.uid() = user_id)
	WITH CHECK (auth.uid() = user_id);

-- recommendation_events policies (own rows only).
DROP POLICY IF EXISTS recommendation_events_select_own ON public.recommendation_events;
CREATE POLICY recommendation_events_select_own
	ON public.recommendation_events
	FOR SELECT
	TO authenticated
	USING (auth.uid() = user_id);

DROP POLICY IF EXISTS recommendation_events_insert_own ON public.recommendation_events;
CREATE POLICY recommendation_events_insert_own
	ON public.recommendation_events
	FOR INSERT
	TO authenticated
	WITH CHECK (auth.uid() = user_id);
