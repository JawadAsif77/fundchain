import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';
import Loader from './Loader';
import './RoleSelection.css';

/**
 * RoleSelection - Role selection for all new users without a role
 * Shown to users (Google OAuth or email/password) who have NULL role
 * Forces users to select Investor or Creator before accessing the platform
 */
const RoleSelection = () => {
  const [selectedRole, setSelectedRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const redirectTimerRef = useRef(null);
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Security: If user already has a role, redirect to dashboard
  useEffect(() => {
    if (profile?.role) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    setWarning('');
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
    setWarning('');

    try {
      // Get session and call edge function to update role
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/update-user-role`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: selectedRole })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update role');
      }

      // Refresh user profile to get updated role from database/auth context
      const refreshedProfile = await refreshProfile();
      const effectiveRole = refreshedProfile?.role || result?.data?.role || selectedRole;

      if (!refreshedProfile?.role && result?.data?.role) {
        setIsSubmitting(false);
        setWarning('Your role was saved successfully. Syncing your session now and redirecting...');

        redirectTimerRef.current = setTimeout(() => {
          if (effectiveRole === 'creator') {
            navigate('/kyc', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 1200);
        return;
      }

      // Redirect based on role
      if (effectiveRole === 'creator') {
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

          {warning && (
            <div className="role-warning-message">
              {warning}
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
