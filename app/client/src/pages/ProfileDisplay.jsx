import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import '../styles/profile-display.css';

const ProfileDisplay = () => {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    console.log('📋 ProfileDisplay: User data:', user);
    console.log('📋 ProfileDisplay: Profile data:', profile);
    console.log('📋 ProfileDisplay: Auth loading:', authLoading);
    
    // Use profile from AuthContext if available, otherwise fall back to user
    const profileData = profile || user;
    
    if (profileData && !authLoading) {
      console.log('✅ ProfileDisplay: Setting profile data:', profileData);
      setUserProfile(profileData);
      setLoading(false);
    } else if (!authLoading) {
      console.log('⚠️ ProfileDisplay: No profile data available');
      setLoading(false);
    }
  }, [user, profile, authLoading]);

  const handleEditProfile = () => {
    navigate('/profile-edit');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSocialLinks = () => {
    if (!userProfile?.social_links) return [];
    const links = typeof userProfile.social_links === 'string' 
      ? JSON.parse(userProfile.social_links) 
      : userProfile.social_links;
    
    return [
      { name: 'LinkedIn', url: userProfile.linkedin_url || links.linkedin, icon: '💼' },
      { name: 'Twitter', url: userProfile.twitter_url || links.twitter, icon: '🐦' },
      { name: 'Instagram', url: userProfile.instagram_url || links.instagram, icon: '📷' }
    ].filter(link => link.url);
  };

  if (loading || authLoading) return <Loader />;

  // More lenient check - only show "Complete Profile" if truly missing essential data
  const needsCompletion = !userProfile || 
    (!userProfile.full_name && !userProfile.username && !userProfile.email);
  
  if (needsCompletion) {
    console.log('⚠️ ProfileDisplay: Profile needs completion');
    return (
      <div className="profile-display-container">
        <div className="profile-error">
          <h2>Complete Your Profile</h2>
          <p>Let's set up your profile to get started!</p>
          <button onClick={() => navigate('/profile-edit')} className="btn-primary">
            Complete Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-display-container">
      {/* Header Section */}
      <div className="profile-header">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            {userProfile.avatar_url ? (
              <img src={userProfile.avatar_url} alt="Profile" />
            ) : (
              <div className="avatar-placeholder">
                {userProfile.full_name?.charAt(0) || userProfile.email?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div className="profile-basic-info">
            <h1>{userProfile.full_name || 'Anonymous User'}</h1>
            <p className="username">@{userProfile.username || 'No username'}</p>
            <div className="profile-badges">
              <span className={`role-badge ${userProfile.role}`}>
                {userProfile.role === 'creator' ? '🚀 Creator' : '💰 Investor'}
              </span>
              {userProfile.is_verified === 'yes' && (
                <span className="verified-badge">✓ Verified</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleEditProfile} className="edit-profile-btn">
          ✏️ Edit Profile
        </button>
      </div>

      {/* Main Content */}
      <div className="profile-content">
        {/* About Section */}
        <div className="profile-section">
          <h2>About</h2>
          <div className="about-content">
            {userProfile.bio ? (
              <p>{userProfile.bio}</p>
            ) : (
              <p className="empty-state">No bio provided yet.</p>
            )}
          </div>
        </div>

        {/* Personal Information */}
        <div className="profile-section">
          <h2>Personal Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Email</label>
              <span>{userProfile.email}</span>
            </div>
            <div className="info-item">
              <label>Location</label>
              <span>{userProfile.location || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>Phone</label>
              <span>{userProfile.phone || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>Date of Birth</label>
              <span>{formatDate(userProfile.date_of_birth)}</span>
            </div>
          </div>
        </div>

        {/* Social Links */}
        {getSocialLinks().length > 0 && (
          <div className="profile-section">
            <h2>Social Links</h2>
            <div className="social-links">
              {getSocialLinks().map((link, index) => (
                <a 
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  <span className="social-icon">{link.icon}</span>
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Stats Section for Investors/Creators */}
        <div className="profile-section">
          <h2>Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-number">{userProfile.followers_count || 0}</span>
              <span className="stat-label">Followers</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{userProfile.following_count || 0}</span>
              <span className="stat-label">Following</span>
            </div>
            {userProfile.role === 'investor' && (
              <>
                <div className="stat-item">
                  <span className="stat-number">{userProfile.total_campaigns_backed || 0}</span>
                  <span className="stat-label">Campaigns Backed</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">${userProfile.total_invested || 0}</span>
                  <span className="stat-label">Total Invested</span>
                </div>
              </>
            )}
            <div className="stat-item">
              <span className="stat-number">{userProfile.trust_score || 0}/5</span>
              <span className="stat-label">Trust Score</span>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="profile-section">
          <h2>Account Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Account Type</label>
              <span className="capitalize">{userProfile.role || 'Not set'}</span>
            </div>
            <div className="info-item">
              <label>Verification Level</label>
              <span>Level {userProfile.verification_level || 0}</span>
            </div>
            <div className="info-item">
              <label>Member Since</label>
              <span>{formatDate(userProfile.created_at)}</span>
            </div>
            <div className="info-item">
              <label>Last Updated</label>
              <span>{formatDate(userProfile.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileDisplay;