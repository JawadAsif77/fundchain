import { supabase } from '../lib/supabase';
import {
  ANALYTICS_WINDOWS,
  PLATFORM_KPI_CONTRACT,
  ANALYTICS_RESPONSE_META,
} from '../constants/analyticsContracts';

/**
 * Step 3: Freeze analytics response shapes and validators.
 *
 * This service intentionally provides schema contracts + mock-safe adapters.
 * Real edge functions will be wired in later steps without changing consumers.
 */

const DEFAULT_META = {
  generated_at: null,
  window: ANALYTICS_WINDOWS.DAILY_30,
  source: 'live_query',
};

// These analytics edge functions are not present in this workspace's deployed set.
// Default to direct DB mode to avoid repeated CORS/preflight failures in the browser.
let edgeAnalyticsAvailable = false;

function ensureMeta(meta = {}) {
  const merged = { ...DEFAULT_META, ...meta };

  for (const field of ANALYTICS_RESPONSE_META.requiredFields) {
    if (merged[field] == null) {
      throw new Error(`analytics meta missing required field: ${field}`);
    }
  }

  if (!ANALYTICS_RESPONSE_META.sourceValues.includes(merged.source)) {
    throw new Error(`analytics meta has invalid source: ${merged.source}`);
  }

  return merged;
}

function validateTrendPoint(point) {
  if (!point || typeof point !== 'object') return false;
  if (typeof point.period !== 'string') return false;
  return true;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isEdgeFunctionTransportError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('failed to send a request to the edge function') ||
    message.includes('cors') ||
    message.includes('failed to fetch') ||
    message.includes('net::err_failed')
  );
}

function aggregateQuarterlyFromMonthly(monthly = []) {
  const quarters = [];
  for (let i = 0; i < monthly.length; i += 3) {
    const chunk = monthly.slice(i, i + 3);
    quarters.push({
      period: `Q${Math.floor(i / 3) + 1}`,
      successful: chunk.reduce((sum, item) => sum + safeNumber(item.successful), 0),
      failed: chunk.reduce((sum, item) => sum + safeNumber(item.failed), 0),
    });
  }
  return quarters;
}

async function buildPlatformKpisFromDatabase(window) {
  const [campaignsResult, milestonesResult, investorsResult] = await Promise.all([
    supabase.from('campaigns').select('current_funding,status'),
    supabase.from('milestones').select('is_completed'),
    supabase.from('campaign_investors').select('investor_id'),
  ]);

  if (campaignsResult.error) {
    throw new Error(`Failed to query campaigns for analytics: ${campaignsResult.error.message}`);
  }

  const campaigns = campaignsResult.data || [];
  const milestones = milestonesResult.error ? [] : milestonesResult.data || [];
  const investors = investorsResult.error ? [] : investorsResult.data || [];

  const totalFunding = campaigns.reduce((sum, row) => sum + safeNumber(row.current_funding), 0);
  const activeCampaigns = campaigns.filter((row) => row.status === 'active').length;
  const uniqueInvestorIds = new Set(investors.map((row) => row.investor_id).filter(Boolean));
  const completedMilestones = milestones.filter((row) => row.is_completed === true).length;
  const avgTrustScore = null;

  const byId = {
    total_funding_raised_fc: totalFunding,
    active_campaigns_count: activeCampaigns,
    total_investors_count: uniqueInvestorIds.size,
    milestones_completed_count: completedMilestones,
    avg_trust_score: avgTrustScore,
    ai_flags_count: null,
  };

  return {
    meta: ensureMeta({
      generated_at: new Date().toISOString(),
      window,
      source: 'live_query',
    }),
    kpis: PLATFORM_KPI_CONTRACT.map((metric) => ({
      id: metric.id,
      label: metric.label,
      owner: metric.owner,
      valueType: metric.valueType,
      defaultWindow: metric.defaultWindow,
      value: byId[metric.id] ?? null,
      delta: null,
      deltaType: null,
    })),
  };
}

