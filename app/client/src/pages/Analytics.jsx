import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { campaignApi } from '../lib/api';
import '../styles/analytics.css';

const Analytics = () => {
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [showMethodology, setShowMethodology] = useState(false);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

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
  }, []);

  // Placeholder data - structured to easily replace with Supabase views later
  const kpiData = [
    {
      icon: '💰',
      label: 'Total Funding Raised',
      value: '2.5M FC',
      delta: '+12.5%',
      deltaType: 'positive',
      tooltip: 'Sum of campaigns.current_funding in FC tokens'
    },
    {
      icon: '🚀',
      label: 'Active Campaigns',
      value: '153',
      delta: '+8',
      deltaType: 'positive',
      tooltip: 'Count of campaigns where status = "active"'
    },
    {
      icon: '👥',
      label: 'Total Investors',
      value: '10k+',
      delta: '+245',
      deltaType: 'positive',
      tooltip: 'Count of unique user_investments.user_id'
    },
    {
      icon: '✅',
      label: 'Milestones Completed',
      value: '650',
      delta: '+28',
      deltaType: 'positive',
      tooltip: 'Count of milestones where status = "completed"'
    },
    {
      icon: '🛡️',
      label: 'Avg Trust Score',
      value: '92%',
      delta: '+2%',
      deltaType: 'positive',
      tooltip: 'Average of campaigns.trust_score'
    },
    {
      icon: '🔍',
      label: 'AI Flags (30d)',
      value: '12',
      delta: '-3',
      deltaType: 'negative',
      tooltip: 'Count of ai_flags where created_at > now() - 30 days'
    }
  ];

  const categoryData = [
    { name: 'Technology', value: 35, color: '#29C7AC' },
    { name: 'Fintech', value: 25, color: '#6366F1' },
    { name: 'Healthcare', value: 20, color: '#10B981' },
    { name: 'Education', value: 12, color: '#F59E0B' },
    { name: 'Other', value: 8, color: '#EF4444' }
  ];

  const trendData = {
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

  const topInvestors = [
    { name: 'Investor A***', totalInvested: 125000, campaigns: 15 },
    { name: 'Investor B***', totalInvested: 98000, campaigns: 12 },
    { name: 'Investor C***', totalInvested: 87000, campaigns: 18 },
    { name: 'Investor D***', totalInvested: 76000, campaigns: 9 },
    { name: 'Investor E***', totalInvested: 65000, campaigns: 11 }
  ];

  const investorDiversity = [
    { category: 'Technology', percentage: 32 },
    { category: 'Fintech', percentage: 21 },
    { category: 'Healthcare', percentage: 18 },
    { category: 'Education', percentage: 15 },
    { category: 'Other', percentage: 14 }
  ];

  const aiInsights = [
    {
      icon: '📈',
      title: 'Funding Momentum',
      value: 'High',
      description: 'Campaign funding velocity up 23% this week',
      type: 'positive'
    },
    {
      icon: '🛡️',
      title: 'Trust Index Change',
      value: '+4% WoW',
      description: 'Platform trust metrics trending upward',
      type: 'positive'
    },
    {
      icon: '⚠️',
      title: 'Risk Anomalies',
      value: '2 campaigns flagged',
      description: 'Automated review triggered for unusual patterns',
      type: 'warning'
    },
    {
      icon: '💡',
      title: 'Conversion Tip',
      value: 'Add 2 images',
      description: 'Campaigns with 3+ images see 9% higher conversion',
      type: 'info'
    }
  ];

  // Helper function to create donut chart path
  const createDonutPath = (percentage, index, total) => {
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
          </div>
        </div>
      </section>

      {/* KPI Summary */}
      <section className="analytics-kpis">
        <div className="container">
          <div className="kpi-grid">
            {kpiData.map((kpi, index) => (
              <div key={index} className="kpi-card" title={kpi.tooltip}>
                <div className="kpi-icon">{kpi.icon}</div>
                <div className="kpi-content">
                  <div className="kpi-label">{kpi.label}</div>
                  <div className="kpi-value">{kpi.value}</div>
                  <div className={`kpi-delta ${kpi.deltaType}`}>
                    {kpi.deltaType === 'positive' ? '↗' : '↘'} {kpi.delta}
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
              <div className="table-row" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ gridColumn: '1 / -1', color: '#6b7280' }}>Loading campaigns...</div>
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
              <div className="table-row" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ gridColumn: '1 / -1', color: '#6b7280' }}>No active campaigns available.</div>
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
                        style={{ width: `${item.percentage}%` }}
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