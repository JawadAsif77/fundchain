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

const ProfileEdit = () => {
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
    role: 'investor', // display only, immutable here
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

  const applyProfileToState = useCallback(
    (profileData) => {
      if (!profileData) return;

      const rawSocialLinks = profileData.social_links;
      const normalizedSocialLinks =
        rawSocialLinks &&
        typeof rawSocialLinks === 'object' &&
        !Array.isArray(rawSocialLinks)
          ? rawSocialLinks
          : {};

      const socialLinks = {
        ...EMPTY_SOCIAL_LINKS,
        ...normalizedSocialLinks
      };

      // Legacy link columns mapping into social_links if empty
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
        role:
          profileData.role ||
          roleStatus?.role ||
          user?.user_metadata?.role ||
          'investor',
        avatar_url: profileData.avatar_url || '',
        bio: profileData.bio || '',
        location: profileData.location || '',
        phone: profileData.phone ?? profileData.phone_number ?? '',
        date_of_birth: normalizedDOB,
        social_links: socialLinks
      });

      setProfileMeta({
        is_verified:
          typeof profileData.is_verified === 'string'
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
    },
    [user, roleStatus]
  );

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

    setFormData((prev) => ({
      ...prev,
      ...(name === 'role' ? {} : { [name]: value }) // role is locked
    }));
  };

  const handleSocialLinksChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
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
      } catch {
        setError('Invalid JSON in preferences field. Please correct the format.');
        setIsSubmitting(false);
        return;
      }
    }

    const sanitizedSocialLinks = Object.entries(
      formData.social_links || {}
    ).reduce((acc, [key, value]) => {
      const trimmed = (value || '').trim();
      if (trimmed) {
        acc[key] = trimmed;
      }
      return acc;
    }, {});

    const updates = {
      full_name: formData.full_name || null,
      username: formData.username || null,
      avatar_url: formData.avatar_url || null,
      bio: formData.bio || null,
      location: formData.location || null,
      date_of_birth: formData.date_of_birth || null,
      social_links: Object.keys(sanitizedSocialLinks).length
        ? sanitizedSocialLinks
        : {},
      preferences: preferencesInput.trim() ? parsedPreferences : null,
      updated_at: new Date().toISOString()
    };

    const hasPhoneNumberColumn =
      profile && Object.prototype.hasOwnProperty.call(profile, 'phone_number');
    const hasPhoneColumn =
      profile && Object.prototype.hasOwnProperty.call(profile, 'phone');

    if (hasPhoneColumn || (!hasPhoneColumn && !hasPhoneNumberColumn)) {
      updates.phone = formData.phone ? formData.phone.trim() : null;
    }
    if (hasPhoneNumberColumn) {
      updates.phone_number = formData.phone ? formData.phone.trim() : null;
    }

    // Map social links back into legacy columns if they exist
    if (profile && Object.prototype.hasOwnProperty.call(profile, 'website')) {
      updates.website = formData.social_links.website
        ? formData.social_links.website.trim()
        : null;
    }
    if (
      profile &&
      Object.prototype.hasOwnProperty.call(profile, 'linkedin_url')
    ) {
      updates.linkedin_url = formData.social_links.linkedin
        ? formData.social_links.linkedin.trim()
        : null;
    }
    if (profile && Object.prototype.hasOwnProperty.call(profile, 'twitter_url')) {
      updates.twitter_url = formData.social_links.twitter
        ? formData.social_links.twitter.trim()
        : null;
    }
    if (
      profile &&
      Object.prototype.hasOwnProperty.call(profile, 'instagram_url')
    ) {
      updates.instagram_url = formData.social_links.instagram
        ? formData.social_links.instagram.trim()
        : null;
    }

    try {
      const updatedProfile = await updateProfile(updates);

      if (!updatedProfile) {
        throw new Error('No data returned from profile update');
      }

      applyProfileToState(updatedProfile);
      setMessage('Profile updated successfully!');

      setTimeout(() => {
        navigate('/profile');
      }, 1500);
    } catch (submitError) {
      console.error('Error updating profile:', submitError);

      let errorMessage = 'Failed to update profile. ';

      if (submitError?.message) {
        if (submitError.message.includes('bio')) {
          errorMessage +=
            'The bio field is not available yet. Please run the database migration first.';
        } else if (submitError.message.includes('social_links')) {
          errorMessage +=
            'Social links are not available yet. Please run the database migration first.';
        } else if (submitError.message.includes('column')) {
          errorMessage +=
            'Some profile fields are not available yet. Please run the database migration first.';
        } else {
          errorMessage += submitError.message;
        }
      } else {
        errorMessage +=
          'Please check your internet connection and try again.';
      }

      setError(errorMessage);
      setMessage('');
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
    const userRole =
      roleStatus?.role || profile?.role || formData.role || 'investor';

    if (userRole === 'creator') {
      navigate('/dashboard');
    } else if (userRole === 'investor') {
      navigate('/explore');
    } else {
      navigate('/explore');
    }
  };

  const handleSkip = () => {
    const userRole =
      roleStatus?.role || profile?.role || formData.role || 'investor';

    if (userRole === 'creator') {
      navigate('/dashboard');
    } else {
      navigate('/explore');
    }
  };

  const formattedLastActive = profileMeta.last_active_at
    ? new Date(profileMeta.last_active_at).toLocaleString()
    : 'Not available yet';

  if (loading) {
    return (
      <div
        className="container"
        style={{ padding: '2rem 0', textAlign: 'center' }}
      >
        <div>Loading profile...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-elev)',
        padding: '2rem 0'
      }}
    >
      <div className="container" style={{ maxWidth: '1000px' }}>
        {/* Header */}
        <div
          style={{
            background: 'var(--gradient-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6) var(--space-4)',
            marginBottom: 'var(--space-4)',
            color: 'var(--color-primary-ink)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
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
              }}
            >
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt="Profile"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <span>👤</span>
              )}
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '2.5rem',
                  fontWeight: 700
                }}
              >
                {formData.full_name || 'Complete Your Profile'}
              </h1>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '1.1rem',
                  opacity: 0.9
                }}
              >
                {formData.role === 'creator' ? '🚀 Creator' : '💰 Investor'} •{' '}
                {user?.email}
              </p>
            </div>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '1.1rem',
              opacity: 0.9,
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
          >
            Keep your details up to date so the FundChain community can learn
            more about you.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-card)',
            border: '1px solid var(--color-border)'
          }}
        >
          {/* Status messages */}
          {needsProfileCompletion && (
            <div
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'var(--color-warning-bg)',
                color: 'var(--color-warning)',
                borderRadius: '0.75rem',
                marginBottom: 'var(--space-4)',
                border: '1px solid rgba(249, 115, 22, 0.12)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span
                style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}
              >
                ⚡
              </span>
              <span>
                Complete the required fields marked with an asterisk (*) to
                unlock the full platform experience.
              </span>
            </div>
          )}

          {message && (
            <div
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'var(--color-info-bg)',
                color: 'var(--color-info)',
                borderRadius: '0.75rem',
                marginBottom: 'var(--space-4)',
                border: '1px solid rgba(3, 105, 161, 0.08)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span
                style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}
              >
                ✅
              </span>
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: '0.75rem',
                marginBottom: 'var(--space-4)',
                border: '1px solid rgba(239, 68, 68, 0.08)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span
                style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}
              >
                ❌
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: '2rem' }}>
              {/* Basic info */}
              <div>
                <h3
                  style={{
                    marginBottom: '1rem',
                    color: 'var(--color-text)',
                    borderBottom: '2px solid var(--color-bg-elev)',
                    paddingBottom: '0.5rem'
                  }}
                >
                  Basic Information
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        color: 'var(--color-text)'
                      }}
                    >
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
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'var(--color-white)'
                      }}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        color: 'var(--color-text)'
                      }}
                    >
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
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'var(--color-white)'
                      }}
                      placeholder="Choose a unique username"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        color: 'var(--color-text)'
                      }}
                    >
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
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'var(--color-bg-elev)',
                        color: 'var(--color-muted)'
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        color: 'var(--color-text-light)'
                      }}
                    >
                      Role
                    </label>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-bg-elev)',
                        color: 'var(--color-text-light)',
                        width: 'fit-content'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>
                        {roleStatus?.role === 'creator' ||
                        formData.role === 'creator'
                          ? '🚀 Creator'
                          : '💰 Investor'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--color-muted)'
                        }}
                      >
                        (locked)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional info */}
              <div>
                <h3
                  style={{
                    marginBottom: '1rem',
                    color: 'var(--color-text-light)',
                    borderBottom: '2px solid var(--color-border)',
                    paddingBottom: '0.5rem'
                  }}
                >
                  Additional Information
                </h3>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 500,
                        color: 'var(--color-text-light)'
                      }}
                    >
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        backgroundColor: 'var(--color-white)',
                        resize: 'vertical'
                      }}
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontWeight: 500,
                          color: 'var(--color-text-light)'
                        }}
                      >
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
                          border: '1px solid var(--color-border)',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: 'var(--color-white)'
                        }}
                        placeholder="City, Country"
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontWeight: 500,
                          color: 'var(--color-text-light)'
                        }}
                      >
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
                          border: '1px solid var(--color-border)',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: 'var(--color-white)'
                        }}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontWeight: 500,
                          color: 'var(--color-text-light)'
                        }}
                      >
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
                          border: '1px solid var(--color-border)',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: 'var(--color-white)'
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontWeight: 500,
                          color: 'var(--color-text-light)'
                        }}
                      >
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
                          border: '1px solid var(--color-border)',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: 'var(--color-white)'
                        }}
                        placeholder="https://example.com/avatar.jpg"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social links */}
              <div>
                <h3
                  style={{
                    marginBottom: '1rem',
                    color: 'var(--color-text-light)',
                    borderBottom: '2px solid var(--color-border)',
                    paddingBottom: '0.5rem'
                  }}
                >
                  Social Links
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1rem'
                  }}
                >
                  {Object.keys(EMPTY_SOCIAL_LINKS).map((platform) => (
                    <div key={platform}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontWeight: 500,
                          color: 'var(--color-text-light)',
                          textTransform: 'capitalize'
                        }}
                      >
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
                          border: '1px solid var(--color-border)',
                          borderRadius: '0.5rem',
                          fontSize: '1rem',
                          backgroundColor: 'var(--color-white)'
                        }}
                        placeholder={`https://${platform}.com/yourprofile`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferences (raw JSON editor) – optional UI, keep if you want */}
              <div>
                <h3
                  style={{
                    marginBottom: '1rem',
                    color: 'var(--color-text-light)',
                    borderBottom: '2px solid var(--color-border)',
                    paddingBottom: '0.5rem'
                  }}
                >
                  Preferences (Advanced)
                </h3>
                <textarea
                  value={preferencesInput}
                  onChange={(e) => setPreferencesInput(e.target.value)}
                  rows={4}
                  placeholder='Optional JSON object, e.g. { "categories": ["DeFi", "Real Estate"] }'
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    fontSize: '0.9rem',
                    backgroundColor: 'var(--color-bg-elev)',
                    fontFamily: 'monospace'
                  }}
                />
                <p
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--color-muted)'
                  }}
                >
                  This field is optional and expects valid JSON.
                </p>
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  justifyContent: 'space-between',
                  paddingTop: '2rem',
                  borderTop: '1px solid var(--color-border)'
                }}
              >
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleSkip}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'transparent',
                      color: 'var(--color-muted)',
                      border: '1px solid var(--color-border)',
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
                      color: 'var(--color-muted)',
                      border: '1px solid var(--color-border)',
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
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-primary-ink)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: 500,
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
                      backgroundColor: 'var(--color-muted)',
                      color: 'var(--color-white)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: 500,
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
                      backgroundColor: 'var(--color-success)',
                      color: 'var(--color-white)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Go to{' '}
                    {(roleStatus?.role || formData.role) === 'creator'
                      ? 'Dashboard'
                      : 'Explore'}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Account insights */}
          <div style={{ marginTop: '3rem' }}>
            <h3
              style={{
                marginBottom: '1.5rem',
                color: 'var(--color-text-light)',
                borderBottom: '2px solid var(--color-border)',
                paddingBottom: '0.5rem'
              }}
            >
              Account Insights
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}
            >
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elev)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border)'
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: 'var(--color-muted)',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Total Invested
                </p>
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    color: 'var(--color-text)'
                  }}
                >
                  ${Number(profileMeta.total_invested || 0).toLocaleString()}
                </p>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elev)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border)'
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: 'var(--color-muted)',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Campaigns Backed
                </p>
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    color: 'var(--color-text)'
                  }}
                >
                  {profileMeta.total_campaigns_backed}
                </p>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elev)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border)'
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: 'var(--color-muted)',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Verification Level
                </p>
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    color: 'var(--color-text)'
                  }}
                >
                  {profileMeta.verification_level}/5
                </p>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elev)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border)'
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: 'var(--color-muted)',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Trust Score
                </p>
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    color: 'var(--color-text)'
                  }}
                >
                  {profileMeta.trust_score}%
                </p>
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-bg-elev)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--color-border)'
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: 'var(--color-muted)',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Last Active
                </p>
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--color-text)'
                  }}
                >
                  {formattedLastActive}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
