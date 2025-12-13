import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { adminApi } from '../lib/api.js';
import { useEscrowActions } from '../hooks/useEscrowActions';
import EscrowFlow from '../components/EscrowFlow';
import TransactionHistory from '../components/TransactionHistory';

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
  const [selectedCampaignForRefund, setSelectedCampaignForRefund] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const { releaseMilestone, refundCampaignInvestors, releaseLoading, refundLoading} = useEscrowActions();
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
    }
  }, [profile]);

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
  };

  const handleReleaseMilestone = async (milestoneId, amountFc) => {
    if (!selectedCampaignForMilestone) return;
    
    try {
      await releaseMilestone({
        campaignId: selectedCampaignForMilestone.id,
        milestoneId,
        amountFc,
        notes: 'Released by admin'
      });
      
      alert('Milestone funds released successfully!');
      setSelectedCampaignForMilestone(null);
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
      // Load campaigns in pending_review
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
                {campaignMilestones.map((milestone) => (
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
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                          Target Amount: <span style={{ color: '#3b82f6' }}>{milestone.target_amount?.toLocaleString() || 0} FC</span>
                        </div>
                        {milestone.is_completed && (
                          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '8px' }}>
                            ✅ Released on {new Date(milestone.completion_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {!milestone.is_completed && (
                        <button
                          onClick={() => handleReleaseMilestone(milestone.id, milestone.target_amount)}
                          disabled={releaseLoading}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: releaseLoading ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                            marginLeft: '12px'
                          }}
                        >
                          {releaseLoading ? 'Releasing...' : 'Release'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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