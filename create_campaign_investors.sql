-- Create campaign_investors table
CREATE TABLE IF NOT EXISTS public.campaign_investors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_invested numeric NOT NULL DEFAULT 0,
  first_investment_at timestamptz DEFAULT now(),
  last_investment_at timestamptz DEFAULT now(),
  
  UNIQUE(campaign_id, investor_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_campaign_investors_campaign ON public.campaign_investors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_investors_investor ON public.campaign_investors(investor_id);