async function buildInvestorPortfolioFromDatabase(window) {
  const [campaignsResult, investorsResult] = await Promise.all([
    supabase.from('campaigns').select('id,current_funding,location,risk_level,category_id,categories(name)').eq('status', 'active'),
    supabase
      .from('campaign_investors')
      .select('investor_id,total_invested,users(full_name,username,wallet_address)')
      .order('total_invested', { ascending: false })
      .limit(5),
  ]);

  if (campaignsResult.error) {
    throw new Error(`Failed to query campaigns for investor analytics: ${campaignsResult.error.message}`);
  }

  const campaigns = campaignsResult.data || [];
  const totalFunding = campaigns.reduce((sum, row) => sum + safeNumber(row.current_funding), 0);

  const categoryTotals = new Map();
  const regionTotals = new Map();
  const riskTotals = new Map();

  for (const row of campaigns) {
    const amount = safeNumber(row.current_funding);
    const categoryName = Array.isArray(row.categories)
      ? row.categories[0]?.name || 'Other'
      : row.categories?.name || 'Other';
    const regionName = row.location || 'Unknown';
    const riskName = row.risk_level != null ? `Risk ${row.risk_level}` : 'Unknown';

    categoryTotals.set(categoryName, safeNumber(categoryTotals.get(categoryName)) + amount);
    regionTotals.set(regionName, safeNumber(regionTotals.get(regionName)) + amount);
    riskTotals.set(riskName, safeNumber(riskTotals.get(riskName)) + amount);
  }

  const toPercentList = (map) =>
    Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        category: name,
        value: totalFunding > 0 ? (safeNumber(amount) / totalFunding) * 100 : 0,
        percentage: totalFunding > 0 ? (safeNumber(amount) / totalFunding) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

  const investorsRows = investorsResult.error ? [] : investorsResult.data || [];
  const topInvestors = investorsRows.map((row, idx) => {
    const profile = Array.isArray(row.users) ? row.users[0] : row.users;
    const displayName =
      profile?.full_name || profile?.username || profile?.wallet_address || `Investor ${idx + 1}`;

    return {
      name: displayName,
      total_invested_fc: safeNumber(row.total_invested),
      campaigns_backed: null,
    };
  });

  const avgRisk = campaigns.length
    ? campaigns.reduce((sum, row) => sum + safeNumber(row.risk_level), 0) / campaigns.length
    : null;

  return {
    meta: ensureMeta({
      generated_at: new Date().toISOString(),
      window,
      source: 'live_query',
    }),
    summary: {
      total_invested_fc: totalFunding,
      active_investments_count: campaigns.length,
      campaigns_backed_count: campaigns.length,
      avg_risk_score: avgRisk,
    },
    charts: {
      allocation_by_category: toPercentList(categoryTotals),
      allocation_by_region: toPercentList(regionTotals),
      allocation_by_risk: toPercentList(riskTotals),
      top_investors: topInvestors,
    },
    top_investors: topInvestors,
    trends: [],
  };
}

