import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import CampaignCard from '../components/CampaignCard';
import EmptyState from '../components/EmptyState';
import { campaigns } from '../mock/campaigns';
import { investments } from '../mock/investments';
import { getPublicProjects, getUserProjects, getUserInvestments, getUserCampaigns } from '../lib/api.js';

const Dashboard = () => {
  // ALL HOOKS MUST BE DECLARED FIRST - BEFORE ANY RETURNS OR CONDITIONS
  const { user, profile, roleStatus, isFullyOnboarded, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [showApprovalBanner, setShowApprovalBanner] = useState(Boolean(location.state?.campaignSubmitted));

  // Reduced debug logging for better performance
  const debugLog = process.env.NODE_ENV === 'development';
  
  if (debugLog) {
    console.log('Dashboard - Auth State:', {
      user: user ? { id: user.id, email: user.email } : null,
      profile: profile ? { id: profile.id, role: profile.role, is_verified: profile.is_verified } : null,
      roleStatus,
      isFullyOnboarded,
      authLoading
    });
  }

  const role = roleStatus?.role || 'investor';
  const isCreator = role === 'creator';
  const isInvestor = role === 'investor';
  const kycStatus = roleStatus?.kycStatus;
  const isVerified = roleStatus?.isKYCVerified || profile?.is_verified === 'yes';
  const showKYCPendingBanner = isCreator && !isVerified && (kycStatus === 'pending');

  // Handle redirects with useEffect to avoid state updates during render
  useEffect(() => {
    console.log('Dashboard useEffect - loading:', loading, 'authLoading:', authLoading, 'user:', !!user);
    if (!loading && !authLoading && user && roleStatus) {
      // If user is admin, redirect to admin panel
      if (profile?.role === 'admin') {
        if (debugLog) console.log('Admin user detected, redirecting to admin panel...');
        navigate('/admin', { replace: true });
        return;
      }

      if (!roleStatus?.hasRole) {
        if (debugLog) console.log('User has no role, redirecting to profile for role selection...');
        navigate('/profile', { replace: true });
        return;
      }

  // For creators: always check verification status
  if (role === 'creator') {
        // Check user's verification status from the profile object
    const userVerificationStatus = (profile?.is_verified || 'no');
        
        if (debugLog) console.log('Creator verification status:', userVerificationStatus);
        
        // If verification status is 'no', redirect to KYC
        if (userVerificationStatus === 'no') {
          if (debugLog) console.log('Creator has no verification, redirecting to KYC...');
          navigate('/kyc', { replace: true });
          return;
        }
        
        // If KYC submission pending or missing, we keep the banner but do not block dashboard
      }

    // Both investors and creators can access dashboard (creators may see KYC prompts)
    }
  }, [user, profile, roleStatus, loading, authLoading, navigate, debugLog]);

  // Load projects/campaigns based on user role
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (!mounted) return;
      
      try {
        if (debugLog) {
          console.log('Dashboard loadData started');
          console.log('roleStatus:', roleStatus);
          console.log('isFullyOnboarded:', isFullyOnboarded);
        }
        
        const fullyOnboarded = isFullyOnboarded;
        if (role === 'creator' && user?.id) {
          console.log('🔍 Dashboard: Loading creator projects for user:', user?.id);
          // Load creator's campaigns from database
          const result = await getUserCampaigns(user?.id);
          console.log('✅ Dashboard: getUserCampaigns result:', result);
          console.log('📊 Dashboard: Campaigns data:', result?.data);
          if (result.success && mounted) {
            console.log('✅ Dashboard: Setting projects state with', result.data?.length || 0, 'campaigns');
            setProjects(result.data || []);
          } else {
            console.error('❌ Dashboard: Failed to load campaigns or not mounted');
          }
        } else if (role === 'investor' && user?.id) {
          if (debugLog) console.log('Loading investor investments...');
          // Load investor's investments from database
          const result = await getUserInvestments(user?.id);
          if (debugLog) console.log('getUserInvestments result:', result);
          if (result.success && mounted) {
            setInvestments(result.data || []);
          }
        } else {
          console.log('❌ Dashboard: Cannot load data - role:', role, 'user.id:', user?.id);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        if (mounted) {
          if (debugLog) console.log('Dashboard loadData finished, setting loading to false');
          setLoading(false);
        }
      }
    };

    // Shorter timeout for better UX
    const timeout = setTimeout(() => {
      if (mounted) {
        if (debugLog) console.log('Dashboard loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 3000); // Reduced to 3 second timeout

    // Load data immediately if we have user and role
    if (user?.id && role && !authLoading) {
      if (debugLog) console.log('Dashboard: Have user and role, calling loadData immediately');
      loadData();
    } else if (!authLoading) {
      if (debugLog) console.log('Dashboard: Missing user/role or auth still loading, setting loading to false');
      setLoading(false);
    } else {
      if (debugLog) console.log('Auth still loading, waiting...');
    }

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [roleStatus, authLoading, isFullyOnboarded, role, user?.id]);

  // Clear navigation state after first render to prevent banner reappearing on refresh
  useEffect(() => {
    if (showApprovalBanner) {
      // Remove state from history
      navigate('.', { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get user's investments (use state from database)
  const userInvestments = useMemo(() => {
    if (roleStatus?.role !== 'investor') return [];
    return investments || [];
  }, [investments, roleStatus]);

  // Get user's projects/campaigns (use state from database)
  const userProjects = useMemo(() => {
    if (roleStatus?.role !== 'creator') return [];
    console.log('📦 Dashboard: userProjects memo updating. projects:', projects);
    return projects || [];
  }, [projects, roleStatus]);

  // Adapter function to convert database campaign to CampaignCard format
  const adaptProjectForCard = (c) => ({
    id: c.id,
    slug: c.slug || `campaign-${c.id}`,
    title: c.title || 'Untitled Campaign',
    summary: c.summary || c.short_description || c.description?.substring(0, 100) || 'No description available',
    category: c.category || c.categories?.name || 'General',
    goalAmount: c.goal_amount ?? Number(c.funding_goal || 0),
    raisedAmount: c.total_raised ?? Number(c.current_funding || 0),
    status: c.status || 'draft',
    deadlineISO: c.deadline || c.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now as fallback
    imageUrl: c.image_url || null,
    creatorId: c.creator_id,
    fundingProgress: c.funding_progress || 0,
    riskScore: c.risk_level ? Math.min(100, Math.max(0, Number(c.risk_level) * 20)) : 50,
    region: c.location || 'Not specified'
  });

  // Adapter function to convert database investment to display format
  const adaptInvestmentForCard = (investment) => ({
    id: investment.id,
    amount: investment.amount,
    status: investment.status,
    created_at: investment.created_at,
    projects: investment.projects ? {
      id: investment.projects.id,
      slug: investment.projects.slug,
      title: investment.projects.title,
      summary: investment.projects.summary,
      category: investment.projects.category,
      goalAmount: investment.projects.goal_amount,
      status: investment.projects.status,
      deadlineISO: investment.projects.deadline,
      imageUrl: investment.projects.image_url
    } : null
  });

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
      month: 'short',
      day: 'numeric'
    });
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        minHeight: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Loading your dashboard...</p>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Debug: user={user?.id ? 'exists' : 'null'}, roleStatus={roleStatus ? 'exists' : 'null'}
          </div>
        </div>
      </div>
    );
  }

  // Debug logging (only in development)
  if (debugLog) {
    console.log('Dashboard render - loading:', loading);
    console.log('Dashboard render - user:', user);
    console.log('Dashboard render - roleStatus:', roleStatus);
  }

  // Safety check - show loading if no user
  if (!user) {
    if (debugLog) console.log('Dashboard - No user found, showing loading state');
    return (
      <div style={{ 
        minHeight: '80vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Role-based dashboard rendering
  const renderInvestorDashboard = () => (
    <div>
      {/* Investor Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
            Total Invested
          </h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
            {formatCurrency(userInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0))}
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
            Active Investments
          </h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
            {userInvestments.filter(inv => inv.projects?.status === 'active').length}
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
            Portfolio Projects
          </h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
            {userInvestments.length}
          </p>
        </div>
      </div>

      {/* Recent Investments */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Your Investments</h2>
          <Link 
            to="/explore" 
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Discover Projects
          </Link>
        </div>

        {userInvestments.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {userInvestments.slice(0, 6).map(investment => {
              const adaptedInvestment = adaptInvestmentForCard(investment);
              return (
                <div key={investment.id} style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  {adaptedInvestment.projects && (
                    <CampaignCard campaign={adaptedInvestment.projects} />
                  )}
                  <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: '#6b7280' }}>Your Investment:</span>
                      <span style={{ fontWeight: '600' }}>{formatCurrency(adaptedInvestment.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                      <span style={{ color: '#6b7280' }}>Date:</span>
                      <span>{formatDate(adaptedInvestment.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState 
            title="No investments yet"
            description="Start investing in innovative projects to build your portfolio"
            action={{
              label: "Explore Projects",
              href: "/explore"
            }}
          />
        )}
      </div>
    </div>
  );

  const renderCreatorDashboard = () => (
    <div>
      {/* Creator Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
            Total Raised
          </h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
            {formatCurrency(userProjects.reduce((sum, project) => sum + (project.total_raised || 0), 0))}
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
            Active Projects
          </h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
            {userProjects.filter(p => p.status === 'active').length}
          </p>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
            Total Projects
          </h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
            {userProjects.length}
          </p>
        </div>
      </div>

      {/* KYC Status */}
      {!isVerified && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
                Tell us about your business
              </h3>
              <p style={{ fontSize: '13px', color: '#92400e', margin: '4px 0' }}>
                Complete your verification to unlock project creation and fundraising tools.
              </p>
              <Link
                to="/kyc"
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  padding: '6px 12px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                Complete KYC
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Your Projects */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Your Projects</h2>
          {isVerified ? (
            <button
              onClick={() => {
                navigate('/create-project');
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Start Your Campaign
            </button>
          ) : (
            <span style={{
              fontSize: '12px',
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              Complete verification to create projects
            </span>
          )}
        </div>

        {userProjects.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {userProjects.map(project => {
              console.log('🎨 Dashboard: Rendering project card for:', project.title, 'status:', project.status);
              return <CampaignCard key={project.id} campaign={adaptProjectForCard(project)} />;
            })}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description={
              isVerified
                ? "Create your first project to start raising funds"
                : "Complete your verification to start creating projects"
            }
            action={
              isVerified
                ? {
                    label: "Start Your Campaign",
                    onClick: () => navigate('/create-project')
                  }
                : {
                    label: "Complete KYC",
                    href: "/kyc"
                  }
            }
          />
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 20px'
    }}>
      {showApprovalBanner && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: '#ecfeff',
          border: '1px solid #67e8f9',
          color: '#0e7490',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div>
            <strong>Submission received.</strong>{' '}
            Your campaign is pending admin review. You’ll see it under “Your Projects” as “pending_review” until approved.
          </div>
          <button
            onClick={() => setShowApprovalBanner(false)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid #67e8f9',
              borderRadius: '6px',
              color: '#0e7490',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Show banner if user has any campaigns pending review */}
      {role === 'creator' && userProjects.some(p => p.status === 'pending_review') && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e'
        }}>
          You have campaigns awaiting admin approval. They’ll appear publicly once approved.
        </div>
      )}
      {showKYCPendingBanner && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: '#fff7ed',
          border: '1px solid #fdba74',
          color: '#9a3412',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div>
            <strong>Identity verification is pending.</strong>{' '}
            Your verification is under review. You can start preparing campaigns while our team finishes the checks.
          </div>
          <Link
            to="/kyc"
            style={{
              padding: '8px 16px',
              backgroundColor: '#f97316',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Update details
          </Link>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#1f2937',
            marginBottom: '8px'
          }}>
        {role === 'investor' ? 'Investor Dashboard' : 'Creator Dashboard'}
          </h1>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280' 
          }}>
            Welcome back, {user?.displayName || user?.full_name || user?.email}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{
            padding: '4px 12px',
            backgroundColor: isInvestor ? '#dbeafe' : '#dcfce7',
            color: isInvestor ? '#1e40af' : '#166534',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {isInvestor ? '💰 Investor' : '🚀 Creator'}
          </span>

          {isCreator && (
            <span style={{
              padding: '4px 12px',
              backgroundColor: roleStatus?.isKYCVerified ? '#dcfce7' : '#fee2e2',
              color: roleStatus?.isKYCVerified ? '#166534' : '#991b1b',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {roleStatus?.isKYCVerified ? '✅ Verified' : '⏳ Identity Verification Pending'}
            </span>
          )}
        </div>
      </div>

      {/* Role-based Dashboard Content */}
      {roleStatus?.role === 'investor' ? renderInvestorDashboard() : renderCreatorDashboard()}

      {/* Add CSS for spinner animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;