import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import CampaignCard from '../components/CampaignCard';
import EmptyState from '../components/EmptyState';
import { campaigns } from '../mock/campaigns';
import { investments } from '../mock/investments';
import { getPublicProjects, getUserProjects, getUserInvestments } from '../lib/api.js';

const Dashboard = () => {
  console.log('Dashboard component rendering...');
  
  // ALL HOOKS MUST BE DECLARED FIRST - BEFORE ANY RETURNS OR CONDITIONS
  const { user, profile, roleStatus, isFullyOnboarded, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Debug logging
  console.log('Dashboard - Auth State:', {
    user: user ? { id: user.id, email: user.email } : null,
    profile: profile ? { id: profile.id, role: profile.role, is_verified: profile.is_verified } : null,
    roleStatus,
    isFullyOnboarded,
    authLoading
  });

  console.log('Dashboard - user:', user);
  console.log('Dashboard - roleStatus:', roleStatus);

  const isCreator = roleStatus?.role === 'creator';
  const isInvestor = roleStatus?.role === 'investor';
  const kycStatus = roleStatus?.kycStatus;
  const showKYCPendingBanner = isCreator && (kycStatus === 'pending' || (roleStatus?.companyData && !roleStatus?.isKYCVerified));

  // Handle redirects with useEffect to avoid state updates during render
  useEffect(() => {
    console.log('Dashboard useEffect - loading:', loading, 'authLoading:', authLoading, 'user:', !!user);
    if (!loading && !authLoading && user && roleStatus) {
      // If user is admin, redirect to admin panel
      if (profile?.role === 'admin') {
        console.log('Admin user detected, redirecting to admin panel...');
        navigate('/admin', { replace: true });
        return;
      }

      if (!roleStatus?.hasRole) {
        console.log('User has no role, redirecting to profile for role selection...');
        navigate('/profile', { replace: true });
        return;
      }

      // For creators: always check verification status
      if (roleStatus?.role === 'creator') {
        // Check user's verification status from the profile object
        const userVerificationStatus = profile?.is_verified || 'no';
        
        console.log('Creator verification status:', userVerificationStatus);
        
        // If verification status is 'no', redirect to KYC
        if (userVerificationStatus === 'no') {
          console.log('Creator has no verification, redirecting to KYC...');
          navigate('/kyc', { replace: true });
          return;
        }
        
        // If no KYC submission exists yet (backward compatibility)
        if (!roleStatus?.companyData && userVerificationStatus !== 'pending' && userVerificationStatus !== 'yes') {
          console.log('Creator needs to complete verification, redirecting to KYC...');
          navigate('/kyc', { replace: true });
          return;
        }
      }

      // Both investors and creators can access dashboard (if creators have submitted KYC)
      // This is now the universal dashboard with role-specific content
    }
  }, [user, profile, roleStatus, loading, authLoading, navigate]);

  // Load projects/campaigns based on user role
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Dashboard loadData started');
        console.log('roleStatus:', roleStatus);
        console.log('isFullyOnboarded():', isFullyOnboarded());
        
        const fullyOnboarded = isFullyOnboarded();
        if (roleStatus?.role === 'creator' && fullyOnboarded) {
          console.log('Loading creator projects...');
          // Load creator's projects from database
          const result = await getUserProjects();
          console.log('getUserProjects result:', result);
          if (result.success) {
            setProjects(result.data || []);
          }
        } else if (roleStatus?.role === 'investor' && fullyOnboarded) {
          console.log('Loading investor investments...');
          // Load investor's investments from database
          const result = await getUserInvestments();
          console.log('getUserInvestments result:', result);
          if (result.success) {
            setInvestments(result.data || []);
          }
        } else {
          console.log('User not fully onboarded or no role, skipping data loading');
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        console.log('Dashboard loadData finished, setting loading to false');
        setLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('Dashboard loading timeout reached, forcing loading to false');
      setLoading(false);
    }, 5000); // 5 second timeout

    if (roleStatus) {
      console.log('roleStatus exists, calling loadData');
      loadData();
    } else if (!authLoading) {
      console.log('No roleStatus and auth not loading, setting loading to false');
      setLoading(false);
    } else {
      console.log('No roleStatus but auth still loading, waiting...');
    }

    return () => clearTimeout(timeout);
  }, [roleStatus, authLoading]); // Include authLoading in dependencies

  // Get user's investments (use state from database)
  const userInvestments = useMemo(() => {
    if (roleStatus?.role !== 'investor') return [];
    return investments || [];
  }, [investments, roleStatus]);

  // Get user's projects (use state from database)
  const userProjects = useMemo(() => {
    if (roleStatus?.role !== 'creator') return [];
    return projects || [];
  }, [projects, roleStatus]);

  // Adapter function to convert database project to CampaignCard format
  const adaptProjectForCard = (project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    category: project.category,
    goalAmount: project.goal_amount,
    raisedAmount: project.total_raised || 0,
    status: project.status,
    deadlineISO: project.deadline,
    imageUrl: project.image_url,
    creatorId: project.creator_id,
    fundingProgress: project.funding_progress || 0
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

  // Debug logging
  console.log('Dashboard render - loading:', loading);
  console.log('Dashboard render - user:', user);
  console.log('Dashboard render - roleStatus:', roleStatus);

  // Safety check - show loading if no user
  if (!user) {
    console.log('Dashboard - No user found, showing loading state');
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
      {!roleStatus?.companyData && (
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
          {roleStatus?.companyData ? (
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
              Create Project
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
            {userProjects.map(project => (
              <CampaignCard key={project.id} campaign={adaptProjectForCard(project)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description={
              roleStatus?.companyData
                ? "Create your first project to start raising funds"
                : "Complete your verification to start creating projects"
            }
            action={
              roleStatus?.companyData
                ? {
                    label: "Create Project",
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
            {roleStatus?.role === 'investor' ? 'Investor Dashboard' : 'Creator Dashboard'}
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