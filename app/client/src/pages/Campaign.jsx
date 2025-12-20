import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import MilestoneList from '../components/MilestoneList';
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
  const { userId, user, wallet, refreshWallet } = useAuth();
  const { investInCampaign, investLoading, investError } = useEscrowActions();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);
  const [campaignMilestones, setCampaignMilestones] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [campaignWallet, setCampaignWallet] = useState(null);
  const [userInvestments, setUserInvestments] = useState([]);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [investAmount, setInvestAmount] = useState('');
  const [investmentLoading, setInvestmentLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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

<<<<<<< HEAD
=======
  const getRiskBadgeClass = (riskScore) => {
    if (riskScore <= 30) return 'badge risk-low';
    if (riskScore <= 60) return 'badge risk-medium';
    return 'badge risk-high';
  };

  const getRiskLabel = (riskScore) => {
    if (riskScore <= 30) return 'Low Risk';
    if (riskScore <= 60) return 'Medium Risk';
    return 'High Risk';
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

>>>>>>> origin/main
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
                {/* Investment Panel */}
                {userId && campaign.status === 'active' && (
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowInvestModal(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
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