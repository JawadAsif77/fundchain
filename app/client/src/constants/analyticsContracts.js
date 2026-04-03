/**
 * Canonical contracts for Analytics & Reporting.
 *
 * This file is the single source of truth for:
 * - metric identifiers
 * - owners (investor/creator/platform)
 * - value types
 * - default aggregation windows
 * - endpoint response shapes
 */

export const ANALYTICS_WINDOWS = {
  REALTIME: 'realtime',
  DAILY_7: '7d',
  DAILY_30: '30d',
  MONTHLY_12: '12m',
};

export const ANALYTICS_OWNERS = {
  INVESTOR: 'investor',
  CREATOR: 'creator',
  PLATFORM: 'platform',
};

export const METRIC_VALUE_TYPES = {
  CURRENCY_FC: 'currency_fc',
  COUNT: 'count',
  PERCENT: 'percent',
  SCORE: 'score',
  DURATION: 'duration',
};

export const PLATFORM_KPI_CONTRACT = [
  {
    id: 'total_funding_raised_fc',
    label: 'Total Funding Raised',
    owner: ANALYTICS_OWNERS.PLATFORM,
    valueType: METRIC_VALUE_TYPES.CURRENCY_FC,
    defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
  },
  {
    id: 'active_campaigns_count',
    label: 'Active Campaigns',
    owner: ANALYTICS_OWNERS.PLATFORM,
    valueType: METRIC_VALUE_TYPES.COUNT,
    defaultWindow: ANALYTICS_WINDOWS.REALTIME,
  },
  {
    id: 'total_investors_count',
    label: 'Total Investors',
    owner: ANALYTICS_OWNERS.PLATFORM,
    valueType: METRIC_VALUE_TYPES.COUNT,
    defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
  },
  {
    id: 'milestones_completed_count',
    label: 'Milestones Completed',
    owner: ANALYTICS_OWNERS.PLATFORM,
    valueType: METRIC_VALUE_TYPES.COUNT,
    defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
  },
  {
    id: 'avg_trust_score',
    label: 'Average Trust Score',
    owner: ANALYTICS_OWNERS.PLATFORM,
    valueType: METRIC_VALUE_TYPES.SCORE,
    defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
  },
  {
    id: 'ai_flags_count',
    label: 'AI Flags',
    owner: ANALYTICS_OWNERS.PLATFORM,
    valueType: METRIC_VALUE_TYPES.COUNT,
    defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
  },
];

export const INVESTOR_PORTFOLIO_CONTRACT = {
  summary: [
    {
      id: 'total_invested_fc',
      valueType: METRIC_VALUE_TYPES.CURRENCY_FC,
      defaultWindow: ANALYTICS_WINDOWS.REALTIME,
    },
    {
      id: 'active_investments_count',
      valueType: METRIC_VALUE_TYPES.COUNT,
      defaultWindow: ANALYTICS_WINDOWS.REALTIME,
    },
    {
      id: 'campaigns_backed_count',
      valueType: METRIC_VALUE_TYPES.COUNT,
      defaultWindow: ANALYTICS_WINDOWS.REALTIME,
    },
    {
      id: 'avg_risk_score',
      valueType: METRIC_VALUE_TYPES.SCORE,
      defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
    },
  ],
  charts: ['allocation_by_category', 'allocation_by_region', 'allocation_by_risk'],
  trendSeries: ['invested_fc_over_time'],
};

export const CREATOR_PROGRESS_CONTRACT = {
  summary: [
    {
      id: 'total_campaigns_count',
      valueType: METRIC_VALUE_TYPES.COUNT,
      defaultWindow: ANALYTICS_WINDOWS.REALTIME,
    },
    {
      id: 'active_campaigns_count',
      valueType: METRIC_VALUE_TYPES.COUNT,
      defaultWindow: ANALYTICS_WINDOWS.REALTIME,
    },
    {
      id: 'total_raised_fc',
      valueType: METRIC_VALUE_TYPES.CURRENCY_FC,
      defaultWindow: ANALYTICS_WINDOWS.REALTIME,
    },
    {
      id: 'unique_backers_count',
      valueType: METRIC_VALUE_TYPES.COUNT,
      defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
    },
    {
      id: 'avg_funding_rate_percent',
      valueType: METRIC_VALUE_TYPES.PERCENT,
      defaultWindow: ANALYTICS_WINDOWS.DAILY_30,
    },
  ],
  charts: ['funding_progress_by_campaign', 'backers_growth_over_time'],
  timeline: ['milestone_completion_timeline'],
};

/**
 * Shared API response envelope for analytics endpoints.
 */
export const ANALYTICS_RESPONSE_META = {
  requiredFields: ['generated_at', 'window', 'source'],
  sourceValues: ['live_query', 'materialized_view', 'cached_response'],
};
