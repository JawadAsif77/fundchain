import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import './AuthForms.css';

const RegisterForm = ({ onSwitchToLogin, onClose }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  
  const { register, error, clearError } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear auth error when user starts typing
    if (error) {
      clearError();
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await register(formData.email, formData.password, {
        fullName: formData.fullName,
        displayName: formData.fullName
      });
      
      // Show success message
      setShowSuccess(true);
      
      // Auto switch to login after 3 seconds
      setTimeout(() => {
        onSwitchToLogin?.();
      }, 3000);
      
    } catch (error) {
      console.error('Registration failed:', error);
      // Error will be displayed via the error from AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="auth-form-container">
        <div className="auth-form success-message">
          <div className="success-icon">✓</div>
          <h2>Check Your Email</h2>
          <p>
            We've sent a confirmation link to <strong>{formData.email}</strong>
          </p>
          <p>
            Please check your email and click the confirmation link to activate your account.
          </p>
          <button 
            type="button"
            className="auth-submit-btn"
            onClick={onSwitchToLogin}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-form-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Create Account</h2>
        <p className="auth-subtitle">Join our investment platform</p>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            className={validationErrors.fullName ? 'error' : ''}
            placeholder="Enter your full name"
            autoComplete="name"
            disabled={isSubmitting}
          />
          {validationErrors.fullName && (
            <span className="field-error">{validationErrors.fullName}</span>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
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
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={validationErrors.password ? 'error' : ''}
            placeholder="Create a password (min. 6 characters)"
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {validationErrors.password && (
            <span className="field-error">{validationErrors.password}</span>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className={validationErrors.confirmPassword ? 'error' : ''}
            placeholder="Confirm your password"
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {validationErrors.confirmPassword && (
            <span className="field-error">{validationErrors.confirmPassword}</span>
          )}
        </div>
        
        <button 
          type="submit" 
          className="auth-submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
        
        <div className="auth-footer">
          <span>Already have an account? </span>
          <button 
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToLogin}
            disabled={isSubmitting}
          >
            Sign In
          </button>
        </div>
        
        <div className="terms-notice">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;