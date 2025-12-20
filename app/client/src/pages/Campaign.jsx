import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import MilestoneList from '../components/MilestoneList';
import InvestPanel from '../components/InvestPanel';
import Loader from '../components/Loader';
import { campaignApi } from '../lib/api.js';
import RiskBadge from '../components/RiskBadge'
import { analyzeCampaignRisk } from '../services/riskAnalysis'
import AdminRiskOverride from '../components/AdminRiskOverride';
import { supabase } from '../lib/supabase';



const Campaign = () => {
  const { slug } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);
  const [campaignMilestones, setCampaignMilestones] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

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
          analyzed_at: data.analyzed_at
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

  // Check if current user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
          
          const adminRole = profile?.role === 'admin';
          setIsAdmin(adminRole);
          console.log('👤 User role:', profile?.role, '| Is Admin:', adminRole);
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      }
    };
    
    checkAdminRole();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
                      <p className="text-gray-700 leading-relaxed">
                        {campaign.summary} This campaign represents an exciting opportunity to invest in 
                        cutting-edge technology that has the potential to transform its industry. 
                        The project team has demonstrated strong progress toward their milestones and 
                        has a clear roadmap for success.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'milestones' && (
                  <MilestoneList milestones={campaignMilestones} />
                )}

                {activeTab === 'updates' && (
                  <div className="card">
                    <h3 className="card-title">Project Updates</h3>
                    <div className="empty-state">
                      <h4>No updates yet</h4>
                      <p>The project creator has not posted any updates. Check back later for news and progress reports.</p>
                    </div>
                  </div>
                )}

                {activeTab === 'qa' && (
                  <div className="card">
                    <h3 className="card-title">Questions & Answers</h3>
                    <div className="empty-state">
                      <h4>No questions yet</h4>
                      <p>Be the first to ask a question about this project. Q&A functionality will be available in Phase 2.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RiskBadge*/}
            <div style={{ marginTop: '10px' }}>
              <h4>AI Risk Analysis</h4>
              <RiskBadge
              level={campaign.risk_level}
              score={campaign.final_risk_score}
              />
            </div>

            {/* AnalyzeRisk*/}
            <button
            disabled={!!campaign.analyzed_at}
            onClick={async () => {
              try {
                await analyzeCampaignRisk(campaign.id)
                alert('Risk analysis completed')
                window.location.reload()
              } catch (err) {
                alert(err.message)
              }
              }}
            >
              {campaign.analyzed_at ? 'Risk Analyzed' : 'Analyze Risk'}
            </button>

            {/* Admin Risk Override - Only visible to admins */}
            {isAdmin && (
              <AdminRiskOverride 
                campaign={campaign}
                onUpdate={(updatedCampaign) => {
                  // Update campaign state with new risk data
                  setCampaign(prev => ({
                    ...prev,
                    manual_risk_level: updatedCampaign.manual_risk_level,
                    risk_level: updatedCampaign.risk_level,
                    final_risk_score: updatedCampaign.final_risk_score
                  }));
                }}
              />
            )}



            {/* Sidebar */}
            <div>
              <div className="sticky" style={{ top: '6rem' }}>
                <InvestPanel 
                  campaign={campaign} 
                  onInvestSuccess={({ amount }) => {
                    // Optimistically update progress while DB triggers update canonical values
                    setCampaign(prev => prev ? ({
                      ...prev,
                      raisedAmount: Number(prev.raisedAmount || 0) + Number(amount)
                    }) : prev);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaign;