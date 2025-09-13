import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import CampaignCard from '../components/CampaignCard';
import EmptyState from '../components/EmptyState';
import { campaigns } from '../mock/campaigns';
import { investments } from '../mock/investments';

const Dashboard = () => {
  const { user, logout, switchRole } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Get user's investments if they're an investor
  const userInvestments = useMemo(() => {
    if (user?.role !== 'investor') return [];
    
    return investments
      .filter(investment => investment.investorId === user.id)
      .map(investment => {
        const campaign = campaigns.find(c => c.id === investment.projectId);
        return {
          ...investment,
          campaign
        };
      })
      .filter(investment => investment.campaign); // Only include valid campaigns
  }, [user]);

  // Get user's campaigns if they're a creator
  const userCampaigns = useMemo(() => {
    if (user?.role !== 'creator') return [];
    
    return campaigns.filter(campaign => campaign.creatorId === user.id);
  }, [user]);

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

  const getTotalInvested = () => {
    return userInvestments.reduce((total, investment) => total + investment.amount, 0);
  };

  const getTotalRaised = () => {
    return userCampaigns.reduce((total, campaign) => total + campaign.raisedAmount, 0);
  };

  const handleRoleSwitch = (newRole) => {
    if (window.confirm(`Switch to ${newRole} role? This is a dev feature for testing UI.`)) {
      switchRole(newRole);
      setActiveTab('overview');
    }
  };

  const handleCreateProject = () => {
    alert('Project creation will be available in Phase 2 with database integration!');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="main">
      <div className="page-content">
        <div className="container">
          {/* Header */}
          <div className="flex items-center justify-between mb-xl">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {user.displayName}</h1>
              <p className="text-gray-600">
                Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </p>
            </div>
            <div className="flex items-center gap-sm">
              {/* Dev role switcher */}
              <div className="flex gap-xs">
                <button
                  onClick={() => handleRoleSwitch('investor')}
                  className={`btn-sm ${user.role === 'investor' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Investor
                </button>
                <button
                  onClick={() => handleRoleSwitch('creator')}
                  className={`btn-sm ${user.role === 'creator' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Creator
                </button>
              </div>
              <button onClick={logout} className="btn-secondary">
                Logout
              </button>
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
                  activeTab === user.role === 'investor' ? 'investments' : 'projects' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(user.role === 'investor' ? 'investments' : 'projects')}
              >
                {user.role === 'investor' ? 'My Investments' : 'My Projects'}
              </button>
              <button
                className={`px-md py-sm border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'profile' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('profile')}
              >
                Profile
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'overview' && (
              <div className="space-y-lg">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
                  {user.role === 'investor' ? (
                    <>
                      <div className="card text-center">
                        <div className="text-2xl font-bold text-primary mb-sm">
                          {userInvestments.length}
                        </div>
                        <div className="text-gray-600">Active Investments</div>
                      </div>
                      <div className="card text-center">
                        <div className="text-2xl font-bold text-primary mb-sm">
                          {formatCurrency(getTotalInvested())}
                        </div>
                        <div className="text-gray-600">Total Invested</div>
                      </div>
                      <div className="card text-center">
                        <div className="text-2xl font-bold text-primary mb-sm">
                          {userInvestments.filter(i => i.status === 'confirmed').length}
                        </div>
                        <div className="text-gray-600">Confirmed Investments</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="card text-center">
                        <div className="text-2xl font-bold text-primary mb-sm">
                          {userCampaigns.length}
                        </div>
                        <div className="text-gray-600">Total Projects</div>
                      </div>
                      <div className="card text-center">
                        <div className="text-2xl font-bold text-primary mb-sm">
                          {formatCurrency(getTotalRaised())}
                        </div>
                        <div className="text-gray-600">Total Raised</div>
                      </div>
                      <div className="card text-center">
                        <div className="text-2xl font-bold text-primary mb-sm">
                          {userCampaigns.filter(c => c.status === 'live').length}
                        </div>
                        <div className="text-gray-600">Live Campaigns</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="card">
                  <h3 className="card-title">Quick Actions</h3>
                  <div className="flex gap-md flex-wrap">
                    <Link to="/explore" className="btn-primary">
                      Browse Projects
                    </Link>
                    {user.role === 'creator' && (
                      <button onClick={handleCreateProject} className="btn-secondary">
                        Create New Project
                      </button>
                    )}
                    <Link to="/profile" className="btn-secondary">
                      Edit Profile
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'investments' && user.role === 'investor' && (
              <div>
                <div className="flex items-center justify-between mb-lg">
                  <h2 className="text-2xl font-bold">My Investments</h2>
                  <Link to="/explore" className="btn-primary">
                    Find New Investments
                  </Link>
                </div>

                {userInvestments.length > 0 ? (
                  <div className="space-y-md">
                    {userInvestments.map(investment => (
                      <div key={investment.id} className="card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="card-title">
                              <Link 
                                to={`/campaign/${investment.campaign.slug}`}
                                className="text-primary hover:underline"
                              >
                                {investment.campaign.title}
                              </Link>
                            </h3>
                            <div className="flex items-center gap-sm mb-sm">
                              <span className="badge badge-secondary">
                                {investment.campaign.category}
                              </span>
                              <span className={`badge status-${investment.status}`}>
                                {investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm mb-sm">
                              {investment.campaign.summary}
                            </p>
                            <div className="text-sm text-gray-500">
                              Invested on {formatDate(investment.investedAt)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {formatCurrency(investment.amount)}
                            </div>
                            <div className="text-sm text-gray-600">Your Investment</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No investments yet"
                    message="Start investing in innovative projects to see them here."
                    action={
                      <Link to="/explore" className="btn-primary">
                        Browse Projects
                      </Link>
                    }
                  />
                )}
              </div>
            )}

            {activeTab === 'projects' && user.role === 'creator' && (
              <div>
                <div className="flex items-center justify-between mb-lg">
                  <h2 className="text-2xl font-bold">My Projects</h2>
                  <button onClick={handleCreateProject} className="btn-primary">
                    Create New Project
                  </button>
                </div>

                {userCampaigns.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
                    {userCampaigns.map(campaign => (
                      <CampaignCard key={campaign.id} campaign={campaign} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No projects yet"
                    message="Create your first project to start raising funds for your innovative ideas."
                    action={
                      <button onClick={handleCreateProject} className="btn-primary">
                        Create Your First Project
                      </button>
                    }
                  />
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold mb-lg">Profile Settings</h2>
                
                <div className="card">
                  <h3 className="card-title">Account Information</h3>
                  <div className="space-y-md">
                    <div className="stat-item">
                      <span className="stat-label">Display Name:</span>
                      <span className="stat-value">{user.displayName}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Email:</span>
                      <span className="stat-value">{user.email}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Role:</span>
                      <span className="stat-value">
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Member Since:</span>
                      <span className="stat-value">
                        {formatDate(user.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card mt-lg bg-warning text-white">
                  <h3 className="card-title">Phase 1 Notice</h3>
                  <p className="text-sm">
                    Profile editing functionality will be available in Phase 2 when the database 
                    integration is complete. Currently, this is a frontend-only demo with mock data.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;