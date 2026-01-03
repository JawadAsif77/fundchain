import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import MilestoneList from '../components/MilestoneList';
import CampaignQA from '../components/CampaignQA';
import MilestoneUpdateForm from '../components/MilestoneUpdateForm';
import CampaignUpdates from '../components/CampaignUpdates';
import Loader from '../components/Loader';
import { campaignApi } from '../lib/api.js';
import RiskBadge from '../components/RiskBadge';
import { analyzeCampaignRisk } from '../services/riskAnalysis';
import AdminRiskOverride from '../components/AdminRiskOverride';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';
import { useEscrowActions } from '../hooks/useEscrowActions';

const Campaign = () => {
  const { slug } = useParams();
  const { userId, user, wallet, refreshWallet, profile } = useAuth();
  const { investInCampaign, investLoading, investError } = useEscrowActions();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);
  const [campaignMilestones, setCampaignMilestones] = useState([]);
  const [campaignWallet, setCampaignWallet] = useState(null);
  const [userInvestments, setUserInvestments] = useState([]);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [investAmount, setInvestAmount] = useState('');
  const [investmentLoading, setInvestmentLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [updatesKey, setUpdatesKey] = useState(0);

  const isCreator = userId === campaign?.creatorId;
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await campaignApi.getCampaignBySlug(slug);
        if (cancelled) return;
        if (!data) {
          setCampaign(null);
          setLoading(false);
          return;
        }
        const mapped = {
          id: data.id,
          slug: data.slug,
          title: data.title,
          summary: data.short_description || '',
          category: data.categories?.name || 'General',
          goalAmount: Number(data.funding_goal || 0),
          raisedAmount: Number(data.current_funding || 0),
          deadlineISO: data.end_date,
          status: data.status,
          region: data.location || '—',
          minInvest: Number(data.min_investment || 0),
          maxInvest: Number(data.max_investment || (data.funding_goal ? Number(data.funding_goal) : 0)),
          risk_level: data.risk_level,
          final_risk_score: data.final_risk_score,
          manual_risk_level: data.manual_risk_level,
          manual_risk_reason: data.manual_risk_reason,
          analyzed_at: data.analyzed_at,
          ml_scam_score: data.ml_scam_score,
          plagiarism_score: data.plagiarism_score,
          wallet_risk_score: data.wallet_risk_score,
          creatorId: data.creator_id,
          // Enhanced fields
          campaign_image_url: data.campaign_image_url,
          video_pitch_url: data.video_pitch_url,
          pitch_deck_url: data.pitch_deck_url,
          whitepaper_url: data.whitepaper_url,
          team_size: data.team_size,
          team_experience: data.team_experience,
          project_stage: data.project_stage,
          target_audience: data.target_audience,
          business_model: data.business_model,
          revenue_streams: data.revenue_streams,
          competitive_advantage: data.competitive_advantage,
          use_of_funds: data.use_of_funds,
          expected_roi: data.expected_roi,
          previous_funding_amount: data.previous_funding_amount,
          previous_funding_source: data.previous_funding_source,
          market_analysis: data.market_analysis,
          risks_and_challenges: data.risks_and_challenges,
          website_url: data.website_url,
          github_repository: data.github_repository,
          social_media_links: data.social_media_links,
          legal_structure: data.legal_structure,
          registration_number: data.registration_number,
          tax_id: data.tax_id
        };
        setCampaign(mapped);

        const m = await campaignApi.getMilestones(data.id);
        if (!cancelled) {
          const mm = (m.data || []).map((row, idx) => ({
            id: row.id,
            index: row.order_index ?? idx + 1,
            name: row.title,
            description: row.description || '',
            payoutPct: row.target_amount && mapped.goalAmount ? Math.round((Number(row.target_amount) / mapped.goalAmount) * 100) : 0,
            status: row.is_completed ? 'completed' : 'pending'
          }));
          setCampaignMilestones(mm);
        }

        // Fetch campaign wallet data
        const { data: cwData } = await supabase
          .from('campaign_wallets')
          .select('escrow_balance_fc, released_fc')
          .eq('campaign_id', data.id)
          .maybeSingle();
        if (!cancelled && cwData) {
          setCampaignWallet(cwData);
        }

        // Fetch user's investments in this campaign
        if (userId) {
          const { data: investments } = await supabase
            .from('investments')
            .select('id, amount, status, investment_date, confirmed_at')
            .eq('campaign_id', data.id)
            .eq('investor_id', userId)
            .order('investment_date', { ascending: false });
          if (!cancelled && investments) {
            setUserInvestments(investments);
          }

          // Log campaign view event for analytics/recommendations
          const { error: eventError } = await supabase
            .from('recommendation_events')
            .insert({
              user_id: userId,
              campaign_id: data.id,
              event_type: 'view',
              source: 'campaign_page'
            });
          
          if (eventError) {
            console.error('Failed to log view event:', eventError);
            // Don't fail the page load if logging fails
          }
        }
      } catch (e) {
        if (!cancelled) {
          setCampaign(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const formatCurrency = (amount) => {
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)} FC`;
  };

  const formatDate = (dateISO) => {
    return new Date(dateISO).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateProgress = () => {
    if (!campaign) return 0;
    return Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100);
  };

  const handleInvestSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(investAmount);
    
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amount > (wallet?.balanceFc || 0)) {
      alert('Insufficient balance');
      return;
    }

    setInvestmentLoading(true);
    setSuccessMessage('');
    
    try {
      const result = await investInCampaign({
        campaignId: campaign.id,
        amount
      });

      if (result.success) {
        setSuccessMessage(`Successfully invested ${amount} FC!`);
        setInvestAmount('');
        setShowInvestModal(false);
        
        // Refresh wallet
        if (refreshWallet) await refreshWallet();
        
        // Refresh campaign data
        setCampaign(prev => prev ? ({
          ...prev,
          raisedAmount: Number(prev.raisedAmount || 0) + amount
        }) : prev);
        
        // Refresh user investments
        const { data: investments } = await supabase
          .from('investments')
          .select('id, amount, status, investment_date, confirmed_at')
          .eq('campaign_id', campaign.id)
          .eq('investor_id', userId)
          .order('investment_date', { ascending: false });
        if (investments) setUserInvestments(investments);
        
        // Refresh campaign wallet
        const { data: cwData } = await supabase
          .from('campaign_wallets')
          .select('escrow_balance_fc, released_fc')
          .eq('campaign_id', campaign.id)
          .maybeSingle();
        if (cwData) setCampaignWallet(cwData);
      }
    } catch (err) {
      console.error('Investment error:', err);
      alert(err.message || 'Investment failed');
    } finally {
      setInvestmentLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    return `badge status-${status}`;
  };

  if (loading) {
    return <Loader size="lg" message="Loading campaign details..." />;
  }

  if (!campaign) {
    return <Navigate to="/404" replace />;
  }

  const progress = calculateProgress();
  const daysLeft = Math.ceil((new Date(campaign.deadlineISO) - new Date()) / (1000 * 60 * 60 * 24));

  const displayedRiskLevel =
  campaign.manual_risk_level || campaign.risk_level;

  const displayedRiskScore =
  campaign.manual_risk_level ? null : campaign.final_risk_score;

  return (
    <div className="main">
      <div className="page-content">
        <div className="container">
          <div className="two-column">
            {/* Main Content */}
            <div>
              {/* Campaign Header */}
              <div className="mb-xl">
                <div className="flex items-center gap-sm mb-md flex-wrap">
                  <span className="badge badge-secondary">{campaign.category}</span>
                  <span className={getStatusBadgeClass(campaign.status)}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </span>
                  <span className="badge badge-secondary">{campaign.region}</span>
                </div>
                
                <h1 className="text-3xl font-bold mb-md">{campaign.title}</h1>
                <p className="text-lg text-gray-600 mb-lg">{campaign.summary}</p>

                {/* Progress and Stats */}
                <div className="card mb-lg">
                  <div className="progress-bar mb-sm">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-info mb-md">
                    <span className="font-semibold text-lg">{formatCurrency(campaign.raisedAmount)} raised</span>
                    <span className="text-gray-600">{progress.toFixed(1)}% of goal</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{formatCurrency(campaign.goalAmount)}</div>
                      <div className="text-sm text-gray-600">Goal</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{daysLeft > 0 ? daysLeft : 0}</div>
                      <div className="text-sm text-gray-600">Days left</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="mb-lg">
                <nav className="flex border-b">
                  <button
                    className={`px-md py-sm border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'overview' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('overview')}
                  >
                    Overview
                  </button>
                  <button
                    className={`px-md py-sm border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'milestones' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('milestones')}
                  >
                    Milestones
                  </button>
                  <button
                    className={`px-md py-sm border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'updates' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('updates')}
                  >
                    Updates
                  </button>
                  <button
                    className={`px-md py-sm border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'qa' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('qa')}
                  >
                    Q&A
                  </button>
                </nav>
              </div>

              <RiskBadge
              level={displayedRiskLevel}
              score={displayedRiskScore}
              />

              {/* Tab Content */}
              <div>
                {activeTab === 'overview' && (
                  <div className="space-y-lg">

                    {/* Funding Overview */}
                    <div className="card">
                      <h3 className="card-title">💰 Funding Overview</h3>
                      <div className="progress-bar mb-md" style={{ height: '24px' }}>
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{formatCurrency(campaign.raisedAmount)}</div>
                          <div className="text-sm text-gray-600">Current Funding</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{formatCurrency(campaign.goalAmount)}</div>
                          <div className="text-sm text-gray-600">Target Funding</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" style={{ color: '#29C7AC' }}>-</div>
                          <div className="text-sm text-gray-600">Investor Count</div>
                        </div>
                        {campaignWallet && (
                          <div className="text-center">
                            <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                              {campaignWallet.escrow_balance_fc?.toLocaleString() || 0} FC
                            </div>
                            <div className="text-sm text-gray-600">Escrow Balance</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Past Investments List */}
                    {userId && userInvestments.length > 0 && (
                      <div className="card">
                        <h3 className="card-title">📊 Your Investment History</h3>
                        <div className="space-y-sm">
                          {userInvestments.map((investment) => (
                            <div 
                              key={investment.id}
                              className="flex items-center justify-between p-md border rounded-lg"
                              style={{ backgroundColor: investment.status === 'refunded' ? '#fef2f2' : '#f0fdf9' }}
                            >
                              <div>
                                <div className="font-semibold text-lg">{investment.amount.toLocaleString()} FC</div>
                                <div className="text-sm text-gray-600">
                                  {new Date(investment.investment_date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </div>
                              </div>
                              <span 
                                className="badge"
                                style={{
                                  backgroundColor: investment.status === 'confirmed' ? '#29C7AC' : investment.status === 'refunded' ? '#ef4444' : '#f59e0b',
                                  color: 'white',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase'
                                }}
                              >
                                {investment.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="card">
                      <h3 className="card-title">Project Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                        <div className="stat-item">
                          <span className="stat-label">Deadline:</span>
                          <span className="stat-value">{formatDate(campaign.deadlineISO)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Min Investment:</span>
                          <span className="stat-value">{formatCurrency(campaign.minInvest)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Max Investment:</span>
                          <span className="stat-value">{formatCurrency(campaign.maxInvest)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Status:</span>
                          <span className="stat-value">{campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <h3 className="card-title">About This Campaign</h3>
                      <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                        {campaign.summary}
                      </p>
                    </div>

                    {/* Campaign Banner Image */}
                    {campaign.campaign_image_url && (
                      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <img 
                          src={campaign.campaign_image_url} 
                          alt={campaign.title} 
                          style={{ 
                            width: '100%', 
                            height: 'auto', 
                            display: 'block',
                            maxHeight: '500px',
                            objectFit: 'cover'
                          }} 
                        />
                      </div>
                    )}

                    {/* Video Pitch */}
                    {campaign.video_pitch_url && (
                      <div className="card">
                        <h3 className="card-title">🎥 Video Pitch</h3>
                        <a 
                          href={campaign.video_pitch_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            transition: 'transform 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                        >
                          Watch Video Pitch →
                        </a>
                      </div>
                    )}

                    {/* Project Stage & Target Audience */}
                    {(campaign.project_stage || campaign.target_audience) && (
                      <div className="card">
                        <h3 className="card-title">🎯 Project Overview</h3>
                        <div className="space-y-md">
                          {campaign.project_stage && (
                            <div>
                              <div className="stat-label" style={{ marginBottom: '8px' }}>Project Stage</div>
                              <span style={{
                                padding: '6px 16px',
                                background: '#f0fdf4',
                                color: '#166534',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                textTransform: 'capitalize'
                              }}>
                                {campaign.project_stage}
                              </span>
                            </div>
                          )}
                          {campaign.target_audience && (
                            <div>
                              <div className="stat-label" style={{ marginBottom: '8px' }}>Target Audience</div>
                              <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                                {campaign.target_audience}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Market Analysis */}
                    {campaign.market_analysis && (
                      <div className="card">
                        <h3 className="card-title">📊 Market Analysis</h3>
                        <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                          {campaign.market_analysis}
                        </p>
                      </div>
                    )}

                    {/* Competitive Advantage */}
                    {campaign.competitive_advantage && (
                      <div className="card">
                        <h3 className="card-title">💡 Competitive Advantage</h3>
                        <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                          {campaign.competitive_advantage}
                        </p>
                      </div>
                    )}

                    {/* Business Model */}
                    {campaign.business_model && (
                      <div className="card">
                        <h3 className="card-title">💼 Business Model</h3>
                        <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                          {campaign.business_model}
                        </p>
                        {campaign.revenue_streams && (
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                            <div className="stat-label" style={{ marginBottom: '8px' }}>Revenue Streams</div>
                            <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                              {campaign.revenue_streams}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Use of Funds */}
                    {campaign.use_of_funds && campaign.use_of_funds.length > 0 && (
                      <div className="card">
                        <h3 className="card-title">💰 Use of Funds</h3>
                        <div className="space-y-md">
                          {campaign.use_of_funds.map((item, idx) => (
                            <div 
                              key={idx} 
                              style={{
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong style={{ fontSize: '16px', color: '#111827' }}>{item.category}</strong>
                                <span style={{
                                  padding: '4px 12px',
                                  background: '#667eea',
                                  color: 'white',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}>
                                  {item.amount}%
                                </span>
                              </div>
                              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                                {item.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expected ROI */}
                    {campaign.expected_roi && (
                      <div className="card">
                        <h3 className="card-title">📈 Expected ROI Timeline</h3>
                        <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                          {campaign.expected_roi}
                        </p>
                      </div>
                    )}

                    {/* Team Information */}
                    {(campaign.team_size || campaign.team_experience) && (
                      <div className="card">
                        <h3 className="card-title">👥 Team</h3>
                        {campaign.team_size && (
                          <div style={{ marginBottom: '16px' }}>
                            <div className="stat-label">Team Size</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                              {campaign.team_size} {campaign.team_size === 1 ? 'member' : 'members'}
                            </div>
                          </div>
                        )}
                        {campaign.team_experience && (
                          <div>
                            <div className="stat-label" style={{ marginBottom: '8px' }}>Experience & Expertise</div>
                            <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                              {campaign.team_experience}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Risks & Challenges */}
                    {campaign.risks_and_challenges && (
                      <div className="card">
                        <h3 className="card-title">⚠️ Risks & Challenges</h3>
                        <p className="text-gray-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                          {campaign.risks_and_challenges}
                        </p>
                      </div>
                    )}

                    {/* Social Media & Links */}
                    {(campaign.social_media_links || campaign.website_url || campaign.github_repository) && (
                      <div className="card">
                        <h3 className="card-title">🔗 Connect with Us</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                          {campaign.website_url && (
                            <a 
                              href={campaign.website_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                padding: '10px 20px',
                                background: '#667eea',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '14px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              🌐 Website
                            </a>
                          )}
                          {campaign.github_repository && (
                            <a 
                              href={campaign.github_repository} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                padding: '10px 20px',
                                background: '#24292e',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '14px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                              </svg>
                              GitHub
                            </a>
                          )}
                          {campaign.social_media_links?.twitter && (
                            <a 
                              href={campaign.social_media_links.twitter} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                padding: '10px 20px',
                                background: '#1DA1F2',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '14px'
                              }}
                            >
                              𝕏 Twitter
                            </a>
                          )}
                          {campaign.social_media_links?.linkedin && (
                            <a 
                              href={campaign.social_media_links.linkedin} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                padding: '10px 20px',
                                background: '#0077B5',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '14px'
                              }}
                            >
                              in LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resources */}
                    {(campaign.pitch_deck_url || campaign.whitepaper_url) && (
                      <div className="card">
                        <h3 className="card-title">📄 Resources</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {campaign.pitch_deck_url && (
                            <a 
                              href={campaign.pitch_deck_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                padding: '16px',
                                background: '#f9fafb',
                                border: '2px solid #e5e7eb',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                color: '#111827',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.borderColor = '#667eea';
                                e.target.style.background = '#f0f4ff';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.background = '#f9fafb';
                              }}
                            >
                              <span>📊 View Pitch Deck</span>
                              <span style={{ color: '#667eea' }}>→</span>
                            </a>
                          )}
                          {campaign.whitepaper_url && (
                            <a 
                              href={campaign.whitepaper_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                padding: '16px',
                                background: '#f9fafb',
                                border: '2px solid #e5e7eb',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                color: '#111827',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.borderColor = '#667eea';
                                e.target.style.background = '#f0f4ff';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.background = '#f9fafb';
                              }}
                            >
                              <span>📄 Read Whitepaper</span>
                              <span style={{ color: '#667eea' }}>→</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Legal Information */}
                    {(campaign.legal_structure || campaign.registration_number) && (
                      <div className="card">
                        <h3 className="card-title">⚖️ Legal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                          {campaign.legal_structure && (
                            <div className="stat-item">
                              <span className="stat-label">Legal Structure</span>
                              <span className="stat-value">{campaign.legal_structure}</span>
                            </div>
                          )}
                          {campaign.registration_number && (
                            <div className="stat-item">
                              <span className="stat-label">Registration Number</span>
                              <span className="stat-value">{campaign.registration_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Previous Funding */}
                    {(campaign.previous_funding_amount || campaign.previous_funding_source) && (
                      <div className="card">
                        <h3 className="card-title">💵 Previous Funding</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                          {campaign.previous_funding_amount && (
                            <div className="stat-item">
                              <span className="stat-label">Amount</span>
                              <span className="stat-value">{formatCurrency(campaign.previous_funding_amount)}</span>
                            </div>
                          )}
                          {campaign.previous_funding_source && (
                            <div className="stat-item">
                              <span className="stat-label">Source</span>
                              <span className="stat-value">{campaign.previous_funding_source}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'milestones' && (
                  <MilestoneList 
                    milestones={campaignMilestones} 
                    campaignId={campaign.id}
                    showVoting={true}
                  />
                )}

                {activeTab === 'updates' && (
                  <div className="space-y-lg">
                    {/* Post Update Form (Creator Only) */}
                    {isCreator && (
                      <MilestoneUpdateForm
                        campaignId={campaign.id}
                        milestones={campaignMilestones}
                        onSuccess={() => setUpdatesKey(prev => prev + 1)}
                      />
                    )}
                    
                    {/* Display Updates */}
                    <CampaignUpdates
                      key={updatesKey}
                      campaignId={campaign.id}
                      isCreator={isCreator}
                      isAdmin={isAdmin}
                    />
                  </div>
                )}

                {activeTab === 'qa' && (
                  <CampaignQA 
                    campaignId={campaign.id} 
                    creatorId={campaign.creatorId} 
                  />
                )}
              </div>
            </div>

            {/* AI Risk Analysis Section */}
            <div style={{ 
              marginTop: '16px',
              background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #BFDBFE'
            }}>
              <h4 style={{ 
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e40af'
              }}>
                AI Risk Analysis
              </h4>

              {campaign.analyzed_at ? (
                <>
                  {/* Risk Level Badge */}
                  <div style={{ marginBottom: '16px' }}>
                    <RiskBadge
                      level={campaign.manual_risk_level || campaign.risk_level}
                      score={campaign.manual_risk_level ? null : campaign.final_risk_score}
                    />
                    {campaign.manual_risk_level && campaign.manual_risk_reason && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: '#fef3c7',
                        border: '1px solid #fbbf24',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#92400e'
                      }}>
                        <strong>Admin Override:</strong> {campaign.manual_risk_reason}
                      </div>
                    )}
                  </div>

                  {/* Detailed Score Breakdown */}
                  {!campaign.manual_risk_level && (
                    <div style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px', fontWeight: '600' }}>
                        Risk Score Breakdown:
                      </div>
                      <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                        {campaign.ml_scam_score !== null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280' }}>ML Scam Detection:</span>
                            <span style={{ 
                              fontWeight: '600',
                              color: campaign.ml_scam_score > 0.5 ? '#dc2626' : campaign.ml_scam_score > 0.3 ? '#f59e0b' : '#10b981'
                            }}>
                              {(campaign.ml_scam_score * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {campaign.plagiarism_score !== null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280' }}>Content Plagiarism:</span>
                            <span style={{ 
                              fontWeight: '600',
                              color: campaign.plagiarism_score > 0.5 ? '#dc2626' : campaign.plagiarism_score > 0.3 ? '#f59e0b' : '#10b981'
                            }}>
                              {(campaign.plagiarism_score * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {campaign.wallet_risk_score !== null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280' }}>Wallet Risk:</span>
                            <span style={{ 
                              fontWeight: '600',
                              color: campaign.wallet_risk_score > 0.5 ? '#dc2626' : campaign.wallet_risk_score > 0.3 ? '#f59e0b' : '#10b981'
                            }}>
                              {(campaign.wallet_risk_score * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <div style={{ 
                          borderTop: '1px solid #e5e7eb',
                          paddingTop: '8px',
                          marginTop: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ color: '#111827', fontWeight: '600' }}>Final Risk Score:</span>
                          <span style={{ 
                            fontWeight: '700',
                            fontSize: '14px',
                            color: campaign.final_risk_score > 0.5 ? '#dc2626' : campaign.final_risk_score > 0.3 ? '#f59e0b' : '#10b981'
                          }}>
                            {(campaign.final_risk_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Analyzed Status */}
                  <div style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    textAlign: 'center',
                    display: 'inline-block',
                    width: '100%',
                    opacity: 0.85
                  }}>
                    ✓ Analyzed on {new Date(campaign.analyzed_at).toLocaleDateString()}
                  </div>
                </>
              ) : (
                <>
                  {/* Not Analyzed Yet */}
                  <div style={{
                    background: '#fef3c7',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#92400e',
                    border: '1px solid #fbbf24'
                  }}>
                    ⚠️ This campaign has not been analyzed yet. {isAdmin ? 'Click below to run AI risk analysis.' : 'AI risk analysis pending.'}
                  </div>

                  {/* Analyze Button - Admin Only */}
                  {isAdmin && (
                    <div
                      style={{
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        userSelect: 'none',
                        width: '100%',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                      }}
                      onClick={async () => {
                        if (!confirm('Run AI risk analysis for this campaign? This will analyze content, creator history, and other factors.')) return;
                        try {
                          setLoading(true);
                          await analyzeCampaignRisk(campaign.id);
                          alert('✅ Risk analysis completed successfully!');
                          window.location.reload();
                        } catch (err) {
                          alert('❌ Risk analysis failed: ' + err.message);
                          setLoading(false);
                        }
                      }}
                    >
                      🔍 Analyze Risk Now
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Admin Risk Override - Only visible to admins */}
            {isAdmin && (
              <AdminRiskOverride 
                campaign={campaign}
                onUpdate={(updatedCampaign) => {
                  // Update campaign state with all new risk data
                  setCampaign(prev => ({
                    ...prev,
                    manual_risk_level: updatedCampaign.manual_risk_level,
                    manual_risk_reason: updatedCampaign.manual_risk_reason,
                    risk_level: updatedCampaign.risk_level,
                    final_risk_score: updatedCampaign.final_risk_score
                  }));
                }}
              />
            )}



            {/* Sidebar */}
            <div>
              <div className="sticky" style={{ top: '6rem' }}>
                {/* Investment Panel - Only for investors (not campaign creator) */}
                {userId && campaign.status === 'active' && !isCreator && (
                  <div className="card" style={{ backgroundColor: '#f0fdfa', border: '2px solid #29C7AC' }}>
                    <h3 className="card-title" style={{ color: '#0f766e' }}>💼 Your Wallet</h3>
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '8px' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>AVAILABLE BALANCE:</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#29C7AC' }}>
                          {wallet?.balanceFc?.toLocaleString() || 0} FC
                        </div>
                      </div>
                      <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>LOCKED (INVESTED):</div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: '#f59e0b' }}>
                          {wallet?.lockedFc?.toLocaleString() || 0} FC
                        </div>
                      </div>
                      <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>TOTAL WALLET:</div>
                        <div style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                          {((wallet?.balanceFc || 0) + (wallet?.lockedFc || 0)).toLocaleString()} FC
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowInvestModal(true)}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold' }}
                    >
                      🚀 Invest in This Campaign
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invest Modal */}
      {showInvestModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowInvestModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold">Invest in Campaign</h3>
              <button 
                onClick={() => setShowInvestModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {successMessage && (
              <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-lg">
                {successMessage}
              </div>
            )}

            {investError && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg">
                {investError}
              </div>
            )}

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Your Available Balance</div>
              <div className="text-2xl font-bold text-primary">
                {wallet?.balanceFc?.toLocaleString() || 0} FC
              </div>
            </div>

            <form onSubmit={handleInvestSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investment Amount (FC)
                </label>
                <input
                  type="number"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  placeholder="Enter amount to invest"
                  min="1"
                  step="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={investmentLoading || investLoading}
                  required
                />
                {investAmount && parseFloat(investAmount) > (wallet?.balanceFc || 0) && (
                  <p className="text-red-600 text-sm mt-1">Insufficient balance</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInvestModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={investmentLoading || investLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={investmentLoading || investLoading || !investAmount || parseFloat(investAmount) > (wallet?.balanceFc || 0)}
                >
                  {investmentLoading || investLoading ? 'Processing...' : 'Invest Now'}
                </button>
              </div>
            </form>

            <div className="mt-4 text-xs text-gray-500 text-center">
              Your investment will be locked in escrow until campaign milestones are met
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaign;