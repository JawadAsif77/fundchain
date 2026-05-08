-- Add moderation columns to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN report_count integer DEFAULT 0;

ALTER TABLE public.campaigns
ADD COLUMN risk_score double precision;

ALTER TABLE public.campaigns
ADD COLUMN is_flagged boolean DEFAULT false;

ALTER TABLE public.campaigns
ADD COLUMN flag_reason text;

CREATE INDEX idx_campaigns_is_flagged ON public.campaigns(is_flagged);
CREATE INDEX idx_campaigns_report_count ON public.campaigns(report_count);

