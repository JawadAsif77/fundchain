import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { adminApi, milestoneVotingApi, qaApi, milestoneUpdateApi, campaignApi } from '../lib/api.js';
import { useEscrowActions } from '../hooks/useEscrowActions';
import EscrowFlow from '../components/EscrowFlow';
import TransactionHistory from '../components/TransactionHistory';
import AdminRiskOverride from '../components/AdminRiskOverride';
import RiskBadge from '../components/RiskBadge';

const AdminPanel = () => {
  const { user, profile, logout, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('verifications');
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  // Campaign approvals state
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [campaignError, setCampaignError] = useState('');
  // Escrow management state
  const [platformWallet, setPlatformWallet] = useState(null);
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [campaignWallets, setCampaignWallets] = useState({});
  const [selectedCampaignForMilestone, setSelectedCampaignForMilestone] = useState(null);
  const [campaignMilestones, setCampaignMilestones] = useState([]);
  const [milestoneVoteStats, setMilestoneVoteStats] = useState({});
  const [selectedCampaignForRefund, setSelectedCampaignForRefund] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const { releaseMilestone, refundCampaignInvestors, releaseLoading, refundLoading} = useEscrowActions();
  // Moderation state
  const [contentReports, setContentReports] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [allAnswers, setAllAnswers] = useState([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  // Risk management state
  const [riskCampaigns, setRiskCampaigns] = useState([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== 'admin')) {
      console.log('Unauthorized access to admin panel');
      navigate('/', { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  // Load pending verifications
  useEffect(() => {
    if (profile?.role === 'admin') {
      loadPendingVerifications();
      loadPendingCampaigns();
      loadPlatformWallet();
      loadAllCampaigns();
      loadContentReports();
      loadRiskCampaigns();
    }
  }, [profile]);

  const loadContentReports = async () => {
    try {
      setModerationLoading(true);
      const [reports, questions, answers] = await Promise.all([
        adminApi.getContentReports(),
        adminApi.getAllQuestions(),
        adminApi.getAllAnswers()
      ]);
      setContentReports(reports);
      setAllQuestions(questions);
      setAllAnswers(answers);
    } catch (err) {
      console.error('Error loading content reports:', err);
    } finally {
      setModerationLoading(false);
    }
  };

  const loadRiskCampaigns = async () => {
    try {
      setRiskLoading(true);
      const { data } = await campaignApi.getCampaigns({});
      const mapped = (data || []).map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        status: c.status,
        risk_level: c.risk_level,
        final_risk_score: c.final_risk_score,
        manual_risk_level: c.manual_risk_level,
        analyzed_at: c.analyzed_at,
        created_at: c.created_at,
      }));
      setRiskCampaigns(mapped);
    } catch (err) {
      console.error('Error loading campaigns for risk management:', err);
    } finally {
      setRiskLoading(false);
    }
  };

  const handleHideQuestion = async (questionId, reportId) => {
    if (!confirm('Are you sure you want to hide this question?')) return;
    
    try {
      await adminApi.hideQuestion(questionId);
      if (reportId) {
        await adminApi.resolveReport(reportId);
      }
      alert('Question hidden successfully');
      loadContentReports();
    } catch (err) {
      alert('Failed to hide question: ' + err.message);
    }
  };

  const handleHideAnswer = async (answerId, reportId) => {
    if (!confirm('Are you sure you want to hide this answer?')) return;
    
    try {
      await adminApi.hideAnswer(answerId);
      if (reportId) {
        await adminApi.resolveReport(reportId);
      }
      alert('Answer hidden successfully');
      loadContentReports();
    } catch (err) {
      alert('Failed to hide answer: ' + err.message);
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await adminApi.resolveReport(reportId);
      alert('Report marked as resolved');
      loadContentReports();
    } catch (err) {
      alert('Failed to resolve report: ' + err.message);
    }
  };

  const loadPlatformWallet = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_wallet')
        .select('*')
        .single();
      
      if (error) throw error;
      setPlatformWallet(data);
    } catch (err) {
      console.error('Error loading platform wallet:', err);
    }
  };

  const loadAllCampaigns = async () => {
    try {
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (campaignsError) throw campaignsError;
      setAllCampaigns(campaigns || []);

      // Load campaign wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('campaign_wallets')
        .select('*');
      
      if (!walletsError && wallets) {
        const walletsMap = {};
        wallets.forEach(w => {
          walletsMap[w.campaign_id] = w;
        });
        setCampaignWallets(walletsMap);
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setCampaignError(err.message);
    }
  };

  const handleViewMilestones = async (campaign) => {
    setSelectedCampaignForMilestone(campaign);
    
    // Load milestones for this campaign
    const { data: milestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('order_index', { ascending: true });
    
    setCampaignMilestones(milestones || []);

    // Load voting stats for each milestone
    const stats = {};
    for (const milestone of milestones || []) {
      try {
        const voteStats = await milestoneVotingApi.getVoteStats(milestone.id);
        stats[milestone.id] = voteStats;
      } catch (err) {
        console.error('Error loading vote stats for milestone:', milestone.id, err);
      }
    }
    setMilestoneVoteStats(stats);
  };

  const handleReleaseMilestone = async (milestoneId, amountFc) => {
    if (!selectedCampaignForMilestone) return;
    
    // Check if milestone has approval consensus
    const voteStats = milestoneVoteStats[milestoneId];
    if (voteStats && voteStats.consensus !== 'approved') {
      alert(`Cannot release milestone: ${voteStats.consensus === 'rejected' ? 'Milestone rejected by investors' : 'Waiting for investor approval (need ≥60% approval)'}`);
      return;
    }
    
    // Check if campaign has any updates
    const hasUpdates = await milestoneUpdateApi.milestoneHasUpdates(selectedCampaignForMilestone.id);
    if (!hasUpdates) {
      alert('Cannot release milestone: Creator must post at least one progress update before requesting funds.');
      return;
    }
    
    try {
      await releaseMilestone({
        campaignId: selectedCampaignForMilestone.id,
        milestoneId,
        amountFc,
        notes: 'Released by admin after investor approval'
      });
      
      alert('Milestone funds released successfully!');
      setSelectedCampaignForMilestone(null);
      setMilestoneVoteStats({});
      loadAllCampaigns();
      loadPlatformWallet();
    } catch (err) {
      alert('Failed to release milestone: ' + err.message);
    }
  };

  const handleRefundCampaign = async () => {
    if (!selectedCampaignForRefund) return;
    
    try {
      const result = await refundCampaignInvestors({
        campaignId: selectedCampaignForRefund.id,
        reason: refundReason || 'Campaign refunded by admin'
      });
      
      alert(`Refund successful! ${result.refundedCount} investors refunded, total: ${result.totalRefund} FC`);
      setSelectedCampaignForRefund(null);
      setRefundReason('');
      loadAllCampaigns();
      loadPlatformWallet();
    } catch (err) {
      alert('Failed to refund: ' + err.message);
    }
  };

  const loadPendingVerifications = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      console.log('Loading pending verifications...');
      
      // First check if there are ANY verifications at all
      const { data: allVerifications, error: allError } = await supabase
        .from('user_verifications')
        .select('*');
      
      console.log('Total verifications in database:', allVerifications?.length || 0);
      console.log('All verifications:', allVerifications);
      
      // Get all pending verifications
      const { data: verificationsData, error: verificationsError } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('verification_status', 'pending')
        .order('submitted_at', { ascending: false });

      if (verificationsError) {
        console.error('Error loading verifications:', verificationsError);
        setError(`Failed to load verifications: ${verificationsError.message}`);
        return;
      }

      console.log('Pending verifications loaded:', verificationsData);
      console.log('Number of pending verifications:', verificationsData?.length || 0);

      // If we have verifications, get the user details separately
      if (verificationsData && verificationsData.length > 0) {
        const userIds = verificationsData.map(v => v.user_id);
        console.log('Loading user details for IDs:', userIds);
        
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, full_name, username')
          .in('id', userIds);

        if (usersError) {
          console.error('Error loading users:', usersError);
          // Continue with verification data only - don't fail completely
          console.log('Continuing without user details due to error');
        }

        console.log('Users loaded:', usersData);

        // Combine the data
        const combinedData = verificationsData.map(verification => ({
          ...verification,
          users: usersData?.find(user => user.id === verification.user_id) || null
        }));

        setVerifications(combinedData);
        console.log('Combined data set:', combinedData);
      } else {
        console.log('No pending verifications found');
        setVerifications([]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCampaigns = async () => {
    try {
      setCampaignLoading(true);
      setCampaignError('');
      // Load campaigns in pending_review status
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false });
      if (campaignsError) {
        console.error('Error loading campaigns:', campaignsError);
        setCampaignError(`Database error: ${campaignsError.message}`);
        setPendingCampaigns([]);
        return;
      }

      if (campaignsData && campaignsData.length > 0) {
        const creatorIds = campaignsData.map(c => c.creator_id).filter(Boolean);
        let usersMap = {};
        if (creatorIds.length > 0) {
          const { data: usersData, error: usersErr } = await supabase
            .from('users')
            .select('id, email, full_name')
            .in('id', creatorIds);
          if (!usersErr && usersData) {
            usersMap = usersData.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
          }
        }
        const enriched = campaignsData.map(c => ({
          ...c,
          creator_user: usersMap[c.creator_id] || null
        }));
        setPendingCampaigns(enriched);
      } else {
        setPendingCampaigns([]);
      }
    } catch (err) {
      console.error('Unexpected error (campaigns):', err);
      setCampaignError(`An unexpected error occurred: ${err.message}`);
      setPendingCampaigns([]);
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleApproveCampaign = async (campaignId) => {
    try {
      setActionLoading(true);
      const res = await adminApi.approveCampaign(campaignId);
      if (!res.success) {
        setCampaignError(res.error || 'Failed to approve campaign');
        return;
      }
      await loadPendingCampaigns();
    } catch (err) {
      console.error('Approve campaign error:', err);
      setCampaignError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectCampaign = async (campaignId) => {
    try {
      const reason = window.prompt('Enter a reason for rejection (optional):') || null;
      setActionLoading(true);
      const res = await adminApi.rejectCampaign(campaignId, reason);
      if (!res.success) {
        setCampaignError(res.error || 'Failed to reject campaign');
        return;
      }
      await loadPendingCampaigns();
    } catch (err) {
      console.error('Reject campaign error:', err);
      setCampaignError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (verificationId) => {
    try {
      setActionLoading(true);
      
      // Call the approve function
      const { data, error } = await supabase.rpc('approve_user_verification', {
        verification_id: verificationId,
        admin_notes_param: 'Approved by admin'
      });

      if (error) {
        console.error('Approval error:', error);
        setError('Failed to approve verification');
        return;
      }

      // Reload verifications
      await loadPendingVerifications();
      setSelectedVerification(null);
      
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (verificationId, reason) => {
    try {
      setActionLoading(true);
      
      // Call the reject function
      const { data, error } = await supabase.rpc('reject_user_verification', {
        verification_id: verificationId,
        rejection_reason_param: reason,
        admin_notes_param: 'Rejected by admin'
      });

      if (error) {
        console.error('Rejection error:', error);
        setError('Failed to reject verification');
        return;
      }

      // Reload verifications
      await loadPendingVerifications();
      setSelectedVerification(null);
      
    } catch (err) {
      console.error('Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px'
      }}>
        Loading admin panel...
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#dc2626'
      }}>
        Access denied. Admin privileges required.
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '0',
      margin: '0'
    }}>
      {/* Admin Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#111827',
            margin: 0
          }}>
            FundChain Admin
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0
          }}>
            Manage Verifications, Funds & Token Tracking
          </p>
        </div>
        
        <button
          onClick={logout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 24px'
      }}>
        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}
        {campaignError && (
          <div style={{
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626'
          }}>
            {campaignError}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #E2E8F0',
          paddingBottom: '0'
        }}>
          <button
            onClick={() => setActiveTab('verifications')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'verifications' ? '3px solid #4299E1' : 'none',
              color: activeTab === 'verifications' ? '#4299E1' : '#718096',
              fontWeight: activeTab === 'verifications' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '16px',
              marginBottom: '-2px'
            }}
          >
            🔍 Verifications
          </button>
          <button
            onClick={() => setActiveTab('funds')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'funds' ? '3px solid #4299E1' : 'none',
              color: activeTab === 'funds' ? '#4299E1' : '#718096',
              fontWeight: activeTab === 'funds' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '16px',
              marginBottom: '-2px'
            }}
          >
            💰 Funds Management
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'tokens' ? '3px solid #4299E1' : 'none',
              color: activeTab === 'tokens' ? '#4299E1' : '#718096',
              fontWeight: activeTab === 'tokens' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '16px',
              marginBottom: '-2px'
            }}
          >
            🔒 Token Tracking
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'risk' ? '3px solid #4299E1' : 'none',
              color: activeTab === 'risk' ? '#4299E1' : '#718096',
              fontWeight: activeTab === 'risk' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '16px',
              marginBottom: '-2px'
            }}
          >
            ⚠️ Risk Management
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'moderation' ? '3px solid #4299E1' : 'none',
              color: activeTab === 'moderation' ? '#4299E1' : '#718096',
              fontWeight: activeTab === 'moderation' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '16px',
              marginBottom: '-2px'
            }}
          >
            🛡️ Content Moderation {contentReports.length > 0 && `(${contentReports.length})`}
          </button>
        </div>

        {/* Verifications Tab Content */}
        {activeTab === 'verifications' && (
          <div>
            {/* Pending Verifications Section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              marginBottom: '24px'
            }}>
              {/* Tab Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#111827',
                    margin: 0
                  }}>
                    👤 Pending User Verifications
                  </h2>
                  <div style={{
                    padding: '4px 12px',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {verifications.length} pending
                  </div>
                </div>
              </div>

          {/* Content */}
          <div style={{ padding: '24px' }}>
            {verifications.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#374151' }}>
                  No pending verifications
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                  All verifications have been processed
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '16px'
              }}>
                {verifications.map((verification) => (
                  <div
                    key={verification.id}
                    style={{
                      padding: '20px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'start',
                      gap: '16px'
                    }}>
                      <div>
                        <h3 style={{
                          margin: '0 0 8px 0',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          {verification.legal_name}
                        </h3>
                        
                        <div style={{ display: 'grid', gap: '4px', fontSize: '14px', color: '#6b7280' }}>
                          <div>Email: {verification.users?.email || verification.legal_email}</div>
                          <div>Phone: {verification.phone}</div>
                          <div>Submitted: {new Date(verification.submitted_at).toLocaleDateString()}</div>
                        </div>

                        <div style={{ marginTop: '12px' }}>
                          <span style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '4px'
                          }}>
                            {verification.verification_type}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setSelectedVerification(verification)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Campaign Approvals */}
        <div style={{
          marginTop: '32px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>📋 Pending Campaign Approvals</h2>
              <div style={{ padding: '4px 12px', backgroundColor: '#DBEAFE', color: '#1E40AF', borderRadius: '20px', fontSize: '14px', fontWeight: 500 }}>
                {pendingCampaigns.length} pending
              </div>
            </div>
          </div>
          <div style={{ padding: '24px' }}>
            {campaignLoading ? (
              <div>Loading pending campaigns…</div>
            ) : pendingCampaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#374151' }}>No pending campaigns</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>All campaigns have been reviewed</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {pendingCampaigns.map((c) => (
                  <div key={c.id} style={{ padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#111827' }}>{c.title}</h3>
                        <div style={{ display: 'grid', gap: '4px', fontSize: '14px', color: '#6b7280' }}>
                          <div>Creator: {c.creator_user?.full_name || c.creator_user?.email || c.creator_id}</div>
                          <div>Goal: ${Number(c.funding_goal || 0).toLocaleString()}</div>
                          <div>Min investment: ${Number(c.min_investment || 0).toLocaleString()}</div>
                          <div>Submitted: {new Date(c.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                        <button
                          onClick={() => handleApproveCampaign(c.id)}
                          disabled={actionLoading}
                          style={{ padding: '8px 12px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectCampaign(c.id)}
                          disabled={actionLoading}
                          style={{ padding: '8px 12px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
          </div>
        )}

        {/* Funds Management Tab Content */}
        {activeTab === 'funds' && (
          <div>
            {/* Platform Wallet Overview */}
            {platformWallet && (
          <div style={{
            marginTop: '32px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '2px solid #29C7AC',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f0fdf9'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                🏦 Platform Wallet
              </h2>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total Balance</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#29C7AC' }}>
                    {platformWallet.balance_fc?.toLocaleString() || 0} FC
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Locked (In Escrow)</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>
                    {platformWallet.locked_fc?.toLocaleString() || 0} FC
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns Escrow Management */}
        <div style={{
          marginTop: '32px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              💰 Campaign Escrow Management
            </h2>
          </div>
          <div style={{ padding: '24px', overflowX: 'auto' }}>
            {allCampaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                No campaigns found
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Campaign</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Creator</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Funding</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Escrow</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Released</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allCampaigns.map((campaign) => {
                    const wallet = campaignWallets[campaign.id];
                    return (
                      <tr key={campaign.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 500, marginBottom: '4px' }}>{campaign.title}</div>
                        </td>
                        <td style={{ padding: '16px', fontSize: '14px', color: '#6b7280' }}>
                          {campaign.users?.full_name || campaign.users?.email || 'N/A'}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 500 }}>
                          ${(campaign.current_funding || 0).toLocaleString()} / ${(campaign.funding_goal || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', color: '#f59e0b' }}>
                          {wallet?.escrow_balance_fc?.toLocaleString() || 0} FC
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                          {wallet?.released_fc?.toLocaleString() || 0} FC
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            backgroundColor: campaign.status === 'active' ? '#dcfce7' : campaign.status === 'failed' ? '#fee2e2' : '#fef3c7',
                            color: campaign.status === 'active' ? '#166534' : campaign.status === 'failed' ? '#991b1b' : '#854d0e',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 500
                          }}>
                            {campaign.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleViewMilestones(campaign)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              View Milestones
                            </button>
                            {campaign.status === 'active' && wallet?.escrow_balance_fc > 0 && (
                              <button
                                onClick={() => setSelectedCampaignForRefund(campaign)}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Escrow Flow Visualization */}
        <div style={{ marginTop: '32px' }}>
          <EscrowFlow 
            userBalance={1000}
            userLocked={500}
            campaignEscrow={platformWallet?.locked_fc || 0}
            creatorBalance={300}
            animated={true}
          />
        </div>

          </div>
        )}

        {/* Token Tracking Tab Content */}
        {activeTab === 'tokens' && (
          <div>
            {/* Summary Cards */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '20px',
              marginBottom: '24px'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '2px solid #FED7D7'
              }}>
                <p style={{ color: '#718096', marginBottom: '8px', fontSize: '14px' }}>
                  Total Locked FC
                </p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#C53030' }}>
                  {platformWallet?.locked_fc?.toLocaleString() || 0} FC
                </p>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '2px solid #C6F6D5'
              }}>
                <p style={{ color: '#718096', marginBottom: '8px', fontSize: '14px' }}>
                  Active Campaigns
                </p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2F855A' }}>
                  {allCampaigns.filter(c => c.status === 'active').length}
                </p>
              </div>
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '2px solid #BEE3F8'
              }}>
                <p style={{ color: '#718096', marginBottom: '8px', fontSize: '14px' }}>
                  Total Campaigns
                </p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2C5282' }}>
                  {allCampaigns.length}
                </p>
              </div>
            </div>

            {/* Transaction History */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
                📜 Recent Token Transactions
              </h3>
              <TransactionHistory limit={20} />
            </div>
          </div>
        )}

        {/* Content Moderation Tab */}
        {/* Risk Management Tab */}
        {activeTab === 'risk' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Campaign Risk Management</h2>
              <button
                onClick={loadRiskCampaigns}
                disabled={riskLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4299E1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: riskLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {riskLoading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>

            {riskLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>Loading campaigns...</p>
              </div>
            ) : riskCampaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                <p>No campaigns found</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {riskCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '20px',
                      backgroundColor: '#fafafa'
                    }}
                  >
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                        {campaign.title}
                      </h3>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '14px', color: '#718096' }}>
                        <span>Status: <strong>{campaign.status}</strong></span>
                        <span>•</span>
                        <span>Created: {new Date(campaign.created_at).toLocaleDateString()}</span>
                        {campaign.analyzed_at && (
                          <>
                            <span>•</span>
                            <span>Analyzed: {new Date(campaign.analyzed_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      {/* Current Risk Display */}
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Current Risk Status</h4>
                        {campaign.manual_risk_level ? (
                          <div>
                            <RiskBadge level={campaign.manual_risk_level} score={campaign.final_risk_score} />
                            <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>Manual Override Active</p>
                          </div>
                        ) : campaign.risk_level ? (
                          <div>
                            <RiskBadge level={campaign.risk_level} score={campaign.final_risk_score} />
                            <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>AI Analysis</p>
                          </div>
                        ) : (
                          <p style={{ color: '#718096', fontSize: '14px' }}>Not analyzed yet</p>
                        )}
                      </div>

                      {/* Admin Risk Override Component */}
                      <div style={{ flex: 1 }}>
                        <AdminRiskOverride
                          campaign={campaign}
                          onUpdate={loadRiskCampaigns}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content Moderation Tab */}
        {activeTab === 'moderation' && (
          <div>
            {/* Reported Content Section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              marginBottom: '24px'
            }}>
              <div style={{
                padding: '24px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  🚩 Reported Content
                </h2>
                <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  Content that has been flagged by users
                </p>
              </div>

              {moderationLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Loading reports...
                </div>
              ) : contentReports.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  <p style={{ fontSize: '16px', marginBottom: '8px' }}>✅ No pending reports</p>
                  <p style={{ fontSize: '14px' }}>All reported content has been reviewed</p>
                </div>
              ) : (
                <div style={{ padding: '24px' }}>
                  {contentReports.map((report) => (
                    <div 
                      key={report.id}
                      style={{
                        backgroundColor: '#fef3c7',
                        border: '1px solid #fbbf24',
                        borderRadius: '8px',
                        padding: '20px',
                        marginBottom: '16px'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>
                            {report.content_type}
                          </span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            Reported: {new Date(report.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                          Reported by: {report.reporter?.username || report.reporter?.email || 'Unknown'}
                        </div>
                      </div>

                      {report.reason && (
                        <div style={{ 
                          backgroundColor: 'white', 
                          padding: '12px', 
                          borderRadius: '6px',
                          marginBottom: '12px',
                          borderLeft: '3px solid #dc2626'
                        }}>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>
                            REASON:
                          </div>
                          <div style={{ fontSize: '14px', color: '#1f2937' }}>
                            {report.reason}
                          </div>
                        </div>
                      )}

                      <div style={{ 
                        display: 'flex', 
                        gap: '12px',
                        marginTop: '16px'
                      }}>
                        {report.content_type === 'question' && (
                          <button
                            onClick={() => handleHideQuestion(report.content_id, report.id)}
                            style={{
                              flex: 1,
                              padding: '10px 16px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            🚫 Hide Question
                          </button>
                        )}
                        {report.content_type === 'answer' && (
                          <button
                            onClick={() => handleHideAnswer(report.content_id, report.id)}
                            style={{
                              flex: 1,
                              padding: '10px 16px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            🚫 Hide Answer
                          </button>
                        )}
                        <button
                          onClick={() => handleResolveReport(report.id)}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Resolve (No Action)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* All Questions Section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              marginBottom: '24px'
            }}>
              <div style={{
                padding: '24px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  💬 All Questions
                </h2>
                <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  Recent questions from all campaigns (last 50)
                </p>
              </div>

              {moderationLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Loading questions...
                </div>
              ) : allQuestions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  No questions yet
                </div>
              ) : (
                <div style={{ padding: '24px' }}>
                  {allQuestions.map((question) => (
                    <div 
                      key={question.id}
                      style={{
                        backgroundColor: question.is_hidden ? '#fee2e2' : '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                          By: {question.users?.full_name || question.users?.username || 'Anonymous'} • {new Date(question.created_at).toLocaleDateString()}
                          {question.is_hidden && (
                            <span style={{ marginLeft: '12px', color: '#dc2626', fontWeight: 'bold' }}>
                              [HIDDEN]
                            </span>
                          )}
                          {question.is_answered && (
                            <span style={{ marginLeft: '12px', color: '#10b981', fontWeight: 'bold' }}>
                              [ANSWERED]
                            </span>
                          )}
                        </div>
                        {question.campaigns && (
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            Campaign: {question.campaigns.title}
                          </div>
                        )}
                        <div style={{ fontSize: '15px', color: '#1f2937' }}>
                          {question.question}
                        </div>
                      </div>
                      {!question.is_hidden && (
                        <button
                          onClick={() => handleHideQuestion(question.id, null)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          🚫 Hide
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* All Answers Section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '24px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  💡 All Answers
                </h2>
                <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  Recent answers from creators (last 50)
                </p>
              </div>

              {moderationLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Loading answers...
                </div>
              ) : allAnswers.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  No answers yet
                </div>
              ) : (
                <div style={{ padding: '24px' }}>
                  {allAnswers.map((answer) => (
                    <div 
                      key={answer.id}
                      style={{
                        backgroundColor: answer.is_hidden ? '#fee2e2' : '#f0fdf4',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '12px'
                      }}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                          By: {answer.users?.full_name || answer.users?.username || 'Creator'} • {new Date(answer.created_at).toLocaleDateString()}
                          {answer.is_hidden && (
                            <span style={{ marginLeft: '12px', color: '#dc2626', fontWeight: 'bold' }}>
                              [HIDDEN]
                            </span>
                          )}
                        </div>
                        {answer.campaign_questions && (
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontStyle: 'italic' }}>
                            Question: {answer.campaign_questions.question}
                          </div>
                        )}
                        <div style={{ fontSize: '15px', color: '#1f2937' }}>
                          {answer.answer}
                        </div>
                      </div>
                      {!answer.is_hidden && (
                        <button
                          onClick={() => handleHideAnswer(answer.id, null)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          🚫 Hide
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Release Milestone Modal */}
      {selectedCampaignForMilestone && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
              Release Milestone Funds: {selectedCampaignForMilestone.title}
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                Escrow Balance: <strong style={{ color: '#f59e0b' }}>
                  {campaignWallets[selectedCampaignForMilestone.id]?.escrow_balance_fc?.toLocaleString() || 0} FC
                </strong>
              </div>
            </div>

            {campaignMilestones.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                No milestones found for this campaign
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {campaignMilestones.map((milestone) => {
                  const voteStats = milestoneVoteStats[milestone.id];
                  const canRelease = !milestone.is_completed && voteStats?.consensus === 'approved';
                  const isRejected = voteStats?.consensus === 'rejected';
                  const isPending = voteStats?.consensus === 'pending';

                  return (
                    <div key={milestone.id} style={{
                      padding: '16px',
                      backgroundColor: milestone.is_completed ? '#f0fdf4' : '#fff',
                      border: '1px solid ' + (milestone.is_completed ? '#10b981' : '#e5e7eb'),
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '8px' }}>{milestone.title}</div>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                            {milestone.description}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                            Target Amount: <span style={{ color: '#3b82f6' }}>{milestone.target_amount?.toLocaleString() || 0} FC</span>
                          </div>

                          {/* Vote Statistics */}
                          {voteStats && voteStats.totalVotes > 0 && !milestone.is_completed && (
                            <div style={{
                              marginTop: '12px',
                              padding: '12px',
                              backgroundColor: '#f9fafb',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb'
                            }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#111827' }}>
                                📊 Investor Voting Status
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                                {voteStats.totalVotes} votes • {voteStats.totalWeight.toLocaleString()} FC total weight
                              </div>
                              <div style={{ 
                                display: 'flex', 
                                height: '8px', 
                                backgroundColor: '#e5e7eb', 
                                borderRadius: '4px',
                                overflow: 'hidden',
                                marginBottom: '8px'
                              }}>
                                <div style={{ 
                                  width: `${voteStats.approvalPercentage}%`,
                                  backgroundColor: '#10b981',
                                  transition: 'width 0.3s'
                                }}></div>
                                <div style={{ 
                                  width: `${voteStats.rejectionPercentage}%`,
                                  backgroundColor: '#ef4444',
                                  transition: 'width 0.3s'
                                }}></div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: '#10b981' }}>
                                  ✓ {voteStats.approvalPercentage}% Approve ({voteStats.approvalCount})
                                </span>
                                <span style={{ color: '#ef4444' }}>
                                  ✗ {voteStats.rejectionPercentage}% Reject ({voteStats.rejectionCount})
                                </span>
                              </div>
                              <div style={{ 
                                marginTop: '8px', 
                                padding: '6px 10px', 
                                borderRadius: '4px',
                                backgroundColor: canRelease ? '#d1fae5' : isRejected ? '#fee2e2' : '#fef3c7',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: canRelease ? '#065f46' : isRejected ? '#991b1b' : '#92400e'
                              }}>
                                {canRelease && '✓ Approved by Investors - Ready for Release'}
                                {isRejected && '✗ Rejected by Investors - Cannot Release'}
                                {isPending && '⏳ Pending Votes - Need ≥60% approval'}
                              </div>
                            </div>
                          )}

                          {milestone.is_completed && (
                            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '8px' }}>
                              ✅ Released on {new Date(milestone.completion_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {!milestone.is_completed && (
                          <button
                            onClick={() => handleReleaseMilestone(milestone.id, milestone.target_amount)}
                            disabled={releaseLoading || !canRelease}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: canRelease ? '#10b981' : '#9ca3af',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: (releaseLoading || !canRelease) ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                              marginLeft: '12px',
                              opacity: canRelease ? 1 : 0.6
                            }}
                            title={!canRelease ? 'Milestone must be approved by investors (≥60%) before release' : ''}
                          >
                            {releaseLoading ? 'Releasing...' : 'Release'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedCampaignForMilestone(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Campaign Modal */}
      {selectedCampaignForRefund && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#ef4444' }}>
              ⚠️ Refund All Investors
            </h2>
            
            <p style={{ marginBottom: '16px', color: '#374151' }}>
              You are about to refund all investors for: <strong>{selectedCampaignForRefund.title}</strong>
            </p>

            <div style={{ 
              padding: '16px', 
              backgroundColor: '#fef2f2', 
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #fecaca'
            }}>
              <div style={{ fontSize: '14px', color: '#991b1b' }}>
                <strong>Warning:</strong> This action will:
                <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                  <li>Refund all confirmed investments</li>
                  <li>Mark campaign as "failed"</li>
                  <li>Cannot be undone</li>
                </ul>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                Refund Reason (optional):
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  minHeight: '80px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setSelectedCampaignForRefund(null);
                  setRefundReason('');
                }}
                disabled={refundLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: refundLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRefundCampaign}
                disabled={refundLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: refundLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
              >
                {refundLoading ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for detailed review */}
      {selectedVerification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              Review Verification
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
                Personal Information
              </h3>
              <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                <div><strong>Legal Name:</strong> {selectedVerification.legal_name}</div>
                <div><strong>Email:</strong> {selectedVerification.legal_email}</div>
                <div><strong>Phone:</strong> {selectedVerification.phone}</div>
                {selectedVerification.business_email && (
                  <div><strong>Business Email:</strong> {selectedVerification.business_email}</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
                Address
              </h3>
              <div style={{ fontSize: '14px' }}>
                {selectedVerification.legal_address?.line1}<br/>
                {selectedVerification.legal_address?.line2 && (
                  <>{selectedVerification.legal_address.line2}<br/></>
                )}
                {selectedVerification.legal_address?.city}, {selectedVerification.legal_address?.state} {selectedVerification.legal_address?.postal_code}<br/>
                {selectedVerification.legal_address?.country}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '500' }}>
                Documents
              </h3>
              <div style={{ fontSize: '14px' }}>
                <div>ID Document: {selectedVerification.id_document_url ? 'Uploaded' : 'Not uploaded'}</div>
                <div>Selfie: {selectedVerification.selfie_image_url ? 'Uploaded' : 'Not uploaded'}</div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setSelectedVerification(null)}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={() => handleReject(selectedVerification.id, 'Verification rejected by admin')}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? 'Processing...' : 'Reject'}
              </button>
              
              <button
                onClick={() => handleApprove(selectedVerification.id)}
                disabled={actionLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;