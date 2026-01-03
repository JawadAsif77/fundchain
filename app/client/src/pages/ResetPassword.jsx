import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { validatePassword, validatePasswordMatch } from '../utils/validation';
import { calculatePasswordStrength } from '../utils/passwordStrength';
import '../styles/form.css';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ strength: 'weak', score: 0, feedback: '' });
  const [validationErrors, setValidationErrors] = useState({});
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user came from reset password email
    const checkSession = async () => {
      try {
        // Check if there's a recovery token in the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        console.log('[Reset Password] URL params:', { accessToken: !!accessToken, type });
        
        // If this is a recovery link, wait longer for Supabase to process it
        if (type === 'recovery' && accessToken) {
          console.log('[Reset Password] Recovery token detected, waiting for session...');
          
          // Retry checking for session multiple times
          let session = null;
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
              session = data.session;
              console.log('[Reset Password] Session established after', (i + 1) * 500, 'ms');
              break;
            }
          }
          
          if (!session) {
            setError('Session could not be established. Please request a new reset link.');
            return;
          }
        } else {
          // No recovery token in URL - check session immediately
          const { data: { session }, error } = await supabase.auth.getSession();
          
          console.log('[Reset Password] Session check:', { hasSession: !!session, error });
          
          if (error) {
            console.error('[Reset Password] Session error:', error);
            setError('Invalid or expired reset link. Please request a new one.');
            return;
          }

          if (!session) {
            setError('Auth session missing! Please request a new reset link.');
          }
        }
      } catch (err) {
        console.error('[Reset Password] Check session error:', err);
        setError('Failed to verify reset link. Please try again.');
      }
    };

    checkSession();
  }, []);

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);
    
    // Calculate password strength
    const strength = calculatePasswordStrength(value);
    setPasswordStrength(strength);
    
    // Validate password
    const result = validatePassword(value);
    setValidationErrors(prev => ({
      ...prev,
      newPassword: result.error || ''
    }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    
    // Validate password match
    const result = validatePasswordMatch(newPassword, value);
    setValidationErrors(prev => ({
      ...prev,
      confirmPassword: result.error || ''
    }));
    
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    const passwordResult = validatePassword(newPassword);
    const matchResult = validatePasswordMatch(newPassword, confirmPassword);
    
    if (!passwordResult.valid || !matchResult.valid) {
      setValidationErrors({
        newPassword: passwordResult.error || '',
        confirmPassword: matchResult.error || ''
      });
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      console.log('[Reset Password] Updating password...');
      
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) {
        console.error('[Reset Password] Update error:', updateError);
        throw updateError;
      }
      
      console.log('[Reset Password] Password updated successfully');
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { message: 'Password reset successful! Please log in with your new password.' } 
        });
      }, 2000);
      
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="form-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="form-container" style={{ maxWidth: '450px', background: 'white', borderRadius: '12px', padding: '3rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✓</div>
            <h2 style={{ marginBottom: '1rem', color: '#2d3748' }}>Password Reset Successful!</h2>
            <p style={{ color: '#718096', marginBottom: '2rem' }}>
              Your password has been updated. Redirecting to login...
            </p>
            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="form-container" style={{ maxWidth: '450px', background: 'white', borderRadius: '12px', padding: '3rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginBottom: '0.5rem', color: '#2d3748', fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
          Reset Your Password
        </h2>
        <p style={{ color: '#718096', marginBottom: '2rem', textAlign: 'center' }}>
          Enter your new password below
        </p>

        {error && (
          <div style={{ 
            background: '#fed7d7', 
            border: '1px solid #fc8181', 
            color: '#c53030', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: '500' }}>
              New Password <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter new password"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '3rem',
                  border: `1px solid ${validationErrors.newPassword ? '#fc8181' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#718096',
                  fontSize: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {validationErrors.newPassword && (
              <p style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {validationErrors.newPassword}
              </p>
            )}
            
            {/* Password Strength Indicator */}
            {newPassword && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                  <div style={{ 
                    flex: 1, 
                    height: '4px', 
                    borderRadius: '2px',
                    background: passwordStrength.score >= 1 ? (passwordStrength.strength === 'weak' ? '#fc8181' : passwordStrength.strength === 'medium' ? '#f6ad55' : '#48bb78') : '#e2e8f0'
                  }} />
                  <div style={{ 
                    flex: 1, 
                    height: '4px', 
                    borderRadius: '2px',
                    background: passwordStrength.score >= 2 ? (passwordStrength.strength === 'medium' ? '#f6ad55' : '#48bb78') : '#e2e8f0'
                  }} />
                  <div style={{ 
                    flex: 1, 
                    height: '4px', 
                    borderRadius: '2px',
                    background: passwordStrength.score >= 3 ? '#48bb78' : '#e2e8f0'
                  }} />
                </div>
                <p style={{ 
                  fontSize: '0.875rem', 
                  color: passwordStrength.strength === 'weak' ? '#e53e3e' : passwordStrength.strength === 'medium' ? '#dd6b20' : '#2f855a'
                }}>
                  Password strength: {passwordStrength.strength}
                  {passwordStrength.feedback && ` - ${passwordStrength.feedback}`}
                </p>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: '500' }}>
              Confirm Password <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="Confirm new password"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '3rem',
                  border: `1px solid ${validationErrors.confirmPassword ? '#fc8181' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#718096',
                  fontSize: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <p style={{ color: '#e53e3e', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {validationErrors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || passwordStrength.strength === 'weak' || !newPassword || !confirmPassword}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: isSubmitting || passwordStrength.strength === 'weak' || !newPassword || !confirmPassword ? '#cbd5e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isSubmitting || passwordStrength.strength === 'weak' ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)'
            }}
          >
            {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
          </button>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
