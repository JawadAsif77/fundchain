import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import CampaignCard from '../components/CampaignCard';
import EmptyState from '../components/EmptyState';
import { campaignApi, investmentApi } from '../lib/api.js';

const Dashboard = () => {
  const {
    user,
    profile,
    roleStatus,
    isFullyOnboarded,
    loading: authLoading,
    sessionVersion
  } = useAuth();

  const [projects, setProjects] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const debug = process.env.NODE_ENV === 'development';

  // Campaign submitted banner via navigation state
  useEffect(() => {
    if (location.state?.campaignSubmitted) {
      setShowApprovalBanner(true);
      // Clear state so it doesn't persist on refresh
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const role = roleStatus?.role || 'investor';
  const isCreator = role === 'creator';
  const isInvestor = role === 'investor';
  const kycStatus = roleStatus?.kycStatus;
  const isVerified =
    roleStatus?.isKYCVerified || profile?.is_verified === 'yes' || false;
  const showKYCPendingBanner =
    isCreator && !isVerified && kycStatus === 'pending';

  // Redirect guard: admin to /admin, unassigned creator/admin roles to /profile,
  // unverified creators to /kyc (but investors always allowed).
  useEffect(() => {
    if (authLoading) return;
    if (!user || !roleStatus) return;

    // Admin => admin panel
    if (profile?.role === 'admin') {
      if (debug) console.log('[Dashboard] Admin detected, redirecting to /admin');
      navigate('/admin', { replace: true });
      return;
    }

    // If no explicit role but inferred investor, allow
    if (!roleStatus.hasRole && role !== 'investor') {
      if (debug)
        console.log(
          '[Dashboard] No explicit creator/admin role, redirecting to /profile'
        );
      navigate('/profile', { replace: true });
      return;
    }

    // Creators: if not verified at all, send to KYC once
    if (role === 'creator') {
      const userVerificationStatus = profile?.is_verified || 'no';

      if (debug) {
        console.log(
          '[Dashboard] Creator verification status:',
          userVerificationStatus
        );
      }

      if (userVerificationStatus === 'no') {
        if (debug)
          console.log('[Dashboard] Creator not verified, redirecting to /kyc');
        navigate('/kyc', { replace: true });
        return;
      }
      // If verification is pending, they can still access dashboard
    }
  }, [authLoading, user, profile, roleStatus, role, navigate, debug]);

  // Data loader for projects / investments
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!mounted) return;

      try {
        if (debug) {
          console.log('[Dashboard] loadData start', {
            role,
            isFullyOnboarded,
            userId: user?.id
          });
        }

        if (!user?.id || authLoading) {
          setDataLoading(false);
          return;
        }

        if (role === 'creator') {
          const result = await campaignApi.getUserCampaigns(user.id);
          if (result?.success && mounted) {
            setProjects(result.data || []);
          }
        } else if (role === 'investor') {
          const result = await investmentApi.getUserInvestments(user.id);
          if (result && mounted) {
            setInvestments(result.data || []);
          }
        }
      } catch (error) {
        console.error('[Dashboard] Error loading data:', error);
      } finally {
        if (mounted) setDataLoading(false);
      }
    };

    // Failsafe timeout
    const timeout = setTimeout(() => {
      if (mounted) {
        if (debug)
          console.log(
            '[Dashboard] loadData timeout reached, forcing dataLoading=false'
          );
        setDataLoading(false);
      }
    }, 3000);

    loadData();

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [authLoading, user?.id, role, sessionVersion, refreshKey]); // Removed isFullyOnboarded and debug to prevent loops

  // Refresh data after tab was hidden for a while
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        setRefreshKey((k) => k + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const userInvestments = useMemo(() => {
    if (!isInvestor) return [];
    return investments || [];
  }, [investments, isInvestor]);

  const userProjects = useMemo(() => {
    if (!isCreator) return [];
    return projects || [];
  }, [projects, isCreator]);

  const totalRaised = useMemo(() => {
    return userProjects.reduce(
      (sum, project) => sum + (project.current_funding || 0),
      0
    );
  }, [userProjects]);

  const adaptProjectForCard = (c) => {
    const goalAmount =
      c.goal_amount != null ? Number(c.goal_amount) : Number(c.funding_goal || 0);
    const raisedAmount =
      c.total_raised != null
        ? Number(c.total_raised)
        : Number(c.current_funding || 0);

    return {
      id: c.id,
      slug: c.slug || `campaign-${c.id}`,
      title: c.title || 'Untitled Campaign',
      summary:
        c.summary ||
        c.short_description ||
        (c.description ? c.description.slice(0, 100) : 'No description available'),
      category: c.category || c.categories?.name || 'General',
      goalAmount,
      raisedAmount,
      status: c.status || 'draft',
      deadlineISO:
        c.deadline ||
        c.end_date ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      imageUrl: c.image_url || null,
      creatorId: c.creator_id,
      fundingProgress: c.funding_progress || 0,
      riskScore: c.risk_level
        ? Math.min(100, Math.max(0, Number(c.risk_level) * 20))
        : 50,
      region: c.location || 'Not specified'
    };
  };

  const adaptInvestmentForCard = (investment) => {
    const campaign = investment.campaigns;
    if (!campaign) return null;

    const base = adaptProjectForCard(campaign);

    return {
      ...base,
      investmentAmount: Number(investment.amount || 0),
      investmentStatus: investment.status,
      investmentDate: investment.created_at
    };
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);

  const formatDate = (dateISO) =>
    new Date(dateISO).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

  // Loading states
  if (authLoading || dataLoading) {
    return (
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--color-bg-elev)',
              borderTop: '4px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}
          />
          <p>Loading your dashboard...</p>
        </div>

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
  }

  // If completely unauthenticated, show basic loading/guard
  if (!user) {
    return (
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p>You must be logged in to view your dashboard.</p>
          <Link
            to="/login"
            style={{
              marginTop: '12px',
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-ink)',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const renderInvestorDashboard = () => (
    <div>
      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-white)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-muted)',
              marginBottom: '8px'
            }}
          >
            Total Invested
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--color-text)'
            }}
          >
            {formatCurrency(
              userInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0)
            )}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-white)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-muted)',
              marginBottom: '8px'
            }}
          >
            Active Investments
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--color-text)'
            }}
          >
            {
              userInvestments.filter(
                (inv) => inv.campaigns?.status === 'active'
              ).length
            }
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-white)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-muted)',
              marginBottom: '8px'
            }}
          >
            Portfolio Projects
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--color-text)'
            }}
          >
            {userInvestments.length}
          </p>
        </div>
      </div>

      {/* Investments list */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Your Investments</h2>
          <Link
            to="/explore"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-ink)',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Discover Projects
          </Link>
        </div>

        {userInvestments.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}
          >
            {userInvestments
              .slice(0, 6)
              .map((investment) => {
                const adapted = adaptInvestmentForCard(investment);
                if (!adapted) return null;

                return (
                  <div
                    key={investment.id}
                    style={{
                      backgroundColor: 'var(--color-white)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <CampaignCard campaign={adapted} />
                    <div
                      style={{
                        padding: '16px',
                        borderTop: '1px solid var(--color-border)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '14px'
                        }}
                      >
                        <span style={{ color: 'var(--color-muted)' }}>
                          Your Investment:
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {formatCurrency(adapted.investmentAmount)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '14px',
                          marginTop: '4px'
                        }}
                      >
                        <span style={{ color: 'var(--color-muted)' }}>Date:</span>
                        <span>{formatDate(adapted.investmentDate)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
              .filter(Boolean)}
          </div>
        ) : (
          <EmptyState
            title="No investments yet"
            description="Start investing in innovative projects to build your portfolio"
            action={{
              label: 'Explore Projects',
              href: '/explore'
            }}
          />
        )}
      </div>
    </div>
  );

  const renderCreatorDashboard = () => (
    <div>
      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-white)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-muted)',
              marginBottom: '8px'
            }}
          >
            Total Raised
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--color-text)'
            }}
          >
            {formatCurrency(totalRaised)}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-white)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-muted)',
              marginBottom: '8px'
            }}
          >
            Active Projects
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--color-text)'
            }}
          >
            {userProjects.filter((p) => p.status === 'active').length}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-white)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-muted)',
              marginBottom: '8px'
            }}
          >
            Total Projects
          </h3>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--color-text)'
            }}
          >
            {userProjects.length}
          </p>
        </div>
      </div>

      {/* KYC banner */}
      {!isVerified && (
        <div
          style={{
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-warning)'
                }}
              >
                Tell us about your business
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-warning)',
                  margin: '4px 0'
                }}
              >
                Complete your verification to unlock project creation and
                fundraising tools.
              </p>
              <Link
                to="/kyc"
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-warning)',
                  color: 'var(--color-white)',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                Complete KYC
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Projects list */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Your Projects</h2>
          {isVerified ? (
            <button
              onClick={() => navigate('/create-project')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--color-success)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Start Your Campaign
            </button>
          ) : (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--color-muted)',
                fontStyle: 'italic'
              }}
            >
              Complete verification to create projects
            </span>
          )}
        </div>

        {userProjects.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}
          >
            {userProjects.map((project) => (
              <CampaignCard
                key={project.id}
                campaign={adaptProjectForCard(project)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description={
              isVerified
                ? 'Create your first project to start raising funds'
                : 'Complete your verification to start creating projects'
            }
            action={
              isVerified
                ? {
                    label: 'Start Your Campaign',
                    onClick: () => navigate('/create-project')
                  }
                : {
                    label: 'Complete KYC',
                    href: '/kyc'
                  }
            }
          />
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px'
      }}
    >
      {/* Campaign submitted banner */}
      {showApprovalBanner && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--color-info-bg)',
            border: '1px solid rgba(59,130,246,0.12)',
            color: 'var(--color-info)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div>
            <strong>Submission received.</strong>{' '}
            Your campaign is pending admin review. You’ll see it under “Your
            Projects” as “pending_review” until approved.
          </div>
          <button
            onClick={() => setShowApprovalBanner(false)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-info)',
              borderRadius: '6px',
              color: 'var(--color-info)',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Banner if any campaign is pending review */}
      {isCreator &&
        userProjects.some((p) => p.status === 'pending_review') && (
          <div
            style={{
              marginBottom: '24px',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-warning-bg)',
              border: '1px solid rgba(245,158,11,0.12)',
              color: 'var(--color-warning)'
            }}
          >
            You have campaigns awaiting admin approval. They’ll appear publicly
            once approved.
          </div>
        )}

      {/* KYC pending banner for creators */}
      {showKYCPendingBanner && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid rgba(250, 204, 21, 0.12)',
            color: 'var(--color-warning)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div>
            <strong>Identity verification is pending.</strong>{' '}
            Your verification is under review. You can start preparing campaigns
            while our team finishes the checks.
          </div>
          <Link
            to="/kyc"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-warning)',
              color: 'var(--color-white)',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Update details
          </Link>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: 'var(--color-text)',
              marginBottom: '8px'
            }}
          >
            {isInvestor ? 'Investor Dashboard' : 'Creator Dashboard'}
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--color-muted)',
              marginBottom: '8px'
            }}
          >
            Welcome back,{' '}
            {user?.displayName || user?.full_name || user?.email || 'Investor'}
          </p>

          {isCreator && (
            <span
              style={{
                padding: '4px 12px',
                backgroundColor: roleStatus?.isKYCVerified
                  ? 'var(--color-success-bg)'
                  : 'var(--color-danger-bg)',
                color: roleStatus?.isKYCVerified
                  ? 'var(--color-success)'
                  : 'var(--color-danger)',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              {roleStatus?.isKYCVerified
                ? '✅ Verified'
                : '⏳ Identity Verification Pending'}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {isInvestor ? renderInvestorDashboard() : renderCreatorDashboard()}
    </div>
  );
};

export default Dashboard;
