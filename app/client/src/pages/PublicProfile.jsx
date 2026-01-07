import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { profileStatsApi } from '../lib/api';
import Loader from '../components/Loader';
import '../styles/public-profile.css';

const PublicProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campaigns');

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const userData = await profileStatsApi.getUserProfile(username);
      
      if (!userData) {
        setLoading(false);
        return;
      }
      
      setProfile(userData);

      // Load campaigns or investments based on role
      if (userData.role === 'creator') {
        const userCampaigns = await profileStatsApi.getCreatorCampaigns(userData.id);
        console.log('📊 Creator campaigns loaded:', userCampaigns);
        console.log('📊 Campaign count:', userCampaigns.length);
        setCampaigns(userCampaigns);
        
        const userInvestors = await profileStatsApi.getCreatorInvestors(userData.id);
        console.log('👥 Investors loaded:', userInvestors);
        setInvestors(userInvestors);
      } else {
        const backedCampaigns = await profileStatsApi.getInvestorCampaigns(userData.id);
        console.log('💰 Backed campaigns loaded:', backedCampaigns);
        setCampaigns(backedCampaigns);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  if (!profile) {
    return (
      <div className="public-profile-container">
        <div className="public-profile-not-found">
          <h2>User Not Found</h2>
          <p>The user @{username} doesn't exist or has been removed.</p>
          <button onClick={() => navigate('/explore')} className="btn-primary">
            Browse Campaigns
          </button>
        </div>
      </div>
    );
  }

  const isCreator = profile.role === 'creator';
  const stats = profile.stats || {};

  return (
    <div className="public-profile-container">
      {/* Header */}
      <div className="public-profile-header">
        <div className="public-profile-cover"></div>
        <div className="public-profile-info">
          <div className="public-profile-avatar">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} />
            ) : (
              <div className="avatar-placeholder">
                {profile.full_name?.[0] || profile.username?.[0] || 'U'}
              </div>
            )}
          </div>
          <div className="public-profile-details">
            <h1>{profile.full_name || profile.username}</h1>
            <p className="public-profile-username">@{profile.username}</p>
            <div className="public-profile-badges">
              <span className={`role-badge ${profile.role}`}>
                {isCreator ? '🚀 Creator' : '💰 Investor'}
              </span>
              {profile.is_verified === 'verified' && (
                <span className="verified-badge">✓ Verified</span>
              )}
              {profile.location && (
                <span className="location-badge">📍 {profile.location}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="public-profile-section">
          <p className="public-profile-bio">{profile.bio}</p>
        </div>
      )}

      {/* Stats */}
      <div className="public-profile-stats">
        {isCreator ? (
          <>
            <div className="stat-card clickable" onClick={() => setActiveTab('campaigns')}>
              <div className="stat-icon creator">🎯</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalCampaigns || 0}</div>
                <div className="stat-label">Total Campaigns</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon success">💰</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalRaised?.toFixed(0) || 0} FC</div>
                <div className="stat-label">Total Raised</div>
              </div>
            </div>
            <div className="stat-card clickable" onClick={() => setActiveTab('investors')}>
              <div className="stat-icon primary">👥</div>
              <div className="stat-content">
                <div className="stat-value">{stats.uniqueInvestors || 0}</div>
                <div className="stat-label">Backers</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon warning">🎚️</div>
              <div className="stat-content">
                <div className="stat-value">{stats.avgFundingRate || 0}%</div>
                <div className="stat-label">Avg Funded</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-icon primary">💵</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalInvested?.toFixed(0) || 0} FC</div>
                <div className="stat-label">Total Invested</div>
              </div>
            </div>
            <div className="stat-card clickable" onClick={() => setActiveTab('campaigns')}>
              <div className="stat-icon creator">📊</div>
              <div className="stat-content">
                <div className="stat-value">{stats.campaignsBacked || 0}</div>
                <div className="stat-label">Campaigns Backed</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon success">🤝</div>
              <div className="stat-content">
                <div className="stat-value">{stats.creatorsSupported || 0}</div>
                <div className="stat-label">Creators Supported</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon warning">⚖️</div>
              <div className="stat-content">
                <div className="stat-value">{stats.avgRisk || 0}</div>
                <div className="stat-label">Avg Risk</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="public-profile-tabs">
        <button
          className={`tab-button ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          {isCreator ? 'Campaigns' : 'Backed Campaigns'} ({campaigns.length})
        </button>
        {isCreator && (
          <button
            className={`tab-button ${activeTab === 'investors' ? 'active' : ''}`}
            onClick={() => setActiveTab('investors')}
          >
            Backers ({investors.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="public-profile-content">
        {activeTab === 'campaigns' && (
          <div className="campaigns-grid">
            {campaigns.length === 0 ? (
              <div className="empty-state">
                <p>{isCreator ? 'No campaigns yet' : 'No backed campaigns yet'}</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  to={`/campaign/${campaign.slug || campaign.id}`}
                  className="campaign-card-public"
                >
                  {campaign.image_url && (
                    <div className="campaign-image">
                      <img src={campaign.image_url} alt={campaign.title} />
                    </div>
                  )}
                  <div className="campaign-info">
                    <h3>{campaign.title}</h3>
                    <p className="campaign-description">{campaign.description?.substring(0, 100)}...</p>
                    <div className="campaign-stats-mini">
                      <div className="stat-mini">
                        <span className="label">Goal:</span>
                        <span className="value">{campaign.funding_goal} FC</span>
                      </div>
                      <div className="stat-mini">
                        <span className="label">Raised:</span>
                        <span className="value">{campaign.current_funding || 0} FC</span>
                      </div>
                      <div className="stat-mini">
                        <span className="label">Status:</span>
                        <span className={`status-badge ${campaign.status}`}>{campaign.status}</span>
                      </div>
                    </div>
                    <div className="campaign-progress-bar">
                      <div
                        className="campaign-progress-fill"
                        style={{
                          width: `${Math.min(
                            ((campaign.current_funding || 0) / campaign.funding_goal) * 100,
                            100
                          )}%`
                        }}
                      ></div>
                    </div>
                    {!isCreator && campaign.invested_amount && (
                      <div className="invested-badge">
                        You invested: {campaign.invested_amount} FC
                      </div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'investors' && isCreator && (
          <div className="investors-list">
            {investors.length === 0 ? (
              <div className="empty-state">
                <p>No backers yet</p>
              </div>
            ) : (
              investors.map((investor) => (
                <Link
                  key={investor.id}
                  to={`/profile/${investor.username}`}
                  className="investor-card"
                >
                  <div className="investor-avatar">
                    {investor.avatar_url ? (
                      <img src={investor.avatar_url} alt={investor.full_name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {investor.full_name?.[0] || investor.username?.[0] || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="investor-info">
                    <h4>{investor.full_name || investor.username}</h4>
                    <p>@{investor.username}</p>
                    <div className="investor-stats-mini">
                      <span>💰 {investor.totalInvested.toFixed(0)} FC invested</span>
                      <span>📊 {investor.campaignCount} campaigns</span>
                      {investor.trust_score && (
                        <span>⭐ {investor.trust_score}/100 trust</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Social Links */}
      {(profile.linkedin_url || profile.twitter_url || profile.instagram_url) && (
        <div className="public-profile-section">
          <h3>Connect</h3>
          <div className="social-links-public">
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="social-link">
                💼 LinkedIn
              </a>
            )}
            {profile.twitter_url && (
              <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="social-link">
                🐦 Twitter
              </a>
            )}
            {profile.instagram_url && (
              <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="social-link">
                📷 Instagram
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProfile;
