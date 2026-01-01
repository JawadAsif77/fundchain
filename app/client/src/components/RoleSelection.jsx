import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { userApi } from '../lib/api';
import Loader from './Loader';
import './RoleSelection.css';

/**
 * RoleSelection - Post-Google OAuth role selection for users without a role
 * Only shown to users who signed in with Google and have NULL role
 */
const RoleSelection = () => {
  const [selectedRole, setSelectedRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Security: If user already has a role, redirect to dashboard
  React.useEffect(() => {
    if (profile?.role) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, navigate]);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!selectedRole) {
      setError('Please select a role to continue');
      return;
    }

    if (!['creator', 'investor'].includes(selectedRole)) {
      setError('Invalid role selection');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Update user role in database
      const result = await userApi.updateProfile(user.id, { role: selectedRole });
      
      if (result.error) {
        throw new Error(result.error.message || 'Failed to update role');
      }

      // Refresh user profile to get updated role
      await refreshProfile();

      // Redirect based on role
      if (selectedRole === 'creator') {
        // Creators must complete KYC first
        navigate('/kyc', { replace: true });
      } else {
        // Investors go to dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Role selection error:', err);
      setError(err.message || 'Failed to set role. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <div className="role-selection-container">
        <Loader message="Setting up your account..." />
      </div>
    );
  }

  return (
    <div className="role-selection-container">
      <div className="role-selection-card">
        <div className="role-selection-header">
          <h1>Welcome to FundChain!</h1>
          <p>Choose your role to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="role-selection-form">
          {error && (
            <div className="role-error-message">
              {error}
            </div>
          )}

          <div className="role-options">
            <button
              type="button"
              className={`role-option ${selectedRole === 'investor' ? 'selected' : ''}`}
              onClick={() => handleRoleSelect('investor')}
              disabled={isSubmitting}
            >
              <div className="role-icon">💰</div>
              <h3>Investor</h3>
              <p>Discover and invest in promising campaigns</p>
              <ul className="role-features">
                <li>Browse campaigns</li>
                <li>Invest with tokens</li>
                <li>Track portfolio</li>
                <li>Earn returns</li>
              </ul>
            </button>

            <button
              type="button"
              className={`role-option ${selectedRole === 'creator' ? 'selected' : ''}`}
              onClick={() => handleRoleSelect('creator')}
              disabled={isSubmitting}
            >
              <div className="role-icon">🚀</div>
              <h3>Creator</h3>
              <p>Launch campaigns and raise funds for your projects</p>
              <ul className="role-features">
                <li>Create campaigns</li>
                <li>Raise capital</li>
                <li>Manage milestones</li>
                <li>Build community</li>
              </ul>
            </button>
          </div>

          <button
            type="submit"
            className="role-submit-btn"
            disabled={!selectedRole || isSubmitting}
          >
            Continue as {selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : '...'}
          </button>

          <p className="role-note">
            You can't change your role later. Choose carefully!
          </p>
        </form>
      </div>
    </div>
  );
};

export default RoleSelection;
