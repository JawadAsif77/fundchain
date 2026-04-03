import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { campaignApi } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  PLATFORM_KPI_CONTRACT,
  ANALYTICS_WINDOWS,
  METRIC_VALUE_TYPES,
} from '../constants/analyticsContracts';
import {
  getPlatformKpis,
  getInvestorPortfolioSummary,
  getCreatorFundingProgress,
} from '../services/analyticsService';
import '../styles/analytics.css';

const Analytics = () => {
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [showMethodology, setShowMethodology] = useState(false);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingInvestorDiversity, setLoadingInvestorDiversity] = useState(true);
  const [loadingTrendData, setLoadingTrendData] = useState(true);
  const [loadingCategoryFunding, setLoadingCategoryFunding] = useState(true);
  const [loadingTopInvestors, setLoadingTopInvestors] = useState(true);
  const [platformKpiRaw, setPlatformKpiRaw] = useState({});
  const [analyticsMeta, setAnalyticsMeta] = useState({
    platform: null,
    investor: null,
    creator: null,
  });
  const [analyticsErrors, setAnalyticsErrors] = useState({
    platform: false,
    investor: false,
    creator: false,
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState(Date.now());
  const [refreshNow, setRefreshNow] = useState(Date.now());
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [reconnectCount, setReconnectCount] = useState(0);

  // Fetch real campaigns from database
  useEffect(() => {
    const fetchTopCampaigns = async () => {
      try {
        const { data } = await campaignApi.getCampaigns({ status: 'active' });
        // Get top 3 campaigns sorted by funding amount
        const top3 = (data || [])
          .sort((a, b) => (b.current_funding || 0) - (a.current_funding || 0))
          .slice(0, 3)
          .map(campaign => ({
            id: campaign.id,
            title: campaign.title,
            creator: campaign.creator_name || 'Anonymous',
            goal: campaign.goal_amount || 0,
            raised: campaign.current_funding || 0,
            fundedPercent: campaign.goal_amount ? Math.round((campaign.current_funding / campaign.goal_amount) * 100) : 0,
            status: campaign.status || 'active',
            slug: campaign.slug,
            category: campaign.category,
            region: campaign.region
          }));
        setTopCampaigns(top3);
      } catch (error) {
        console.error('Failed to fetch top campaigns:', error);
        setTopCampaigns([]);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    fetchTopCampaigns();
  }, [refreshTick]);

  // Contract-backed placeholder data.
  // Step 2 goal: keep the same UI values while binding every card to a canonical KPI id.
  const KPI_PLACEHOLDER_VALUES = {
    total_funding_raised_fc: {
      icon: '💰',
      value: '2.5M FC',
      delta: '+12.5%',
      deltaType: 'positive',
      tooltip: 'Sum of campaigns.current_funding in FC tokens',
    },
    active_campaigns_count: {
      icon: '🚀',
      value: '153',
      delta: '+8',
      deltaType: 'positive',
      tooltip: 'Count of campaigns where status = "active"',
    },
    total_investors_count: {
      icon: '👥',
      value: '10k+',
      delta: '+245',
      deltaType: 'positive',
      tooltip: 'Count of unique user_investments.user_id',
    },
    milestones_completed_count: {
      icon: '✅',
      value: '650',
      delta: '+28',
      deltaType: 'positive',
      tooltip: 'Count of milestones where status = "completed"',
    },
    avg_trust_score: {
      icon: '🛡️',
      value: '92%',
      delta: '+2%',
      deltaType: 'positive',
      tooltip: 'Average of campaigns.trust_score',
    },
    ai_flags_count: {
      icon: '🔍',
      value: '12',
      delta: '-3',
      deltaType: 'negative',
      tooltip: 'Count of ai_flags where created_at > now() - 30 days',
    },
  };

  const buildPlaceholderKpiData = () =>
    PLATFORM_KPI_CONTRACT.map((metric) => ({
      id: metric.id,
      label: metric.label,
      window: metric.defaultWindow,
      ...KPI_PLACEHOLDER_VALUES[metric.id],
    }));

  const [kpiData, setKpiData] = useState(buildPlaceholderKpiData);

  const formatKpiValue = (metric, rawValue) => {
    if (rawValue == null || rawValue === '') {
      return KPI_PLACEHOLDER_VALUES[metric.id]?.value ?? 'N/A';
    }

    switch (metric.valueType) {
      case METRIC_VALUE_TYPES.CURRENCY_FC:
        return `${new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Number(rawValue) || 0)} FC`;
      case METRIC_VALUE_TYPES.PERCENT:
        return `${Number(rawValue).toFixed(1)}%`;
      case METRIC_VALUE_TYPES.SCORE:
        return `${Number(rawValue).toFixed(1)}%`;
      case METRIC_VALUE_TYPES.COUNT:
      default:
        return new Intl.NumberFormat('en-US').format(Number(rawValue) || 0);
    }
  };

  const formatKpiDelta = (delta) => {
    if (delta == null || delta === '') return null;
    const deltaNumber = Number(delta);
    if (Number.isNaN(deltaNumber)) return String(delta);
    const sign = deltaNumber > 0 ? '+' : '';
    return `${sign}${deltaNumber}`;
  };

  const getDeltaArrow = (deltaType) => {
    if (deltaType === 'positive') return '↗';
    if (deltaType === 'negative') return '↘';
    return '→';
  };

  const formatMetaTimestamp = (isoValue) => {
    if (!isoValue) return 'Unknown';
    const parsed = new Date(isoValue);
    if (Number.isNaN(parsed.getTime())) return 'Unknown';
    return parsed.toLocaleString();
  };

  const formatRelativeRefresh = (timestamp) => {
    if (!timestamp) return 'unknown';
    const diffSeconds = Math.max(0, Math.floor((refreshNow - timestamp) / 1000));
    if (diffSeconds < 5) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  };

  const triggerManualRefresh = () => {
    setLoadingCampaigns(true);
    setLoadingKpis(true);
    setLoadingTrendData(true);
    setLoadingTopInvestors(true);
    setLoadingInvestorDiversity(true);
    setLoadingCategoryFunding(true);
    setRefreshTick((prev) => prev + 1);
  };

  useEffect(() => {
    setLastRefreshAt(Date.now());
  }, [refreshTick]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setRefreshNow(Date.now());
    }, 5000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const fetchPlatformKpis = async () => {
      setLoadingKpis(true);
      try {
        const response = await getPlatformKpis(ANALYTICS_WINDOWS.DAILY_30);
        setAnalyticsMeta((prev) => ({ ...prev, platform: response?.meta || null }));
        setAnalyticsErrors((prev) => ({ ...prev, platform: false }));
        const kpisById = new Map((response?.kpis || []).map((kpi) => [kpi.id, kpi]));
        setPlatformKpiRaw(Object.fromEntries((response?.kpis || []).map((kpi) => [kpi.id, kpi])));

        const merged = PLATFORM_KPI_CONTRACT.map((metric) => {
          const base = KPI_PLACEHOLDER_VALUES[metric.id] || {};
          const live = kpisById.get(metric.id);

          return {
            id: metric.id,
            label: metric.label,
            window: metric.defaultWindow,
            icon: base.icon,
            tooltip: base.tooltip,
            value: formatKpiValue(metric, live?.value),
            delta: formatKpiDelta(live?.delta) ?? base.delta,
            deltaType: live?.deltaType || base.deltaType || 'neutral',
          };
        });

        setKpiData(merged);
      } catch (error) {
        console.error('Failed to fetch platform KPIs:', error);
        setAnalyticsErrors((prev) => ({ ...prev, platform: true }));
        setPlatformKpiRaw({});
        setKpiData(buildPlaceholderKpiData());
      } finally {
        setLoadingKpis(false);
      }
    };

    fetchPlatformKpis();
  }, [refreshTick]);

  const DEFAULT_CATEGORY_DATA = [
    { name: 'Technology', value: 35, color: '#29C7AC' },
    { name: 'Fintech', value: 25, color: '#6366F1' },
    { name: 'Healthcare', value: 20, color: '#10B981' },
    { name: 'Education', value: 12, color: '#F59E0B' },
    { name: 'Other', value: 8, color: '#EF4444' }
  ];

  const [categoryData, setCategoryData] = useState(DEFAULT_CATEGORY_DATA);

  const DEFAULT_TREND_DATA = {
    monthly: [
      { period: 'Jan', successful: 45, failed: 8 },
      { period: 'Feb', successful: 52, failed: 12 },
      { period: 'Mar', successful: 38, failed: 6 },
      { period: 'Apr', successful: 61, failed: 9 },
      { period: 'May', successful: 73, failed: 11 },
      { period: 'Jun', successful: 69, failed: 7 }
    ],
    quarterly: [
      { period: 'Q1', successful: 135, failed: 26 },
      { period: 'Q2', successful: 203, failed: 27 },
      { period: 'Q3', successful: 189, failed: 22 },
      { period: 'Q4', successful: 156, failed: 19 }
    ]
  };

  const [trendData, setTrendData] = useState(DEFAULT_TREND_DATA);

  const normalizeTrendPoint = (entry, fallbackPeriod) => {
    const period = entry?.period || entry?.label || entry?.month || entry?.quarter || fallbackPeriod;
    const successfulRaw = entry?.successful ?? entry?.completed ?? entry?.funded ?? entry?.value ?? 0;
    const failedRaw = entry?.failed ?? entry?.rejected ?? entry?.dropped ?? 0;

    return {
      period: String(period),
      successful: Math.max(0, Number(successfulRaw) || 0),
      failed: Math.max(0, Number(failedRaw) || 0),
    };
  };

  const aggregateQuarterly = (monthlySeries) => {
    const chunks = [];
    for (let i = 0; i < monthlySeries.length; i += 3) {
      chunks.push(monthlySeries.slice(i, i + 3));
    }

    return chunks.map((chunk, idx) => ({
      period: `Q${idx + 1}`,
      successful: chunk.reduce((sum, item) => sum + (item.successful || 0), 0),
      failed: chunk.reduce((sum, item) => sum + (item.failed || 0), 0),
    }));
  };

  useEffect(() => {
    const fetchCreatorTrends = async () => {
      setLoadingTrendData(true);
      try {
        const response = await getCreatorFundingProgress(ANALYTICS_WINDOWS.MONTHLY_12);
        setAnalyticsMeta((prev) => ({ ...prev, creator: response?.meta || null }));
        setAnalyticsErrors((prev) => ({ ...prev, creator: false }));
        const charts = response?.charts || {};

        const monthlySource = Array.isArray(charts.monthly_success_trends)
          ? charts.monthly_success_trends
          : Array.isArray(charts.backers_growth_over_time)
          ? charts.backers_growth_over_time
          : [];

        const quarterlySource = Array.isArray(charts.quarterly_success_trends)
          ? charts.quarterly_success_trends
          : [];

        const normalizedMonthly = monthlySource
          .map((entry, idx) => normalizeTrendPoint(entry, `P${idx + 1}`))
          .filter((entry) => entry.period);

        const normalizedQuarterly = quarterlySource
          .map((entry, idx) => normalizeTrendPoint(entry, `Q${idx + 1}`))
          .filter((entry) => entry.period);

        if (normalizedMonthly.length > 0) {
          setTrendData({
            monthly: normalizedMonthly,
            quarterly:
              normalizedQuarterly.length > 0
                ? normalizedQuarterly
                : aggregateQuarterly(normalizedMonthly),
          });
        } else {
          setTrendData(DEFAULT_TREND_DATA);
        }
      } catch (error) {
        console.error('Failed to fetch creator trends:', error);
        setAnalyticsErrors((prev) => ({ ...prev, creator: true }));
        setTrendData(DEFAULT_TREND_DATA);
      } finally {
        setLoadingTrendData(false);
      }
    };

    fetchCreatorTrends();
  }, [refreshTick]);

  const DEFAULT_TOP_INVESTORS = [
    { name: 'Investor A***', totalInvested: 125000, campaigns: 15 },
    { name: 'Investor B***', totalInvested: 98000, campaigns: 12 },
    { name: 'Investor C***', totalInvested: 87000, campaigns: 18 },
    { name: 'Investor D***', totalInvested: 76000, campaigns: 9 },
    { name: 'Investor E***', totalInvested: 65000, campaigns: 11 }
  ];

  const [topInvestors, setTopInvestors] = useState(DEFAULT_TOP_INVESTORS);

  const DEFAULT_INVESTOR_DIVERSITY = [
    { category: 'Technology', percentage: 32 },
    { category: 'Fintech', percentage: 21 },
    { category: 'Healthcare', percentage: 18 },
    { category: 'Education', percentage: 15 },
    { category: 'Other', percentage: 14 }
  ];

  const [investorDiversity, setInvestorDiversity] = useState(DEFAULT_INVESTOR_DIVERSITY);

  const CATEGORY_COLORS = {
    technology: '#29C7AC',
    fintech: '#6366F1',
    healthcare: '#10B981',
    education: '#F59E0B',
    other: '#EF4444',
  };

  const FALLBACK_COLORS = ['#29C7AC', '#6366F1', '#10B981', '#F59E0B', '#EF4444'];

  const mapCategoryColor = (name, index) => {
    const key = String(name || 'other').trim().toLowerCase();
    return CATEGORY_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  };

  useEffect(() => {
    const fetchInvestorDiversity = async () => {
      setLoadingTopInvestors(true);
      setLoadingInvestorDiversity(true);
      setLoadingCategoryFunding(true);
      try {
        const response = await getInvestorPortfolioSummary(ANALYTICS_WINDOWS.DAILY_30);
        setAnalyticsMeta((prev) => ({ ...prev, investor: response?.meta || null }));
        setAnalyticsErrors((prev) => ({ ...prev, investor: false }));
        const allocationByCategory = response?.charts?.allocation_by_category;
        const topInvestorsSource =
          (Array.isArray(response?.top_investors) && response.top_investors) ||
          (Array.isArray(response?.charts?.top_investors) && response.charts.top_investors) ||
          (Array.isArray(response?.summary?.top_investors) && response.summary.top_investors) ||
          [];

        if (topInvestorsSource.length > 0) {
          const mappedTopInvestors = topInvestorsSource
            .map((entry, idx) => {
              const rawName =
                entry?.name ||
                entry?.investor_name ||
                entry?.user_name ||
                entry?.wallet_address ||
                `Investor ${idx + 1}`;
              const name = String(rawName);
              const totalInvested = Number(
                entry?.total_invested_fc ?? entry?.invested ?? entry?.value ?? entry?.amount ?? 0
              );
              const campaigns = Number(
                entry?.campaigns_backed ?? entry?.campaigns ?? entry?.count ?? 0
              );

              return {
                name,
                totalInvested: Number.isFinite(totalInvested) ? totalInvested : 0,
                campaigns: Number.isFinite(campaigns) ? campaigns : 0,
              };
            })
            .sort((a, b) => b.totalInvested - a.totalInvested)
            .slice(0, 5);

          if (mappedTopInvestors.length > 0) {
            setTopInvestors(mappedTopInvestors);
          } else {
            setTopInvestors(DEFAULT_TOP_INVESTORS);
          }
        } else {
          setTopInvestors(DEFAULT_TOP_INVESTORS);
        }

        if (Array.isArray(allocationByCategory) && allocationByCategory.length > 0) {
          const mapped = allocationByCategory
            .map((entry) => {
              const category = entry?.category || entry?.name || 'Other';
              const numericValue = Number(entry?.percentage ?? entry?.value ?? 0);
              const percentage = Number.isFinite(numericValue)
                ? Math.max(0, Math.min(100, numericValue))
                : 0;

              return { category, percentage };
            })
            .sort((a, b) => b.percentage - a.percentage);

          if (mapped.length > 0) {
            setInvestorDiversity(mapped);

            const total = mapped.reduce((sum, item) => sum + item.percentage, 0);
            const normalizedCategoryData = mapped.map((item, index) => {
              const normalizedValue = total > 0 ? (item.percentage / total) * 100 : item.percentage;
              return {
                name: item.category,
                value: Number(normalizedValue.toFixed(1)),
                color: mapCategoryColor(item.category, index),
              };
            });

            if (normalizedCategoryData.length > 0) {
              setCategoryData(normalizedCategoryData);
            }
            return;
          }
        }

        setInvestorDiversity(DEFAULT_INVESTOR_DIVERSITY);
        setCategoryData(DEFAULT_CATEGORY_DATA);
      } catch (error) {
        console.error('Failed to fetch investor diversity:', error);
        setAnalyticsErrors((prev) => ({ ...prev, investor: true }));
        setTopInvestors(DEFAULT_TOP_INVESTORS);
        setInvestorDiversity(DEFAULT_INVESTOR_DIVERSITY);
        setCategoryData(DEFAULT_CATEGORY_DATA);
      } finally {
        setLoadingTopInvestors(false);
        setLoadingInvestorDiversity(false);
        setLoadingCategoryFunding(false);
      }
    };

    fetchInvestorDiversity();
  }, [refreshTick]);

  useEffect(() => {
    let refreshDebounceTimer = null;

    const queueRefresh = () => {
      if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
      }

      refreshDebounceTimer = setTimeout(() => {
        setRefreshTick((prev) => prev + 1);
      }, 450);
    };

    const analyticsChannel = supabase
      .channel('analytics-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        queueRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_investments' },
        queueRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones' },
        queueRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_flags' },
        queueRefresh
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('reconnecting');
          setReconnectCount((prev) => prev + 1);
          return;
        }

        if (status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    const pollIntervalId = setInterval(() => {
      setRefreshTick((prev) => prev + 1);
    }, 30000);

    return () => {
      clearInterval(pollIntervalId);
      if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
      }
      setRealtimeStatus('disconnected');
      supabase.removeChannel(analyticsChannel);
    };
  }, []);

  const aiInsights = useMemo(() => {
    const monthly = Array.isArray(trendData?.monthly) ? trendData.monthly : [];
    const latest = monthly[monthly.length - 1];
    const previous = monthly[monthly.length - 2];
    const momentumDelta =
      latest && previous
        ? ((Number(latest.successful || 0) - Number(previous.successful || 0)) /
            Math.max(1, Number(previous.successful || 0))) *
          100
        : null;

    const trustDelta = Number(platformKpiRaw?.avg_trust_score?.delta);
    const riskFlags = Number(platformKpiRaw?.ai_flags_count?.value);
    const activeCampaigns = Number(platformKpiRaw?.active_campaigns_count?.value);

    const momentumType =
      momentumDelta == null ? 'info' : momentumDelta >= 0 ? 'positive' : 'warning';
    const momentumValue =
      momentumDelta == null
        ? 'Stable'
        : `${momentumDelta >= 0 ? '+' : ''}${momentumDelta.toFixed(1)}%`;

    const trustType = Number.isFinite(trustDelta)
      ? trustDelta >= 0
        ? 'positive'
        : 'warning'
      : 'info';
    const trustValue = Number.isFinite(trustDelta)
      ? `${trustDelta >= 0 ? '+' : ''}${trustDelta.toFixed(1)}% WoW`
      : 'No change';

    const riskType = Number.isFinite(riskFlags)
      ? riskFlags > 10
        ? 'warning'
        : 'positive'
      : 'info';
    const riskValue = Number.isFinite(riskFlags)
      ? `${Math.round(riskFlags)} campaigns flagged`
      : 'No anomaly data';

    const conversionValue = Number.isFinite(activeCampaigns)
      ? `${Math.round(activeCampaigns)} active campaigns`
      : 'Add 2 images';

    return [
      {
        icon: '📈',
        title: 'Funding Momentum',
        value: momentumValue,
        description:
          momentumDelta == null
            ? 'Insufficient trend history to estimate momentum change yet.'
            : 'Derived from change in successful campaign outcomes between recent periods.',
        type: momentumType,
      },
      {
        icon: '🛡️',
        title: 'Trust Index Change',
        value: trustValue,
        description:
          'Computed from average trust score delta in the platform KPI analytics feed.',
        type: trustType,
      },
      {
        icon: '⚠️',
        title: 'Risk Anomalies',
        value: riskValue,
        description: 'Based on current AI flag counts from the platform KPI contract.',
        type: riskType,
      },
      {
        icon: '💡',
        title: 'Conversion Tip',
        value: conversionValue,
        description:
          'Use campaign media and milestone clarity to improve investor conversion outcomes.',
        type: 'info',
      },
    ];
  }, [trendData, platformKpiRaw]);

  const analyticsDataStatus = useMemo(() => {
    const metaList = [analyticsMeta.platform, analyticsMeta.investor, analyticsMeta.creator].filter(Boolean);
    const parsedTimes = metaList
      .map((meta) => new Date(meta.generated_at))
      .filter((d) => !Number.isNaN(d.getTime()));

    const lastUpdatedDate =
      parsedTimes.length > 0
        ? new Date(Math.max(...parsedTimes.map((d) => d.getTime())))
        : null;

    const sourceSet = new Set(metaList.map((meta) => meta.source).filter(Boolean));
    const sourceLabel = sourceSet.size > 0 ? Array.from(sourceSet).join(', ') : 'unknown';

    const hasErrors = Object.values(analyticsErrors).some(Boolean);
    const isLoading =
      loadingCampaigns ||
      loadingKpis ||
      loadingInvestorDiversity ||
      loadingTrendData ||
      loadingCategoryFunding ||
      loadingTopInvestors;

    return {
      health: hasErrors ? 'degraded' : 'healthy',
      sourceLabel,
      lastUpdated: lastUpdatedDate ? formatMetaTimestamp(lastUpdatedDate.toISOString()) : 'Unknown',
      lastRefreshRelative: formatRelativeRefresh(lastRefreshAt),
      isLoading,
      realtimeStatus,
      reconnectCount,
    };
  }, [
    analyticsMeta,
    analyticsErrors,
    loadingCampaigns,
    loadingKpis,
    loadingInvestorDiversity,
    loadingTrendData,
    loadingCategoryFunding,
    loadingTopInvestors,
    lastRefreshAt,
    refreshNow,
    realtimeStatus,
    reconnectCount,
  ]);

  // Helper function to create donut chart path
  const createDonutPath = (percentage, index) => {
    const angle = (percentage / 100) * 360;
    const startAngle = categoryData.slice(0, index).reduce((sum, item) => sum + (item.value / 100) * 360, 0);
    const endAngle = startAngle + angle;
    
    const startX = 50 + 35 * Math.cos((startAngle - 90) * Math.PI / 180);
    const startY = 50 + 35 * Math.sin((startAngle - 90) * Math.PI / 180);
    const endX = 50 + 35 * Math.cos((endAngle - 90) * Math.PI / 180);
    const endY = 50 + 35 * Math.sin((endAngle - 90) * Math.PI / 180);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    return `M 50 50 L ${startX} ${startY} A 35 35 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  };

  const formatCurrency = (amount) => {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0)} FC`;
  };

  return (
    <div className="analytics-page">
      {/* Hero Section */}
      <section className="analytics-hero">
        <div className="container">
          <div className="hero-content">
            <h1>FundChain Analytics: Real-Time Platform Insights</h1>
            <p>
              Track campaign funding in FC tokens, investor participation, milestone completions, and platform performance metrics—all transparently recorded on Solana.
            </p>
            <div className="data-legend">
              <span className="legend-item">
                <span className="legend-dot current"></span>
                Current: Supabase views
              </span>
              <span className="legend-item">
                <span className="legend-dot future"></span>
                Future: On-chain data
              </span>
            </div>
            <div className="analytics-status-panel">
              <strong
                className={`analytics-status-health ${
                  analyticsDataStatus.health === 'healthy' ? 'healthy' : 'degraded'
                }`}
              >
                Data Health: {analyticsDataStatus.health}
              </strong>
              <span className="analytics-status-meta">
                Last Updated: {analyticsDataStatus.lastUpdated}
              </span>
              <span className="analytics-status-meta">
                Last Refreshed: {analyticsDataStatus.lastRefreshRelative}
              </span>
              <span className="analytics-status-meta">
                Source: {analyticsDataStatus.sourceLabel}
              </span>
              <span
                className={`analytics-realtime-badge ${analyticsDataStatus.realtimeStatus}`}
              >
                <span
                  className={`analytics-realtime-dot ${analyticsDataStatus.realtimeStatus}`}
                  aria-hidden="true"
                ></span>
                {analyticsDataStatus.realtimeStatus === 'connected' && 'Realtime Connected'}
                {analyticsDataStatus.realtimeStatus === 'reconnecting' &&
                  `Reconnecting${
                    analyticsDataStatus.reconnectCount > 0
                      ? ` (retry ${analyticsDataStatus.reconnectCount})`
                      : ''
                  }`}
                {analyticsDataStatus.realtimeStatus === 'disconnected' && 'Realtime Disconnected'}
                {analyticsDataStatus.realtimeStatus === 'connecting' && 'Connecting Realtime...'}
              </span>
              {analyticsDataStatus.realtimeStatus === 'connected' &&
                analyticsDataStatus.reconnectCount > 0 && (
                  <span className="analytics-status-meta">
                    Recovered after {analyticsDataStatus.reconnectCount}{' '}
                    {analyticsDataStatus.reconnectCount === 1 ? 'retry' : 'retries'}
                  </span>
                )}
              {analyticsDataStatus.isLoading && (
                <span className="analytics-status-refreshing">Refreshing...</span>
              )}
              <button
                type="button"
                className="analytics-status-refresh-btn"
                onClick={triggerManualRefresh}
              >
                {analyticsDataStatus.isLoading ? 'Refreshing...' : 'Refresh Now'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Summary */}
      <section className="analytics-kpis">
        <div className="container">
          {loadingKpis && (
            <p className="analytics-loading-text">
              Loading KPI metrics...
            </p>
          )}
          <div className="kpi-grid">
            {kpiData.map((kpi) => (
              <div key={kpi.id} className="kpi-card" title={kpi.tooltip}>
                <div className="kpi-icon">{kpi.icon}</div>
                <div className="kpi-content">
                  <div className="kpi-label">{kpi.label}</div>
                  <div className="kpi-value">{kpi.value}</div>
                  <div className={`kpi-delta ${kpi.deltaType}`}>
                    {getDeltaArrow(kpi.deltaType)} {kpi.delta || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Charts Section */}
      <section className="analytics-charts">
        <div className="container">
          <div className="charts-grid">
            {/* Funding by Category */}
            <div className="chart-card">
              <h3>Funding by Category</h3>
              {loadingCategoryFunding && (
                <p className="analytics-loading-text">
                  Loading category funding...
                </p>
              )}
              <div className="donut-chart-container">
                <svg viewBox="0 0 100 100" className="donut-chart">
                  {categoryData.map((category, index) => (
                    <path
                      key={category.name}
                      d={createDonutPath(category.value, index)}
                      fill={category.color}
                      className="donut-segment"
                    />
                  ))}
                  <circle cx="50" cy="50" r="20" fill="var(--color-white)" />
                </svg>
                <div className="chart-legend">
                  {categoryData.map((category) => (
                    <div key={category.name} className="legend-item">
                      <span 
                        className="legend-color" 
                        style={{ backgroundColor: category.color }}
                      ></span>
                      <span className="legend-text">
                        {category.name} ({category.value}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Success Trends */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Success Trends</h3>
                <div className="trend-toggle">
                  <button 
                    className={trendPeriod === 'monthly' ? 'active' : ''}
                    onClick={() => setTrendPeriod('monthly')}
                  >
                    Monthly
                  </button>
                  <button 
                    className={trendPeriod === 'quarterly' ? 'active' : ''}
                    onClick={() => setTrendPeriod('quarterly')}
                  >
                    Quarterly
                  </button>
                </div>
              </div>
              {loadingTrendData && (
                <p className="analytics-loading-text">
                  Loading trend data...
                </p>
              )}
              <div className="trend-chart-container">
                <svg viewBox="0 0 400 200" className="trend-chart">
                  {/* Grid lines */}
                  {[0, 50, 100, 150, 200].map(y => (
                    <line key={y} x1="50" y1={y} x2="350" y2={y} stroke="var(--color-border-light)" strokeWidth="1" />
                  ))}
                  
                  {/* Trend lines */}
                  <polyline
                    points={trendData[trendPeriod].map((d, i) => `${70 + i * 60},${180 - d.successful}`).join(' ')}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                    className="trend-line"
                  />
                  <polyline
                    points={trendData[trendPeriod].map((d, i) => `${70 + i * 60},${180 - d.failed * 5}`).join(' ')}
                    fill="none"
                    stroke="var(--color-error)"
                    strokeWidth="3"
                    className="trend-line"
                  />
                  
                  {/* Data points */}
                  {trendData[trendPeriod].map((d, i) => (
                    <g key={i}>
                      <circle cx={70 + i * 60} cy={180 - d.successful} r="4" fill="var(--color-accent)" />
                      <circle cx={70 + i * 60} cy={180 - d.failed * 5} r="4" fill="var(--color-error)" />
                      <text x={70 + i * 60} y="195" textAnchor="middle" className="chart-label">
                        {d.period}
                      </text>
                    </g>
                  ))}
                </svg>
                <div className="trend-legend">
                  <div className="legend-item">
                    <span className="legend-dot successful"></span>
                    Successful
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot failed"></span>
                    Failed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Performing Campaigns */}
      <section className="analytics-campaigns">
        <div className="container">
          <div className="section-header">
            <h2>Top Performing Campaigns</h2>
            <Link to="/explore" className="view-all-link">View All →</Link>
          </div>
          <div className="campaigns-table">
            <div className="table-header">
              <div>Campaign</div>
              <div>Creator</div>
              <div>Goal</div>
              <div>Raised</div>
              <div>% Funded</div>
              <div>Status</div>
              <div></div>
            </div>
            {loadingCampaigns ? (
              <div className="table-row table-row-message">
                <div className="table-row-message-text">Loading campaigns...</div>
              </div>
            ) : topCampaigns.length > 0 ? (
              topCampaigns.map((campaign) => (
              <div key={campaign.id} className="table-row">
                <div className="campaign-info">
                  <span className="campaign-title">{campaign.title}</span>
                </div>
                <div className="creator-name">{campaign.creator || 'Anonymous'}</div>
                <div className="goal-amount">{formatCurrency(campaign.goal)}</div>
                <div className="raised-amount">{formatCurrency(campaign.raised)}</div>
                <div className="funded-percent">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${Math.min(campaign.fundedPercent, 100)}%` }}
                    ></div>
                  </div>
                  <span>{campaign.fundedPercent}%</span>
                </div>
                <div className={`campaign-status ${campaign.status}`}>
                  {campaign.status}
                </div>
                <div className="campaign-actions">
                  <Link to={`/campaign/${campaign.slug}`} className="view-campaign-btn">
                    View →
                  </Link>
                </div>
              </div>
            ))
            ) : (
              <div className="table-row table-row-message">
                <div className="table-row-message-text">No active campaigns available.</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Investor Insights */}
      <section className="analytics-investors">
        <div className="container">
          <h2>Investor Insights</h2>
          <div className="insights-grid">
            {/* Most Active Investors */}
            <div className="insight-card">
              <h3>Most Active Investors</h3>
              {loadingTopInvestors && (
                <p className="analytics-loading-text">
                  Loading active investors...
                </p>
              )}
              <div className="investors-list">
                {topInvestors.map((investor, index) => (
                  <div key={index} className="investor-item">
                    <div className="investor-avatar">
                      {investor.name.charAt(0)}
                    </div>
                    <div className="investor-info">
                      <div className="investor-name">{investor.name}</div>
                      <div className="investor-stats">
                        {formatCurrency(investor.totalInvested)} • {investor.campaigns} campaigns
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Investor Diversity */}
            <div className="insight-card">
              <h3>Investor Diversity by Category</h3>
              {loadingInvestorDiversity && (
                <p className="analytics-loading-text">
                  Loading investor diversity...
                </p>
              )}
              <div className="diversity-bars">
                {investorDiversity.map((item, index) => (
                  <div key={index} className="diversity-item">
                    <div className="diversity-label">
                      <span>{item.category}</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <div className="diversity-bar">
                      <div 
                        className="diversity-fill" 
                        style={{ width: `${Math.max(0, Math.min(100, item.percentage))}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Insights */}
      <section className="analytics-ai">
        <div className="container">
          <h2>AI Insights</h2>
          <p className="ai-description">
            Our AI system continuously analyzes platform data to surface trends, identify risks, and provide actionable insights for better decision-making.
          </p>
          <div className="ai-insights-grid">
            {aiInsights.map((insight, index) => (
              <div key={index} className={`ai-insight-card ${insight.type}`}>
                <div className="insight-icon">{insight.icon}</div>
                <div className="insight-content">
                  <h4>{insight.title}</h4>
                  <div className="insight-value">{insight.value}</div>
                  <p className="insight-description">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="ai-insights-cta">
            <p>
              These insights help inform <Link to="/governance" className="inline-link">governance decisions →</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Data Notes */}
      <section className="analytics-methodology">
        <div className="container">
          <button 
            className="methodology-toggle"
            onClick={() => setShowMethodology(!showMethodology)}
          >
            Data Methodology & Notes {showMethodology ? '↑' : '↓'}
          </button>
          
          {showMethodology && (
            <div className="methodology-content">
              <div className="methodology-grid">
                <div className="methodology-section">
                  <h4>Metric Definitions</h4>
                  <ul>
                    <li><strong>Successful:</strong> Campaigns reaching 100% funding goal</li>
                    <li><strong>Trust Score:</strong> AI-calculated rating based on transparency, milestones, and community feedback</li>
                    <li><strong>Active:</strong> Campaigns currently accepting investments</li>
                    <li><strong>AI Flags:</strong> Automated alerts for unusual patterns or potential risks</li>
                  </ul>
                </div>
                <div className="methodology-section">
                  <h4>Update Cadence</h4>
                  <ul>
                    <li><strong>KPI Metrics:</strong> Updated hourly</li>
                    <li><strong>Charts & Trends:</strong> Updated daily at midnight UTC</li>
                    <li><strong>AI Insights:</strong> Updated every 6 hours</li>
                    <li><strong>Campaign Rankings:</strong> Updated every 2 hours</li>
                  </ul>
                </div>
                <div className="methodology-section">
                  <h4>Privacy Notes</h4>
                  <ul>
                    <li>All investor data is aggregated and anonymized</li>
                    <li>Individual investment amounts are not disclosed</li>
                    <li>Personal information is masked in public analytics</li>
                    <li>AI analysis respects user privacy settings</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="analytics-cta">
        <div className="container">
          <div className="cta-content">
            <h3>Ready to Explore?</h3>
            <p>Discover investment opportunities or start your own campaign based on these insights.</p>
            <div className="cta-buttons">
              <Link to="/explore" className="btn btn-primary">
                Explore Opportunities
              </Link>
              <Link to="/dashboard" className="btn btn-secondary">
                Creator Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Analytics;