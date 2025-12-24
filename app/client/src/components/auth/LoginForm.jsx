import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { validateEmail, validateRequired } from '../../utils/validation';
import { supabase } from '../../lib/supabase';
import './AuthForms.css';

const LoginForm = ({ onSwitchToRegister, onClose }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});
  const [googleError, setGoogleError] = useState('');
  
  // Forgot Password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  
  const { login, error, clearError } = useAuth();

  // Check if form is valid for submit button
  const isFormValid = () => {
    return (
      formData.email.trim() !== '' &&
      formData.password.trim() !== '' &&
      !validationErrors.email &&
      !validationErrors.password
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Apply input filtering for email
    let filteredValue = value;
    if (name === 'email') {
      filteredValue = value.replace(/[^a-zA-Z0-9@._-]/g, '');
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: filteredValue
    }));
    
    // Validate on change if field was touched
    if (fieldTouched[name]) {
      validateField(name, filteredValue);
    }
    
    // Clear auth error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setFieldTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const validateField = (fieldName, value) => {
    let result = { valid: true, error: null };

    switch (fieldName) {
      case 'email':
        result = validateEmail(value);
        break;
      case 'password':
        result = validateRequired(value);
        break;
      default:
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [fieldName]: result.error || ''
    }));

    return result.valid;
  };

  const validateForm = () => {
    const errors = {};
    
    const emailResult = validateEmail(formData.email);
    if (!emailResult.valid) errors.email = emailResult.error;
    
    const passwordResult = validateRequired(formData.password);
    if (!passwordResult.valid) errors.password = passwordResult.error;
    
    setValidationErrors(errors);
    setFieldTouched({ email: true, password: true });
    
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent empty submissions
    if (!formData.email.trim() || !formData.password.trim()) {
      setValidationErrors(prev => ({
        ...prev,
        email: !formData.email.trim() ? 'Email is required' : prev.email,
        password: !formData.password.trim() ? 'Password is required' : prev.password
      }));
      setFieldTouched({ email: true, password: true });
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await login(formData.email, formData.password);
      // Login successful - AuthContext will handle the state update
      onClose?.();
    } catch (error) {
      console.error('Login failed:', error);
      // Error will be displayed via the error from AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
    setResetEmail(formData.email); // Pre-fill with login email if available
    setResetSuccess(false);
    setResetError('');
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetSuccess(false);
    setResetError('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    // Validate email
    const emailValidation = validateEmail(resetEmail);
    if (!emailValidation.valid) {
      setResetError(emailValidation.error);
      return;
    }
    
    setIsResetting(true);
    setResetError('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      setResetSuccess(true);
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        handleCloseForgotPassword();
      }, 3000);
    } catch (error) {
      console.error('Password reset failed:', error);
      setResetError(error.message || 'Failed to send reset email');
    } finally {
      setIsResetting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setGoogleError('');
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        }
      });
      
      if (error) throw error;
      
      // OAuth will redirect automatically, no need to call onClose here
    } catch (error) {
      console.error('Google login failed:', error);
      setGoogleError(error.message || 'Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="auth-form-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your account</p>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {googleError && (
          <div className="error-message">
            {googleError}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="email">Email Address *</label>
          <input
            type="text"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={validationErrors.email ? 'error' : ''}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={isSubmitting}
          />
          {validationErrors.email && (
            <span className="field-error">{validationErrors.email}</span>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password *</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={validationErrors.password ? 'error' : ''}
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          {validationErrors.password && (
            <span className="field-error">{validationErrors.password}</span>
          )}
        </div>
        
        <button 
          type="button" 
          className="forgot-password-link"
          onClick={handleForgotPassword}
          disabled={isSubmitting}
        >
          Forgot your password?
        </button>
        
        <button 
          type="submit" 
          className="auth-submit-btn"
          disabled={isSubmitting || isGoogleLoading || !isFormValid()}
        >
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogleLogin}
          disabled={isSubmitting || isGoogleLoading}
        >
          {isGoogleLoading ? (
            'Connecting to Google...'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>
        
        <div className="auth-footer">
          <span>Don't have an account? </span>
          <button 
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToRegister}
            disabled={isSubmitting}
          >
            Sign Up
          </button>
        </div>
      </form>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div 
          className="modal-backdrop"
          onClick={handleCloseForgotPassword}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button 
                type="button"
                className="modal-close"
                onClick={handleCloseForgotPassword}
                disabled={isResetting}
              >
                ×
              </button>
            </div>

            {resetSuccess ? (
              <div className="success-message">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="24" cy="24" r="24" fill="#10B981"/>
                  <path d="M17 24L21.5 28.5L31 19" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h4>Email Sent!</h4>
                <p>
                  We've sent a password reset link to <strong>{resetEmail}</strong>.
                  Please check your email and follow the instructions.
                </p>
                <p className="text-muted">This window will close automatically...</p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <p className="modal-description">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                {resetError && (
                  <div className="error-message">
                    {resetError}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="reset-email">Email Address *</label>
                  <input
                    type="email"
                    id="reset-email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled={isResetting}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCloseForgotPassword}
                    disabled={isResetting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isResetting || !resetEmail}
                  >
                    {isResetting ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginForm;