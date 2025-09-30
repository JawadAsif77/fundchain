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
      is_accredited_investor: !!profileData.is_accredited_investor,
      total_invested: profileData.total_invested ?? 0,
      total_campaigns_backed: profileData.total_campaigns_backed ?? 0,
      verification_level: profileData.verification_level ?? 0,
      trust_score: profileData.trust_score ?? 0,
      referral_code: profileData.referral_code || '',
      last_active_at: profileData.last_active_at || '',
      followers_count: profileData.followers_count ?? 0,
      following_count: profileData.following_count ?? 0
    });

    const rawPreferences = profileData.preferences;
    const hasPreferences = rawPreferences && typeof rawPreferences === 'object' && !Array.isArray(rawPreferences);

    setPreferencesInput(
      hasPreferences && Object.keys(rawPreferences).length
        ? JSON.stringify(rawPreferences, null, 2)
        : ''
    );
  }, [roleStatus?.role, user]);

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
    }
  }, [location.state]);

  useEffect(() => {
    if (profile) {
      applyProfileToState(profile);
    } else if (user) {
      setFormData((prev) => ({
        ...prev,
        email: user.email || prev.email,
        role: user.user_metadata?.role || prev.role
      }));
    }
  }, [applyProfileToState, profile, roleStatus, user]);

  useEffect(() => {
    setAvatarError(false);
  }, [formData.avatar_url]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    if (name.startsWith('social_links.')) {
      const [, key] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        social_links: {
          ...prev.social_links,
          [key]: value
        }
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    let parsedPreferences = null;
    if (preferencesInput.trim()) {
      try {
        parsedPreferences = JSON.parse(preferencesInput);
      } catch (parseError) {
        setError('Preferences must be valid JSON. Please fix the formatting and try again.');
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
      const updatedProfile = await updateProfile(updates);
      if (updatedProfile) {
        applyProfileToState(updatedProfile);
      }
      setMessage('Profile updated successfully!');
      
      // If this was initial profile setup (user came from registration), 
      // show a success message with option to continue
      if (needsProfileCompletion && needsProfileCompletion()) {
        setMessage('Profile setup complete! You can now continue to your dashboard.');
      }
    } catch (submitError) {
      console.error('Error updating profile:', submitError);
      setError(submitError.message || 'Failed to update profile');
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
    const userRole = roleStatus?.role || formData.role;
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
    const userRole = roleStatus?.role || formData.role;
    console.log('User skipping profile completion, role:', userRole);
    
    // Save minimal data (at least the role) before skipping
    if (formData.role && formData.role !== (roleStatus?.role || '')) {
      handleSubmit({ preventDefault: () => {} }); // Save role if it was changed
    }
    
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
    <div className="container" style={{ padding: '2rem 0', maxWidth: '960px' }}>
      <div className="card">
        <div className="card__header">
          <h1 className="card__title">Edit Your Profile</h1>
          <p className="card__subtitle">
            Keep your details up to date so the FundChain community can learn more about you.
          </p>
        </div>

        <div className="card__content">
          {needsProfileCompletion() && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--color-warning-bg)',
              color: 'var(--color-warning)',
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              Please complete the required fields marked with an asterisk (*) to unlock the full platform experience.
            </div>
          )}

          {message && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              {message}
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap',
            marginBottom: '2rem'
          }}>
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {formData.avatar_url && !avatarError ? (
                <img
                  src={formData.avatar_url}
                  alt={formData.full_name || 'Profile avatar'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0 0.5rem' }}>
                  No image
                </span>
              )}
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{formData.full_name || 'Add your name'}</h2>
              <p style={{ margin: '0.25rem 0', color: 'var(--color-muted)' }}>
                {formData.role ? formData.role.charAt(0).toUpperCase() + formData.role.slice(1) : 'Member'}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  backgroundColor: 'var(--color-bg-secondary)'
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: profileMeta.is_verified === 'yes' ? 'var(--color-success)' : 'var(--color-border)'
                  }} />
                  Verified: {profileMeta.is_verified === 'yes' ? 'Yes' : 'No'}
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  backgroundColor: 'var(--color-bg-secondary)'
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: profileMeta.is_accredited_investor ? 'var(--color-primary)' : 'var(--color-border)'
                  }} />
                  Accredited Investor: {profileMeta.is_accredited_investor ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Basic Information</h3>
              <div className="form__group">
                <label className="form__label">Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="form__input"
                  required
                />
              </div>
              <div className="form__group">
                <label className="form__label">Username *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="form__input"
                  required
                />
              </div>
              <div className="form__group">
                <label className="form__label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  className="form__input"
                  disabled
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                />
              </div>
              <div className="form__group">
                <label className="form__label">Role</label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  className="form__input"
                  disabled
                  style={{ backgroundColor: 'var(--color-bg-secondary)', textTransform: 'capitalize' }}
                />
              </div>
              <div className="form__group">
                <label className="form__label">Profile Picture URL</label>
                <input
                  type="url"
                  name="avatar_url"
                  value={formData.avatar_url}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://"
                />
                <small style={{ color: 'var(--color-muted)' }}>
                  Paste a direct link to an image to use it as your avatar.
                </small>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Contact & Personal Details</h3>
              <div className="form__group">
                <label className="form__label">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="+1 555 000 1234"
                />
              </div>
              <div className="form__group">
                <label className="form__label">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="City, Country"
                />
              </div>
              <div className="form__group">
                <label className="form__label">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  className="form__input"
                />
              </div>
              <div className="form__group">
                <label className="form__label">Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="form__input"
                  rows="4"
                  placeholder="Share your background, interests, and what you're looking for on FundChain."
                />
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Social Links</h3>
              <div className="form__group">
                <label className="form__label">Website</label>
                <input
                  type="url"
                  name="social_links.website"
                  value={formData.social_links.website}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://yourwebsite.com"
                />
              </div>
              <div className="form__group">
                <label className="form__label">LinkedIn</label>
                <input
                  type="url"
                  name="social_links.linkedin"
                  value={formData.social_links.linkedin}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
              <div className="form__group">
                <label className="form__label">Twitter</label>
                <input
                  type="url"
                  name="social_links.twitter"
                  value={formData.social_links.twitter}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>
              <div className="form__group">
                <label className="form__label">Instagram</label>
                <input
                  type="url"
                  name="social_links.instagram"
                  value={formData.social_links.instagram}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://instagram.com/yourprofile"
                />
              </div>
              <div className="form__group">
                <label className="form__label">Facebook</label>
                <input
                  type="url"
                  name="social_links.facebook"
                  value={formData.social_links.facebook}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://facebook.com/yourprofile"
                />
              </div>
              <div className="form__group">
                <label className="form__label">YouTube</label>
                <input
                  type="url"
                  name="social_links.youtube"
                  value={formData.social_links.youtube}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://youtube.com/yourchannel"
                />
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Preferences</h3>
              <div className="form__group">
                <label className="form__label">Custom Preferences (JSON)</label>
                <textarea
                  name="preferences"
                  value={preferencesInput}
                  onChange={(event) => setPreferencesInput(event.target.value)}
                  className="form__input"
                  rows="6"
                  placeholder='{"investment_focus": "climate-tech"}'
                />
                <small style={{ color: 'var(--color-muted)' }}>
                  Use JSON format to store any additional preferences. Leave blank to clear this field.
                </small>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--color-border)',
              paddingTop: '1.5rem'
            }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="btn btn--ghost"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Skip for Now
                </button>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn--ghost"
                  disabled={isSubmitting}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="btn btn--accent"
                >
                  Go to {(roleStatus?.role || formData.role) === 'creator' ? 'Dashboard' : 'Explore'}
                </button>
              </div>
            </div>
          </form>

          <div style={{ marginTop: '2.5rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Account Insights</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1rem'
              }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>Total Invested</p>
                <p style={{ margin: '0.35rem 0 0', fontWeight: 'var(--font-semibold)' }}>
                  ${Number(profileMeta.total_invested || 0).toLocaleString()}
                </p>
              </div>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1rem'
              }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>Campaigns Backed</p>
                <p style={{ margin: '0.35rem 0 0', fontWeight: 'var(--font-semibold)' }}>
                  {profileMeta.total_campaigns_backed}
                </p>
              </div>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1rem'
              }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>Verification Level</p>
                <p style={{ margin: '0.35rem 0 0', fontWeight: 'var(--font-semibold)' }}>
                  {profileMeta.verification_level}
                </p>
              </div>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1rem'
              }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>Trust Score</p>
                <p style={{ margin: '0.35rem 0 0', fontWeight: 'var(--font-semibold)' }}>
                  {Number(profileMeta.trust_score || 0).toFixed(2)}
                </p>
              </div>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1rem'
              }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>Followers</p>
                <p style={{ margin: '0.35rem 0 0', fontWeight: 'var(--font-semibold)' }}>
                  {profileMeta.followers_count}
                </p>
              </div>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1rem'
              }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>Following</p>
                <p style={{ margin: '0.35rem 0 0', fontWeight: 'var(--font-semibold)' }}>
                  {profileMeta.following_count}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <div className="form__group">
                <label className="form__label">Referral Code</label>
                <input
                  type="text"
                  value={profileMeta.referral_code || 'Not assigned'}
                  className="form__input"
                  disabled
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                />
              </div>
              <div className="form__group">
                <label className="form__label">Last Active</label>
                <input
                  type="text"
                  value={formattedLastActive}
                  className="form__input"
                  disabled
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
