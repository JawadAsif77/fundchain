import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

const EMPTY_SOCIAL_LINKS = {
  website: '',
  linkedin: '',
  twitter: '',
  instagram: '',
  facebook: '',
  youtube: ''
};

const Profile = () => {
  const {
    user,
    profile,
    roleStatus,
    loading,
    updateProfile,
    needsProfileCompletion
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    // role is immutable after first selection; keep for display only
    role: 'investor',
    avatar_url: '',
    bio: '',
    location: '',
    phone: '',
    date_of_birth: '',
    social_links: { ...EMPTY_SOCIAL_LINKS }
  });
  const [profileMeta, setProfileMeta] = useState({
    is_verified: 'no',
    is_accredited_investor: false,
    total_invested: 0,
    total_campaigns_backed: 0,
    verification_level: 0,
    trust_score: 0,
    referral_code: '',
    last_active_at: '',
    followers_count: 0,
    following_count: 0
  });
  const [preferencesInput, setPreferencesInput] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const applyProfileToState = useCallback((profileData) => {
    if (!profileData) return;

    const rawSocialLinks = profileData.social_links;
    const normalizedSocialLinks = (rawSocialLinks && typeof rawSocialLinks === 'object' && !Array.isArray(rawSocialLinks))
      ? rawSocialLinks
      : {};

    const socialLinks = {
      ...EMPTY_SOCIAL_LINKS,
      ...normalizedSocialLinks
    };

    if (profileData.linkedin_url && !socialLinks.linkedin) {
      socialLinks.linkedin = profileData.linkedin_url;
    }
    if (profileData.twitter_url && !socialLinks.twitter) {
      socialLinks.twitter = profileData.twitter_url;
    }
    if (profileData.instagram_url && !socialLinks.instagram) {
      socialLinks.instagram = profileData.instagram_url;
    }

    const normalizedDOB = profileData.date_of_birth
      ? String(profileData.date_of_birth).split('T')[0]
      : '';

    setFormData({
      full_name: profileData.full_name || '',
      username: profileData.username || '',
      email: profileData.email || user?.email || '',
      role: profileData.role || roleStatus?.role || user?.user_metadata?.role || 'investor',
      avatar_url: profileData.avatar_url || '',
      bio: profileData.bio || '',
      location: profileData.location || '',
      phone: (profileData.phone ?? profileData.phone_number) || '',
      date_of_birth: normalizedDOB,
      social_links: socialLinks
    });

    setProfileMeta({
      is_verified: typeof profileData.is_verified === 'string'
        ? profileData.is_verified
        : profileData.is_verified
          ? 'yes'
          : 'no',
      is_accredited_investor: Boolean(profileData.is_accredited_investor),
      total_invested: Number(profileData.total_invested || 0),
      total_campaigns_backed: Number(profileData.total_campaigns_backed || 0),
      verification_level: Number(profileData.verification_level || 0),
      trust_score: Number(profileData.trust_score || 0),
      referral_code: profileData.referral_code || '',
      last_active_at: profileData.last_active_at || '',
      followers_count: Number(profileData.followers_count || 0),
      following_count: Number(profileData.following_count || 0)
    });

    const rawPreferences = profileData.preferences;
    if (rawPreferences && typeof rawPreferences === 'object') {
      setPreferencesInput(JSON.stringify(rawPreferences, null, 2));
    } else if (rawPreferences && typeof rawPreferences === 'string') {
      setPreferencesInput(rawPreferences);
    } else {
      setPreferencesInput('');
    }
  }, [user, roleStatus]);

  useEffect(() => {
    if (profile) {
      applyProfileToState(profile);
    }
  }, [profile, applyProfileToState]);

  useEffect(() => {
    if (location?.state?.message) {
      setMessage(location.state.message);
    }
  }, [location]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      // prevent any changes to role from this page
      ...(name === 'role' ? {} : { [name]: value })
    }));
  };

  const handleSocialLinksChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      social_links: {
        ...prev.social_links,
        [name]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    let parsedPreferences = null;
    if (preferencesInput.trim()) {
      try {
        parsedPreferences = JSON.parse(preferencesInput);
      } catch (parseError) {
        setError('Invalid JSON in preferences field. Please correct the format.');
        setIsSubmitting(false);
        return;
      }
    }

    const sanitizedSocialLinks = Object.entries(formData.social_links || {}).reduce((acc, [key, value]) => {
      const trimmed = (value || '').trim();
      if (trimmed) {
        acc[key] = trimmed;
      }
      return acc;
    }, {});

    const updates = {
      full_name: formData.full_name || null,
      username: formData.username || null,
      // Do not allow changing role from profile page
      avatar_url: formData.avatar_url || null,
      bio: formData.bio || null,
      location: formData.location || null,
      date_of_birth: formData.date_of_birth || null,
      social_links: Object.keys(sanitizedSocialLinks).length ? sanitizedSocialLinks : {},
      preferences: preferencesInput.trim() ? parsedPreferences : null,
      updated_at: new Date().toISOString()
    };

    const hasPhoneNumberColumn = profile && Object.prototype.hasOwnProperty.call(profile, 'phone_number');
    const hasPhoneColumn = profile && Object.prototype.hasOwnProperty.call(profile, 'phone');

    if (hasPhoneColumn || (!hasPhoneColumn && !hasPhoneNumberColumn)) {
      updates.phone = formData.phone ? formData.phone.trim() : null;
    }
    if (hasPhoneNumberColumn) {
      updates.phone_number = formData.phone ? formData.phone.trim() : null;
    }

    if (profile && Object.prototype.hasOwnProperty.call(profile, 'website')) {
      updates.website = formData.social_links.website ? formData.social_links.website.trim() : null;
    }
    if (profile && Object.prototype.hasOwnProperty.call(profile, 'linkedin_url')) {
      updates.linkedin_url = formData.social_links.linkedin ? formData.social_links.linkedin.trim() : null;
    }
    if (profile && Object.prototype.hasOwnProperty.call(profile, 'twitter_url')) {
      updates.twitter_url = formData.social_links.twitter ? formData.social_links.twitter.trim() : null;
    }
    if (profile && Object.prototype.hasOwnProperty.call(profile, 'instagram_url')) {
      updates.instagram_url = formData.social_links.instagram ? formData.social_links.instagram.trim() : null;
    }

    try {
      console.log('🚀 Submitting profile updates...', updates);
      setError(''); // Clear previous errors
      
      const updatedProfile = await updateProfile(updates);
      
      if (updatedProfile) {
        console.log('✅ Profile update successful:', updatedProfile);
        applyProfileToState(updatedProfile);
        setMessage('Profile updated successfully!');
        
        // Auto-redirect to profile display page after successful save
        setTimeout(() => {
          console.log('Profile saved, redirecting to profile display...');
          navigate('/profile');
        }, 1500); // Show success message for 1.5 seconds then redirect
      } else {
        throw new Error('No data returned from profile update');
      }
      
    } catch (submitError) {
      console.error('❌ Error updating profile:', submitError);
      
      // Set a user-friendly error message
      let errorMessage = 'Failed to update profile. ';
      
      if (submitError.message) {
        if (submitError.message.includes('bio')) {
          errorMessage += 'The bio field is not available yet. Please run the database migration first.';
        } else if (submitError.message.includes('social_links')) {
          errorMessage += 'Social links are not available yet. Please run the database migration first.';
        } else if (submitError.message.includes('column')) {
          errorMessage += 'Some profile fields are not available yet. Please run the database migration first.';
        } else {
          errorMessage += submitError.message;
        }
      } else {
        errorMessage += 'Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
      setMessage(''); // Clear any success message
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (profile) {
      applyProfileToState(profile);
    }
    setError('');
    setMessage('');
  };

  const handleContinue = () => {
    const userRole = roleStatus?.role || profile?.role || formData.role;
    if (userRole === 'creator') {
      console.log('Creator completing profile, redirecting to dashboard...');
      navigate('/dashboard');
    } else if (userRole === 'investor') {
      console.log('Investor completing profile, redirecting to explore...');
      navigate('/explore');
    } else {
      // Fallback - redirect to explore as it's more general
      console.log('Unknown role, redirecting to explore...');
      navigate('/explore');
    }
  };

  const handleSkip = () => {
    const userRole = roleStatus?.role || profile?.role || formData.role;
    console.log('User skipping profile completion, role:', userRole);
    
    // Redirect based on role
    if (userRole === 'investor') {
      navigate('/explore');
    } else if (userRole === 'creator') {
      navigate('/dashboard');
    } else {
      navigate('/explore'); // Default
    }
  };

  const formattedLastActive = profileMeta.last_active_at
    ? new Date(profileMeta.last_active_at).toLocaleString()
    : 'Not available yet';

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 0', textAlign: 'center' }}>
        <div>Loading profile...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc',
      padding: '2rem 0' 
    }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        
        {/* Header Section */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          borderRadius: '1rem',
          padding: '3rem 2rem',
          marginBottom: '2rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              marginRight: '1rem',
              marginBottom: '1rem'
            }}>
              {formData.avatar_url ? (
                <img 
                  src={formData.avatar_url} 
                  alt="Profile"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span>👤</span>
              )}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '700' }}>
                {formData.full_name || 'Complete Your Profile'}
              </h1>
              <p style={{ margin: '0.5rem 0 0', fontSize: '1.1rem', opacity: 0.9 }}>
                {formData.role === 'creator' ? '🚀 Creator' : '💰 Investor'} • {user?.email}
              </p>
            </div>
          </div>
          <p style={{ 
            margin: 0, 
            fontSize: '1.1rem', 
            opacity: 0.9,
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Keep your details up to date so the FundChain community can learn more about you.
          </p>
        </div>

        {/* Main Content */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          
          {/* Status Messages */}
          {needsProfileCompletion && needsProfileCompletion() && (
            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#fef3cd',
              color: '#856404',
              borderRadius: '0.75rem',
              marginBottom: '2rem',
              border: '1px solid #faebcd',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>⚡</span>
              <span>Complete the required fields marked with an asterisk (*) to unlock the full platform experience.</span>
            </div>
          )}

          {message && (
            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#d1edff',
              color: '#0969da',
              borderRadius: '0.75rem',
              marginBottom: '2rem',
              border: '1px solid #b6e3ff',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>✅</span>
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#ffebe9',
              color: '#d1242f',
              borderRadius: '0.75rem',
              marginBottom: '2rem',
              border: '1px solid #ffbdba',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>❌</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '2rem' }}>
              
              {/* Basic Information */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  Basic Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#fff'
                      }}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                      Username *
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#fff'
                      }}
                      placeholder="Choose a unique username"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                      Role
                    </label>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '9999px',
                      backgroundColor: '#f9fafb',
                      color: '#374151',
                      width: 'fit-content'
                    }}>
                      <span style={{ fontSize: '0.9rem' }}>
                        {roleStatus?.role === 'creator' || formData.role === 'creator' ? '🚀 Creator' : '💰 Investor'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>(locked)</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Additional Information */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  Additional Information
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      rows="3"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#fff',
                        resize: 'vertical'
                      }}
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                        Location
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: '#fff'
                        }}
                        placeholder="City, Country"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: '#fff'
                        }}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        name="date_of_birth"
                        value={formData.date_of_birth}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: '#fff'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                        Avatar URL
                      </label>
                      <input
                        type="url"
                        name="avatar_url"
                        value={formData.avatar_url}
                        onChange={handleInputChange}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: '#fff'
                        }}
                        placeholder="https://example.com/avatar.jpg"
                      />
                    </div>

                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                  Social Links
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  
                  {Object.keys(EMPTY_SOCIAL_LINKS).map(platform => (
                    <div key={platform}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', textTransform: 'capitalize' }}>
                        {platform}
                      </label>
                      <input
                        type="url"
                        name={platform}
                        value={formData.social_links[platform]}
                        onChange={handleSocialLinksChange}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: '#fff'
                        }}
                        placeholder={`https://${platform}.com/yourprofile`}
                      />
                    </div>
                  ))}

                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                justifyContent: 'space-between',
                paddingTop: '2rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleSkip}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'transparent',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Skip for Now
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSubmitting}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'transparent',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '0.75rem 2rem',
                      backgroundColor: '#4f46e5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Back to Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Go to {(roleStatus?.role || formData.role) === 'creator' ? 'Dashboard' : 'Explore'}
                  </button>
                </div>
              </div>

            </div>
          </form>

          {/* Account Insights */}
          <div style={{ marginTop: '3rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              Account Insights
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Total Invested</p>
                <p style={{ margin: '0.5rem 0 0', fontWeight: '700', fontSize: '1.5rem', color: '#111827' }}>
                  ${Number(profileMeta.total_invested || 0).toLocaleString()}
                </p>
              </div>
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Campaigns Backed</p>
                <p style={{ margin: '0.5rem 0 0', fontWeight: '700', fontSize: '1.5rem', color: '#111827' }}>
                  {profileMeta.total_campaigns_backed}
                </p>
              </div>
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Verification Level</p>
                <p style={{ margin: '0.5rem 0 0', fontWeight: '700', fontSize: '1.5rem', color: '#111827' }}>
                  {profileMeta.verification_level}/5
                </p>
              </div>
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Trust Score</p>
                <p style={{ margin: '0.5rem 0 0', fontWeight: '700', fontSize: '1.5rem', color: '#111827' }}>
                  {profileMeta.trust_score}%
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;