async function buildCreatorProgressFromDatabase(window) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id,title,current_funding,funding_goal,investor_count,status,created_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to query campaigns for creator analytics: ${error.message}`);
  }

  const campaigns = data || [];
  const totalRaised = campaigns.reduce((sum, row) => sum + safeNumber(row.current_funding), 0);
  const activeCampaigns = campaigns.filter((row) => row.status === 'active').length;
  const uniqueBackers = campaigns.reduce((sum, row) => sum + safeNumber(row.investor_count), 0);

  const fundingProgressByCampaign = campaigns
    .map((row) => {
      const goal = safeNumber(row.funding_goal);
      const raised = safeNumber(row.current_funding);
      const fundingRate = goal > 0 ? (raised / goal) * 100 : 0;

      return {
        campaign_id: row.id,
        campaign_name: row.title,
        current_funding_fc: raised,
        funding_goal_fc: goal,
        funding_rate_percent: fundingRate,
        funded: goal > 0 && raised >= goal ? 1 : 0,
      };
    })
    .sort((a, b) => b.funding_rate_percent - a.funding_rate_percent)
    .slice(0, 12);

  const monthlyMap = new Map();
  for (const row of campaigns) {
    const date = new Date(row.created_at || Date.now());
    const period = date.toLocaleString('en-US', { month: 'short' });
    const goal = safeNumber(row.funding_goal);
    const raised = safeNumber(row.current_funding);
    const funded = goal > 0 && raised >= goal;

    const entry = monthlyMap.get(period) || { period, successful: 0, failed: 0 };
    if (funded) entry.successful += 1;
    else entry.failed += 1;
    monthlyMap.set(period, entry);
  }

  const monthlySuccessTrends = Array.from(monthlyMap.values());
  const quarterlySuccessTrends = aggregateQuarterlyFromMonthly(monthlySuccessTrends);

  const totalGoal = campaigns.reduce((sum, row) => sum + safeNumber(row.funding_goal), 0);
  const avgFundingRate = totalGoal > 0 ? (totalRaised / totalGoal) * 100 : null;

  return {
    meta: ensureMeta({
      generated_at: new Date().toISOString(),
      window,
      source: 'live_query',
    }),
    summary: {
      total_campaigns_count: campaigns.length,
      active_campaigns_count: activeCampaigns,
      total_raised_fc: totalRaised,
      unique_backers_count: uniqueBackers,
      avg_funding_rate_percent: avgFundingRate,
    },
    charts: {
      funding_progress_by_campaign: fundingProgressByCampaign,
      backers_growth_over_time: monthlySuccessTrends,
      monthly_success_trends: monthlySuccessTrends,
      quarterly_success_trends: quarterlySuccessTrends,
    },
    timeline: [],
  };
}

export function validatePlatformKpisResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid platform KPI payload');
  }

  const meta = ensureMeta(payload.meta);
  const kpis = Array.isArray(payload.kpis) ? payload.kpis : [];

  return { meta, kpis };
}

export function validateInvestorPortfolioResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid investor portfolio payload');
  }

  const meta = ensureMeta(payload.meta);
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  const charts = payload.charts && typeof payload.charts === 'object' ? payload.charts : {};
  const trends = Array.isArray(payload.trends) ? payload.trends.filter(validateTrendPoint) : [];

  return { meta, summary, charts, trends };
}

export function validateCreatorProgressResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid creator progress payload');
  }

  const meta = ensureMeta(payload.meta);
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  const charts = payload.charts && typeof payload.charts === 'object' ? payload.charts : {};
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];

  return { meta, summary, charts, timeline };
}

export async function getPlatformKpis(window = ANALYTICS_WINDOWS.DAILY_30) {
  if (edgeAnalyticsAvailable) {
    try {
      const { data, error } = await supabase.functions.invoke('get-platform-kpis', {
        body: { window },
      });

      if (error) {
        throw new Error(error.message || 'Failed to load platform KPIs');
      }

      return validatePlatformKpisResponse(data);
    } catch (error) {
      if (isEdgeFunctionTransportError(error)) {
        edgeAnalyticsAvailable = false;
      } else {
        throw error;
      }
    }
  }

  return validatePlatformKpisResponse(await buildPlatformKpisFromDatabase(window));
}

export async function getInvestorPortfolioSummary(window = ANALYTICS_WINDOWS.DAILY_30) {
  if (edgeAnalyticsAvailable) {
    try {
      const { data, error } = await supabase.functions.invoke('get-investor-portfolio-summary', {
        body: { window },
      });

      if (error) {
        throw new Error(error.message || 'Failed to load investor portfolio summary');
      }

      return validateInvestorPortfolioResponse(data);
    } catch (error) {
      if (isEdgeFunctionTransportError(error)) {
        edgeAnalyticsAvailable = false;
      } else {
        throw error;
      }
    }
  }

  return validateInvestorPortfolioResponse(await buildInvestorPortfolioFromDatabase(window));
}

export async function getCreatorFundingProgress(window = ANALYTICS_WINDOWS.DAILY_30) {
  if (edgeAnalyticsAvailable) {
    try {
      const { data, error } = await supabase.functions.invoke('get-creator-funding-progress', {
        body: { window },
      });

      if (error) {
        throw new Error(error.message || 'Failed to load creator funding progress');
      }

      return validateCreatorProgressResponse(data);
    } catch (error) {
      if (isEdgeFunctionTransportError(error)) {
        edgeAnalyticsAvailable = false;
      } else {
        throw error;
      }
    }
  }

  return validateCreatorProgressResponse(await buildCreatorProgressFromDatabase(window));
}
