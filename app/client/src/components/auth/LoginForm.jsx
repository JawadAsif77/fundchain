import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { validateEmail, validateRequired } from '../../utils/validation';
import './AuthForms.css';

const LoginForm = ({ onSwitchToRegister, onClose }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});
  
  const { login, error, clearError } = useAuth();

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
    // TODO: Implement forgot password functionality
    alert('Forgot password functionality will be implemented soon.');
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
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing In...' : 'Sign In'}
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
    </div>
  );
};

export default LoginForm;