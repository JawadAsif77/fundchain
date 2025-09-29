import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

const Profile = () => {
  const { user, profile, roleStatus, loading } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    role: 'investor',
    phone_number: '',
    bio: '',
    location: '',
    date_of_birth: '',
    website: '',
    social_links: {
      linkedin: '',
      twitter: '',
      facebook: '',
      instagram: ''
    }
  });

  // Load profile data when component mounts or profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        email: profile.email || user?.email || '',
        role: profile.role || 'investor',
        phone_number: profile.phone_number || '',
        bio: profile.bio || '',
        location: profile.location || '',
        date_of_birth: profile.date_of_birth || '',
        website: profile.website || '',
        social_links: {
          linkedin: profile.social_links?.linkedin || '',
          twitter: profile.social_links?.twitter || '',
          facebook: profile.social_links?.facebook || '',
          instagram: profile.social_links?.instagram || ''
        }
      });
    }
  }, [profile, user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('social_')) {
      const platform = name.replace('social_', '');
      setFormData(prev => ({
        ...prev,
        social_links: {
          ...prev.social_links,
          [platform]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      // Update the profile in the database
      const { data, error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          username: formData.username,
          phone_number: formData.phone_number || null,
          bio: formData.bio || null,
          location: formData.location || null,
          date_of_birth: formData.date_of_birth || null,
          website: formData.website || null,
          social_links: formData.social_links,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setMessage('Profile updated successfully!');
      setIsEditing(false);
      
      // Refresh the auth context to get updated profile
      window.location.reload();
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    // Route based on user role
    if (roleStatus?.role === 'creator') {
      navigate('/explore');
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 0', textAlign: 'center' }}>
        <div>Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '800px' }}>
      <div className="card">
        <div className="card__header">
          <h1 className="card__title">Complete Your Profile</h1>
          <p className="card__subtitle">
            {roleStatus?.role === 'creator' 
              ? 'Set up your creator profile to start raising funds for your projects'
              : 'Complete your investor profile to start discovering exciting projects'
            }
          </p>
        </div>

        <div className="card__content">
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

          <form onSubmit={handleSubmit}>
            {/* Basic Information Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
                Basic Information
              </h3>
              
              <div className="form__group">
                <label className="form__label">Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="form__input"
                  required
                  disabled={!isEditing}
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
                  disabled={!isEditing}
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
                <small style={{ color: 'var(--color-muted)' }}>
                  Email cannot be changed here. Contact support if needed.
                </small>
              </div>

              <div className="form__group">
                <label className="form__label">Role</label>
                <input
                  type="text"
                  value={roleStatus?.role || 'Unknown'}
                  className="form__input"
                  disabled
                  style={{ 
                    backgroundColor: 'var(--color-bg-secondary)',
                    textTransform: 'capitalize'
                  }}
                />
                <small style={{ color: 'var(--color-muted)' }}>
                  Role is set during registration and cannot be changed.
                </small>
              </div>
            </div>

            {/* Contact Information Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
                Contact Information
              </h3>
              
              <div className="form__group">
                <label className="form__label">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="form__input"
                  disabled={!isEditing}
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
                  disabled={!isEditing}
                />
              </div>

              <div className="form__group">
                <label className="form__label">Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://yourwebsite.com"
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* Personal Information Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
                Personal Information
              </h3>
              
              <div className="form__group">
                <label className="form__label">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  className="form__input"
                  disabled={!isEditing}
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
                  placeholder={roleStatus?.role === 'creator' 
                    ? "Tell investors about your background and what drives you to create..." 
                    : "Tell creators about your investment interests and background..."
                  }
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* Social Links Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
                Social Links
              </h3>
              
              <div className="form__group">
                <label className="form__label">LinkedIn</label>
                <input
                  type="url"
                  name="social_linkedin"
                  value={formData.social_links.linkedin}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://linkedin.com/in/yourprofile"
                  disabled={!isEditing}
                />
              </div>

              <div className="form__group">
                <label className="form__label">Twitter</label>
                <input
                  type="url"
                  name="social_twitter"
                  value={formData.social_links.twitter}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://twitter.com/yourusername"
                  disabled={!isEditing}
                />
              </div>

              <div className="form__group">
                <label className="form__label">Facebook</label>
                <input
                  type="url"
                  name="social_facebook"
                  value={formData.social_links.facebook}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://facebook.com/yourprofile"
                  disabled={!isEditing}
                />
              </div>

              <div className="form__group">
                <label className="form__label">Instagram</label>
                <input
                  type="url"
                  name="social_instagram"
                  value={formData.social_links.instagram}
                  onChange={handleInputChange}
                  className="form__input"
                  placeholder="https://instagram.com/yourusername"
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end',
              paddingTop: '1rem',
              borderTop: '1px solid var(--color-border)'
            }}>
              {!isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="btn btn--outline"
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="btn btn--primary"
                  >
                    Continue to {roleStatus?.role === 'creator' ? 'Explore' : 'Dashboard'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setError('');
                      setMessage('');
                    }}
                    className="btn btn--ghost"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;