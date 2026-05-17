-- Returns all investors for a campaign with their total invested amount.
-- SECURITY DEFINER is used so the client can call this RPC without being blocked by RLS on campaign_investments.

create or replace function public.get_campaign_investors(p_campaign_id uuid)
returns table (
  investor_id uuid,
  total_invested numeric,
  first_investment_at timestamptz,
  last_investment_at timestamptz,
  username text,
  full_name text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select
    ci.investor_id,
    ci.amount_fc as total_invested,
    ci.created_at as first_investment_at,
    ci.created_at as last_investment_at,
    u.username,
    u.full_name,
    u.avatar_url
  from public.campaign_investments ci
  left join public.users u on u.id = ci.investor_id
  where ci.campaign_id = p_campaign_id
  order by ci.amount_fc desc, ci.created_at asc;
$$;

grant execute on function public.get_campaign_investors(uuid) to authenticated;